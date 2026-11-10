const pool = require('../config/db');
const {
  notifyMilestoneSubmittedForReview,
  notifyMilestoneApproved,
} = require('../services/emailService');

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
    const error = new Error('Mentorship connection not found');
    error.status = 404;
    throw error;
  }

  const match = matchRes.rows[0];

  if (match.menteeID !== accountID && match.mentorID !== accountID) {
    const error = new Error('You are not an authorized participant in this mentorship connection');
    error.status = 403;
    throw error;
  }

  if (match.status !== 'accepted') {
    const error = new Error('Progress tracking is only available for accepted mentorship connections');
    error.status = 400;
    throw error;
  }

  return match;
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
   Fetch goals, action items, and calculated progress for a match
   ───────────────────────────────────────────────────────────────────────────── */
const getMatchProgress = async (req, res) => {
  try {
    const accountID = req.user.accountID;
    const matchID = parseInt(req.params.matchId, 10);

    if (isNaN(matchID)) {
      return res.status(400).json({ error: 'Invalid match ID parameter' });
    }

    const match = await verifyMatchAccess(matchID, accountID);

    // Fetch goals
    const goalsRes = await pool.query(
      `SELECT g."goalID", g."matchID", g.title, g.description,
              TO_CHAR(g.target_date, 'YYYY-MM-DD') AS target_date,
              g.status, g."createdBy", g.reviewed_at, g.review_notes,
              g."createdAt", g."updatedAt",
              creator.name AS creator_name, creator.role AS creator_role
       FROM mentorship_goals g
       JOIN account creator ON creator."accountID" = g."createdBy"
       WHERE g."matchID" = $1
       ORDER BY g.target_date ASC NULLS LAST, g."createdAt" ASC`,
      [matchID]
    );

    const goalIds = goalsRes.rows.map((r) => r.goalID);

    // Fetch action items for these goals
    let itemsByGoal = {};
    if (goalIds.length > 0) {
      const itemsRes = await pool.query(
        `SELECT "itemID", "goalID", task_text, is_completed, completed_at, "createdAt"
         FROM mentorship_action_items
         WHERE "goalID" = ANY($1::int[])
         ORDER BY "itemID" ASC`,
        [goalIds]
      );

      for (const item of itemsRes.rows) {
        if (!itemsByGoal[item.goalID]) itemsByGoal[item.goalID] = [];
        itemsByGoal[item.goalID].push(item);
      }
    }

    const goals = goalsRes.rows.map((g) => ({
      ...g,
      action_items: itemsByGoal[g.goalID] || [],
    }));

    const stats = calculateStats(goals);

    const isMentor = accountID === match.mentorID;
    const partnerName = isMentor ? match.mentee_name : match.mentor_name;
    const partnerRole = isMentor ? 'Mentee' : 'Mentor';

    return res.status(200).json({
      matchID,
      isMentor,
      partner: {
        name: partnerName,
        role: partnerRole,
      },
      stats,
      goals,
    });
  } catch (err) {
    console.error('getMatchProgress error:', err);
    return res.status(err.status || 500).json({ error: err.message || 'Server error' });
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

    // Insert goal
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

    // Insert any initial action items if provided
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

    return res.status(201).json({
      message: 'Milestone created successfully',
      goal: newGoal,
    });
  } catch (err) {
    console.error('createGoal error:', err);
    return res.status(err.status || 500).json({ error: err.message || 'Server error' });
  }
};

/* ─────────────────────────────────────────────────────────────────────────────
   PATCH /api/progress/goals/:goalId
   Update milestone title, description, target date, or status
   Enforces Mentor Approval:
   - If mentee marks "completed", it routes to "pending_review" and notifies mentor
   - If mentor marks "completed", it immediately completes and notifies mentee
   ───────────────────────────────────────────────────────────────────────────── */
