import React, { useState, useEffect, useRef } from 'react';
import { Container, Row, Col, Form, Button, Alert, Spinner, Modal, Badge } from 'react-bootstrap';
import { useFormik } from 'formik';
import * as Yup from 'yup';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';
import Avatar from '../components/Avatar';
import { getWhatsAppUrl } from '../services/whatsappHelper';

/* ── Pill Tag Input Component ──────────────────────────────────────────────── */
const TagInput = ({ label, tags, setTags, placeholder }) => {
  const [inputVal, setInputVal] = useState('');

  const add = () => {
    const trimmed = inputVal.trim();
    if (trimmed && !tags.includes(trimmed)) {
      setTags([...tags, trimmed]);
      setInputVal('');
    }
  };

  const remove = (tag) => {
    setTags(tags.filter((t) => t !== tag));
  };

  return (
    <div className="mb-4">
      <label className="form-dark-label mb-2 d-block">{label}</label>
      <div className="d-flex gap-2 mb-2">
        <input
          type="text"
          className="form-dark-control flex-grow-1"
          placeholder={placeholder}
          value={inputVal}
          onChange={(e) => setInputVal(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              add();
            }
          }}
        />
        <button
          type="button"
          className="btn-gold"
          style={{
            borderRadius: 'var(--mp-radius-pill)',
            padding: '0.5rem 1.1rem',
            fontWeight: 700,
            border: 'none',
            cursor: 'pointer',
            background: 'var(--mp-gold)',
            color: '#0A0A0A',
            whiteSpace: 'nowrap',
          }}
          onClick={add}
        >
          + Add
        </button>
      </div>
      <div className="d-flex flex-wrap gap-2">
        {tags.map((t) => (
          <span key={t} className="tag-gold-outline" style={{ cursor: 'default' }}>
            {t}
            <button
              type="button"
              onClick={() => remove(t)}
              style={{
                background: 'none',
                border: 'none',
                color: 'var(--mp-gold)',
                marginLeft: '6px',
                cursor: 'pointer',
                padding: 0,
                fontWeight: 700,
                lineHeight: 1,
              }}
            >
              ×
            </button>
          </span>
        ))}
      </div>
    </div>
  );
};

/* ── Formik Validation Schema ─────────────────────────────────────────────── */
const profileValidationSchema = Yup.object({
  bio: Yup.string()
    .trim()
    .required('Please write a short bio before saving.'),
  experience_years: Yup.number()
    .typeError('Years of experience must be a valid number')
    .min(0, 'Cannot be negative')
    .max(60, 'Maximum 60 years')
    .nullable()
    .transform((value, originalValue) => (String(originalValue).trim() === '' ? null : value)),
  whatsapp: Yup.string()
    .trim()
    .nullable(),
  linkedin_url: Yup.string()
    .trim()
    .url('Please enter a valid URL (e.g. https://linkedin.com/in/username)')
    .nullable()
    .transform((value, originalValue) => (String(originalValue).trim() === '' ? null : value)),
});

