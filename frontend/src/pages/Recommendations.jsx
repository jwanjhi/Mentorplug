import React, { useState, useEffect } from 'react';
import { Container, Row, Col, Button, Spinner, ProgressBar, Modal, Form, Alert } from 'react-bootstrap';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';
import Avatar from '../components/Avatar';
import FeedbackModal from '../components/FeedbackModal';

/* ── Single Mentor Card ───────────────────────────────────────────────────────── */
const MentorCard = ({ match, onRequest, onRate, user }) => {
  const score = Math.round((match.similarity_score ?? 0) * 100);
  const mentor = match.mentor;

  const skills = mentor?.profile?.skills || [];
  const interests = mentor?.profile?.interests || [];
  const tags = [...new Set([...skills, ...interests])].slice(0, 4);

  return (
    <div className="card-mentor-custom p-4 h-100 d-flex flex-column">
      {/* Top row */}
      <div className="d-flex align-items-start justify-content-between mb-3">
        <div className="d-flex align-items-center gap-3">
          <Avatar
            avatarUrl={mentor?.profile?.avatar_url}
            name={mentor?.name || 'Mentor'}
            size={48}
          />
          <div>
            <h5 className="fw-bold mb-0 text-themed-primary" style={{ fontFamily: 'var(--font-heading)' }}>
              {mentor?.name || 'Mentor'}
            </h5>
            <span className="text-themed-secondary small">
              {mentor?.profile?.experience_years != null
                ? `${mentor.profile.experience_years} yrs experience`
                : 'Mentor'}
            </span>
          </div>
        </div>
        <span className="badge-match-pill">{score}% Match</span>
      </div>

      {/* Bio */}
      <p className="small text-themed-secondary mb-3" style={{ lineHeight: '1.6', flexGrow: 1 }}>
        {mentor?.profile?.bio
          ? mentor.profile.bio.length > 140
            ? mentor.profile.bio.slice(0, 140) + '…'
            : mentor.profile.bio
          : 'This mentor has not added a bio yet.'}
      </p>

      {/* Tags */}
      <div className="d-flex flex-wrap gap-2 mb-4">
        {tags.length > 0
          ? tags.map((t) => <span key={t} className="tag-gold-outline">{t}</span>)
          : <span className="text-themed-secondary small">No skills listed</span>}
      </div>

      {/* Match bar */}
      <div className="pt-3 border-top border-secondary border-opacity-25">
        <div className="d-flex justify-content-between align-items-center mb-2">
          <span className="small text-themed-secondary fw-semibold">Match Score</span>
          <span className="small text-gold fw-bold">{score}%</span>
        </div>
        <ProgressBar now={score} className="progress-gold" />
      </div>

      {/* Action */}
      <div className="mt-3">
        {match.status === 'accepted' ? (
          <div>
            <div className="d-flex align-items-center justify-content-center gap-1 mb-2 text-success fw-bold small">
              <span>✓</span> Connected with {mentor.name}
            </div>
            {mentor?.profile?.whatsapp && (
              <a
                href={`https://wa.me/${mentor.profile.whatsapp.replace(/[^0-9]/g, '')}?text=${encodeURIComponent(`Hi ${mentor.name}, our mentorship match on MentorPlug was accepted! Looking forward to learning from you.`)}`}
                target="_blank"
                rel="noreferrer"
                className="btn w-100 mb-2 fw-semibold d-flex align-items-center justify-content-center gap-2 shadow-sm"
                style={{ background: '#25D366', color: '#FFFFFF', borderRadius: 'var(--mp-radius-pill)', border: 'none', padding: '0.45rem 1rem', fontSize: '0.85rem' }}
              >
                <span>💬</span> Message on WhatsApp
              </a>
            )}
            <a
              href={`mailto:${mentor.email}?subject=${encodeURIComponent(`MentorPlug Mentorship Connection — ${user?.name || 'Mentee'}`)}&body=${encodeURIComponent(`Hi ${mentor.name},\n\nI am thrilled that our mentorship match on MentorPlug was confirmed!\n\nI would love to arrange a convenient time for an introductory conversation to discuss my goals and learn more about your experience.\n\nLooking forward to hearing from you!\n\nBest regards,\n${user?.name || 'Mentee'}`)}`}
              className="btn w-100 fw-semibold d-flex align-items-center justify-content-center gap-2"
              style={{ background: 'transparent', border: '1.5px solid var(--mp-gold)', color: 'var(--mp-gold)', borderRadius: 'var(--mp-radius-pill)', padding: '0.45rem 1rem', fontSize: '0.85rem' }}
            >
              <span>✉️</span> Email Mentor
            </a>
            {mentor?.profile?.linkedin_url && (
              <a
                href={mentor.profile.linkedin_url.startsWith('http') ? mentor.profile.linkedin_url : `https://${mentor.profile.linkedin_url}`}
                target="_blank"
                rel="noreferrer"
                className="text-gold small mt-2 d-block text-center text-decoration-none"
              >
                View LinkedIn ↗
              </a>
            )}
          </div>
        ) : match.status === 'pending' ? (
          <Button className="btn-gold w-100" disabled style={{ opacity: 0.7, cursor: 'not-allowed' }}>
            ⏳ Request Pending
          </Button>
        ) : match.status === 'rejected' ? (
          <div className="text-center p-2 small" style={{ color: '#F87171', background: 'rgba(239,68,68,0.1)', borderRadius: 'var(--mp-radius-card)' }}>
            Match Declined
          </div>
        ) : (
          <Button
            className="btn-gold w-100"
            onClick={() => onRequest(match)}
          >
            ✦ Request Match
          </Button>
        )}

        {/* Post-engagement feedback & rating button (Section 3.8.5) */}
        <Button
          variant="outline-secondary"
          className="btn-outline-gold w-100 mt-2"
          size="sm"
          onClick={() => onRate(match)}
          style={{ fontSize: '0.82rem', padding: '0.38rem 0.75rem', borderRadius: 'var(--mp-radius-pill)' }}
        >
          {match.feedback
            ? `★ ${match.feedback.rating}/5 Rated • Update Review`
            : '★ Rate Recommendation'}
        </Button>
      </div>
    </div>
  );
};