const updateGoal = async (req, res) => {
  try {
    const accountID = req.user.accountID;
    const goalID = parseInt(req.params.goalId, 10);
    let { title, description, target_date, status } = req.body;

    if (isNaN(goalID)) {
      return res.status(400).json({ error: 'Invalid goal ID' });
    }

    // Verify goal exists and user has access
    const goalRes = await pool.query(
      `SELECT g."goalID", g."matchID", g.title, g.status FROM mentorship_goals g WHERE g."goalID" = $1`,
      [goalID]
    );
    if (goalRes.rows.length === 0) {
      return res.status(404).json({ error: 'Milestone not found' });
    }

    const currentGoal = goalRes.rows[0];
    const match = await verifyMatchAccess(currentGoal.matchID, accountID);
    const isMentor = accountID === match.mentorID;

    if (status && !['pending', 'in_progress', 'pending_review', 'completed'].includes(status)) {
      return res.status(400).json({ error: 'Invalid milestone status' });
    }

    // Mentee cannot directly self-certify completion
    let shouldNotifyMentor = false;
    let shouldNotifyMentee = false;

    if (status === 'completed' && !isMentor) {
      status = 'pending_review';
      shouldNotifyMentor = true;
    } else if (status === 'pending_review' && !isMentor) {
      shouldNotifyMentor = true;
    } else if (status === 'completed' && isMentor) {
      shouldNotifyMentee = true;
    }

    const updateRes = await pool.query(
      `UPDATE mentorship_goals
       SET title = COALESCE($1, title),
           description = CASE WHEN $2 IS NOT NULL THEN $2 ELSE description END,
           target_date = CASE WHEN $3 IS NOT NULL THEN $3 ELSE target_date END,
           status = COALESCE($4, status),
           reviewed_at = CASE WHEN $4 = 'completed' AND $6 = TRUE THEN CURRENT_TIMESTAMP ELSE reviewed_at END,
           "updatedAt" = CURRENT_TIMESTAMP
       WHERE "goalID" = $5
       RETURNING "goalID", "matchID", title, description,
                 TO_CHAR(target_date, 'YYYY-MM-DD') AS target_date,
                 status, "createdBy", reviewed_at, review_notes, "createdAt", "updatedAt"`,
      [
        title ? title.trim() : null,
        description !== undefined ? (description ? description.trim() : null) : null,
        target_date !== undefined ? (target_date || null) : null,
        status || null,
        goalID,
        isMentor,
      ]
    );

    const updatedGoal = updateRes.rows[0];

    // Asynchronously dispatch notifications
    if (shouldNotifyMentor) {
      notifyMilestoneSubmittedForReview({
        mentorEmail: match.mentor_email,
        mentorName: match.mentor_name,
        menteeName: match.mentee_name,
        milestoneTitle: updatedGoal.title,
      }).catch((e) => console.warn('Review notification error:', e.message));
    } else if (shouldNotifyMentee) {
      notifyMilestoneApproved({
        menteeEmail: match.mentee_email,
        menteeName: match.mentee_name,
        mentorName: match.mentor_name,
        milestoneTitle: updatedGoal.title,
        reviewNotes: updatedGoal.review_notes,
      }).catch((e) => console.warn('Approval notification error:', e.message));
    }

    return res.status(200).json({
      message: status === 'pending_review' ? 'Submitted for mentor review' : 'Milestone updated successfully',
      goal: updatedGoal,
    });
  } catch (err) {
    console.error('updateGoal error:', err);
    return res.status(err.status || 500).json({ error: err.message || 'Server error' });
  }
};

/* ─────────────────────────────────────────────────────────────────────────────
   POST /api/progress/goals/:goalId/review
   Mentor decision: 'approve' or 'request_changes'
   ───────────────────────────────────────────────────────────────────────────── */
const reviewGoal = async (req, res) => {
  try {
    const accountID = req.user.accountID;
    const goalID = parseInt(req.params.goalId, 10);
    const { decision, notes } = req.body;

    if (isNaN(goalID)) {
      return res.status(400).json({ error: 'Invalid goal ID' });
    }

    if (!['approve', 'request_changes'].includes(decision)) {
      return res.status(400).json({ error: "Decision must be 'approve' or 'request_changes'" });
    }

    const goalRes = await pool.query(
      `SELECT g."goalID", g."matchID", g.title FROM mentorship_goals g WHERE g."goalID" = $1`,
      [goalID]
    );
    if (goalRes.rows.length === 0) {
      return res.status(404).json({ error: 'Milestone not found' });
    }

    const currentGoal = goalRes.rows[0];
    const match = await verifyMatchAccess(currentGoal.matchID, accountID);

    if (accountID !== match.mentorID) {
      return res.status(403).json({ error: 'Only the assigned mentor can review and approve milestones.' });
    }

    const newStatus = decision === 'approve' ? 'completed' : 'in_progress';
    const trimmedNotes = notes ? notes.trim() : null;

    const updateRes = await pool.query(
      `UPDATE mentorship_goals
       SET status = $1,
           reviewed_at = CASE WHEN $1 = 'completed' THEN CURRENT_TIMESTAMP ELSE NULL END,
           review_notes = $2,
           "updatedAt" = CURRENT_TIMESTAMP
       WHERE "goalID" = $3
       RETURNING "goalID", "matchID", title, description,
                 TO_CHAR(target_date, 'YYYY-MM-DD') AS target_date,
                 status, "createdBy", reviewed_at, review_notes, "createdAt", "updatedAt"`,
      [newStatus, trimmedNotes, goalID]
    );

    const updatedGoal = updateRes.rows[0];

    if (decision === 'approve') {
      notifyMilestoneApproved({
        menteeEmail: match.mentee_email,
        menteeName: match.mentee_name,
        mentorName: match.mentor_name,
        milestoneTitle: updatedGoal.title,
        reviewNotes: trimmedNotes,
      }).catch((e) => console.warn('Approval notification error:', e.message));
    }

    return res.status(200).json({
      message: decision === 'approve' ? 'Milestone approved and verified!' : 'Revision requested from mentee',
      goal: updatedGoal,
    });
  } catch (err) {
    console.error('reviewGoal error:', err);
    return res.status(err.status || 500).json({ error: err.message || 'Server error' });
  }
};

