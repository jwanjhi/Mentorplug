const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/auth');
const {
  submitFeedback,
  getMatchFeedback,
  getMyFeedback,
  getFeedbackSummary,
} = require('../controllers/feedbackController');

// POST /api/feedback             — submit or update 1-5 star rating and comment
router.post('/', authMiddleware, submitFeedback);

// GET  /api/feedback/my         — list feedback given by current user
router.get('/my', authMiddleware, getMyFeedback);

// GET  /api/feedback/summary    — aggregate stats for evaluation and testing
router.get('/summary', authMiddleware, getFeedbackSummary);

// GET  /api/feedback/match/:matchId — get feedback on a specific match
router.get('/match/:matchId', authMiddleware, getMatchFeedback);

module.exports = router;