/* ── Request Modal with AI-Drafted Introduction ───────────────────────────── */
const RequestModal = ({ show, match, onHide, onSend, user }) => {
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [alert, setAlert] = useState(null);

  const generateAIDraft = (m, u) => {
    const mentorName = m?.mentor?.name?.split(' ')[0] || m?.mentor?.name || 'there';
    const skills = m?.mentor?.profile?.skills || [];
    const skillText = skills.length > 0 ? skills.slice(0, 2).join(' and ') : 'your area of expertise';
    return `Hi ${mentorName}, I came across your profile and noticed your experience in ${skillText}. I would love the opportunity to connect with you on MentorPlug for mentorship and guidance on my learning path.`;
  };

  useEffect(() => {
    if (match && show) {
      setMessage(generateAIDraft(match, user));
      setAlert(null);
    }
  }, [match, show, user]);

  const handleSend = async () => {
    setSending(true);
    setAlert(null);
    try {
      await onSend(match, message.trim());
      setMessage('');
      onHide();
    } catch (err) {
      setAlert(err.response?.data?.error || 'Failed to send request. Please try again.');
    } finally {
      setSending(false);
    }
  };

  return (
    <Modal show={show} onHide={onHide} centered contentClassName="card-mentor-custom">
      <Modal.Header
        closeButton
        style={{
          borderBottom: '1px solid var(--mp-border-subtle)',
          background: 'var(--mp-bg-card)',
          borderRadius: 'var(--mp-radius-card) var(--mp-radius-card) 0 0',
        }}
      >
        <Modal.Title className="fw-bold text-themed-primary" style={{ fontFamily: 'var(--font-heading)', fontSize: '1.15rem' }}>
          Request Match with {match?.mentor?.name}
        </Modal.Title>
      </Modal.Header>
      <Modal.Body style={{ background: 'var(--mp-bg-card)' }}>
        {alert && (
          <Alert variant="danger" style={{ borderRadius: 'var(--mp-radius-card)', background: 'rgba(220,53,69,0.1)', border: '1px solid rgba(220,53,69,0.35)', color: '#F87171' }}>
            {alert}
          </Alert>
        )}
        <div className="d-flex justify-content-between align-items-center mb-1">
          <Form.Label className="form-dark-label mb-0">
            Introduction Message (Auto-Drafted)
          </Form.Label>
          <button
            type="button"
            className="btn btn-sm text-gold p-0"
            style={{ fontSize: '0.78rem', textDecoration: 'none' }}
            onClick={() => setMessage(generateAIDraft(match, user))}
          >
            ✨ Reset to AI Draft
          </button>
        </div>
        <Form.Control
          as="textarea"
          rows={4}
          className="form-dark-control"
          placeholder="Hi, I would love your guidance on..."
          value={message}
          onChange={(e) => setMessage(e.target.value)}
        />
        <p className="text-themed-secondary small mt-2 mb-0">
          This note is delivered directly to your mentor's dashboard. You can customize it before sending.
        </p>
      </Modal.Body>
      <Modal.Footer style={{ borderTop: '1px solid var(--mp-border-subtle)', background: 'var(--mp-bg-card)', borderRadius: '0 0 var(--mp-radius-card) var(--mp-radius-card)' }}>
        <Button variant="link" onClick={onHide} className="text-themed-secondary" style={{ textDecoration: 'none' }}>
          Cancel
        </Button>
        <Button className="btn-gold" onClick={handleSend} disabled={sending}>
          {sending ? <><Spinner size="sm" className="me-2" />Sending…</> : 'Send Request'}
        </Button>
      </Modal.Footer>
    </Modal>
  );
};

