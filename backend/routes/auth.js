const express = require('express');
const router = express.Router();
const { register, login, getMe, googleAuth } = require('../controllers/authController');
const { sendOtp, verifyOtp } = require('../controllers/phoneVerificationController');
const authMiddleware = require('../middleware/auth');

// POST /register -> register controller
router.post('/register', register);

// POST /login -> login controller
router.post('/login', login);

// POST /google -> Google OAuth token verification and login/register
router.post('/google', googleAuth);

// GET /me -> protected by auth middleware, calls getMe controller
router.get('/me', authMiddleware, getMe);

// POST /phone/send-otp -> generate and send 6-digit phone verification OTP
router.post('/phone/send-otp', authMiddleware, sendOtp);

// POST /phone/verify-otp -> verify 6-digit OTP and mark phone verified
router.post('/phone/verify-otp', authMiddleware, verifyOtp);

module.exports = router;

