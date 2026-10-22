import React, { useState, useEffect } from 'react';
import { Container, Row, Col, Form, Button, Alert, Spinner } from 'react-bootstrap';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';

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

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [alert, setAlert] = useState(null); // { type: 'success'|'danger', msg }

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
      <div className="d-flex align-items-center gap-3 mb-5">
        <div className="avatar-placeholder" style={{ width: 64, height: 64, fontSize: '1.4rem' }}>{initials}</div>
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
          <Form.Group className="mb-5">
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
