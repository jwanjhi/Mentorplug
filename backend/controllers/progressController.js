const pool = require('../config/db');
const {
  notifyMilestoneSubmittedForReview,
  notifyMilestoneApproved,
  notifyMilestoneChangesRequested,
} = require('../services/emailService');

/* ─────────────────────────────────────────────────────────────────────────────
   Milestone review workflow (enforced here, not just in the UI):

     in_progress ──(mentee submits: all tasks done + note)──▶ pending_review
     pending_review ──(mentor approves)──────────────────────▶ completed
     pending_review ──(mentor requests changes + reason)────▶ in_progress
     completed ──(mentor reopens)───────────────────────────▶ in_progress

   While a milestone is pending_review or completed it is locked: its details
   and checklist cannot be changed. Every transition is recorded in
   mentorship_goal_reviews.
   ───────────────────────────────────────────────────────────────────────────── */

const MAX_NOTE_LENGTH = 2000;
const MAX_URL_LENGTH = 500;

const httpError = (status, message) => {
  const error = new Error(message);
  error.status = status;
  return error;
};

const sendError = (res, err, label) => {
  if (!err.status) console.error(`${label} error:`, err);
  return res.status(err.status || 500).json({ error: err.status ? err.message : 'Server error' });
};

/* ─────────────────────────────────────────────────────────────────────────────
   Helper: verify match existence, accepted status, and user participation
   ───────────────────────────────────────────────────────────────────────────── */
const verifyMatchAccess = async (matchID, accountID) => {
  const matchRes = await pool.query(
    `SELECT m."matchID", m."menteeID", m."mentorID", m.status,
            mentee.name AS mentee_name, mentee.email AS mentee_email,
            mentor.name AS mentor_name, mentor.email AS mentor_email
     FROM matches m
     JOIN account mentee ON mentee."accountID" = m."menteeID"
     JOIN account mentor ON mentor."accountID" = m."mentorID"
     WHERE m."matchID" = $1`,
    [matchID]
  );

  if (matchRes.rows.length === 0) {
    throw httpError(404, 'Mentorship connection not found');
  }

  const match = matchRes.rows[0];

  if (match.menteeID !== accountID && match.mentorID !== accountID) {
    throw httpError(403, 'You are not an authorized participant in this mentorship connection');
  }

  if (match.status !== 'accepted') {
    throw httpError(400, 'Progress tracking is only available for accepted mentorship connections');
  }

  return match;
};

/* Helper: load a goal and check the caller belongs to its match */
const loadGoalWithAccess = async (goalIDParam, accountID) => {
  const goalID = parseInt(goalIDParam, 10);
  if (isNaN(goalID)) throw httpError(400, 'Invalid goal ID');

  const goalRes = await pool.query(
    `SELECT "goalID", "matchID", title, status FROM mentorship_goals WHERE "goalID" = $1`,
    [goalID]
  );
  if (goalRes.rows.length === 0) throw httpError(404, 'Milestone not found');

  const goal = goalRes.rows[0];
  const match = await verifyMatchAccess(goal.matchID, accountID);
  return { goal, match, isMentor: accountID === match.mentorID };
};

const assertUnlocked = (goal) => {
  if (goal.status === 'pending_review') {
    throw httpError(409, 'This milestone is awaiting mentor review and cannot be changed. The mentor must approve it or request changes first.');
  }
  if (goal.status === 'completed') {
    throw httpError(409, 'This milestone has been approved and is locked. The mentor can reopen it if changes are needed.');
  }
};

const cleanNote = (value, { required, field }) => {
  const text = typeof value === 'string' ? value.trim() : '';
  if (required && !text) throw httpError(400, `${field} is required`);
  if (text.length > MAX_NOTE_LENGTH) throw httpError(400, `${field} must be ${MAX_NOTE_LENGTH} characters or fewer`);
  return text || null;
};

