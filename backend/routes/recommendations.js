const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/auth');
const { getRecommendations } = require('../controllers/recommendationController');

// GET /api/recommendations — protected by auth middleware, mentee only
router.get('/', authMiddleware, getRecommendations);

module.exports = router;
