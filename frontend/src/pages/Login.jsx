import React, { useState } from 'react';
import { Container, Row, Col, Card, Form, Button, Alert, Spinner, Modal } from 'react-bootstrap';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import GoogleAuthButton from '../components/GoogleAuthButton';

const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [showForgotModal, setShowForgotModal] = useState(false);

  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);

    if (!email || !password) {
      setError('Please provide both email and password.');
      return;
    }

    try {
      setLoading(true);
      const user = await login(email, password);

      // Determine redirect path
      const from = location.state?.from?.pathname;
      if (from) {
        navigate(from, { replace: true });
      } else if (user.role === 'mentor') {
        navigate('/mentor-dashboard', { replace: true });
      } else {
        navigate('/recommendations', { replace: true });
      }
    } catch (err) {
      const msg = err.response?.data?.message || 'Login failed. Please check your credentials.';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page-bg py-5">
      <Container className="my-auto">
        <Row className="justify-content-center">
          <Col xs={12} sm={10} md={8} lg={5}>
            {/* Header branding */}
            <div className="text-center mb-4">
              <span className="tag-gold-outline mb-2 d-inline-block">Welcome Back</span>
              <h2 className="display-6 fw-bold text-themed-primary">
                Sign into Mentor<span className="text-gold">plug</span>
              </h2>
              <p className="text-themed-secondary small">
                Connect with mentors who are the best fit for your goals.
              </p>
            </div>

            {/* Login Card */}
            <Card className="card-glass-custom p-4 p-md-5">
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
                  {/* Email Input */}
                  <Form.Group className="mb-3" controlId="loginEmail">
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

                  {/* Password Input with Show/Hide toggle */}
                  <Form.Group className="mb-3" controlId="loginPassword">
                    <div className="d-flex justify-content-between align-items-center mb-1">
                      <Form.Label className="form-dark-label mb-0">Password</Form.Label>
                      <button
                        type="button"
                        onClick={() => setShowForgotModal(true)}
                        className="btn btn-link p-0 text-gold small text-decoration-none"
                        style={{ fontSize: '0.8rem' }}
                      >
                        Forgot password?
                      </button>
                    </div>

                    <div className="position-relative">
                      <Form.Control
                        type={showPassword ? 'text' : 'password'}
                        placeholder="••••••••"
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

                  {/* Sign In Button */}
                  <Button
                    type="submit"
                    className="btn-gold w-100 py-2 d-flex align-items-center justify-content-center mt-4"
                    disabled={loading}
                  >
                    {loading ? (
                      <>
                        <Spinner animation="border" size="sm" className="me-2" />
                        Signing In...
                      </>
                    ) : (
                      'Sign In'
                    )}
                  </Button>
                </Form>

                {/* Footer link */}
                <div className="text-center mt-4 pt-3 border-top border-secondary border-opacity-25">
                  <p className="text-themed-secondary small mb-0">
                    Don't have an account?{' '}
                    <Link to="/register" className="text-gold fw-semibold text-decoration-none">
                      Sign up
                    </Link>
                  </p>
                </div>
              </Card.Body>
            </Card>
          </Col>
        </Row>
      </Container>

      {/* Forgot Password Informational Modal */}
      <Modal
        show={showForgotModal}
        onHide={() => setShowForgotModal(false)}
        centered
        contentClassName="card-mentor-custom border-0 p-3"
      >
        <Modal.Header closeButton className="border-0 pb-0">
          <Modal.Title className="fw-bold text-themed-primary h5">
            Reset Password
          </Modal.Title>
        </Modal.Header>
        <Modal.Body className="pt-2">
          <p className="text-themed-secondary small mb-3">
            Self-service email password reset requires transactional email service configuration (e.g. SMTP/SendGrid).
          </p>
          <div className="p-3 mb-3" style={{ background: 'var(--mp-bg-input)', borderRadius: 'var(--mp-radius-card)', border: '1px solid var(--mp-border-subtle)' }}>
            <p className="small text-themed-primary mb-1 fw-semibold">Need to access your account?</p>
            <p className="small text-themed-secondary mb-0">
              Please contact the platform administrator at <strong>support@mentorplug.local</strong> to reset your password or sign in using your linked <strong>Google Account</strong>.
            </p>
          </div>
          <div className="d-flex justify-content-end">
            <Button className="btn-gold" size="sm" onClick={() => setShowForgotModal(false)}>
              Got it
            </Button>
          </div>
        </Modal.Body>
      </Modal>
    </div>
  );
};

export default Login;
