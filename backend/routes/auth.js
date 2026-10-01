const express = require('express');
const router = express.Router();
const { register, login, getMe } = require('../controllers/authController');
const authMiddleware = require('../middleware/auth');

// POST /register -> register controller
router.post('/register', register);

// POST /login -> login controller
router.post('/login', login);

// GET /me -> protected by auth middleware, calls getMe controller
router.get('/me', authMiddleware, getMe);

module.exports = router;