/* ── Main Profile Page ───────────────────────────────────────────────────────── */
export default function Profile() {
  const { user } = useAuth();
  const [avatarUrl, setAvatarUrl] = useState(null);
  const [loading, setLoading] = useState(true);
  const [alert, setAlert] = useState(null); // { type: 'success'|'danger', msg }

  const cvFileRef = useRef(null);
  const [parsingCv, setParsingCv] = useState(false);

  /* Phone SMS OTP Verification State */
  const [phoneVerified, setPhoneVerified] = useState(false);
  const [showOtpModal, setShowOtpModal] = useState(false);
  const [otpSending, setOtpSending] = useState(false);
  const [otpVerifying, setOtpVerifying] = useState(false);
  const [otpCode, setOtpCode] = useState('');
  const [demoCodeNotice, setDemoCodeNotice] = useState(null);
  const [otpModalAlert, setOtpModalAlert] = useState(null);
  const [countdown, setCountdown] = useState(0);
  const [isContactUsername, setIsContactUsername] = useState(false);
  const [verifiedContactTarget, setVerifiedContactTarget] = useState('');

  /* 5-minute countdown timer effect */
  useEffect(() => {
    let timer;
    if (showOtpModal && countdown > 0) {
      timer = setInterval(() => {
        setCountdown((prev) => (prev > 0 ? prev - 1 : 0));
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [showOtpModal, countdown]);

  const formatCountdown = (secs) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  /* Send verification OTP code to user's phone or WhatsApp username */
  const handleInitiateOtp = async () => {
    const contact = formik.values.whatsapp?.trim();
    if (!contact || contact.length < 3) {
      setAlert({ type: 'danger', msg: 'Please enter a valid phone number (+254...) or WhatsApp username (@handle) before verifying.' });
      return;
    }

    setOtpSending(true);
    setOtpModalAlert(null);
    try {
      const res = await api.post('/auth/phone/send-otp', { contact });
      setIsContactUsername(Boolean(res.data.isUsername));
      setVerifiedContactTarget(res.data.contact);
      setDemoCodeNotice(res.data.isDemo ? res.data.demoCode : null);
      setCountdown(res.data.expiresInSeconds || 300);
      setOtpCode('');
      setShowOtpModal(true);
      setOtpModalAlert({
        type: 'info',
        msg: res.data.message || 'Verification code dispatched.',
      });
    } catch (err) {
      const msg = err.response?.data?.message || 'Failed to dispatch verification code. Please check your contact and try again.';
      setAlert({ type: 'danger', msg });
    } finally {
      setOtpSending(false);
    }
  };

  /* Confirm 6-digit OTP code */
  const handleConfirmOtp = async () => {
    if (!otpCode || otpCode.trim().length !== 6) {
      setOtpModalAlert({ type: 'danger', msg: 'Please enter all 6 digits of your verification code.' });
      return;
    }
    setOtpVerifying(true);
    setOtpModalAlert(null);
    try {
      const res = await api.post('/auth/phone/verify-otp', {
        contact: verifiedContactTarget || formik.values.whatsapp?.trim(),
        code: otpCode.trim(),
      });
      setPhoneVerified(true);
      if (res.data.contact) {
        formik.setFieldValue('whatsapp', res.data.contact);
      }
      setShowOtpModal(false);
      setAlert({
        type: 'success',
        msg: res.data.message || '✓ Contact successfully verified and linked to your MentorPlug profile!',
      });
    } catch (err) {
      const msg = err.response?.data?.message || 'Verification failed. Please check the code and try again.';
      setOtpModalAlert({ type: 'danger', msg });
    } finally {
      setOtpVerifying(false);
    }
  };

  const formik = useFormik({
    initialValues: {
      bio: '',
      skills: [],
      interests: [],
      experience_years: '',
      whatsapp: '',
      linkedin_url: '',
    },
    validationSchema: profileValidationSchema,
    onSubmit: async (values, { setSubmitting }) => {
      setAlert(null);
      try {
        await api.post('/profiles', {
          bio: values.bio.trim(),
          skills: values.skills,
          interests: values.interests,
          experience_years: values.experience_years === '' || values.experience_years === null ? null : Number(values.experience_years),
          whatsapp: values.whatsapp.trim() || null,
          linkedin_url: values.linkedin_url.trim() || null,
        });
        setAlert({ type: 'success', msg: 'Your profile has been saved and your match embedding updated!' });
      } catch (err) {
        const msg = err.response?.data?.error || 'Failed to save profile. Please try again.';
        setAlert({ type: 'danger', msg });
      } finally {
        setSubmitting(false);
      }
    },
  });

  /* CV SBERT Extraction handler */
  const handleCvUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.name.toLowerCase().endsWith('.pdf')) {
      return setAlert({ type: 'danger', msg: 'Please select a valid PDF document (.pdf).' });
    }

    if (file.size > 10 * 1024 * 1024) {
      return setAlert({ type: 'danger', msg: 'File size exceeds 10MB limit.' });
    }

    const formData = new FormData();
    formData.append('cv', file);

    setParsingCv(true);
    setAlert(null);
    try {
      const res = await api.post('/profiles/parse-cv', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      const data = res.data.data;
      if (data.bio) formik.setFieldValue('bio', data.bio);
      if (Array.isArray(data.skills) && data.skills.length > 0) {
        formik.setFieldValue('skills', [...new Set([...formik.values.skills, ...data.skills])]);
      }
      if (Array.isArray(data.interests) && data.interests.length > 0) {
        formik.setFieldValue('interests', [...new Set([...formik.values.interests, ...data.interests])]);
      }
      if (data.experience_years) {
        formik.setFieldValue('experience_years', String(data.experience_years));
      }

      setAlert({
        type: 'success',
        msg: `✨ We've analyzed "${file.name}" and filled in your profile! Review and adjust anything before saving.`,
      });
    } catch (err) {
      const msg = err.response?.data?.error || 'Failed to extract text from CV. Please try again.';
      setAlert({ type: 'danger', msg });
    } finally {
      setParsingCv(false);
      if (cvFileRef.current) cvFileRef.current.value = '';
    }
  };

  /* Fetch existing profile */
  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const res = await api.get('/profiles/me');
        const p = res.data;
        formik.setValues({
          bio: p.bio || '',
          skills: p.skills || [],
          interests: p.interests || [],
          experience_years: p.experience_years !== null && p.experience_years !== undefined ? String(p.experience_years) : '',
          whatsapp: p.whatsapp || '',
          linkedin_url: p.linkedin_url || '',
        });
        setAvatarUrl(p.avatar_url || null);
        setPhoneVerified(Boolean(p.phone_verified));
      } catch (err) {
        // 404 means no profile yet — that's fine
        if (err.response?.status !== 404) {
          setAlert({ type: 'danger', msg: 'Could not load your profile. Please try again.' });
        }
      } finally {
        setLoading(false);
      }
    };
    fetchProfile();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (loading) {
    return (
      <Container className="py-5 text-center">
        <Spinner animation="border" style={{ color: 'var(--mp-gold)' }} />
        <p className="text-themed-secondary mt-3 small">Loading your profile…</p>
      </Container>
    );
  }

  return (
    <div className="profile-page-bg py-5">
      <Container style={{ maxWidth: '1120px' }}>
        {/* Top Identity & Resume Ingest Bar */}
        <div className="card-glass-custom p-4 mb-4">
          <div className="d-flex flex-column flex-md-row align-items-md-center justify-content-between gap-4">
            {/* Left: User Identity */}
            <div className="d-flex align-items-center gap-3">
              <div>
                <Avatar
                  avatarUrl={avatarUrl}
                  name={user?.name || ''}
                  size={72}
                  editable
                  onUpload={(newUrl) => setAvatarUrl(newUrl)}
                />
                <p className="text-themed-secondary text-center mt-1 mb-0" style={{ fontSize: '0.68rem', maxWidth: 72 }}>
                  Click photo
                </p>
              </div>
              <div>
                <div className="d-flex align-items-center gap-2 flex-wrap mb-1">
                  <h1 className="h4 fw-bolder mb-0 text-themed-primary" style={{ fontFamily: 'var(--font-heading)' }}>
                    {user?.name}
                  </h1>
                  <span className="badge rounded-pill text-uppercase px-2 py-1" style={{ fontSize: '0.7rem', background: 'var(--mp-gold-tint)', color: 'var(--mp-gold)', border: '1px solid var(--mp-gold-border)' }}>
                    {user?.role}
                  </span>
                </div>
                <p className="text-themed-secondary small mb-0">{user?.email}</p>
              </div>
            </div>

            {/* Right: CV Auto-Fill Feature */}
            <div className="p-3" style={{ background: 'var(--mp-bg-input)', borderRadius: 'var(--mp-radius-card)', border: '1px solid var(--mp-border-subtle)', minWidth: '320px' }}>
              <div className="d-flex align-items-center justify-content-between gap-3">
                <div>
                  <div className="d-flex align-items-center gap-1 mb-1">
                    <span role="img" aria-label="document" style={{ fontSize: '0.9rem' }}>📄</span>
                    <strong className="text-themed-primary small">Auto-Fill with CV / Resume</strong>
                  </div>
                  <p className="text-themed-secondary mb-0" style={{ fontSize: '0.74rem' }}>
                    Extracts bio, skills, and experience in 1-click.
                  </p>
                </div>
                <div>
                  <input
                    type="file"
                    ref={cvFileRef}
                    accept=".pdf,application/pdf"
                    className="d-none"
                    onChange={handleCvUpload}
                  />
                  <Button
                    className="btn-gold"
                    size="sm"
                    style={{ whiteSpace: 'nowrap' }}
                    disabled={parsingCv || formik.isSubmitting}
                    onClick={() => cvFileRef.current?.click()}
                  >
                    {parsingCv ? (
                      <>
                        <Spinner size="sm" className="me-1" />
                        Analyzing…
                      </>
                    ) : (
                      'Upload PDF'
                    )}
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>

        {alert && (
          <Alert variant={alert.type} dismissible onClose={() => setAlert(null)} className="mb-4">
            {alert.msg}
          </Alert>
        )}

        <Form onSubmit={formik.handleSubmit} noValidate>
          <Row className="g-4">
            {/* LEFT COLUMN: Narrative Bio, Skills & Topics */}
            <Col lg={7}>
              <div className="card-glass-custom p-4 h-100 d-flex flex-column">
                <div className="d-flex align-items-center justify-content-between pb-3 mb-3 border-bottom border-secondary border-opacity-25">
                  <h5 className="fw-bold text-themed-primary mb-0" style={{ fontFamily: 'var(--font-heading)' }}>
                    Core Profile & Expertise
                  </h5>
                </div>

                {/* Bio */}
                <Form.Group className="mb-4" controlId="profileBio">
                  <Form.Label className="form-dark-label">
                    {user?.role === 'mentor'
                      ? 'About You (What you can help mentees with)'
                      : 'About You (What you want to learn and achieve)'}
                  </Form.Label>
                  <Form.Control
                    as="textarea"
                    rows={4}
                    name="bio"
                    className="form-dark-control"
                    placeholder={
                      user?.role === 'mentor'
                        ? 'E.g. I am a senior software engineer with experience in cloud architectures and backend systems…'
                        : 'E.g. I am a fourth-year student looking to build practical skills in data science and web development…'
                    }
                    value={formik.values.bio}
                    onChange={formik.handleChange}
                    onBlur={formik.handleBlur}
                    isInvalid={formik.touched.bio && !!formik.errors.bio}
                    style={{ resize: 'vertical' }}
                    disabled={formik.isSubmitting}
                  />
                  {formik.touched.bio && formik.errors.bio && (
                    <Form.Control.Feedback type="invalid" className="d-block small mt-1">
                      {formik.errors.bio}
                    </Form.Control.Feedback>
                  )}
                </Form.Group>

                {/* Skills */}
                <TagInput
                  label={user?.role === 'mentor' ? 'Your Skills & Technologies (what you teach)' : 'Skills You Have'}
                  tags={formik.values.skills}
                  setTags={(newTags) => formik.setFieldValue('skills', newTags)}
                  placeholder="e.g. Python, React, PostgreSQL — type & press Enter"
                />

                {/* Interests */}
                <TagInput
                  label={user?.role === 'mentor' ? 'Mentoring Focus Areas' : 'Interests & Topics You Want to Learn'}
                  tags={formik.values.interests}
                  setTags={(newTags) => formik.setFieldValue('interests', newTags)}
                  placeholder="e.g. Artificial Intelligence, Career Transition, System Design"
                />
              </div>
            </Col>

            {/* RIGHT COLUMN: Experience, Communication Channels & Save Action */}
            <Col lg={5}>
              <div className="card-glass-custom p-4 h-100 d-flex flex-column justify-content-between">
                <div>
                  <div className="d-flex align-items-center justify-content-between pb-3 mb-3 border-bottom border-secondary border-opacity-25">
                    <h5 className="fw-bold text-themed-primary mb-0" style={{ fontFamily: 'var(--font-heading)' }}>
                      Experience & Channels
                    </h5>
                    <span className="text-themed-secondary small">Direct Contact</span>
                  </div>

                  {/* Experience Years */}
                  <Form.Group className="mb-4" controlId="profileExperienceYears">
                    <Form.Label className="form-dark-label">Years of Experience</Form.Label>
                    <div className="d-flex align-items-center gap-2">
                      <Form.Control
                        type="number"
                        min="0"
                        max="60"
                        name="experience_years"
                        className="form-dark-control"
                        placeholder="e.g. 2"
                        value={formik.values.experience_years}
                        onChange={formik.handleChange}
                        onBlur={formik.handleBlur}
                        isInvalid={formik.touched.experience_years && !!formik.errors.experience_years}
                        style={{ maxWidth: '140px' }}
                        disabled={formik.isSubmitting}
                      />
                      <span className="text-themed-secondary small">years</span>
                    </div>
                    {formik.touched.experience_years && formik.errors.experience_years && (
                      <Form.Control.Feedback type="invalid" className="d-block small mt-1">
                        {formik.errors.experience_years}
                      </Form.Control.Feedback>
                    )}
                  </Form.Group>

                  {/* Direct Channels */}
                  <div className="mb-4">
                    <h6 className="fw-bold text-themed-primary small mb-1">Direct Communication Channels</h6>
                    <p className="text-themed-secondary small mb-3" style={{ fontSize: '0.78rem' }}>
                      Contact details are unlocked exclusively after a match request is mutually accepted.
                    </p>

                    <Form.Group className="mb-3" controlId="profileWhatsapp">
                      <div className="d-flex align-items-center justify-content-between mb-1">
                        <Form.Label className="form-dark-label mb-0">WhatsApp Number or @Username</Form.Label>
                        {phoneVerified ? (
                          <Badge bg="success" className="d-inline-flex align-items-center gap-1 px-2 py-1" style={{ fontSize: '0.72rem' }}>
                            {formik.values.whatsapp?.startsWith('@') ? '✓ Verified Handle' : '✓ Verified Phone'}
                          </Badge>
                        ) : (
                          <span className="badge bg-secondary text-white" style={{ fontSize: '0.70rem', opacity: 0.85 }}>
                            Unverified
                          </span>
                        )}
                      </div>
                      <div className="d-flex gap-2">
                        <Form.Control
                          type="text"
                          name="whatsapp"
                          className="form-dark-control"
                          placeholder="e.g. +254712345678 or @username"
                          value={formik.values.whatsapp}
                          onChange={(e) => {
                            formik.handleChange(e);
                            if (phoneVerified) setPhoneVerified(false);
                          }}
                          onBlur={formik.handleBlur}
                          isInvalid={formik.touched.whatsapp && !!formik.errors.whatsapp}
                          disabled={formik.isSubmitting}
                        />
                        <Button
                          variant={phoneVerified ? "outline-secondary" : "outline-warning"}
                          size="sm"
                          style={{ whiteSpace: 'nowrap', borderRadius: 'var(--mp-radius-pill)', fontWeight: 600, padding: '0.4rem 0.9rem' }}
                          onClick={handleInitiateOtp}
                          disabled={otpSending || formik.isSubmitting || !formik.values.whatsapp || formik.values.whatsapp.trim().length < 3}
                        >
                          {otpSending ? <Spinner animation="border" size="sm" /> : (phoneVerified ? 'Re-verify' : 'Verify Contact')}
                        </Button>
                      </div>
                      <Form.Text className="text-themed-secondary d-block mt-1" style={{ fontSize: '0.72rem' }}>
                        {phoneVerified 
                          ? 'Phone number verified. Enables 1-click WhatsApp messaging upon match acceptance.' 
                          : 'Enter your phone number (e.g. +254712345678) or WhatsApp handle (e.g. @username).'}
                      </Form.Text>
                      {formik.touched.whatsapp && formik.errors.whatsapp && (
                        <Form.Control.Feedback type="invalid" className="d-block small mt-1">
                          {formik.errors.whatsapp}
                        </Form.Control.Feedback>
                      )}
                    </Form.Group>

                    <Form.Group className="mb-3" controlId="profileLinkedin">
                      <Form.Label className="form-dark-label">LinkedIn / Portfolio URL</Form.Label>
                      <Form.Control
                        type="url"
                        name="linkedin_url"
                        className="form-dark-control"
                        placeholder="https://linkedin.com/in/username"
                        value={formik.values.linkedin_url}
                        onChange={formik.handleChange}
                        onBlur={formik.handleBlur}
                        isInvalid={formik.touched.linkedin_url && !!formik.errors.linkedin_url}
                        disabled={formik.isSubmitting}
                      />
                      {formik.touched.linkedin_url && formik.errors.linkedin_url && (
                        <Form.Control.Feedback type="invalid" className="d-block small mt-1">
                          {formik.errors.linkedin_url}
                        </Form.Control.Feedback>
                      )}
                    </Form.Group>
                  </div>
                </div>

                {/* Profile Readiness & Save Action */}
                <div className="pt-3 border-top border-secondary border-opacity-25">
                  <div className="d-flex align-items-center justify-content-between mb-3 px-1">
                    <span className="text-themed-secondary small">
                      Skills: <strong className="text-gold">{formik.values.skills.length}</strong>
                    </span>
                    <span className="text-themed-secondary small">
                      Topics: <strong className="text-gold">{formik.values.interests.length}</strong>
                    </span>
                    <span className="text-themed-secondary small">
                      {formik.values.bio.trim() ? '✓ Bio ready' : '⚠ Bio needed'}
                    </span>
                  </div>

                  <Button
                    type="submit"
                    className="btn-gold btn-lg w-100"
                    disabled={formik.isSubmitting}
                  >
                    {formik.isSubmitting ? (
                      <>
                        <Spinner size="sm" className="me-2" />
                        Saving Profile…
                      </>
                    ) : (
                      'Save Profile'
                    )}
                  </Button>
                  <p className="text-themed-secondary text-center small mt-2 mb-0" style={{ fontSize: '0.74rem' }}>
                    Saving updates your AI match embedding automatically.
                  </p>
                </div>
              </div>
            </Col>
          </Row>
        </Form>

        {/* Phone & WhatsApp Username Verification Modal */}
        <Modal
          show={showOtpModal}
          onHide={() => !otpVerifying && setShowOtpModal(false)}
          centered
          contentClassName="card-mentor-custom border-0"
        >
          <Modal.Header closeButton={!otpVerifying} closeVariant="white" className="border-0 px-4 pt-4 pb-2">
            <Modal.Title className="fw-bold text-themed-primary h5 mb-0" style={{ fontFamily: 'var(--font-heading)' }}>
              {isContactUsername ? 'Verify WhatsApp Username' : 'Verify Phone Number'}
            </Modal.Title>
          </Modal.Header>
          <Modal.Body className="px-4 py-3" style={{ background: 'var(--mp-bg-card)' }}>
            <p className="text-themed-secondary small mb-3">
              {isContactUsername
                ? <>Verifying WhatsApp handle: <strong className="text-gold">{verifiedContactTarget || formik.values.whatsapp}</strong>.</>
                : <>We dispatched a 6-digit verification code to <strong>{verifiedContactTarget || formik.values.whatsapp}</strong>.</>}
            </p>

            {/* If username, provide direct 1-click test link */}
            {isContactUsername && (
              <div className="mb-3 text-center">
                <a
                  href={getWhatsAppUrl(verifiedContactTarget || formik.values.whatsapp, `MentorPlug Verification Code: ${demoCodeNotice || ''}`)}
                  target="_blank"
                  rel="noreferrer"
                  className="btn btn-sm fw-semibold d-inline-flex align-items-center gap-1 shadow-sm"
                  style={{ background: '#25D366', color: '#fff', borderRadius: 'var(--mp-radius-pill)', fontSize: '0.78rem', padding: '0.35rem 0.9rem' }}
                >
                  <span>💬</span> Open WhatsApp to Test Handle
                </a>
              </div>
            )}

            {/* Smart In-App Demo Display */}
            {demoCodeNotice && (
              <div
                className="p-3 mb-3 rounded-3"
                style={{
                  background: 'rgba(212, 160, 23, 0.12)',
                  border: '1px solid rgba(212, 160, 23, 0.4)'
                }}
              >
                <div className="d-flex align-items-center justify-content-between mb-1">
                  <span className="small fw-bold text-warning">
                    💡 {isContactUsername ? 'WhatsApp Handle Verification Token' : 'In-App Demo SMS OTP'}
                  </span>
                  <Button
                    size="sm"
                    className="btn-gold"
                    style={{ fontSize: '0.72rem', padding: '0.2rem 0.6rem' }}
                    onClick={() => setOtpCode(demoCodeNotice)}
                  >
                    Auto-Fill
                  </Button>
                </div>
                <div className="h3 fw-bold mb-1 text-white" style={{ letterSpacing: '6px' }}>
                  {demoCodeNotice}
                </div>
                <div className="text-themed-secondary" style={{ fontSize: '0.72rem' }}>
                  Valid for 5 minutes. No fees required.
                </div>
              </div>
            )}

            {otpModalAlert && (
              <Alert variant={otpModalAlert.type} className="py-2 small mb-3">
                {otpModalAlert.msg}
              </Alert>
            )}

            <Form.Group className="mb-3 text-center">
              <Form.Label className="form-dark-label d-block text-center mb-2">
                Enter 6-Digit Code
              </Form.Label>
              <Form.Control
                type="text"
                maxLength={6}
                autoFocus
                className="form-dark-control text-center fw-bold fs-4"
                style={{ letterSpacing: '8px', maxWidth: '220px', margin: '0 auto' }}
                placeholder="······"
                value={otpCode}
                onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, ''))}
                disabled={otpVerifying}
              />
              <div className="text-themed-secondary small mt-2">
                {countdown > 0 ? (
                  <span>Code expires in: <strong className="text-gold">{formatCountdown(countdown)}</strong></span>
                ) : (
                  <span className="text-danger">Code expired. Please request a new code.</span>
                )}
              </div>
            </Form.Group>

            <div className="d-flex flex-column gap-2 mt-4">
              <Button
                className="btn-gold w-100"
                onClick={handleConfirmOtp}
                disabled={otpVerifying || otpCode.trim().length !== 6 || countdown === 0}
              >
                {otpVerifying ? (
                  <>
                    <Spinner size="sm" className="me-2" />
                    Verifying…
                  </>
                ) : (
                  isContactUsername ? 'Confirm & Verify Handle' : 'Confirm & Verify Phone'
                )}
              </Button>
              <Button
                variant="link"
                className="text-themed-secondary small text-decoration-none text-center"
                onClick={handleInitiateOtp}
                disabled={otpSending || otpVerifying}
              >
                {otpSending ? 'Resending code…' : (isContactUsername ? "Didn't receive code? Resend Handle Code" : "Didn't receive code? Resend SMS OTP")}
              </Button>
            </div>
          </Modal.Body>
        </Modal>
      </Container>
    </div>
  );
}
