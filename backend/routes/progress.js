const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/auth');
const {
  getMatchProgress,
  createGoal,
  updateGoal,
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

// PATCH  /api/progress/goals/:goalId     — update milestone details or status
router.patch('/goals/:goalId', updateGoal);

// DELETE /api/progress/goals/:goalId     — delete a milestone
router.delete('/goals/:goalId', deleteGoal);

// POST   /api/progress/goals/:goalId/items — add an action item to a goal
router.post('/goals/:goalId/items', addActionItem);

// PATCH  /api/progress/items/:itemId/toggle — toggle action item completion
router.patch('/items/:itemId/toggle', toggleActionItem);

// DELETE /api/progress/items/:itemId      — delete an action item
router.delete('/items/:itemId', deleteActionItem);

module.exports = router;