/* ── Mentorship Insight Modal (Comic feature) ─────────────────────────────────── */
const MentorshipAdviceModal = ({ show, onHide, role = 'mentee' }) => (
  <Modal show={show} onHide={onHide} centered size="lg" contentClassName="card-glass-custom border-0 p-0 overflow-hidden">
    <Modal.Header closeButton className="border-0 px-4 pt-4 pb-2">
      <Modal.Title className="fw-bold text-themed-primary h5">
        💡 Mentorship Principles for Success
      </Modal.Title>
    </Modal.Header>
    <Modal.Body className="px-4 py-2">
      <div className="text-center mb-3">
        <img
          src="/images/mentorship-comic.jpg"
          alt="Mentorship wisdom comic"
          className="img-fluid rounded"
          style={{ maxHeight: '340px', width: 'auto', border: '1px solid var(--mp-border-subtle)', boxShadow: '0 8px 24px rgba(0,0,0,0.3)' }}
        />
      </div>
      <div className="p-3 mb-2" style={{ background: 'var(--mp-gold-tint)', border: '1px solid var(--mp-gold-border)', borderRadius: 'var(--mp-radius-input)' }}>
        <h6 className="fw-bold text-gold mb-1">
          {role === 'mentor' ? 'The Golden Rule for Mentors' : 'The Golden Rule for Mentees'}
        </h6>
        <p className="text-themed-primary small mb-0" style={{ lineHeight: '1.6' }}>
          {role === 'mentor'
            ? "Mentorship isn't downloading '20 years of unfiltered wisdom' in one breath! The most impactful mentors ask open questions, listen 70% of the time, and guide mentees to reach their own breakthroughs."
            : "Mentorship is an active two-way partnership, not a lecture! Come prepared with specific questions, share your current blockers, and drive your own growth."}
        </p>
      </div>
    </Modal.Body>
    <Modal.Footer className="border-0 px-4 pb-4 pt-1">
      <Button className="btn-gold" size="sm" onClick={onHide}>
        Got It!
      </Button>
    </Modal.Footer>
  </Modal>
);