const cleanEvidenceUrl = (value) => {
  const text = typeof value === 'string' ? value.trim() : '';
  if (!text) return null;
  if (text.length > MAX_URL_LENGTH) throw httpError(400, `Evidence link must be ${MAX_URL_LENGTH} characters or fewer`);
  let parsed;
  try {
    parsed = new URL(text);
  } catch {
    throw httpError(400, 'Evidence link must be a valid URL');
  }
  if (!['http:', 'https:'].includes(parsed.protocol)) {
    throw httpError(400, 'Evidence link must start with http:// or https://');
  }
  return parsed.toString();
};

/* Moves a goal from one of `fromStatuses` to a new status atomically.
   Returns the updated row, or throws 409 if another request changed it first. */
const transitionGoal = async (client, goalID, fromStatuses, setSql, params) => {
  const res = await client.query(
    `UPDATE mentorship_goals
     SET ${setSql}, "updatedAt" = CURRENT_TIMESTAMP
     WHERE "goalID" = $1 AND status = ANY($2::text[])
     RETURNING "goalID", "matchID", title, description,
               TO_CHAR(target_date, 'YYYY-MM-DD') AS target_date,
               status, "createdBy", reviewed_at, review_notes,
               submission_note, evidence_url, submitted_at, "createdAt", "updatedAt"`,
    [goalID, fromStatuses, ...params]
  );
  if (res.rows.length === 0) {
    throw httpError(409, 'This milestone was changed by someone else. Refresh and try again.');
  }
  return res.rows[0];
};

const recordReview = (client, goalID, actorID, action, notes = null, evidenceUrl = null) =>
  client.query(
    `INSERT INTO mentorship_goal_reviews ("goalID", "actorID", action, notes, evidence_url)
     VALUES ($1, $2, $3, $4, $5)`,
    [goalID, actorID, action, notes, evidenceUrl]
  );

/* Runs fn(client) inside a transaction */
const withTransaction = async (fn) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    throw err;
  } finally {
    client.release();
  }
};

/* ─────────────────────────────────────────────────────────────────────────────
   Helper: calculate overall progress stats
   ───────────────────────────────────────────────────────────────────────────── */
const calculateStats = (goals) => {
  const totalGoals = goals.length;
  const completedGoals = goals.filter((g) => g.status === 'completed').length;
  const pendingReviewGoals = goals.filter((g) => g.status === 'pending_review').length;

  let totalTasks = 0;
  let completedTasks = 0;

  for (const g of goals) {
    const items = g.action_items || [];
    totalTasks += items.length;
    completedTasks += items.filter((i) => i.is_completed).length;
  }

  let percentage = 0;
  if (totalTasks > 0) {
    percentage = Math.round((completedTasks / totalTasks) * 100);
  } else if (totalGoals > 0) {
    percentage = Math.round((completedGoals / totalGoals) * 100);
  }

  return {
    totalGoals,
    completedGoals,
    pendingReviewGoals,
    totalTasks,
    completedTasks,
    percentage,
  };
};

/* ─────────────────────────────────────────────────────────────────────────────
   GET /api/progress/:matchId
   Fetch goals, action items, review history and calculated progress for a match
   ───────────────────────────────────────────────────────────────────────────── */
