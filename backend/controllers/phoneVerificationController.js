const pool = require('../config/db');
const { normalizeWhatsAppContact, generateOtpCode, sendVerificationOtp } = require('../services/smsService');

/**
 * POST /api/auth/phone/send-otp
 * Generates and sends a 5-minute 6-digit OTP code to the requested phone number or WhatsApp username.
 */
const sendOtp = async (req, res) => {
  try {
    const accountID = req.user?.accountID;
    if (!accountID) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    const rawContact = req.body.contact || req.body.phone;
    if (!rawContact || typeof rawContact !== 'string' || rawContact.trim().length < 3) {
      return res.status(400).json({ message: 'A valid phone number or WhatsApp username (@handle) is required.' });
    }

    const normalized = normalizeWhatsAppContact(rawContact.trim());
    if (!normalized.value) {
      return res.status(400).json({ message: 'Invalid contact format. Provide a phone number (+254...) or username (@handle).' });
    }

    const code = generateOtpCode();
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes

    // Ensure database table exists (idempotent guard)
    await pool.query(`
      CREATE TABLE IF NOT EXISTS phone_verifications (
        id SERIAL PRIMARY KEY,
        "accountID" INT NOT NULL REFERENCES account("accountID") ON DELETE CASCADE,
        phone VARCHAR(50) NOT NULL,
        code VARCHAR(10) NOT NULL,
        "expiresAt" TIMESTAMP WITH TIME ZONE NOT NULL,
        verified BOOLEAN DEFAULT FALSE,
        "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Invalidate any previously unverified codes for this account/contact
    await pool.query(
      `UPDATE phone_verifications SET verified = TRUE WHERE "accountID" = $1 AND phone = $2 AND verified = FALSE`,
      [accountID, normalized.value]
    );

    // Save newly generated OTP
    await pool.query(
      `INSERT INTO phone_verifications ("accountID", phone, code, "expiresAt") VALUES ($1, $2, $3, $4)`,
      [accountID, normalized.value, code, expiresAt]
    );

    // Dispatch SMS or provide Demo OTP
    const smsResult = await sendVerificationOtp({ contact: normalized.value, code });

    return res.status(200).json({
      success: true,
      contact: normalized.value,
      phone: normalized.value, // Backward compatibility
      isUsername: normalized.type === 'username',
      message: smsResult.message,
      isDemo: smsResult.isDemo,
      demoCode: smsResult.demoCode,
      expiresInSeconds: 300,
    });
  } catch (error) {
    console.error('Error in sendOtp:', error);
    return res.status(500).json({ message: 'Failed to generate verification code.', error: error.message });
  }
};

/**
 * POST /api/auth/phone/verify-otp
 * Validates the entered 6-digit OTP and marks the phone number / username as verified in profiles.
 */
const verifyOtp = async (req, res) => {
  try {
    const accountID = req.user?.accountID;
    if (!accountID) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    const rawContact = req.body.contact || req.body.phone;
    const { code } = req.body;
    if (!rawContact || !code) {
      return res.status(400).json({ message: 'Contact detail and verification code are required.' });
    }

    const normalized = normalizeWhatsAppContact(rawContact.trim());
    const inputCode = String(code).trim();

    // Find the latest pending OTP for this account and contact
    const otpQuery = `
      SELECT id, code, "expiresAt"
      FROM phone_verifications
      WHERE "accountID" = $1 AND phone = $2 AND verified = FALSE
      ORDER BY "createdAt" DESC
      LIMIT 1
    `;
    const otpResult = await pool.query(otpQuery, [accountID, normalized.value]);

    if (otpResult.rows.length === 0) {
      return res.status(400).json({
        message: 'No pending verification request found for this contact. Please request a new code.',
      });
    }

    const record = otpResult.rows[0];

    // Check expiration
    if (new Date() > new Date(record.expiresAt)) {
      return res.status(400).json({
        message: 'The verification code has expired. Please request a new code.',
      });
    }

    // Check code correctness
    if (record.code !== inputCode) {
      return res.status(400).json({
        message: 'Invalid verification code. Please check and try again.',
      });
    }

    // Mark OTP row as verified
    await pool.query(`UPDATE phone_verifications SET verified = TRUE WHERE id = $1`, [record.id]);

    // Ensure phone_verified column exists on profiles table
    await pool.query(`ALTER TABLE profiles ADD COLUMN IF NOT EXISTS phone_verified BOOLEAN DEFAULT FALSE;`);

    // Upsert or update profile record with verified status
    const profileCheck = await pool.query('SELECT "profileID" FROM profiles WHERE "accountID" = $1', [accountID]);

    if (profileCheck.rows.length > 0) {
      await pool.query(
        `UPDATE profiles 
         SET phone_verified = TRUE, whatsapp = $1, "updatedAt" = CURRENT_TIMESTAMP 
         WHERE "accountID" = $2`,
        [normalized.value, accountID]
      );
    } else {
      await pool.query(
        `INSERT INTO profiles ("accountID", whatsapp, phone_verified)
         VALUES ($1, $2, TRUE)`,
        [accountID, normalized.value]
      );
    }

    return res.status(200).json({
      success: true,
      phone_verified: true,
      contact: normalized.value,
      phone: normalized.value, // Backward compatibility
      isUsername: normalized.type === 'username',
      message: normalized.type === 'username'
        ? `WhatsApp handle ${normalized.value} successfully verified and linked to your profile!`
        : `Phone number ${normalized.value} successfully verified and linked to your profile!`,
    });
  } catch (error) {
    console.error('Error in verifyOtp:', error);
    return res.status(500).json({ message: 'Failed to verify code.', error: error.message });
  }
};

module.exports = {
  sendOtp,
  verifyOtp,
};
