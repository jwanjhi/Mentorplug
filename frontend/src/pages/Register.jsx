import React, { useState } from 'react';
import { Container, Row, Col, Card, Form, Button, Alert, Spinner } from 'react-bootstrap';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import GoogleAuthButton from '../components/GoogleAuthButton';

const Register = () => {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
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

                {/* Continue with Google */}
                <GoogleAuthButton buttonText="continue_with" />

                <div className="d-flex align-items-center my-3">
                  <hr className="flex-grow-1 border-secondary border-opacity-25 my-0" />
                  <span className="px-3 fw-bold text-themed-secondary" style={{ fontSize: '0.75rem', letterSpacing: '0.1em' }}>OR</span>
                  <hr className="flex-grow-1 border-secondary border-opacity-25 my-0" />
                </div>

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
                      disabled={loading}
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
                      disabled={loading}
                    />
                  </Form.Group>

                  {/* Password with Show/Hide toggle */}
                  <Form.Group className="mb-4" controlId="registerPassword">
                    <Form.Label className="form-dark-label">Password</Form.Label>
                    <div className="position-relative">
                      <Form.Control
                        type={showPassword ? 'text' : 'password'}
                        placeholder="At least 6 characters"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className="form-dark-control pe-5"
                        required
                        disabled={loading}
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="btn position-absolute top-50 end-0 translate-middle-y text-themed-secondary p-2 me-1"
                        style={{ background: 'transparent', border: 'none', boxShadow: 'none' }}
                        aria-label={showPassword ? 'Hide password' : 'Show password'}
                      >
                        {showPassword ? (
                          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
                            <line x1="1" y1="1" x2="23" y2="23" />
                          </svg>
                        ) : (
                          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                            <circle cx="12" cy="12" r="3" />
                          </svg>
                        )}
                      </button>
                    </div>
                  </Form.Group>

                  {/* Create Account Button */}
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
                      'Create Account'
                    )}
                  </Button>
                </Form>

                {/* Footer link for existing users */}
                <div className="text-center mt-4 pt-3 border-top border-secondary border-opacity-25">
                  <p className="text-themed-secondary small mb-0">
                    Already have an account?{' '}
                    <Link to="/login" className="text-gold fw-semibold text-decoration-none">
                      Sign in
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
