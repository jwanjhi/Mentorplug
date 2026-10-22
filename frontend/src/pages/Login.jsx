import React, { useState } from 'react';
import { Container, Row, Col, Card, Form, Button, Alert, Spinner } from 'react-bootstrap';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

import GoogleAuthButton from '../components/GoogleAuthButton';

const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

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
    <div className="login-page py-5">
      <Container>
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
            <Card className="card-mentor-custom p-4">
              <Card.Body className="p-0">
                {error && (
                  <Alert variant="danger" className="py-2 px-3 small border-0" style={{ backgroundColor: 'rgba(239, 68, 68, 0.15)', color: '#EF4444' }}>
                    {error}
                  </Alert>
                )}

                {/* Google Sign In */}
                <GoogleAuthButton buttonText="signin_with" />

                <div className="d-flex align-items-center my-3">
                  <hr className="flex-grow-1 border-secondary border-opacity-25 my-0" />
                  <span className="px-3 small text-themed-secondary text-uppercase" style={{ fontSize: '0.72rem', letterSpacing: '0.08em' }}>or sign in with email</span>
                  <hr className="flex-grow-1 border-secondary border-opacity-25 my-0" />
                </div>

                <Form onSubmit={handleSubmit}>
                  <Form.Group className="mb-3" controlId="loginEmail">
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

                  <Form.Group className="mb-4" controlId="loginPassword">
                    <Form.Label className="form-dark-label">Password</Form.Label>
                    <Form.Control
                      type="password"
                      placeholder="••••••••"
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
                        Authenticating...
                      </>
                    ) : (
                      'Sign In'
                    )}
                  </Button>
                </Form>

                <div className="text-center mt-4 pt-3 border-top border-secondary border-opacity-25">
                  <p className="text-themed-secondary small mb-0">
                    Don't have an account yet?{' '}
                    <Link to="/register" className="text-gold fw-semibold text-decoration-none">
                      Create an account
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

export default Login;