/* ─────────────────────────────────────────────────────────────────────────────
   DELETE /api/progress/goals/:goalId
   Delete a milestone and its action items
   ───────────────────────────────────────────────────────────────────────────── */
const deleteGoal = async (req, res) => {
  try {
    const accountID = req.user.accountID;
    const goalID = parseInt(req.params.goalId, 10);

    if (isNaN(goalID)) {
      return res.status(400).json({ error: 'Invalid goal ID' });
    }

    const goalRes = await pool.query(
      `SELECT g."goalID", g."matchID" FROM mentorship_goals g WHERE g."goalID" = $1`,
      [goalID]
    );
    if (goalRes.rows.length === 0) {
      return res.status(404).json({ error: 'Milestone not found' });
    }

    await verifyMatchAccess(goalRes.rows[0].matchID, accountID);

    await pool.query('DELETE FROM mentorship_goals WHERE "goalID" = $1', [goalID]);

    return res.status(200).json({ message: 'Milestone deleted successfully' });
  } catch (err) {
    console.error('deleteGoal error:', err);
    return res.status(err.status || 500).json({ error: err.message || 'Server error' });
  }
};

/* ─────────────────────────────────────────────────────────────────────────────
   POST /api/progress/goals/:goalId/items
   Add an action item to a milestone
   ───────────────────────────────────────────────────────────────────────────── */
const addActionItem = async (req, res) => {
  try {
    const accountID = req.user.accountID;
    const goalID = parseInt(req.params.goalId, 10);
    const { task_text } = req.body;

    if (isNaN(goalID)) {
      return res.status(400).json({ error: 'Invalid goal ID' });
    }

    if (!task_text || !task_text.trim()) {
      return res.status(400).json({ error: 'Task text is required' });
    }

    const goalRes = await pool.query(
      `SELECT g."goalID", g."matchID" FROM mentorship_goals g WHERE g."goalID" = $1`,
      [goalID]
    );
    if (goalRes.rows.length === 0) {
      return res.status(404).json({ error: 'Milestone not found' });
    }

    await verifyMatchAccess(goalRes.rows[0].matchID, accountID);

    const itemRes = await pool.query(
      `INSERT INTO mentorship_action_items ("goalID", task_text)
       VALUES ($1, $2)
       RETURNING "itemID", "goalID", task_text, is_completed, completed_at, "createdAt"`,
      [goalID, task_text.trim()]
    );

    // If goal was previously completed or pending_review, reopen to in_progress now that a new task was added
    await pool.query(
      `UPDATE mentorship_goals SET status = 'in_progress', "updatedAt" = CURRENT_TIMESTAMP
       WHERE "goalID" = $1 AND status IN ('completed', 'pending_review')`,
      [goalID]
    );

    return res.status(201).json({
      message: 'Action item added',
      item: itemRes.rows[0],
    });
  } catch (err) {
    console.error('addActionItem error:', err);
    return res.status(err.status || 500).json({ error: err.message || 'Server error' });
  }
};

/* ─────────────────────────────────────────────────────────────────────────────
   PATCH /api/progress/items/:itemId/toggle
   Toggle completion of an action item
   When all tasks are completed:
   - If user is mentee: moves to 'pending_review' and notifies mentor
   - If user is mentor: marks 'completed'
   ───────────────────────────────────────────────────────────────────────────── */