const getMatchProgress = async (req, res) => {
  try {
    const accountID = req.user.accountID;
    const matchID = parseInt(req.params.matchId, 10);

    if (isNaN(matchID)) {
      return res.status(400).json({ error: 'Invalid match ID parameter' });
    }

    const match = await verifyMatchAccess(matchID, accountID);

    const goalsRes = await pool.query(
      `SELECT g."goalID", g."matchID", g.title, g.description,
              TO_CHAR(g.target_date, 'YYYY-MM-DD') AS target_date,
              g.status, g."createdBy", g.reviewed_at, g.review_notes,
              g.submission_note, g.evidence_url, g.submitted_at,
              g."createdAt", g."updatedAt",
              creator.name AS creator_name, creator.role AS creator_role
       FROM mentorship_goals g
       JOIN account creator ON creator."accountID" = g."createdBy"
       WHERE g."matchID" = $1
       ORDER BY g.target_date ASC NULLS LAST, g."createdAt" ASC`,
      [matchID]
    );

    const goalIds = goalsRes.rows.map((r) => r.goalID);
    const itemsByGoal = {};
    const historyByGoal = {};

    if (goalIds.length > 0) {
      const [itemsRes, historyRes] = await Promise.all([
        pool.query(
          `SELECT "itemID", "goalID", task_text, is_completed, completed_at, "createdAt"
           FROM mentorship_action_items
           WHERE "goalID" = ANY($1::int[])
           ORDER BY "itemID" ASC`,
          [goalIds]
        ),
        pool.query(
          `SELECT r."reviewID", r."goalID", r.action, r.notes, r.evidence_url, r."createdAt",
                  a.name AS actor_name, a.role AS actor_role
           FROM mentorship_goal_reviews r
           JOIN account a ON a."accountID" = r."actorID"
           WHERE r."goalID" = ANY($1::int[])
           ORDER BY r."createdAt" ASC, r."reviewID" ASC`,
          [goalIds]
        ),
      ]);

      for (const item of itemsRes.rows) {
        (itemsByGoal[item.goalID] ||= []).push(item);
      }
      for (const entry of historyRes.rows) {
        (historyByGoal[entry.goalID] ||= []).push(entry);
      }
    }

    const goals = goalsRes.rows.map((g) => ({
      ...g,
      action_items: itemsByGoal[g.goalID] || [],
      review_history: historyByGoal[g.goalID] || [],
    }));

    const isMentor = accountID === match.mentorID;

    return res.status(200).json({
      matchID,
      isMentor,
      partner: {
        name: isMentor ? match.mentee_name : match.mentor_name,
        role: isMentor ? 'Mentee' : 'Mentor',
      },
      stats: calculateStats(goals),
      goals,
    });
  } catch (err) {
    return sendError(res, err, 'getMatchProgress');
  }
};

/* ─────────────────────────────────────────────────────────────────────────────
   POST /api/progress/:matchId
   Create a new goal / milestone with optional initial tasks
   ───────────────────────────────────────────────────────────────────────────── */
const createGoal = async (req, res) => {
  try {
    const accountID = req.user.accountID;
    const matchID = parseInt(req.params.matchId, 10);
    const { title, description, target_date, tasks } = req.body;

    if (isNaN(matchID)) {
      return res.status(400).json({ error: 'Invalid match ID' });
    }

    if (!title || !title.trim()) {
      return res.status(400).json({ error: 'Milestone title is required' });
    }

    await verifyMatchAccess(matchID, accountID);

    const insertGoalRes = await pool.query(
      `INSERT INTO mentorship_goals ("matchID", title, description, target_date, status, "createdBy")
       VALUES ($1, $2, $3, $4, 'in_progress', $5)
       RETURNING "goalID", "matchID", title, description,
                 TO_CHAR(target_date, 'YYYY-MM-DD') AS target_date,
                 status, "createdBy", reviewed_at, review_notes, "createdAt", "updatedAt"`,
      [
        matchID,
        title.trim(),
        description ? description.trim() : null,
        target_date ? target_date : null,
        accountID,
      ]
    );

    const newGoal = insertGoalRes.rows[0];
    const createdItems = [];

    if (Array.isArray(tasks) && tasks.length > 0) {
      for (const t of tasks) {
        const text = typeof t === 'string' ? t.trim() : (t?.task_text || '').trim();
        if (text) {
          const itemRes = await pool.query(
            `INSERT INTO mentorship_action_items ("goalID", task_text)
             VALUES ($1, $2)
             RETURNING "itemID", "goalID", task_text, is_completed, completed_at, "createdAt"`,
            [newGoal.goalID, text]
          );
          createdItems.push(itemRes.rows[0]);
        }
      }
    }

    newGoal.action_items = createdItems;
    newGoal.review_history = [];

    return res.status(201).json({
      message: 'Milestone created successfully',
      goal: newGoal,
    });
  } catch (err) {
    return sendError(res, err, 'createGoal');
  }
};

