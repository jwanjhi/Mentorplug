const express = require('express');
const cors    = require('cors');
const path    = require('path');
const dotenv  = require('dotenv');

// Load environment variables
dotenv.config();

const pool = require('./config/db');
const authRoutes = require('./routes/auth');
const profileRoutes = require('./routes/profiles');
const recommendationRoutes = require('./routes/recommendations');
const feedbackRoutes = require('./routes/feedback');

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Serve uploaded profile photos as static files
// e.g. GET http://localhost:5000/uploads/avatars/avatar_3.jpg
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Root health endpoints
app.get('/', (req, res) => {
  res.json({ status: 'ok', message: 'MentorPlug API is running' });
});

app.get('/health', (req, res) => {
  res.json({ status: 'healthy', uptime: process.uptime() });
});

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/profiles', profileRoutes);
app.use('/api/recommendations', recommendationRoutes);
app.use('/api/feedback', feedbackRoutes);

// Test database connection and ensure schema updates on startup
pool.query('SELECT NOW()')
  .then(async () => {
    console.log('Database connected successfully');
    try {
      await pool.query(`
        ALTER TABLE profiles ADD COLUMN IF NOT EXISTS phone_verified BOOLEAN DEFAULT FALSE;
        CREATE TABLE IF NOT EXISTS phone_verifications (
          id SERIAL PRIMARY KEY,
          "accountID" INT NOT NULL REFERENCES account("accountID") ON DELETE CASCADE,
          phone VARCHAR(50) NOT NULL,
          code VARCHAR(10) NOT NULL,
          "expiresAt" TIMESTAMP WITH TIME ZONE NOT NULL,
          verified BOOLEAN DEFAULT FALSE,
          "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        );
        CREATE INDEX IF NOT EXISTS idx_phone_verifications_lookup 
        ON phone_verifications ("accountID", phone, verified, "expiresAt");
      `);
      console.log('Phone verification schema verified successfully.');
    } catch (migErr) {
      console.warn('Startup migration notice:', migErr.message);
    }
  })
  .catch((err) => {
    console.error('Database connection failure:', err.message);
  });

// Port configuration
const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`MentorPlug server running on port ${PORT}`);
});

module.exports = app;
