const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/auth');
const {
  createOrUpdateProfile,
  getMyProfile,
  getProfileById
} = require('../controllers/profileController');
const { uploadAvatar, deleteAvatar } = require('../controllers/avatarController');

// POST /api/profiles — create or update profile (bio, skills, interests, experience)
router.post('/', authMiddleware, createOrUpdateProfile);

// GET /api/profiles/me — current user's profile (must come before /:id)
router.get('/me', authMiddleware, getMyProfile);

// POST /api/profiles/avatar — upload / replace profile photo (multipart/form-data, field: "avatar")
router.post('/avatar', authMiddleware, ...uploadAvatar);

// DELETE /api/profiles/avatar — remove profile photo
router.delete('/avatar', authMiddleware, deleteAvatar);

// GET /api/profiles/:id — public mentor profile by accountID
router.get('/:id', authMiddleware, getProfileById);

module.exports = router;