/* ─────────────────────────────────────────────────────────────────────────────
   PATCH /api/progress/goals/:goalId
   Edit milestone title, description or target date.
   Status changes go through /submit, /review and /reopen instead.
   ───────────────────────────────────────────────────────────────────────────── */
const updateGoal = async (req, res) => {
  try {
    const { title, description, target_date, status } = req.body;

    if (status !== undefined) {
      return res.status(400).json({
        error: 'Milestone status cannot be set directly. Use submit for review (mentee) or review/reopen (mentor).',
      });
    }

    const { goal } = await loadGoalWithAccess(req.params.goalId, req.user.accountID);
    assertUnlocked(goal);

    if (title !== undefined && (typeof title !== 'string' || !title.trim())) {
      return res.status(400).json({ error: 'Milestone title cannot be empty' });
    }

    const updated = await transitionGoal(
      pool,
      goal.goalID,
      ['pending', 'in_progress'],
      `title = COALESCE($3, title),
       description = CASE WHEN $4::boolean THEN $5 ELSE description END,
       target_date = CASE WHEN $6::boolean THEN $7::date ELSE target_date END`,
      [
        title ? title.trim() : null,
        description !== undefined,
        description ? String(description).trim() : null,
        target_date !== undefined,
        target_date || null,
      ]
    );

    return res.status(200).json({ message: 'Milestone updated successfully', goal: updated });
  } catch (err) {
    return sendError(res, err, 'updateGoal');
  }
};

/* ─────────────────────────────────────────────────────────────────────────────
   POST /api/progress/goals/:goalId/submit
   Mentee submits a finished milestone for review with a note and optional link.
   ───────────────────────────────────────────────────────────────────────────── */
const submitGoal = async (req, res) => {
  try {
    const accountID = req.user.accountID;
    const { goal, match, isMentor } = await loadGoalWithAccess(req.params.goalId, accountID);

    if (isMentor) {
      return res.status(403).json({ error: 'Only the mentee can submit a milestone for review.' });
    }
    assertUnlocked(goal);

    const note = cleanNote(req.body?.note, { required: true, field: 'A note describing what you completed' });
    const evidenceUrl = cleanEvidenceUrl(req.body?.evidence_url);

    const updated = await withTransaction(async (client) => {
      const openTasks = await client.query(
        `SELECT COUNT(*)::int AS open FROM mentorship_action_items
         WHERE "goalID" = $1 AND is_completed = FALSE`,
        [goal.goalID]
      );
      if (openTasks.rows[0].open > 0) {
        throw httpError(400, 'Complete every task in this milestone before submitting it for review.');
      }

      const row = await transitionGoal(
        client,
        goal.goalID,
        ['pending', 'in_progress'],
        `status = 'pending_review', submission_note = $3, evidence_url = $4,
         submitted_at = CURRENT_TIMESTAMP, review_notes = NULL, reviewed_at = NULL`,
        [note, evidenceUrl]
      );
      await recordReview(client, goal.goalID, accountID, 'submitted', note, evidenceUrl);
      return row;
    });

    notifyMilestoneSubmittedForReview({
      mentorEmail: match.mentor_email,
      mentorName: match.mentor_name,
      menteeName: match.mentee_name,
      milestoneTitle: updated.title,
      submissionNote: note,
      evidenceUrl,
    }).catch((e) => console.warn('Review notification error:', e.message));

    return res.status(200).json({ message: 'Submitted for mentor review', goal: updated });
  } catch (err) {
    return sendError(res, err, 'submitGoal');
  }
};

/* ─────────────────────────────────────────────────────────────────────────────
   POST /api/progress/goals/:goalId/review
   Mentor decision on a submitted milestone: 'approve' or 'request_changes'
   ───────────────────────────────────────────────────────────────────────────── */
