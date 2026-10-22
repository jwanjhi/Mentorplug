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

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Serve uploaded profile photos as static files
// e.g. GET http://localhost:5000/uploads/avatars/avatar_3.jpg
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/profiles', profileRoutes);
app.use('/api/recommendations', recommendationRoutes);

// Test database connection on startup
pool.query('SELECT NOW()')
  .then(() => {
    console.log('Database connected successfully');
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