const toggleActionItem = async (req, res) => {
  try {
    const accountID = req.user.accountID;
    const itemID = parseInt(req.params.itemId, 10);

    if (isNaN(itemID)) {
      return res.status(400).json({ error: 'Invalid item ID' });
    }

    const itemRes = await pool.query(
      `SELECT i."itemID", i."goalID", i.is_completed, g."matchID", g.title AS goal_title
       FROM mentorship_action_items i
       JOIN mentorship_goals g ON g."goalID" = i."goalID"
       WHERE i."itemID" = $1`,
      [itemID]
    );

    if (itemRes.rows.length === 0) {
      return res.status(404).json({ error: 'Action item not found' });
    }

    const item = itemRes.rows[0];
    const match = await verifyMatchAccess(item.matchID, accountID);
    const isMentor = accountID === match.mentorID;

    const newCompleted = !item.is_completed;
    const updateRes = await pool.query(
      `UPDATE mentorship_action_items
       SET is_completed = $1,
           completed_at = CASE WHEN $1 = TRUE THEN CURRENT_TIMESTAMP ELSE NULL END
       WHERE "itemID" = $2
       RETURNING "itemID", "goalID", task_text, is_completed, completed_at, "createdAt"`,
      [newCompleted, itemID]
    );

    // Check all tasks under this goal
    const allItemsRes = await pool.query(
      `SELECT is_completed FROM mentorship_action_items WHERE "goalID" = $1`,
      [item.goalID]
    );
    const allTasks = allItemsRes.rows;
    const allCompleted = allTasks.length > 0 && allTasks.every((t) => t.is_completed);

    if (allCompleted) {
      // If mentee finished, require mentor review. If mentor clicked, approve directly.
      const targetStatus = isMentor ? 'completed' : 'pending_review';
      await pool.query(
        `UPDATE mentorship_goals 
         SET status = $1, 
             reviewed_at = CASE WHEN $1 = 'completed' THEN CURRENT_TIMESTAMP ELSE NULL END,
             "updatedAt" = CURRENT_TIMESTAMP 
         WHERE "goalID" = $2`,
        [targetStatus, item.goalID]
      );

      if (!isMentor) {
        notifyMilestoneSubmittedForReview({
          mentorEmail: match.mentor_email,
          mentorName: match.mentor_name,
          menteeName: match.mentee_name,
          milestoneTitle: item.goal_title,
        }).catch((e) => console.warn('Review notification error:', e.message));
      }
    } else {
      // If uncompleted an item and goal was previously completed/pending_review, reset to in_progress
      await pool.query(
        `UPDATE mentorship_goals SET status = 'in_progress', "updatedAt" = CURRENT_TIMESTAMP 
         WHERE "goalID" = $1 AND status IN ('completed', 'pending_review')`,
        [item.goalID]
      );
    }

    return res.status(200).json({
      message: newCompleted ? 'Task completed' : 'Task uncompleted',
      item: updateRes.rows[0],
      allGoalTasksCompleted: allCompleted,
      isPendingReview: allCompleted && !isMentor,
    });
  } catch (err) {
    console.error('toggleActionItem error:', err);
    return res.status(err.status || 500).json({ error: err.message || 'Server error' });
  }
};

/* ─────────────────────────────────────────────────────────────────────────────
   DELETE /api/progress/items/:itemId
   Delete an action item
   ───────────────────────────────────────────────────────────────────────────── */
const deleteActionItem = async (req, res) => {
  try {
    const accountID = req.user.accountID;
    const itemID = parseInt(req.params.itemId, 10);

    if (isNaN(itemID)) {
      return res.status(400).json({ error: 'Invalid item ID' });
    }

    const itemRes = await pool.query(
      `SELECT i."itemID", i."goalID", g."matchID"
       FROM mentorship_action_items i
       JOIN mentorship_goals g ON g."goalID" = i."goalID"
       WHERE i."itemID" = $1`,
      [itemID]
    );

    if (itemRes.rows.length === 0) {
      return res.status(404).json({ error: 'Action item not found' });
    }

    await verifyMatchAccess(itemRes.rows[0].matchID, accountID);

    await pool.query('DELETE FROM mentorship_action_items WHERE "itemID" = $1', [itemID]);

    return res.status(200).json({ message: 'Action item deleted successfully' });
  } catch (err) {
    console.error('deleteActionItem error:', err);
    return res.status(err.status || 500).json({ error: err.message || 'Server error' });
  }
};

module.exports = {
  getMatchProgress,
  createGoal,
  updateGoal,
  reviewGoal,
  deleteGoal,
  addActionItem,
  toggleActionItem,
  deleteActionItem,
};
