const crypto = require('crypto');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const pool = require('../config/db');
const { notifyWelcomeUser, notifySignInAlert, notifyMfaOtp } = require('../services/emailService');

const maskEmail = (email) => {
  if (!email || !email.includes('@')) return email;
  const [local, domain] = email.split('@');
  if (local.length <= 2) return `${local[0]}***@${domain}`;
  return `${local[0]}***${local[local.length - 1]}@${domain}`;
};

// Register a new mentor or mentee account
const register = async (req, res) => {
  try {
    const { name, email, password, role } = req.body;

    // Validate that name, email, password, role are all present
    if (!name || !email || !password || !role) {
      return res.status(400).json({ message: 'All fields (name, email, password, role) are required' });
    }

    // Check role is either "mentor" or "mentee" only
    if (role !== 'mentor' && role !== 'mentee') {
      return res.status(400).json({ message: 'Role must be either "mentor" or "mentee"' });
    }

    // Check email does not already exist in Account table
    const existingAccountQuery = 'SELECT "accountID" FROM account WHERE email = $1';
    const existingAccountResult = await pool.query(existingAccountQuery, [email]);

    if (existingAccountResult.rows.length > 0) {
      return res.status(409).json({ message: 'Email already exists' });
    }

    // Hash password using bcrypt with cost factor 10
    const saltRounds = 10;
    const passwordHash = await bcrypt.hash(password, saltRounds);

    // Insert new row into Account table
    const insertQuery = `
      INSERT INTO account (name, email, "passwordHash", role)
      VALUES ($1, $2, $3, $4)
      RETURNING "accountID", name, email, role, "createdAt"
    `;
    const insertResult = await pool.query(insertQuery, [name, email, passwordHash, role]);
    const newAccount = insertResult.rows[0];

    // Signed JWT containing accountID and role
    const token = jwt.sign(
      { accountID: newAccount.accountID, role: newAccount.role },
      process.env.JWT_SECRET,
      { expiresIn: '24h' }
    );

    // Send welcome email asynchronously (non-blocking)
    notifyWelcomeUser({
      email: newAccount.email,
      name: newAccount.name,
      role: newAccount.role,
    }).catch((e) => console.warn('Welcome email error:', e.message));

    return res.status(201).json({
      message: 'Registration successful',
      token,
      user: newAccount
    });
  } catch (error) {
    console.error('Error in register controller:', error);
    return res.status(500).json({ message: 'Server error during registration' });
  }
};

// Login user with Two-Factor Authentication (Email OTP)
const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ message: 'Email and password are required' });
    }

    // Find account by email in Account table
    const accountQuery = 'SELECT "accountID", name, email, "passwordHash", role, COALESCE(mfa_enabled, TRUE) AS mfa_enabled FROM account WHERE email = $1';
    const accountResult = await pool.query(accountQuery, [email]);

    if (accountResult.rows.length === 0) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    const account = accountResult.rows[0];

    // Compare provided password with stored hash using bcrypt
    const isMatch = await bcrypt.compare(password, account.passwordHash);
    if (!isMatch) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    // Check if MFA is enabled (enforced by default for all password logins)
    if (account.mfa_enabled !== false) {
      const code = crypto.randomInt(100000, 999999).toString();
      const tempToken = crypto.randomBytes(32).toString('hex');
      const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

      // Invalidate any previous unconsumed temp tokens for this user
      await pool.query(
        'UPDATE email_mfa_codes SET consumed = TRUE WHERE "accountID" = $1 AND consumed = FALSE',
        [account.accountID]
      );

      // Insert new MFA record
      await pool.query(
        'INSERT INTO email_mfa_codes ("accountID", code, "tempToken", "expiresAt") VALUES ($1, $2, $3, $4)',
        [account.accountID, code, tempToken, expiresAt]
      );

      // Send OTP via verified Resend domain
      notifyMfaOtp({
        email: account.email,
        name: account.name,
        code,
      }).catch((e) => console.warn('MFA OTP dispatch error:', e.message));

      return res.status(200).json({
        mfaRequired: true,
        tempToken,
        maskedEmail: maskEmail(account.email),
        message: 'Two-factor verification code sent to your email.',
      });
    }

    // If MFA explicitly disabled: issue JWT directly
    const token = jwt.sign(
      { accountID: account.accountID, role: account.role },
      process.env.JWT_SECRET,
      { expiresIn: '24h' }
    );

    // Send security sign-in alert asynchronously (non-blocking)
    notifySignInAlert({
      email: account.email,
      name: account.name,
      ip: req.ip || req.headers['x-forwarded-for'],
      userAgent: req.headers['user-agent'],
    }).catch((e) => console.warn('Sign-in alert error:', e.message));

    return res.status(200).json({
      message: 'Login successful',
      token,
      user: {
        accountID: account.accountID,
        name: account.name,
        email: account.email,
        role: account.role
      }
    });
  } catch (error) {
    console.error('Error in login controller:', error);
    return res.status(500).json({ message: 'Server error during login' });
  }
};

