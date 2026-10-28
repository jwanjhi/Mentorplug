import React, { useState, useEffect, useRef } from 'react';
import { Container, Row, Col, Form, Button, Alert, Spinner } from 'react-bootstrap';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';
import Avatar from '../components/Avatar';

/* ── Tag chip input ─────────────────────────────────────────────────────────── */
const TagInput = ({ label, tags, setTags, placeholder }) => {
  const [input, setInput] = useState('');

  const add = () => {
    const val = input.trim();
    if (val && !tags.includes(val)) setTags([...tags, val]);
    setInput('');
  };

  const remove = (t) => setTags(tags.filter((x) => x !== t));

  return (
    <div className="mb-4">
      <label className="form-dark-label">{label}</label>
      <div className="d-flex gap-2 mb-2">
        <input
          className="form-dark-control flex-grow-1"
          style={{ borderRadius: 'var(--mp-radius-input)', padding: '0.6rem 1rem', background: 'var(--mp-bg-input)', border: '1px solid var(--mp-border-subtle)', color: 'var(--mp-text-primary)', fontSize: '0.95rem' }}
          value={input}
          placeholder={placeholder}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); add(); } }}
        />
        <button type="button" className="btn-gold" style={{ borderRadius: 'var(--mp-radius-pill)', padding: '0.5rem 1.1rem', fontWeight: 700, border: 'none', cursor: 'pointer', background: 'var(--mp-gold)', color: '#0A0A0A', whiteSpace: 'nowrap' }} onClick={add}>
          + Add
        </button>
      </div>
      <div className="d-flex flex-wrap gap-2">
        {tags.map((t) => (
          <span key={t} className="tag-gold-outline" style={{ cursor: 'default' }}>
            {t}
            <button type="button" onClick={() => remove(t)} style={{ background: 'none', border: 'none', color: 'var(--mp-gold)', marginLeft: '6px', cursor: 'pointer', padding: 0, fontWeight: 700, lineHeight: 1 }}>×</button>
          </span>
        ))}
      </div>
    </div>
  );
};