const reviewGoal = async (req, res) => {
  try {
    const accountID = req.user.accountID;
    const { decision } = req.body || {};

    if (!['approve', 'request_changes'].includes(decision)) {
      return res.status(400).json({ error: "Decision must be 'approve' or 'request_changes'" });
    }

    const { goal, match, isMentor } = await loadGoalWithAccess(req.params.goalId, accountID);

    if (!isMentor) {
      return res.status(403).json({ error: 'Only the assigned mentor can review and approve milestones.' });
    }
    if (goal.status !== 'pending_review') {
      return res.status(409).json({
        error: 'Only milestones the mentee has submitted for review can be approved or sent back.',
      });
    }

    const approve = decision === 'approve';
    const notes = cleanNote(req.body?.notes, {
      required: !approve,
      field: approve ? 'Review notes' : 'An explanation of the changes needed',
    });

    const updated = await withTransaction(async (client) => {
      const row = await transitionGoal(
        client,
        goal.goalID,
        ['pending_review'],
        `status = $3::text, review_notes = $4,
         reviewed_at = CASE WHEN $3::text = 'completed' THEN CURRENT_TIMESTAMP ELSE NULL END`,
        [approve ? 'completed' : 'in_progress', notes]
      );
      await recordReview(client, goal.goalID, accountID, approve ? 'approved' : 'changes_requested', notes);
      return row;
    });

    const notify = approve ? notifyMilestoneApproved : notifyMilestoneChangesRequested;
    notify({
      menteeEmail: match.mentee_email,
      menteeName: match.mentee_name,
      mentorName: match.mentor_name,
      milestoneTitle: updated.title,
      reviewNotes: notes,
    }).catch((e) => console.warn('Review decision notification error:', e.message));

    return res.status(200).json({
      message: approve ? 'Milestone approved and verified!' : 'Revision requested from mentee',
      goal: updated,
    });
  } catch (err) {
    return sendError(res, err, 'reviewGoal');
  }
};

/* ─────────────────────────────────────────────────────────────────────────────
   POST /api/progress/goals/:goalId/reopen
   Mentor reopens an approved milestone so it can be changed again.
   ───────────────────────────────────────────────────────────────────────────── */
const reopenGoal = async (req, res) => {
  try {
    const accountID = req.user.accountID;
    const { goal, isMentor } = await loadGoalWithAccess(req.params.goalId, accountID);

    if (!isMentor) {
      return res.status(403).json({ error: 'Only the mentor can reopen an approved milestone.' });
    }
    if (goal.status !== 'completed') {
      return res.status(409).json({ error: 'Only approved milestones can be reopened.' });
    }

    const notes = cleanNote(req.body?.notes, { required: false, field: 'Reopen notes' });

    const updated = await withTransaction(async (client) => {
      const row = await transitionGoal(
        client,
        goal.goalID,
        ['completed'],
        `status = 'in_progress', reviewed_at = NULL, review_notes = $3`,
        [notes]
      );
      await recordReview(client, goal.goalID, accountID, 'reopened', notes);
      return row;
    });

    return res.status(200).json({ message: 'Milestone reopened', goal: updated });
  } catch (err) {
    return sendError(res, err, 'reopenGoal');
  }
};

/* ─────────────────────────────────────────────────────────────────────────────
   DELETE /api/progress/goals/:goalId
   Delete a milestone and its action items.
   Mentees cannot delete milestones under review or already approved.
   ───────────────────────────────────────────────────────────────────────────── */
const deleteGoal = async (req, res) => {
  try {
    const { goal, isMentor } = await loadGoalWithAccess(req.params.goalId, req.user.accountID);

    if (!isMentor) assertUnlocked(goal);

    await pool.query('DELETE FROM mentorship_goals WHERE "goalID" = $1', [goal.goalID]);

    return res.status(200).json({ message: 'Milestone deleted successfully' });
  } catch (err) {
    return sendError(res, err, 'deleteGoal');
  }
};

