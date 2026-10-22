const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/auth');
const {
  getRecommendations,
  runAndSaveRecommendations,
  getIncomingRequests,
  updateMatchStatus,
  sendMatchRequest,
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

module.exports = router;
