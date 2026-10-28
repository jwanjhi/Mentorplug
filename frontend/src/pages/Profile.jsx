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
        msg: `✨ SBERT analyzed "${file.name}"! Bio, skills, and experience have been populated. Review and edit before saving.`,
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
    <Container className="py-5" style={{ maxWidth: '680px' }}>
      {/* Header */}
      <div className="d-flex align-items-center gap-4 mb-5">
        <div>
          <Avatar
            avatarUrl={avatarUrl}
            name={user?.name || ''}
            size={80}
            editable
            onUpload={(newUrl) => setAvatarUrl(newUrl)}
          />
          <p className="text-themed-secondary text-center mt-2" style={{ fontSize: '0.72rem', maxWidth: 80 }}>Click to change</p>
        </div>
        <div>
          <h1 className="h3 fw-bolder mb-0 text-themed-primary" style={{ fontFamily: 'var(--font-heading)' }}>{user?.name}</h1>
          <span className="tag-gold-outline" style={{ fontSize: '0.78rem', textTransform: 'capitalize' }}>{user?.role}</span>
          <span className="text-themed-secondary small ms-2">{user?.email}</span>
        </div>
      </div>

      {alert && (
        <Alert variant={alert.type} className="mb-4" style={{ borderRadius: 'var(--mp-radius-card)', background: alert.type === 'success' ? 'rgba(201,168,76,0.12)' : 'rgba(220,53,69,0.12)', border: `1px solid ${alert.type === 'success' ? 'var(--mp-gold-border)' : 'rgba(220,53,69,0.4)'}`, color: alert.type === 'success' ? 'var(--mp-gold)' : '#F87171' }} onClose={() => setAlert(null)} dismissible>
          {alert.msg}
        </Alert>
      )}

      <div className="card-mentor-custom p-4 p-md-5">
        {/* CV / Resume Auto-fill Banner using Sentence-BERT */}
        <div
          className="p-3 mb-4 d-flex flex-column flex-sm-row align-items-sm-center justify-content-between gap-3"
          style={{
            background: 'rgba(212,175,55,0.06)',
            border: '1.5px dashed var(--mp-gold-border)',
            borderRadius: 'var(--mp-radius-card)',
          }}
        >
          <div>
            <div className="fw-bold text-themed-primary d-flex align-items-center gap-2 mb-1">
              <span>📄</span> Auto-Fill with CV / Resume
            </div>
            <p className="text-themed-secondary small mb-0">
              Upload your PDF resume to extract your bio, skills, and experience with Sentence-BERT NLP.
            </p>
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
                  Analyzing with SBERT…
                </>
              ) : (
                'Upload CV (.pdf)'
              )}
            </Button>
          </div>
        </div>

        <Form onSubmit={handleSave}>
          {/* Bio */}
          <Form.Group className="mb-4">
            <Form.Label className="form-dark-label">
              {user?.role === 'mentor' ? 'About You (What you can help mentees with)' : 'About You (What you want to learn and achieve)'}
            </Form.Label>
            <Form.Control
              as="textarea"
              rows={4}
              className="form-dark-control"
              placeholder={user?.role === 'mentor'
                ? 'E.g. I am a senior software engineer with 8 years in backend development. I enjoy helping junior developers grow…'
                : 'E.g. I am a second-year computer science student looking to break into data science and machine learning…'}
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              style={{ resize: 'vertical' }}
            />
          </Form.Group>

          {/* Skills */}
          <TagInput
            label={user?.role === 'mentor' ? 'Your Skills (what you teach)' : 'Skills You Have'}
            tags={skills}
            setTags={setSkills}
            placeholder="e.g. Python, React, Machine Learning — press Enter or click Add"
          />

          {/* Interests */}
          <TagInput
            label={user?.role === 'mentor' ? 'Topics You Enjoy Mentoring' : 'Interests & Topics You Want to Learn'}
            tags={interests}
            setTags={setInterests}
            placeholder="e.g. AI, Career Growth, Web Development"
          />

          {/* Experience Years */}
          <Form.Group className="mb-4">
            <Form.Label className="form-dark-label">Years of Experience</Form.Label>
            <Form.Control
              type="number"
              min="0"
              max="50"
              className="form-dark-control"
              placeholder="e.g. 5"
              value={experienceYears}
              onChange={(e) => setExperienceYears(e.target.value)}
              style={{ maxWidth: '200px' }}
            />
          </Form.Group>

          {/* Direct Communication Channels */}
          <div className="pt-3 border-top border-secondary border-opacity-25 mb-4">
            <h6 className="fw-bold text-themed-primary mb-1">Direct Communication Channels</h6>
            <p className="text-themed-secondary small mb-3">
              Your contact details are strictly private and only unlocked when a mentorship match is accepted by both parties.
            </p>

            <Row className="g-3">
              <Col xs={12} md={6}>
                <Form.Group>
                  <Form.Label className="form-dark-label">
                    WhatsApp Number
                  </Form.Label>
                  <Form.Control
                    type="text"
                    className="form-dark-control"
                    placeholder="e.g. +254712345678"
                    value={whatsapp}
                    onChange={(e) => setWhatsapp(e.target.value)}
                  />
                  <Form.Text className="text-themed-secondary" style={{ fontSize: '0.75rem' }}>
                    Used for direct 1-click WhatsApp messaging upon connection.
                  </Form.Text>
                </Form.Group>
              </Col>

              <Col xs={12} md={6}>
                <Form.Group>
                  <Form.Label className="form-dark-label">
                    LinkedIn / Portfolio URL
                  </Form.Label>
                  <Form.Control
                    type="url"
                    className="form-dark-control"
                    placeholder="https://linkedin.com/in/username"
                    value={linkedinUrl}
                    onChange={(e) => setLinkedinUrl(e.target.value)}
                  />
                  <Form.Text className="text-themed-secondary" style={{ fontSize: '0.75rem' }}>
                    Optional professional profile link.
                  </Form.Text>
                </Form.Group>
              </Col>
            </Row>
          </div>

          <div className="d-flex gap-3 align-items-center">
            <Button type="submit" className="btn-gold btn-lg" disabled={saving}>
              {saving ? <><Spinner size="sm" className="me-2" />Saving…</> : 'Save Profile'}
            </Button>
            <span className="text-themed-secondary small">
              Saving updates your AI match score automatically.
            </span>
          </div>
        </Form>
      </div>
    </Container>
  );
}