/* ─────────────────────────────────────────────────────────────────────────────
   POST /api/progress/goals/:goalId/items
   Add an action item to an unlocked milestone
   ───────────────────────────────────────────────────────────────────────────── */
const addActionItem = async (req, res) => {
  try {
    const { task_text } = req.body;

    if (!task_text || typeof task_text !== 'string' || !task_text.trim()) {
      return res.status(400).json({ error: 'Task text is required' });
    }

    const { goal } = await loadGoalWithAccess(req.params.goalId, req.user.accountID);
    assertUnlocked(goal);

    const itemRes = await pool.query(
      `INSERT INTO mentorship_action_items ("goalID", task_text)
       VALUES ($1, $2)
       RETURNING "itemID", "goalID", task_text, is_completed, completed_at, "createdAt"`,
      [goal.goalID, task_text.trim()]
    );

    return res.status(201).json({ message: 'Action item added', item: itemRes.rows[0] });
  } catch (err) {
    return sendError(res, err, 'addActionItem');
  }
};

/* Helper: load an action item with its goal and check access + lock */
const loadUnlockedItem = async (itemIDParam, accountID) => {
  const itemID = parseInt(itemIDParam, 10);
  if (isNaN(itemID)) throw httpError(400, 'Invalid item ID');

  const itemRes = await pool.query(
    `SELECT i."itemID", i."goalID", i.is_completed, g."matchID", g.status AS goal_status
     FROM mentorship_action_items i
     JOIN mentorship_goals g ON g."goalID" = i."goalID"
     WHERE i."itemID" = $1`,
    [itemID]
  );
  if (itemRes.rows.length === 0) throw httpError(404, 'Action item not found');

  const item = itemRes.rows[0];
  await verifyMatchAccess(item.matchID, accountID);
  assertUnlocked({ status: item.goal_status });
  return item;
};

/* ─────────────────────────────────────────────────────────────────────────────
   PATCH /api/progress/items/:itemId/toggle
   Tick or untick an action item. Never changes the milestone status:
   the mentee submits explicitly once every task is done.
   ───────────────────────────────────────────────────────────────────────────── */
const toggleActionItem = async (req, res) => {
  try {
    const item = await loadUnlockedItem(req.params.itemId, req.user.accountID);

    const updateRes = await pool.query(
      `UPDATE mentorship_action_items
       SET is_completed = NOT is_completed,
           completed_at = CASE WHEN NOT is_completed THEN CURRENT_TIMESTAMP ELSE NULL END
       WHERE "itemID" = $1
       RETURNING "itemID", "goalID", task_text, is_completed, completed_at, "createdAt"`,
      [item.itemID]
    );

    const remaining = await pool.query(
      `SELECT COUNT(*)::int AS open FROM mentorship_action_items
       WHERE "goalID" = $1 AND is_completed = FALSE`,
      [item.goalID]
    );

    const updated = updateRes.rows[0];
    return res.status(200).json({
      message: updated.is_completed ? 'Task completed' : 'Task uncompleted',
      item: updated,
      allGoalTasksCompleted: remaining.rows[0].open === 0,
    });
  } catch (err) {
    return sendError(res, err, 'toggleActionItem');
  }
};

/* ─────────────────────────────────────────────────────────────────────────────
   DELETE /api/progress/items/:itemId
   Delete an action item from an unlocked milestone
   ───────────────────────────────────────────────────────────────────────────── */
const deleteActionItem = async (req, res) => {
  try {
    const item = await loadUnlockedItem(req.params.itemId, req.user.accountID);

    await pool.query('DELETE FROM mentorship_action_items WHERE "itemID" = $1', [item.itemID]);

    return res.status(200).json({ message: 'Action item deleted successfully' });
  } catch (err) {
    return sendError(res, err, 'deleteActionItem');
  }
};

module.exports = {
  getMatchProgress,
  createGoal,
  updateGoal,
  submitGoal,
  reviewGoal,
  reopenGoal,
  deleteGoal,
  addActionItem,
  toggleActionItem,
  deleteActionItem,
};
