import React, { useState } from 'react';
import { Container, Row, Col, Card, Form, Button, Alert, Spinner } from 'react-bootstrap';
import { Link, useNavigate } from 'react-router-dom';
import { useFormik } from 'formik';
import * as Yup from 'yup';
import { useAuth } from '../context/AuthContext';
import GoogleAuthButton from '../components/GoogleAuthButton';

const registerValidationSchema = Yup.object({
  name: Yup.string()
    .trim()
    .min(2, 'Full name must be at least 2 characters')
    .required('Full name is required'),
  email: Yup.string()
    .trim()
    .email('Please enter a valid email address')
    .required('Email address is required'),
  password: Yup.string()
    .min(6, 'Password must be at least 6 characters')
    .required('Password is required'),
  role: Yup.string()
    .oneOf(['mentee', 'mentor'], 'Please select a valid role')
    .required('Please select whether you are a mentee or mentor'),
});

const Register = () => {
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState(null);

  const { register } = useAuth();
  const navigate = useNavigate();

  const formik = useFormik({
    initialValues: {
      name: '',
      email: '',
      password: '',
      role: 'mentee',
    },
    validationSchema: registerValidationSchema,
    onSubmit: async (values, { setSubmitting }) => {
      setError(null);
      try {
        await register(values.name, values.email, values.password, values.role);
        // Direct new user to complete their profile
        navigate('/profile', { replace: true, state: { isNewUser: true } });
      } catch (err) {
        const msg = err.response?.data?.message || 'Registration failed. Please try again.';
        setError(msg);
      } finally {
        setSubmitting(false);
      }
    },
  });

  return (
    <div className="auth-page-bg py-5">
      <Container className="my-auto">
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

                <Form onSubmit={formik.handleSubmit} noValidate>
                  {/* Role Selector */}
                  <Form.Group className="mb-4">
                    <Form.Label className="form-dark-label d-block text-center mb-2">
                      I want to join Mentorplug as a:
                    </Form.Label>
                    <div className="role-pill-group">
                      <div
                        className={`role-pill-btn ${formik.values.role === 'mentee' ? 'active' : ''}`}
                        onClick={() => formik.setFieldValue('role', 'mentee')}
                      >
                        Mentee (Learner)
                      </div>
                      <div
                        className={`role-pill-btn ${formik.values.role === 'mentor' ? 'active' : ''}`}
                        onClick={() => formik.setFieldValue('role', 'mentor')}
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
                      name="name"
                      placeholder="e.g. Joy Wambui"
                      value={formik.values.name}
                      onChange={formik.handleChange}
                      onBlur={formik.handleBlur}
                      isInvalid={formik.touched.name && !!formik.errors.name}
                      className="form-dark-control"
                      disabled={formik.isSubmitting}
                    />
                    {formik.touched.name && formik.errors.name && (
                      <Form.Control.Feedback type="invalid" className="d-block small mt-1">
                        {formik.errors.name}
                      </Form.Control.Feedback>
                    )}
                  </Form.Group>

                  {/* Email */}
                  <Form.Group className="mb-3" controlId="registerEmail">
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

                  {/* Password with Show/Hide toggle */}
                  <Form.Group className="mb-4" controlId="registerPassword">
                    <Form.Label className="form-dark-label">Password</Form.Label>
                    <div className="position-relative">
                      <Form.Control
                        type={showPassword ? 'text' : 'password'}
                        name="password"
                        placeholder="At least 6 characters"
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

                  {/* Create Account Button */}
                  <Button
                    type="submit"
                    className="btn-gold w-100 py-2 d-flex align-items-center justify-content-center"
                    disabled={formik.isSubmitting}
                  >
                    {formik.isSubmitting ? (
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
