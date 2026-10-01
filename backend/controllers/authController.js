const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const pool = require('../config/db');

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

// Login user
const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ message: 'Email and password are required' });
    }

    // Find account by email in Account table
    const accountQuery = 'SELECT "accountID", name, email, "passwordHash", role FROM account WHERE email = $1';
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

    // Signed JWT containing accountID and role
    const token = jwt.sign(
      { accountID: account.accountID, role: account.role },
      process.env.JWT_SECRET,
      { expiresIn: '24h' }
    );

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

module.exports = {
  register,
  login,
  getMe
};