/* ── Main Profile Page ───────────────────────────────────────────────────────── */
export default function Profile() {
  const { user, setUser } = useAuth();

  const [bio, setBio] = useState('');
  const [skills, setSkills] = useState([]);
  const [interests, setInterests] = useState([]);
  const [experienceYears, setExperienceYears] = useState('');
  const [whatsapp, setWhatsapp] = useState('');
  const [linkedinUrl, setLinkedinUrl] = useState('');
  const [avatarUrl, setAvatarUrl] = useState(null);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [alert, setAlert] = useState(null); // { type: 'success'|'danger', msg }

  const cvFileRef = useRef(null);
  const [parsingCv, setParsingCv] = useState(false);

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
      if (data.bio) setBio(data.bio);
      if (Array.isArray(data.skills) && data.skills.length > 0) {
        setSkills((prev) => [...new Set([...prev, ...data.skills])]);
      }
      if (Array.isArray(data.interests) && data.interests.length > 0) {
        setInterests((prev) => [...new Set([...prev, ...data.interests])]);
      }
      if (data.experience_years) {
        setExperienceYears(String(data.experience_years));
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
        setBio(p.bio || '');
        setSkills(p.skills || []);
        setInterests(p.interests || []);
        setExperienceYears(p.experience_years ?? '');
        setWhatsapp(p.whatsapp || '');
        setLinkedinUrl(p.linkedin_url || '');
        setAvatarUrl(p.avatar_url || null);
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
  }, []);

  /* Save profile */
  const handleSave = async (e) => {
    e.preventDefault();
    if (!bio.trim()) return setAlert({ type: 'danger', msg: 'Please write a short bio before saving.' });

    setSaving(true);
    setAlert(null);
    try {
      await api.post('/profiles', {
        bio: bio.trim(),
        skills,
        interests,
        experience_years: experienceYears === '' ? null : Number(experienceYears),
        whatsapp: whatsapp.trim() || null,
        linkedin_url: linkedinUrl.trim() || null,
      });
      setAlert({ type: 'success', msg: 'Your profile has been saved and your match embedding updated!' });
    } catch (err) {
      const msg = err.response?.data?.error || 'Failed to save profile. Please try again.';
      setAlert({ type: 'danger', msg });
    } finally {
      setSaving(false);
    }
  };

  const initials = user?.name
    ? user.name.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2)
    : '??';

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
                  <span className="tag-gold-outline" style={{ fontSize: '0.75rem', textTransform: 'capitalize' }}>
                    {user?.role}
                  </span>
                </div>
                <span className="text-themed-secondary small">{user?.email}</span>
              </div>
            </div>

            {/* Right: Quick CV / Resume Auto-fill */}
            <div
              className="p-3 d-flex align-items-center justify-content-between gap-3 flex-grow-1 flex-md-grow-0"
              style={{
                background: 'rgba(212, 175, 55, 0.08)',
                border: '1.5px dashed var(--mp-gold-border)',
                borderRadius: 'var(--mp-radius-input)',
                minWidth: '320px',
              }}
            >
              <div>
                <div className="fw-bold text-themed-primary small d-flex align-items-center gap-2 mb-0">
                  <span>📄</span> Auto-Fill with CV / Resume
                </div>
                <span className="text-themed-secondary" style={{ fontSize: '0.75rem' }}>
                  Extracts bio, skills, and experience in 1-click.
                </span>
              </div>
              <div>
                <input
                  type="file"
                  ref={cvFileRef}
                  accept=".pdf"
                  style={{ display: 'none' }}
                  onChange={handleCvUpload}
                />
                <Button
                  className="btn-gold"
                  size="sm"
                  style={{ whiteSpace: 'nowrap' }}
                  onClick={() => cvFileRef.current?.click()}
                  disabled={parsingCv}
                >
                  {parsingCv ? (
                    <>
                      <Spinner size="sm" className="me-2" />
                      Reading…
                    </>
                  ) : (
                    'Upload PDF'
                  )}
                </Button>
              </div>
            </div>
          </div>
        </div>

        {alert && (
          <Alert
            variant={alert.type}
            className="mb-4"
            style={{
              borderRadius: 'var(--mp-radius-card)',
              background: alert.type === 'success' ? 'rgba(201,168,76,0.12)' : 'rgba(220,53,69,0.12)',
              border: `1px solid ${alert.type === 'success' ? 'var(--mp-gold-border)' : 'rgba(220,53,69,0.4)'}`,
              color: alert.type === 'success' ? 'var(--mp-gold)' : '#F87171',
            }}
            onClose={() => setAlert(null)}
            dismissible
          >
            {alert.msg}
          </Alert>
        )}

        <Form onSubmit={handleSave}>
          <Row className="g-4">
            {/* LEFT COLUMN: Narrative Bio, Skills & Topics */}
            <Col lg={7}>
              <div className="card-glass-custom p-4 h-100 d-flex flex-column">
                <div className="d-flex align-items-center justify-content-between pb-3 mb-3 border-bottom border-secondary border-opacity-25">
                  <h5 className="fw-bold text-themed-primary mb-0" style={{ fontFamily: 'var(--font-heading)' }}>
                    Core Profile & Expertise
                  </h5>
                  <span className="text-themed-secondary small">NLP Matched</span>
                </div>

                {/* Bio */}
                <Form.Group className="mb-4">
                  <Form.Label className="form-dark-label">
                    {user?.role === 'mentor'
                      ? 'About You (What you can help mentees with)'
                      : 'About You (What you want to learn and achieve)'}
                  </Form.Label>
                  <Form.Control
                    as="textarea"
                    rows={4}
                    className="form-dark-control"
                    placeholder={
                      user?.role === 'mentor'
                        ? 'E.g. I am a senior software engineer with experience in cloud architectures and backend systems…'
                        : 'E.g. I am a fourth-year student looking to build practical skills in data science and web development…'
                    }
                    value={bio}
                    onChange={(e) => setBio(e.target.value)}
                    style={{ resize: 'vertical' }}
                  />
                </Form.Group>

                {/* Skills */}
                <TagInput
                  label={user?.role === 'mentor' ? 'Your Skills & Technologies (what you teach)' : 'Skills You Have'}
                  tags={skills}
                  setTags={setSkills}
                  placeholder="e.g. Python, React, PostgreSQL — type & press Enter"
                />

                {/* Interests */}
                <TagInput
                  label={user?.role === 'mentor' ? 'Mentoring Focus Areas' : 'Interests & Topics You Want to Learn'}
                  tags={interests}
                  setTags={setInterests}
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
                  <Form.Group className="mb-4">
                    <Form.Label className="form-dark-label">Years of Experience</Form.Label>
                    <div className="d-flex align-items-center gap-2">
                      <Form.Control
                        type="number"
                        min="0"
                        max="50"
                        className="form-dark-control"
                        placeholder="e.g. 2"
                        value={experienceYears}
                        onChange={(e) => setExperienceYears(e.target.value)}
                        style={{ maxWidth: '140px' }}
                      />
                      <span className="text-themed-secondary small">years</span>
                    </div>
                  </Form.Group>

                  {/* Direct Channels */}
                  <div className="mb-4">
                    <h6 className="fw-bold text-themed-primary small mb-1">Direct Communication Channels</h6>
                    <p className="text-themed-secondary small mb-3" style={{ fontSize: '0.78rem' }}>
                      Contact details are unlocked exclusively after a match request is mutually accepted.
                    </p>

                    <Form.Group className="mb-3">
                      <Form.Label className="form-dark-label">WhatsApp Number</Form.Label>
                      <Form.Control
                        type="text"
                        className="form-dark-control"
                        placeholder="e.g. +254712345678"
                        value={whatsapp}
                        onChange={(e) => setWhatsapp(e.target.value)}
                      />
                      <Form.Text className="text-themed-secondary" style={{ fontSize: '0.72rem' }}>
                        Used for 1-click WhatsApp messaging upon match acceptance.
                      </Form.Text>
                    </Form.Group>

                    <Form.Group className="mb-3">
                      <Form.Label className="form-dark-label">LinkedIn / Portfolio URL</Form.Label>
                      <Form.Control
                        type="url"
                        className="form-dark-control"
                        placeholder="https://linkedin.com/in/username"
                        value={linkedinUrl}
                        onChange={(e) => setLinkedinUrl(e.target.value)}
                      />
                    </Form.Group>
                  </div>
                </div>

                {/* Profile Readiness & Save Action */}
                <div className="pt-3 border-top border-secondary border-opacity-25">
                  <div className="d-flex align-items-center justify-content-between mb-3 px-1">
                    <span className="text-themed-secondary small">Skills: <strong className="text-gold">{skills.length}</strong></span>
                    <span className="text-themed-secondary small">Topics: <strong className="text-gold">{interests.length}</strong></span>
                    <span className="text-themed-secondary small">{bio.trim() ? '✓ Bio ready' : '⚠ Bio needed'}</span>
                  </div>

                  <Button type="submit" className="btn-gold btn-lg w-100" disabled={saving}>
                    {saving ? (
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
      </Container>
    </div>
  );
}
