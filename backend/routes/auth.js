const express = require('express');
const router = express.Router();
const { register, login, verifyMfa, resendMfa, toggleMfa, getMe, googleAuth } = require('../controllers/authController');
const { sendOtp, verifyOtp } = require('../controllers/phoneVerificationController');
const authMiddleware = require('../middleware/auth');

// POST /register -> register controller
router.post('/register', register);

// POST /login -> login controller
router.post('/login', login);

// POST /mfa/verify -> verify 6-digit email OTP and issue full session JWT
router.post('/mfa/verify', verifyMfa);

// POST /mfa/resend -> resend fresh 6-digit email OTP
router.post('/mfa/resend', resendMfa);

// PATCH /mfa/toggle -> toggle MFA preference for authenticated user
router.patch('/mfa/toggle', authMiddleware, toggleMfa);

// POST /google -> Google OAuth token verification and login/register
router.post('/google', googleAuth);

// GET /me -> protected by auth middleware, calls getMe controller
router.get('/me', authMiddleware, getMe);

// POST /phone/send-otp -> generate and send 6-digit phone verification OTP
router.post('/phone/send-otp', authMiddleware, sendOtp);

// POST /phone/verify-otp -> verify 6-digit OTP and mark phone verified
router.post('/phone/verify-otp', authMiddleware, verifyOtp);

module.exports = router;