// Verify 2FA OTP code
const verifyMfa = async (req, res) => {
  try {
    const { tempToken, code } = req.body;

    if (!tempToken || !code) {
      return res.status(400).json({ message: 'Verification token and 6-digit code are required' });
    }

    const cleanCode = String(code).trim();
    if (cleanCode.length !== 6) {
      return res.status(400).json({ message: 'Code must be exactly 6 digits' });
    }

    const mfaRes = await pool.query(
      `SELECT m.id, m."accountID", m.code, m."expiresAt", m.consumed,
              a.name, a.email, a.role
       FROM email_mfa_codes m
       JOIN account a ON a."accountID" = m."accountID"
       WHERE m."tempToken" = $1
       ORDER BY m."createdAt" DESC
       LIMIT 1`,
      [tempToken.trim()]
    );

    if (mfaRes.rows.length === 0 || mfaRes.rows[0].consumed) {
      return res.status(400).json({ message: 'Invalid or expired verification session. Please sign in again.' });
    }

    const record = mfaRes.rows[0];

    if (new Date() > new Date(record.expiresAt)) {
      return res.status(400).json({ message: 'Verification code has expired. Please click Resend Code.' });
    }

    if (record.code.trim() !== cleanCode) {
      return res.status(400).json({ message: 'Incorrect 6-digit code. Please check your email and try again.' });
    }

    // Mark as consumed
    await pool.query('UPDATE email_mfa_codes SET consumed = TRUE WHERE id = $1', [record.id]);

    // Issue authentic 24h JWT
    const token = jwt.sign(
      { accountID: record.accountID, role: record.role },
      process.env.JWT_SECRET,
      { expiresIn: '24h' }
    );

    // Send sign-in security alert
    notifySignInAlert({
      email: record.email,
      name: record.name,
      ip: req.ip || req.headers['x-forwarded-for'],
      userAgent: req.headers['user-agent'],
    }).catch((e) => console.warn('Sign-in alert error:', e.message));

    return res.status(200).json({
      message: 'Two-factor authentication successful',
      token,
      user: {
        accountID: record.accountID,
        name: record.name,
        email: record.email,
        role: record.role,
      },
    });
  } catch (error) {
    console.error('Error in verifyMfa controller:', error);
    return res.status(500).json({ message: 'Server error during MFA verification' });
  }
};

// Resend fresh MFA OTP code
const resendMfa = async (req, res) => {
  try {
    const { tempToken } = req.body;

    if (!tempToken) {
      return res.status(400).json({ message: 'Verification session token is required' });
    }

    const mfaRes = await pool.query(
      `SELECT m.id, m."accountID", m."createdAt", a.name, a.email
       FROM email_mfa_codes m
       JOIN account a ON a."accountID" = m."accountID"
       WHERE m."tempToken" = $1 AND m.consumed = FALSE
       ORDER BY m."createdAt" DESC
       LIMIT 1`,
      [tempToken.trim()]
    );

    if (mfaRes.rows.length === 0) {
      return res.status(400).json({ message: 'Session expired. Please sign in again.' });
    }

    const record = mfaRes.rows[0];

    // Rate-limiting: prevent spamming resend within 45 seconds
    const secondsSinceLast = (Date.now() - new Date(record.createdAt).getTime()) / 1000;
    if (secondsSinceLast < 45) {
      const waitSec = Math.ceil(45 - secondsSinceLast);
      return res.status(429).json({ message: `Please wait ${waitSec}s before requesting a new code.` });
    }

    const newCode = crypto.randomInt(100000, 999999).toString();
    const newExpires = new Date(Date.now() + 10 * 60 * 1000);

    await pool.query(
      'UPDATE email_mfa_codes SET code = $1, "expiresAt" = $2, "createdAt" = CURRENT_TIMESTAMP WHERE id = $3',
      [newCode, newExpires, record.id]
    );

    notifyMfaOtp({
      email: record.email,
      name: record.name,
      code: newCode,
    }).catch((e) => console.warn('Resend MFA OTP error:', e.message));

    return res.status(200).json({ message: 'A fresh 6-digit verification code has been sent to your email.' });
  } catch (error) {
    console.error('Error in resendMfa controller:', error);
    return res.status(500).json({ message: 'Server error resending verification code' });
  }
};

