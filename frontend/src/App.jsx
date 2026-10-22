import React, { useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Link } from 'react-router-dom';
import { Container, Row, Col, Card, Button, Badge } from 'react-bootstrap';
import AppNavbar from './components/Navbar';
import Footer from './components/Footer';
import './App.css';

// Placeholder Home view showing design tokens and brand layout
const Home = ({ user }) => {
  return (
    <div className="home-page">
      {/* Hero Section */}
      <section className="hero-mentor">
        <Container>
          <Row className="align-items-center gy-4">
            <Col lg={8} className="text-center text-lg-start">
              <Badge className="badge-interest mb-3 px-3 py-2">
                Strathmore University CS Project &bull; Sprint III
              </Badge>
              <h1 className="display-4 fw-bold mb-3">
                Connecting Minds with <span className="brand-plug">Semantic NLP</span>
              </h1>
              <p className="lead mb-4 text-white-50" style={{ maxWidth: '640px' }}>
                MentorPlug uses Sentence-BERT transformer embeddings to deeply match mentees with the right mentors based on real technical skills, domain aspirations, and contextual affinities.
              </p>
              <div className="d-flex flex-wrap gap-3 justify-content-center justify-content-lg-start">
                <Button as={Link} to="/register" className="btn-mentor-gold btn-lg">
                  Get Started as Mentor or Mentee
                </Button>
                <Button as={Link} to="/login" className="btn-mentor-outline-gold btn-lg">
                  Sign In
                </Button>
              </div>
            </Col>

            <Col lg={4}>
              <Card className="card-mentor shadow-lg border-0">
                <Card.Body className="p-4">
                  <div className="d-flex align-items-center justify-content-between mb-3">
                    <span className="badge-role-mentee">Sample Recommendation</span>
                    <span className="match-score-pill">84.1% Match</span>
                  </div>
                  <h5 className="fw-bold text-mentor-navy mb-1">Dr. James Kamau</h5>
                  <p className="text-muted small mb-2">Senior ML & Fintech Engineer &bull; 8 Yrs Exp</p>
                  <p className="small text-secondary mb-3">
                    "Specialising in distributed backend systems, Python, PyTorch, and financial technology."
                  </p>
                  <div className="d-flex flex-wrap gap-1 mb-3">
                    <span className="badge-skill">Python</span>
                    <span className="badge-skill">Node.js</span>
                    <span className="badge-skill">PostgreSQL</span>
                    <span className="badge-skill">System Design</span>
                  </div>
                  <Button variant="outline-primary" size="sm" className="w-100">
                    Preview Match Details
                  </Button>
                </Card.Body>
              </Card>
            </Col>
          </Row>
        </Container>
      </section>

      {/* Feature Section */}
      <section className="py-5 bg-white">
        <Container>
          <div className="text-center mb-5">
            <h2 className="fw-bold">Why MentorPlug?</h2>
            <p className="text-muted">Overcoming the limitations of traditional keyword-matching</p>
          </div>

          <Row className="g-4">
            <Col md={4}>
              <Card className="card-mentor h-100 p-4 border-0 shadow-sm">
                <div className="feature-icon-box">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#0D1B4B" strokeWidth="2">
                    <path d="M12 2L2 7L12 12L22 7L12 2Z" />
                    <path d="M2 17L12 22L22 17" />
                    <path d="M2 12L12 17L22 12" />
                  </svg>
                </div>
                <h5 className="fw-bold mb-2">Sentence-BERT Architecture</h5>
                <p className="text-muted small">
                  Leverages the <code>all-MiniLM-L6-v2</code> transformer to capture semantic synonymy between domain concepts like "fintech" and "financial technology".
                </p>
              </Card>
            </Col>

            <Col md={4}>
              <Card className="card-mentor h-100 p-4 border-0 shadow-sm">
                <div className="feature-icon-box gold">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#C9A84C" strokeWidth="2">
                    <circle cx="12" cy="12" r="10" />
                    <path d="M12 6V12L16 14" />
                  </svg>
                </div>
                <h5 className="fw-bold mb-2">Evaluated Against TF-IDF</h5>
                <p className="text-muted small">
                  Sprint II demonstrated an empirical discriminative margin of 0.4649 against bag-of-words baselines, eliminating spurious surface-level matches.
                </p>
              </Card>
            </Col>

            <Col md={4}>
              <Card className="card-mentor h-100 p-4 border-0 shadow-sm">
                <div className="feature-icon-box">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#0D1B4B" strokeWidth="2">
                    <path d="M17 21V19C17 16.7909 15.2091 15 13 15H5C2.79086 15 1 16.7909 1 19V21" />
                    <circle cx="9" cy="7" r="4" />
                    <path d="M23 21V19C22.9986 17.1771 21.765 15.5857 20 15.13" />
                    <path d="M16 3.13C17.7699 3.58317 19.0078 5.17799 19.0078 7.005C19.0078 8.83201 17.7699 10.4268 16 10.88" />
                  </svg>
                </div>
                <h5 className="fw-bold mb-2">Role-Based Experience</h5>
                <p className="text-muted small">
                  Tailored workflows for mentors and mentees with dedicated profile completion, skill tagging, and connection lifecycle management.
                </p>
              </Card>
            </Col>
          </Row>
        </Container>
      </section>
    </div>
  );
};

function App() {
  const [user, setUser] = useState(null);

  const handleLogout = () => {
    setUser(null);
  };

  return (
    <Router>
      <div className="page-wrapper">
        <AppNavbar user={user} onLogout={handleLogout} />
        <main className="main-content">
          <Routes>
            <Route path="/" element={<Home user={user} />} />
            <Route
              path="/login"
              element={
                <Container className="py-5 text-center">
                  <h2 className="mb-3">Login Screen</h2>
                  <p className="text-muted">Coming in Step 4</p>
                  <Button as={Link} to="/" className="btn-mentor-primary">
                    Return Home
                  </Button>
                </Container>
              }
            />
            <Route
              path="/register"
              element={
                <Container className="py-5 text-center">
                  <h2 className="mb-3">Registration Screen</h2>
                  <p className="text-muted">Coming in Step 4</p>
                  <Button as={Link} to="/" className="btn-mentor-primary">
                    Return Home
                  </Button>
                </Container>
              }
            />
            <Route
              path="/profile"
              element={
                <Container className="py-5 text-center">
                  <h2 className="mb-3">Profile Completion Screen</h2>
                  <p className="text-muted">Coming in Step 5</p>
                  <Button as={Link} to="/" className="btn-mentor-primary">
                    Return Home
                  </Button>
                </Container>
              }
            />
            <Route
              path="/recommendations"
              element={
                <Container className="py-5 text-center">
                  <h2 className="mb-3">Recommendations Dashboard</h2>
                  <p className="text-muted">Coming in Step 6</p>
                  <Button as={Link} to="/" className="btn-mentor-primary">
                    Return Home
                  </Button>
                </Container>
              }
            />
          </Routes>
        </main>
        <Footer />
      </div>
    </Router>
  );
}

export default App;