/* ── Main Recommendations Page ─────────────────────────────────────────────── */
export default function Recommendations() {
  const { user } = useAuth();

  const [matches, setMatches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [runningMatch, setRunningMatch] = useState(false);
  const [error, setError] = useState(null);

  const [selectedMatch, setSelectedMatch] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [showAdviceModal, setShowAdviceModal] = useState(false);
  const [feedbackMatch, setFeedbackMatch] = useState(null);
  const [showFeedbackModal, setShowFeedbackModal] = useState(false);

  const handleOpenFeedback = (match) => {
    setFeedbackMatch(match);
    setShowFeedbackModal(true);
  };

  const handleFeedbackSubmitted = (matchId, fb) => {
    setMatches((prev) =>
      prev.map((m) => (m.matchid === matchId ? { ...m, feedback: fb } : m))
    );
  };

  /* Load existing matches */
  const loadMatches = async () => {
    try {
      const res = await api.get('/recommendations');
      setMatches(res.data.matches || res.data || []);
    } catch (err) {
      if (err.response?.status !== 404) {
        setError('Could not load your mentor matches. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadMatches();
  }, []);

  /* Run fresh NLP matching */
  const handleRunMatch = async () => {
    setRunningMatch(true);
    setError(null);
    try {
      const res = await api.post('/recommendations');
      setMatches(res.data.matches || res.data || []);
    } catch (err) {
      const msg = err.response?.data?.error || err.response?.data?.message || '';
      if (msg.toLowerCase().includes('profile')) {
        setError('You need to fill in your profile before we can find matches for you.');
      } else {
        setError('The matching engine is warming up. Please try again in a moment.');
      }
    } finally {
      setRunningMatch(false);
    }
  };

  /* Send match request */
  const handleSendRequest = async (match, message) => {
    await api.post(`/recommendations/${match.matchid}/request`, { message });
    setMatches((prev) =>
      prev.map((m) => (m.matchid === match.matchid ? { ...m, status: 'pending' } : m))
    );
  };

  const openModal = (match) => {
    setSelectedMatch(match);
    setShowModal(true);
  };

  if (loading) {
    return (
      <Container className="py-5 text-center">
        <Spinner animation="border" style={{ color: 'var(--mp-gold)' }} />
        <p className="text-themed-secondary mt-3 small">Loading your matches…</p>
      </Container>
    );
  }

  return (
    <div className="recommendations-page-bg py-5">
      <Container>
        {/* Panoramic Hero Banner with Mentor Guidance Background */}
        <div className="hero-banner-custom hero-banner-mentee">
        <div className="hero-banner-content">
          <span className="tag-gold-outline mb-2 d-inline-block">Mentee Portal</span>
          <h1 className="h2 fw-bolder mb-2 text-themed-primary" style={{ fontFamily: 'var(--font-heading)' }}>
            Discover Your Ideal Mentors
          </h1>
          <p className="text-themed-secondary mb-3 small" style={{ lineHeight: '1.6' }}>
            Semantic profile matching analyzes your skills, interests, and aspirations to connect you with expert guides and industry mentors.
          </p>
          <div className="d-flex flex-wrap gap-2">
            <Button className="btn-gold" onClick={handleRunMatch} disabled={runningMatch} style={{ whiteSpace: 'nowrap' }}>
              {runningMatch
                ? <><Spinner size="sm" className="me-2" />Finding matches…</>
                : matches.length > 0 ? '↻ Refresh Matches' : '✦ Find My Mentors'}
            </Button>
            <Button
              variant="outline-secondary"
              className="btn-outline-gold"
              onClick={() => setShowAdviceModal(true)}
              style={{ whiteSpace: 'nowrap' }}
            >
              💡 Mentorship Advice
            </Button>
          </div>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="mb-4 p-4" style={{ background: 'rgba(220,53,69,0.08)', border: '1px solid rgba(220,53,69,0.3)', borderRadius: 'var(--mp-radius-card)', color: '#F87171' }}>
          <strong>Heads up: </strong>{error}
          {error.includes('profile') && (
            <> <Link to="/profile" className="text-gold ms-1">Go to your profile →</Link></>
          )}
        </div>
      )}

      {/* Empty State */}
      {!error && matches.length === 0 && (
        <Row className="justify-content-center">
          <Col xs={12} lg={7}>
            <div className="card-mentor-custom p-4 p-md-5 text-center">
              <div className="step-icon-wrap mx-auto mb-3">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
                </svg>
              </div>
              <h4 className="fw-bold text-themed-primary mb-2">No mentor matches generated yet</h4>
              <p className="text-themed-secondary mb-4 small">
                First, <Link to="/profile" className="text-gold">complete your profile</Link> with your skills, interests, and bio.<br />
                Then click <strong className="text-gold">Find My Mentors</strong> to generate your tailored recommendations.
              </p>
              <div className="d-flex justify-content-center gap-2">
                <Button className="btn-gold" onClick={handleRunMatch} disabled={runningMatch}>
                  {runningMatch ? 'Finding…' : '✦ Find My Mentors'}
                </Button>
                <Button variant="outline-secondary" className="btn-outline-gold" onClick={() => setShowAdviceModal(true)}>
                  💡 View Mentorship Tips
                </Button>
              </div>
            </div>
          </Col>
        </Row>
      )}

      {/* Match Cards Grid */}
      {matches.length > 0 && (
        <Row className="g-4">
          {matches.map((match, i) => (
            <Col key={match.matchid || i} md={6} xl={4}>
              <MentorCard
                match={match}
                onRequest={openModal}
                onRate={handleOpenFeedback}
                user={user}
              />
            </Col>
          ))}
        </Row>
      )}

      {/* Request Modal */}
      <RequestModal
        show={showModal}
        match={selectedMatch}
        onHide={() => setShowModal(false)}
        onSend={handleSendRequest}
        user={user}
      />

      {/* Post-Engagement / Match Feedback Modal (Section 3.8.5) */}
      <FeedbackModal
        show={showFeedbackModal}
        match={feedbackMatch}
        onHide={() => setShowFeedbackModal(false)}
        onFeedbackSubmitted={handleFeedbackSubmitted}
      />

      {/* Mentorship Insight Advice Modal (Comic Feature) */}
      <MentorshipAdviceModal
        show={showAdviceModal}
        onHide={() => setShowAdviceModal(false)}
        role="mentee"
      />
    </Container>
    </div>
  );
}
