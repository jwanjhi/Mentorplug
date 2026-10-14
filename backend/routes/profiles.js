const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/auth');
const {
  createOrUpdateProfile,
  getMyProfile,
  getProfileById
} = require('../controllers/profileController');

// POST /api/profiles — protected by auth middleware (create or update profile)
router.post('/', authMiddleware, createOrUpdateProfile);

// GET /api/profiles/me — protected by auth middleware (current user's profile)
router.get('/me', authMiddleware, getMyProfile);

// GET /api/profiles/:id — protected by auth middleware (mentor profile by accountID)
router.get('/:id', authMiddleware, getProfileById);

module.exports = router;
