import React, { useState, useEffect } from 'react';
import { Container, Row, Col, Button, Spinner, ProgressBar, Modal, Form, Alert } from 'react-bootstrap';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';
import Avatar from '../components/Avatar';

/* ── Single Mentor Card ───────────────────────────────────────────────────────── */
const MentorCard = ({ match, onRequest }) => {
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
        <Button
          className="btn-gold w-100"
          onClick={() => onRequest(match)}
          disabled={match.status === 'pending' || match.status === 'accepted'}
        >
          {match.status === 'accepted'
            ? '✓ Connected'
            : match.status === 'pending'
            ? 'Request Sent'
            : 'Request Match'}
        </Button>
      </div>
    </div>
  );
};

/* ── Request Modal ─────────────────────────────────────────────────────────── */
const RequestModal = ({ show, match, onHide, onSend }) => {
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [alert, setAlert] = useState(null);

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
        <Form.Label className="form-dark-label">
          Add a short message to your mentor (optional)
        </Form.Label>
        <Form.Control
          as="textarea"
          rows={4}
          className="form-dark-control"
          placeholder="Hi, I'm interested in learning about machine learning and would love your guidance on…"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
        />
        <p className="text-themed-secondary small mt-2 mb-0">
          A personalised message increases your chances of getting accepted.
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

/* ── Main Recommendations Page ─────────────────────────────────────────────── */
export default function Recommendations() {
  const { user } = useAuth();

  const [matches, setMatches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [runningMatch, setRunningMatch] = useState(false);
  const [error, setError] = useState(null);

  const [selectedMatch, setSelectedMatch] = useState(null);
  const [showModal, setShowModal] = useState(false);

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
    <Container className="py-5">
      {/* Page Header */}
      <div className="d-flex flex-column flex-md-row align-items-md-center justify-content-between gap-3 mb-5">
        <div>
          <span className="text-gold fw-bold text-uppercase small d-block mb-1" style={{ letterSpacing: '0.1em' }}>Mentee Portal</span>
          <h1 className="h2 fw-bolder mb-1 text-themed-primary" style={{ fontFamily: 'var(--font-heading)' }}>
            Your Ranked Mentors
          </h1>
          <p className="text-themed-secondary mb-0">
            Matches are ranked by AI similarity to your profile.
          </p>
        </div>
        <Button className="btn-gold" onClick={handleRunMatch} disabled={runningMatch} style={{ whiteSpace: 'nowrap' }}>
          {runningMatch
            ? <><Spinner size="sm" className="me-2" />Finding matches…</>
            : matches.length > 0 ? '↻ Refresh Matches' : '✦ Find My Mentors'}
        </Button>
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
        <div className="card-mentor-custom p-5 text-center" style={{ maxWidth: 560, margin: '0 auto' }}>
          <div className="step-icon-wrap mx-auto mb-4">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
          </div>
          <h4 className="fw-bold text-themed-primary mb-2">No matches yet</h4>
          <p className="text-themed-secondary mb-4">
            First, <Link to="/profile" className="text-gold">complete your profile</Link> with your interests and skills.<br />
            Then click <strong className="text-gold">Find My Mentors</strong> to run the AI matching engine.
          </p>
          <Button className="btn-gold" onClick={handleRunMatch} disabled={runningMatch}>
            {runningMatch ? 'Finding…' : '✦ Find My Mentors'}
          </Button>
        </div>
      )}

      {/* Match Cards Grid */}
      {matches.length > 0 && (
        <Row className="g-4">
          {matches.map((match, i) => (
            <Col key={match.matchid || i} md={6} xl={4}>
              <MentorCard match={match} onRequest={openModal} />
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
      />
    </Container>
  );
}
