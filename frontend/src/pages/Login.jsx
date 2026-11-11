import React, { useState, useEffect } from 'react';
import { Container, Row, Col, Card, Form, Button, Alert, Spinner, Modal } from 'react-bootstrap';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useFormik } from 'formik';
import * as Yup from 'yup';
import { useAuth } from '../context/AuthContext';
import GoogleAuthButton from '../components/GoogleAuthButton';

const loginValidationSchema = Yup.object({
  email: Yup.string()
    .trim()
    .email('Please enter a valid email address')
    .required('Email address is required'),
  password: Yup.string()
    .required('Password is required'),
});

const Login = () => {
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState(null);
  const [showForgotModal, setShowForgotModal] = useState(false);

  // Two-Factor Authentication state
  const [mfaState, setMfaState] = useState(null); // { required: true, tempToken: '', maskedEmail: '' }
  const [otpCode, setOtpCode] = useState('');
  const [verifyingMfa, setVerifyingMfa] = useState(false);
  const [resending, setResending] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);
  const [resendNotice, setResendNotice] = useState(null);

  const { login, verifyMfa, resendMfa } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  // Cooldown countdown timer for resending OTP
  useEffect(() => {
    let timer;
    if (resendCooldown > 0) {
      timer = setInterval(() => {
        setResendCooldown((prev) => (prev > 0 ? prev - 1 : 0));
      }, 1000);
    }
    return () => {
      if (timer) clearInterval(timer);
    };
  }, [resendCooldown]);

  const handleSuccessRedirect = (user) => {
    const from = location.state?.from?.pathname;
    if (from) {
      navigate(from, { replace: true });
    } else if (user?.role === 'mentor') {
      navigate('/mentor-dashboard', { replace: true });
    } else {
      navigate('/recommendations', { replace: true });
    }
  };

  const formik = useFormik({
    initialValues: {
      email: '',
      password: '',
    },
    validationSchema: loginValidationSchema,
    onSubmit: async (values, { setSubmitting }) => {
      setError(null);
      setResendNotice(null);
      try {
        const result = await login(values.email, values.password);

        // Check if 2FA verification challenge is required
        if (result?.mfaRequired) {
          setMfaState({
            required: true,
            tempToken: result.tempToken,
            maskedEmail: result.maskedEmail,
          });
          setResendCooldown(60);
          setOtpCode('');
          return;
        }

        // Direct login succeeded
        handleSuccessRedirect(result);
      } catch (err) {
        const msg = err.response?.data?.message || 'Login failed. Please check your credentials.';
        setError(msg);
      } finally {
        setSubmitting(false);
      }
    },
  });

  // Handle MFA OTP Verification submission
  const handleVerifyOtp = async (e) => {
    e.preventDefault();
    if (!mfaState?.tempToken || otpCode.trim().length !== 6) return;

    setVerifyingMfa(true);
    setError(null);
    setResendNotice(null);

    try {
      const user = await verifyMfa(mfaState.tempToken, otpCode.trim());
      handleSuccessRedirect(user);
    } catch (err) {
      setError(err.response?.data?.message || 'Invalid or expired verification code. Please try again.');
    } finally {
      setVerifyingMfa(false);
    }
  };

  // Handle Resending MFA OTP
  const handleResendOtp = async () => {
    if (!mfaState?.tempToken || resendCooldown > 0) return;

    setResending(true);
    setError(null);
    setResendNotice(null);

    try {
      await resendMfa(mfaState.tempToken);
      setResendNotice('A fresh 6-digit verification code has been dispatched to your email.');
      setResendCooldown(60);
      setOtpCode('');
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to resend code. Please try again.');
    } finally {
      setResending(false);
    }
  };

  return (
    <div className="auth-page-bg py-5">
      <Container className="my-auto">
        <Row className="justify-content-center">
          <Col xs={12} sm={10} md={8} lg={5}>
            {/* Header branding */}
            <div className="text-center mb-4">
              <span className="tag-gold-outline mb-2 d-inline-block">
                {mfaState?.required ? 'Security Verification' : 'Welcome Back'}
              </span>
              <h2 className="display-6 fw-bold text-themed-primary">
                Sign into Mentor<span className="text-gold">plug</span>
              </h2>
              <p className="text-themed-secondary small">
                {mfaState?.required
                  ? 'Two-factor authentication protects your mentorship journey.'
                  : 'Connect with mentors who are the best fit for your goals.'}
              </p>
            </div>

            {/* Login / MFA Card */}
            <Card className="card-glass-custom p-4 p-md-5">
              <Card.Body className="p-0">
                {error && (
                  <Alert variant="danger" className="py-2 px-3 small border-0 mb-3" style={{ backgroundColor: 'rgba(239, 68, 68, 0.15)', color: '#EF4444' }}>
                    {error}
                  </Alert>
                )}

                {resendNotice && (
                  <Alert variant="success" className="py-2 px-3 small border-0 mb-3" style={{ backgroundColor: 'rgba(34, 197, 94, 0.15)', color: '#22C55E' }}>
                    {resendNotice}
                  </Alert>
                )}

                {/* ── Mode 1: MFA Verification Screen ── */}
                {mfaState?.required ? (
                  <div>
                    <div className="text-center mb-4">
                      <div
                        className="mx-auto mb-3 d-flex align-items-center justify-content-center"
                        style={{
                          width: '56px',
                          height: '56px',
                          borderRadius: '50%',
                          background: 'rgba(201, 168, 76, 0.15)',
                          border: '1.5px solid var(--mp-gold)',
                          fontSize: '1.6rem',
                        }}
                      >
                        🛡️
                      </div>
                      <h5 className="fw-bold text-themed-primary mb-1">Enter Security Code</h5>
                      <p className="text-themed-secondary small mb-0">
                        We sent a 6-digit code to <strong className="text-gold">{mfaState.maskedEmail}</strong>.
                      </p>
                    </div>

                    <Form onSubmit={handleVerifyOtp}>
                      <Form.Group className="mb-4" controlId="mfaOtpInput">
                        <Form.Label className="form-dark-label text-center d-block small mb-2">
                          6-DIGIT EMAIL VERIFICATION CODE
                        </Form.Label>
                        <Form.Control
                          type="text"
                          inputMode="numeric"
                          autoComplete="one-time-code"
                          maxLength={6}
                          placeholder="••••••"
                          value={otpCode}
                          onChange={(e) => {
                            const val = e.target.value.replace(/[^0-9]/g, '').slice(0, 6);
                            setOtpCode(val);
                          }}
                          className="text-center fw-bold form-dark-control"
                          style={{
                            fontSize: '1.75rem',
                            letterSpacing: '0.35em',
                            height: '56px',
                            fontFamily: 'monospace',
                          }}
                          autoFocus
                          required
                          disabled={verifyingMfa}
                        />
                      </Form.Group>

                      <Button
                        type="submit"
                        className="btn-gold w-100 py-2 d-flex align-items-center justify-content-center mb-3"
                        disabled={verifyingMfa || otpCode.length !== 6}
                      >
                        {verifyingMfa ? (
                          <>
                            <Spinner animation="border" size="sm" className="me-2" />
                            Verifying Code...
                          </>
                        ) : (
                          'Verify & Complete Sign In'
                        )}
                      </Button>

                      <div className="d-flex justify-content-between align-items-center small mt-3 pt-2 border-top border-secondary border-opacity-25">
                        <button
                          type="button"
                          className="btn btn-link p-0 text-themed-secondary text-decoration-none"
                          onClick={() => {
                            setMfaState(null);
                            setOtpCode('');
                            setError(null);
                            setResendNotice(null);
                          }}
                        >
                          ← Back to Login
                        </button>

                        <button
                          type="button"
                          className="btn btn-link p-0 text-gold text-decoration-none"
                          disabled={resending || resendCooldown > 0}
                          onClick={handleResendOtp}
                          style={{ opacity: resendCooldown > 0 ? 0.6 : 1 }}
                        >
                          {resending ? (
                            'Sending...'
                          ) : resendCooldown > 0 ? (
                            `Resend code (${resendCooldown}s)`
                          ) : (
                            'Resend Code'
                          )}
                        </button>
                      </div>
                    </Form>
                  </div>
                ) : (
                  /* ── Mode 2: Standard Login Form ── */
                  <>
                    {/* Continue with Google */}
                    <GoogleAuthButton buttonText="continue_with" />

                    <div className="d-flex align-items-center my-3">
                      <hr className="flex-grow-1 border-secondary border-opacity-25 my-0" />
                      <span className="px-3 fw-bold text-themed-secondary" style={{ fontSize: '0.75rem', letterSpacing: '0.1em' }}>OR</span>
                      <hr className="flex-grow-1 border-secondary border-opacity-25 my-0" />
                    </div>

                    <Form onSubmit={formik.handleSubmit} noValidate>
                      {/* Email Input */}
                      <Form.Group className="mb-3" controlId="loginEmail">
                        <Form.Label className="form-dark-label">Email Address</Form.Label>
                        <Form.Control
                          type="email"
                          name="email"
                          placeholder="name@example.com"
                          value={formik.values.email}
                          onChange={formik.handleChange}
                          onBlur={formik.handleBlur}
                          isInvalid={formik.touched.email && !!formik.errors.email}
                          className="form-dark-control"
                          disabled={formik.isSubmitting}
                        />
                        {formik.touched.email && formik.errors.email && (
                          <Form.Control.Feedback type="invalid" className="d-block small mt-1">
                            {formik.errors.email}
                          </Form.Control.Feedback>
                        )}
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
                            name="password"
                            placeholder="••••••••"
                            value={formik.values.password}
                            onChange={formik.handleChange}
                            onBlur={formik.handleBlur}
                            isInvalid={formik.touched.password && !!formik.errors.password}
                            className="form-dark-control pe-5"
                            disabled={formik.isSubmitting}
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
                        {formik.touched.password && formik.errors.password && (
                          <Form.Control.Feedback type="invalid" className="d-block small mt-1">
                            {formik.errors.password}
                          </Form.Control.Feedback>
                        )}
                      </Form.Group>

                      {/* Sign In Button */}
                      <Button
                        type="submit"
                        className="btn-gold w-100 py-2 d-flex align-items-center justify-content-center mt-4"
                        disabled={formik.isSubmitting}
                      >
                        {formik.isSubmitting ? (
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
                  </>
                )}
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
            Self-service email password reset requires transactional email service configuration.
          </p>
          <div className="p-3 mb-3" style={{ background: 'var(--mp-bg-input)', borderRadius: 'var(--mp-radius-card)', border: '1px solid var(--mp-border-subtle)' }}>
            <p className="small text-themed-primary mb-1 fw-semibold">Need to access your account?</p>
            <p className="small text-themed-secondary mb-0">
              Please contact the platform administrator at <strong>support@mentorplug.me</strong> to reset your password or sign in using your linked <strong>Google Account</strong>.
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
