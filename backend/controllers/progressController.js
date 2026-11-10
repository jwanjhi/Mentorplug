const pool = require('../config/db');

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
              g.status, g."createdBy", g."createdAt", g."updatedAt",
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

    const partnerName = accountID === match.menteeID ? match.mentor_name : match.mentee_name;
    const partnerRole = accountID === match.menteeID ? 'Mentor' : 'Mentee';

    return res.status(200).json({
      matchID,
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
                 status, "createdBy", "createdAt", "updatedAt"`,
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
   ───────────────────────────────────────────────────────────────────────────── */
const updateGoal = async (req, res) => {
  try {
    const accountID = req.user.accountID;
    const goalID = parseInt(req.params.goalId, 10);
    const { title, description, target_date, status } = req.body;

    if (isNaN(goalID)) {
      return res.status(400).json({ error: 'Invalid goal ID' });
    }

    // Verify goal exists and user has access
    const goalRes = await pool.query(
      `SELECT g."goalID", g."matchID" FROM mentorship_goals g WHERE g."goalID" = $1`,
      [goalID]
    );
    if (goalRes.rows.length === 0) {
      return res.status(404).json({ error: 'Milestone not found' });
    }

    await verifyMatchAccess(goalRes.rows[0].matchID, accountID);

    if (status && !['pending', 'in_progress', 'completed'].includes(status)) {
      return res.status(400).json({ error: 'Status must be pending, in_progress, or completed' });
    }

    const updateRes = await pool.query(
      `UPDATE mentorship_goals
       SET title = COALESCE($1, title),
           description = CASE WHEN $2 IS NOT NULL THEN $2 ELSE description END,
           target_date = CASE WHEN $3 IS NOT NULL THEN $3 ELSE target_date END,
           status = COALESCE($4, status),
           "updatedAt" = CURRENT_TIMESTAMP
       WHERE "goalID" = $5
       RETURNING "goalID", "matchID", title, description,
                 TO_CHAR(target_date, 'YYYY-MM-DD') AS target_date,
                 status, "createdBy", "createdAt", "updatedAt"`,
      [
        title ? title.trim() : null,
        description !== undefined ? (description ? description.trim() : null) : null,
        target_date !== undefined ? (target_date || null) : null,
        status || null,
        goalID,
      ]
    );

    return res.status(200).json({
      message: 'Milestone updated successfully',
      goal: updateRes.rows[0],
    });
  } catch (err) {
    console.error('updateGoal error:', err);
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

    // If goal was previously marked completed, reopen to in_progress now that a new task was added
    await pool.query(
      `UPDATE mentorship_goals SET status = 'in_progress', "updatedAt" = CURRENT_TIMESTAMP
       WHERE "goalID" = $1 AND status = 'completed'`,
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
   ───────────────────────────────────────────────────────────────────────────── */
const toggleActionItem = async (req, res) => {
  try {
    const accountID = req.user.accountID;
    const itemID = parseInt(req.params.itemId, 10);

    if (isNaN(itemID)) {
      return res.status(400).json({ error: 'Invalid item ID' });
    }

    const itemRes = await pool.query(
      `SELECT i."itemID", i."goalID", i.is_completed, g."matchID"
       FROM mentorship_action_items i
       JOIN mentorship_goals g ON g."goalID" = i."goalID"
       WHERE i."itemID" = $1`,
      [itemID]
    );

    if (itemRes.rows.length === 0) {
      return res.status(404).json({ error: 'Action item not found' });
    }

    const item = itemRes.rows[0];
    await verifyMatchAccess(item.matchID, accountID);

    const newCompleted = !item.is_completed;
    const updateRes = await pool.query(
      `UPDATE mentorship_action_items
       SET is_completed = $1,
           completed_at = CASE WHEN $1 = TRUE THEN CURRENT_TIMESTAMP ELSE NULL END
       WHERE "itemID" = $2
       RETURNING "itemID", "goalID", task_text, is_completed, completed_at, "createdAt"`,
      [newCompleted, itemID]
    );

    // Auto-update goal status if all tasks are complete
    const allItemsRes = await pool.query(
      `SELECT is_completed FROM mentorship_action_items WHERE "goalID" = $1`,
      [item.goalID]
    );
    const allTasks = allItemsRes.rows;
    const allCompleted = allTasks.length > 0 && allTasks.every((t) => t.is_completed);

    if (allCompleted) {
      await pool.query(
        `UPDATE mentorship_goals SET status = 'completed', "updatedAt" = CURRENT_TIMESTAMP WHERE "goalID" = $1`,
        [item.goalID]
      );
    } else {
      await pool.query(
        `UPDATE mentorship_goals SET status = 'in_progress', "updatedAt" = CURRENT_TIMESTAMP WHERE "goalID" = $1 AND status = 'completed'`,
        [item.goalID]
      );
    }

    return res.status(200).json({
      message: newCompleted ? 'Task completed' : 'Task uncompleted',
      item: updateRes.rows[0],
      allGoalTasksCompleted: allCompleted,
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
  deleteGoal,
  addActionItem,
  toggleActionItem,
  deleteActionItem,
};
