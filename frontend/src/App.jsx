import React from 'react';
import { BrowserRouter as Router, Routes, Route, Link } from 'react-router-dom';
import { Container, Row, Col, Card, Button, ProgressBar } from 'react-bootstrap';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';
import AppNavbar from './components/Navbar';
import ProtectedRoute from './components/ProtectedRoute';
import Login from './pages/Login';
import Register from './pages/Register';
import Profile from './pages/Profile';
import Recommendations from './pages/Recommendations';
import MentorDashboard from './pages/MentorDashboard';
import './App.css';

// Public Landing Page
const Home = () => {
  return (
    <div className="home-page">
      {/* 3. HERO SECTION */}
      <section className="py-5" style={{ minHeight: '82vh', display: 'flex', alignItems: 'center' }}>
        <Container>
          <Row className="align-items-center gy-5">
            {/* HERO LEFT SIDE */}
            <Col lg={7} className="text-center text-lg-start">
              {/* Large Heading: "Mentorplug" */}
              <h1 className="display-2 fw-bolder mb-3 text-themed-primary" style={{ letterSpacing: '-0.03em' }}>
                Mentor<span className="text-gold">plug</span>
              </h1>

              {/* Core Bullets / Messages */}
              <div className="mb-4">
                <p className="fs-3 fw-bold mb-1 text-themed-primary">
                  We match mentors to mentees.
                </p>
                <p className="fs-3 fw-bold mb-0 text-themed-primary">
                  You get <span className="text-gold">ranked matches</span>.
                </p>
              </div>

              {/* Short friendly lines */}
              <div className="mb-4 text-themed-secondary" style={{ maxWidth: '540px' }}>
                <p className="fs-5 mb-1 text-themed-secondary">
                  Tell us about yourself and what you want to learn.
                </p>
                <p className="fs-5 mb-0 text-themed-secondary">
                  We'll show you the mentors who are the best fit for you.
                </p>
              </div>

              {/* Two Action Buttons */}
              <div className="d-flex flex-wrap gap-3 justify-content-center justify-content-lg-start pt-2">
                <Button as={Link} to="/register" className="btn-gold btn-lg">
                  Get Started
                </Button>
                <Button as={Link} to="/login" className="btn-outline-gold btn-lg">
                  Sign In
                </Button>
              </div>
            </Col>

            {/* HERO RIGHT SIDE (MENTOR CARD) */}
            <Col lg={5} className="d-flex justify-content-center">
              <Card className="card-mentor-custom p-4 w-100" style={{ maxWidth: '440px' }}>
                <Card.Body className="p-0">
                  {/* Top Bar: Avatar + Info + Top Right 84% Match Pill */}
                  <div className="d-flex align-items-start justify-content-between mb-3">
                    <div className="d-flex align-items-center gap-3">
                      {/* Circular Avatar Placeholder */}
                      <div className="avatar-placeholder">
                        JK
                      </div>
                      <div>
                        <h4 className="fw-bold mb-0 text-themed-primary">James Kamau</h4>
                        <span className="small text-themed-secondary">Senior Mentor</span>
                      </div>
                    </div>

                    {/* Top-right gold pill: "84% Match" */}
                    <span className="badge-match-pill">
                      84% Match
                    </span>
                  </div>

                  {/* Short Description */}
                  <p className="small text-themed-secondary mb-3" style={{ lineHeight: '1.55' }}>
                    Experienced mentor who can help you grow your skills and achieve your goals.
                  </p>

                  {/* Three tags in gold outlined pills */}
                  <div className="d-flex flex-wrap gap-2 mb-4">
                    <span className="tag-gold-outline">Leadership</span>
                    <span className="tag-gold-outline">Career Growth</span>
                    <span className="tag-gold-outline">Problem Solving</span>
                  </div>

                  {/* Below everything: Match Score with Progress Bar filled to 84% in gold */}
                  <div className="pt-2 border-top border-secondary border-opacity-25">
                    <div className="d-flex justify-content-between align-items-center mb-2">
                      <span className="small text-themed-secondary fw-semibold">Match Score</span>
                      <span className="small text-gold fw-bold">84%</span>
                    </div>
                    <ProgressBar now={84} className="progress-gold" />
                  </div>
                </Card.Body>
              </Card>
            </Col>
          </Row>
        </Container>
      </section>

      {/* 5. HOW IT WORKS SECTION (FULL WIDTH BELOW HERO) */}
      <section id="how-it-works" className="py-5" style={{ borderTop: '1px solid var(--mp-border-subtle)' }}>
        <Container>
          {/* Section Header */}
          <div className="text-center mb-5">
            <span className="text-gold fw-bold text-uppercase small mb-2 d-inline-block" style={{ letterSpacing: '0.12em' }}>
              How It Works
            </span>
            <h2 className="display-6 fw-bold text-themed-primary">
              Simple Steps to Find Your Mentor
            </h2>
          </div>

          {/* 3 Step Cards in a Row */}
          <Row className="g-4">
            {/* Step 1: Create Your Profile */}
            <Col md={4}>
              <div className="step-card">
                <div className="step-icon-wrap">
                  {/* User Icon */}
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                    <circle cx="12" cy="7" r="4" />
                  </svg>
                </div>
                <h5 className="fw-bold text-themed-primary mb-2">1. Create Your Profile</h5>
                <p className="text-themed-secondary small mb-0" style={{ lineHeight: '1.6' }}>
                  Tell us about yourself, your interests, and what you want to learn.
                </p>
              </div>
            </Col>

            {/* Step 2: Get Matched */}
            <Col md={4}>
              <div className="step-card">
                <div className="step-icon-wrap">
                  {/* Search Icon */}
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="11" cy="11" r="8" />
                    <line x1="21" y1="21" x2="16.65" y2="16.65" />
                  </svg>
                </div>
                <h5 className="fw-bold text-themed-primary mb-2">2. Get Matched</h5>
                <p className="text-themed-secondary small mb-0" style={{ lineHeight: '1.6' }}>
                  We find mentors who match your goals and rank them for you.
                </p>
              </div>
            </Col>

            {/* Step 3: Connect & Learn */}
            <Col md={4}>
              <div className="step-card">
                <div className="step-icon-wrap">
                  {/* Chat Icon */}
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                  </svg>
                </div>
                <h5 className="fw-bold text-themed-primary mb-2">3. Connect &amp; Learn</h5>
                <p className="text-themed-secondary small mb-0" style={{ lineHeight: '1.6' }}>
                  View mentor profiles, connect with them, and start your learning journey.
                </p>
              </div>
            </Col>
          </Row>
        </Container>
      </section>

      {/* Clean, Non-Academic Footer */}
      <footer className="py-4 text-center text-themed-secondary small border-top border-secondary border-opacity-10 mt-5">
        <Container>
          <p className="mb-0">
            Mentor<span className="text-gold">plug</span> &bull; We match mentors to mentees.
          </p>
        </Container>
      </footer>
    </div>
  );
};

// Real pages imported above — placeholder section removed

function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <Router>
          <div className="page-wrapper">
            <main className="main-content">
              <Routes>
                {/* Public Landing & Auth Routes */}
                <Route path="/" element={<Home />} />
                <Route path="/login" element={<Login />} />
                <Route path="/register" element={<Register />} />

                {/* Protected Mentee-Only Route */}
                <Route
                  path="/recommendations"
                  element={
                    <ProtectedRoute allowedRoles={['mentee']}>
                      <Recommendations />
                    </ProtectedRoute>
                  }
                />

                {/* Protected Mentor-Only Route */}
                <Route
                  path="/mentor-dashboard"
                  element={
                    <ProtectedRoute allowedRoles={['mentor']}>
                      <MentorDashboard />
                    </ProtectedRoute>
                  }
                />

                {/* Protected Common Route (Both Mentor and Mentee) */}
                <Route
                  path="/profile"
                  element={
                    <ProtectedRoute>
                      <Profile />
                    </ProtectedRoute>
                  }
                />
              </Routes>
            </main>

            {/* Floating Bottom Pill Navbar with Light/Dark Mode Toggle */}
            <AppNavbar />
          </div>
        </Router>
      </AuthProvider>
    </ThemeProvider>
  );
}

export default App;
