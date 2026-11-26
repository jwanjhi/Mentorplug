const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/auth');
const {
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
} = require('../controllers/progressController');

// All progress endpoints require valid authentication
router.use(authMiddleware);

// GET    /api/progress/:matchId          — retrieve goals, tasks, and progress %
router.get('/:matchId', getMatchProgress);

// POST   /api/progress/:matchId          — create a new goal / milestone
router.post('/:matchId', createGoal);

// PATCH  /api/progress/goals/:goalId     — edit milestone title, description, target date
router.patch('/goals/:goalId', updateGoal);

// POST   /api/progress/goals/:goalId/submit — mentee submits finished milestone (note + optional link)
router.post('/goals/:goalId/submit', submitGoal);

// POST   /api/progress/goals/:goalId/review — mentor decision on a submitted milestone (approve or request_changes)
router.post('/goals/:goalId/review', reviewGoal);

// POST   /api/progress/goals/:goalId/reopen — mentor reopens an approved milestone
router.post('/goals/:goalId/reopen', reopenGoal);

// DELETE /api/progress/goals/:goalId     — delete a milestone
router.delete('/goals/:goalId', deleteGoal);

// POST   /api/progress/goals/:goalId/items — add an action item to a goal
router.post('/goals/:goalId/items', addActionItem);

// PATCH  /api/progress/items/:itemId/toggle — toggle action item completion
router.patch('/items/:itemId/toggle', toggleActionItem);

// DELETE /api/progress/items/:itemId      — delete an action item
router.delete('/items/:itemId', deleteActionItem);

module.exports = router;
