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
const progressRoutes = require('./routes/progress');
const { testEmailConfig } = require('./services/emailService');

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

// Diagnostic endpoint to test live email delivery and inspect errors
app.get('/api/email/test', async (req, res) => {
  const targetEmail = req.query.to || 'wanjohijoy37@gmail.com';
  const result = await testEmailConfig(targetEmail);
  res.status(result.success ? 200 : (result.configured ? 500 : 400)).json(result);
});

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/profiles', profileRoutes);
app.use('/api/recommendations', recommendationRoutes);
app.use('/api/feedback', feedbackRoutes);
app.use('/api/progress', progressRoutes);

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

        CREATE TABLE IF NOT EXISTS mentorship_goals (
          "goalID" SERIAL PRIMARY KEY,
          "matchID" INT NOT NULL REFERENCES matches("matchID") ON DELETE CASCADE,
          title VARCHAR(255) NOT NULL,
          description TEXT,
          target_date DATE,
          status VARCHAR(50) DEFAULT 'in_progress' CHECK (status IN ('pending', 'in_progress', 'pending_review', 'completed')),
          "createdBy" INT NOT NULL REFERENCES account("accountID") ON DELETE CASCADE,
          reviewed_at TIMESTAMP WITH TIME ZONE,
          review_notes TEXT,
          "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
          "updatedAt" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        );

        ALTER TABLE mentorship_goals ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMP WITH TIME ZONE;
        ALTER TABLE mentorship_goals ADD COLUMN IF NOT EXISTS review_notes TEXT;
        ALTER TABLE mentorship_goals DROP CONSTRAINT IF EXISTS mentorship_goals_status_check;
        ALTER TABLE mentorship_goals ADD CONSTRAINT mentorship_goals_status_check 
          CHECK (status IN ('pending', 'in_progress', 'pending_review', 'completed'));

        CREATE TABLE IF NOT EXISTS mentorship_action_items (
          "itemID" SERIAL PRIMARY KEY,
          "goalID" INT NOT NULL REFERENCES mentorship_goals("goalID") ON DELETE CASCADE,
          task_text VARCHAR(255) NOT NULL,
          is_completed BOOLEAN DEFAULT FALSE,
          completed_at TIMESTAMP WITH TIME ZONE,
          "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        );

        CREATE INDEX IF NOT EXISTS idx_mentorship_goals_match ON mentorship_goals ("matchID");
        CREATE INDEX IF NOT EXISTS idx_mentorship_action_items_goal ON mentorship_action_items ("goalID");
      `);
      console.log('Phone verification and mentorship progress schema verified successfully.');
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
