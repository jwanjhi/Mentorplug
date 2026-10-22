const express = require('express');
const router = express.Router();
const { register, login, getMe, googleAuth } = require('../controllers/authController');
const authMiddleware = require('../middleware/auth');

// POST /register -> register controller
router.post('/register', register);

// POST /login -> login controller
router.post('/login', login);

// POST /google -> Google OAuth token verification and login/register
router.post('/google', googleAuth);

// GET /me -> protected by auth middleware, calls getMe controller
router.get('/me', authMiddleware, getMe);

module.exports = router;