// Toggle MFA for the logged-in user
const toggleMfa = async (req, res) => {
  try {
    const accountID = req.user.accountID;
    const { enabled } = req.body;

    const isEnabled = Boolean(enabled);
    await pool.query('UPDATE account SET mfa_enabled = $1 WHERE "accountID" = $2', [isEnabled, accountID]);

    return res.status(200).json({
      message: `Two-factor authentication is now ${isEnabled ? 'enabled' : 'disabled'}.`,
      mfa_enabled: isEnabled,
    });
  } catch (error) {
    console.error('Error in toggleMfa controller:', error);
    return res.status(500).json({ message: 'Server error toggling MFA status' });
  }
};

// Get current authenticated user details
const getMe = async (req, res) => {
  try {
    const accountID = req.user.accountID;

    // Return current authenticated user details excluding passwordHash
    const userQuery = 'SELECT "accountID", name, email, role, "createdAt" FROM account WHERE "accountID" = $1';
    const userResult = await pool.query(userQuery, [accountID]);

    if (userResult.rows.length === 0) {
      return res.status(404).json({ message: 'Account not found' });
    }

    return res.status(200).json(userResult.rows[0]);
  } catch (error) {
    console.error('Error in getMe controller:', error);
    return res.status(500).json({ message: 'Server error fetching user details' });
  }
};

/**
 * Google OAuth Authentication
 * Validates the Google ID Token securely using google-auth-library.
 * Handles new user registration (requiring role) and existing account lookup.
 * Protects existing password accounts from unverified automatic linking.
 */
const { OAuth2Client } = require('google-auth-library');
const googleClient = new OAuth2Client();

