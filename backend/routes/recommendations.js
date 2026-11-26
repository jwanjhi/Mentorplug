const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/auth');
const {
  getRecommendations,
  runAndSaveRecommendations,
  getIncomingRequests,
  updateMatchStatus,
  sendMatchRequest,
  withdrawRequest,
  endMentorship,
} = require('../controllers/recommendationController');

// GET  /api/recommendations         — mentee: fetch saved matches
router.get('/', authMiddleware, getRecommendations);

// POST /api/recommendations         — mentee: run NLP + save/upsert all matches
router.post('/', authMiddleware, runAndSaveRecommendations);

// GET  /api/recommendations/incoming — mentor: fetch incoming mentee requests
router.get('/incoming', authMiddleware, getIncomingRequests);

// PATCH /api/recommendations/:id/status — mentor: accept or reject a match
router.patch('/:id/status', authMiddleware, updateMatchStatus);

// POST /api/recommendations/:id/request — mentee: send request for a match
router.post('/:id/request', authMiddleware, sendMatchRequest);

// POST /api/recommendations/:id/withdraw — mentee: withdraw a pending request
router.post('/:id/withdraw', authMiddleware, withdrawRequest);

// POST /api/recommendations/:id/end — mentee or mentor: end an accepted mentorship { reason, detail }
router.post('/:id/end', authMiddleware, endMentorship);

module.exports = router;
