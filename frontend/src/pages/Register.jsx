import React, { useState } from 'react';
import { Container, Row, Col, Card, Form, Button, Alert, Spinner } from 'react-bootstrap';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const Register = () => {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState('mentee'); // Default to mentee
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const { register } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);

    if (!name || !email || !password || !role) {
      setError('Please fill in all required fields.');
      return;
    }

    if (password.length < 6) {
      setError('Password should be at least 6 characters long.');
      return;
    }

    try {
      setLoading(true);
      const user = await register(name, email, password, role);

      // Once registered, direct them immediately to complete their profile
      navigate('/profile', { replace: true, state: { isNewUser: true } });
    } catch (err) {
      const msg = err.response?.data?.message || 'Registration failed. Please try again.';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="register-page py-5">
      <Container>
        <Row className="justify-content-center">
          <Col xs={12} sm={10} md={8} lg={6}>
            {/* Header branding */}
            <div className="text-center mb-4">
              <span className="tag-gold-outline mb-2 d-inline-block">Get Started</span>
              <h2 className="display-6 fw-bold text-themed-primary">
                Create Your Mentor<span className="text-gold">plug</span> Account
              </h2>
              <p className="text-themed-secondary small">
                Join as a mentee to get matched with the right mentors, or as a mentor to share your experience.
              </p>
            </div>

            {/* Registration Card */}
            <Card className="card-mentor-custom p-4">
              <Card.Body className="p-0">
                {error && (
                  <Alert variant="danger" className="py-2 px-3 small border-0" style={{ backgroundColor: 'rgba(239, 68, 68, 0.15)', color: '#EF4444' }}>
                    {error}
                  </Alert>
                )}

                <Form onSubmit={handleSubmit}>
                  {/* Role Selector */}
                  <Form.Group className="mb-4">
                    <Form.Label className="form-dark-label d-block text-center mb-2">
                      I want to join Mentorplug as a:
                    </Form.Label>
                    <div className="role-pill-group">
                      <div
                        className={`role-pill-btn ${role === 'mentee' ? 'active' : ''}`}
                        onClick={() => setRole('mentee')}
                      >
                        Mentee (Learner)
                      </div>
                      <div
                        className={`role-pill-btn ${role === 'mentor' ? 'active' : ''}`}
                        onClick={() => setRole('mentor')}
                      >
                        Mentor (Guide)
                      </div>
                    </div>
                  </Form.Group>

                  {/* Full Name */}
                  <Form.Group className="mb-3" controlId="registerName">
                    <Form.Label className="form-dark-label">Full Name</Form.Label>
                    <Form.Control
                      type="text"
                      placeholder="e.g. Joy Wambui"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className="form-dark-control"
                      required
                    />
                  </Form.Group>

                  {/* Email */}
                  <Form.Group className="mb-3" controlId="registerEmail">
                    <Form.Label className="form-dark-label">Email Address</Form.Label>
                    <Form.Control
                      type="email"
                      placeholder="name@example.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="form-dark-control"
                      required
                    />
                  </Form.Group>

                  {/* Password */}
                  <Form.Group className="mb-4" controlId="registerPassword">
                    <Form.Label className="form-dark-label">Password</Form.Label>
                    <Form.Control
                      type="password"
                      placeholder="At least 6 characters"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="form-dark-control"
                      required
                    />
                  </Form.Group>

                  <Button
                    type="submit"
                    className="btn-gold w-100 py-2 d-flex align-items-center justify-content-center"
                    disabled={loading}
                  >
                    {loading ? (
                      <>
                        <Spinner animation="border" size="sm" className="me-2" />
                        Creating Account...
                      </>
                    ) : (
                      `Register as ${role === 'mentor' ? 'Mentor' : 'Mentee'}`
                    )}
                  </Button>
                </Form>

                <div className="text-center mt-4 pt-3 border-top border-secondary border-opacity-25">
                  <p className="text-themed-secondary small mb-0">
                    Already have an account?{' '}
                    <Link to="/login" className="text-gold fw-semibold text-decoration-none">
                      Sign in here
                    </Link>
                  </p>
                </div>
              </Card.Body>
            </Card>
          </Col>
        </Row>
      </Container>
    </div>
  );
};

export default Register;