const googleAuth = async (req, res) => {
  try {
    const { idToken, role } = req.body;

    if (!idToken) {
      return res.status(400).json({ message: 'Google ID token is required' });
    }

    const expectedClientId = process.env.GOOGLE_CLIENT_ID;
    if (!expectedClientId) {
      console.error('GOOGLE_CLIENT_ID environment variable is not configured');
      return res.status(500).json({ message: 'Google authentication is not configured on the server' });
    }

    // 1. Verify Google ID token against the expected audience
    let ticket;
    try {
      ticket = await googleClient.verifyIdToken({
        idToken,
        audience: expectedClientId,
      });
    } catch (verifyError) {
      console.error('Failed to verify Google ID token:', verifyError.message);
      return res.status(401).json({ message: 'Invalid or expired Google token' });
    }

    const payload = ticket.getPayload();
    if (!payload) {
      return res.status(401).json({ message: 'Invalid Google token payload' });
    }

    const { sub: googleId, email, email_verified, name, picture } = payload;

    // 2. Safeguard: Require verified email from Google
    if (!email_verified || !email) {
      return res.status(400).json({ message: 'Google account email is not verified' });
    }

    // 3. Lookup existing account by googleId first
    const googleAccountQuery = 'SELECT "accountID", name, email, role, "googleId", "authProvider" FROM account WHERE "googleId" = $1';
    const googleAccountResult = await pool.query(googleAccountQuery, [googleId]);

    if (googleAccountResult.rows.length > 0) {
      const existingUser = googleAccountResult.rows[0];

      // Sign JWT
      const token = jwt.sign(
        { accountID: existingUser.accountID, role: existingUser.role },
        process.env.JWT_SECRET,
        { expiresIn: '24h' }
      );

      // Send security sign-in alert asynchronously
      notifySignInAlert({
        email: existingUser.email,
        name: existingUser.name,
        ip: req.ip || req.headers['x-forwarded-for'],
        userAgent: req.headers['user-agent'],
      }).catch((e) => console.warn('Google sign-in alert error:', e.message));

      return res.status(200).json({
        message: 'Google login successful',
        token,
        user: {
          accountID: existingUser.accountID,
          name: existingUser.name,
          email: existingUser.email,
          role: existingUser.role,
        },
      });
    }

    // 4. Lookup by email to check for account conflicts
    const emailAccountQuery = 'SELECT "accountID", name, email, role, "passwordHash", "googleId", "authProvider" FROM account WHERE email = $1';
    const emailAccountResult = await pool.query(emailAccountQuery, [email]);

    if (emailAccountResult.rows.length > 0) {
      const existingEmailUser = emailAccountResult.rows[0];

      // Safeguard 2: Do not automatically link if account was created with a password
      if (existingEmailUser.passwordHash) {
        return res.status(409).json({
          code: 'ACCOUNT_EXISTS_WITH_PASSWORD',
          message: 'An account with this email already exists using email and password. Please sign in with your password to access your account.',
        });
      }

      // If account exists with no password and no googleId, link googleId safely
      if (!existingEmailUser.googleId) {
        await pool.query(
          'UPDATE account SET "googleId" = $1, "authProvider" = $2 WHERE "accountID" = $3',
          [googleId, 'google', existingEmailUser.accountID]
        );
      }

      const token = jwt.sign(
        { accountID: existingEmailUser.accountID, role: existingEmailUser.role },
        process.env.JWT_SECRET,
        { expiresIn: '24h' }
      );

      // Send security sign-in alert asynchronously
      notifySignInAlert({
        email: existingUser.email,
        name: existingUser.name,
        ip: req.ip || req.headers['x-forwarded-for'],
        userAgent: req.headers['user-agent'],
      }).catch((e) => console.warn('Google sign-in alert error:', e.message));

      return res.status(200).json({
        message: 'Google login successful',
        token,
        user: {
          accountID: existingEmailUser.accountID,
          name: existingEmailUser.name,
          email: existingEmailUser.email,
          role: existingEmailUser.role,
        },
      });
    }

    // 5. New user: If role is not provided, inform client that role selection is required
    if (!role) {
      return res.status(200).json({
        needsRole: true,
        email,
        name: name || 'MentorPlug User',
        picture: picture || null,
        message: 'Please select whether you are joining as a Mentor or Mentee.',
      });
    }

    // Safeguard 3: Validate role on the backend
    if (role !== 'mentor' && role !== 'mentee') {
      return res.status(400).json({ message: 'Role must be either "mentor" or "mentee"' });
    }

    // 6. Create new account and profile inside a transaction (Safeguard 5: safe concurrency)
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const insertAccountQuery = `
        INSERT INTO account (name, email, "passwordHash", role, "googleId", "authProvider")
        VALUES ($1, $2, NULL, $3, $4, 'google')
        RETURNING "accountID", name, email, role, "createdAt"
      `;
      const accountInsertResult = await client.query(insertAccountQuery, [
        name || email.split('@')[0],
        email,
        role,
        googleId,
      ]);
      const newAccount = accountInsertResult.rows[0];

      // Safeguard 7: Initialize profile with Google avatar safely (avoid duplicates)
      const insertProfileQuery = `
        INSERT INTO profiles ("accountID", avatar_url, bio, skills, interests, experience_years)
        VALUES ($1, $2, '', ARRAY[]::TEXT[], ARRAY[]::TEXT[], 0)
        ON CONFLICT ("accountID") DO NOTHING
      `;
      await client.query(insertProfileQuery, [newAccount.accountID, picture || null]);

      await client.query('COMMIT');

      // Issue JWT
      const token = jwt.sign(
        { accountID: newAccount.accountID, role: newAccount.role },
        process.env.JWT_SECRET,
        { expiresIn: '24h' }
      );

      // Send welcome email asynchronously (non-blocking)
    notifyWelcomeUser({
      email: newAccount.email,
      name: newAccount.name,
      role: newAccount.role,
    }).catch((e) => console.warn('Welcome email error:', e.message));

    return res.status(201).json({
        message: 'Google registration successful',
        token,
        user: newAccount,
        isNewUser: true,
      });
    } catch (txError) {
      await client.query('ROLLBACK');
      // If concurrent request already inserted the account
      if (txError.code === '23505') {
        return res.status(409).json({ message: 'An account with this email was just registered. Please try signing in.' });
      }
      throw txError;
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Error in googleAuth controller:', error);
    return res.status(500).json({ message: 'Server error during Google authentication' });
  }
};

module.exports = {
  register,
  login,
  verifyMfa,
  resendMfa,
  toggleMfa,
  getMe,
  googleAuth
};

