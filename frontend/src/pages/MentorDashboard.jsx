import React, { useState, useEffect } from 'react';
import { Container, Row, Col, Button, Spinner, Badge } from 'react-bootstrap';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';

/* ── Stat Card ──────────────────────────────────────────────────────────────── */
const StatCard = ({ label, value, sub }) => (
  <div className="card-mentor-custom p-4 text-center h-100">
    <div className="display-5 fw-bolder text-gold mb-1" style={{ fontFamily: 'var(--font-heading)' }}>{value}</div>
    <div className="fw-semibold text-themed-primary small mb-1">{label}</div>
    {sub && <div className="text-themed-secondary" style={{ fontSize: '0.78rem' }}>{sub}</div>}
  </div>
);

/* ── Status Badge ───────────────────────────────────────────────────────────── */
const StatusBadge = ({ status }) => {
  const map = {
    pending:  { bg: 'rgba(201,168,76,0.12)',  color: 'var(--mp-gold)',   text: 'Pending' },
    accepted: { bg: 'rgba(34,197,94,0.12)',   color: '#4ADE80',          text: 'Accepted' },
    rejected: { bg: 'rgba(239,68,68,0.12)',   color: '#F87171',          text: 'Declined' },
    active:   { bg: 'rgba(56,189,248,0.12)',  color: '#38BDF8',          text: 'Active' },
  };
  const s = map[status] || map.pending;
  return (
    <span style={{ background: s.bg, color: s.color, border: `1px solid ${s.color}40`, borderRadius: 'var(--mp-radius-pill)', padding: '0.25rem 0.75rem', fontSize: '0.78rem', fontWeight: 700 }}>
      {s.text}
    </span>
  );
};

/* ── Request Row ─────────────────────────────────────────────────────────── */
const RequestRow = ({ match, onAccept, onDecline }) => {
  const mentee = match.mentee;
  const score = Math.round((match.similarity_score ?? 0) * 100);
  const initials = mentee?.name
    ? mentee.name.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2)
    : 'ME';

  const skills = mentee?.profile?.skills || [];
  const interests = mentee?.profile?.interests || [];
  const tags = [...new Set([...skills, ...interests])].slice(0, 3);

  return (
    <div className="card-mentor-custom p-4 mb-3">
      <div className="d-flex flex-column flex-md-row align-items-md-center justify-content-between gap-3">
        {/* Left: mentee info */}
        <div className="d-flex align-items-center gap-3">
          <div className="avatar-placeholder" style={{ width: 48, height: 48, fontSize: '1rem' }}>{initials}</div>
          <div>
            <div className="d-flex align-items-center gap-2 flex-wrap">
              <h6 className="fw-bold mb-0 text-themed-primary">{mentee?.name || 'Mentee'}</h6>
              <StatusBadge status={match.status} />
              <span className="badge-match-pill" style={{ fontSize: '0.75rem', padding: '0.2rem 0.65rem' }}>{score}% fit</span>
            </div>
            <div className="d-flex flex-wrap gap-1 mt-1">
              {tags.map((t) => (
                <span key={t} className="tag-gold-outline" style={{ fontSize: '0.72rem', padding: '0.18rem 0.6rem' }}>{t}</span>
              ))}
            </div>
          </div>
        </div>

        {/* Right: actions */}
        {match.status === 'pending' && (
          <div className="d-flex gap-2">
            <Button className="btn-gold" size="sm" onClick={() => onAccept(match.matchid)}>
              Accept
            </Button>
            <Button size="sm" onClick={() => onDecline(match.matchid)} style={{ background: 'transparent', border: '1.5px solid var(--mp-border-subtle)', color: 'var(--mp-text-secondary)', borderRadius: 'var(--mp-radius-pill)', padding: '0.35rem 1rem', fontWeight: 600 }}>
              Decline
            </Button>
          </div>
        )}
        {match.status === 'accepted' && (
          <span className="text-themed-secondary small">✓ You are connected</span>
        )}
        {match.status === 'rejected' && (
          <span style={{ color: '#F87171', fontSize: '0.85rem' }}>× Declined</span>
        )}
      </div>
    </div>
  );
};

/* ── Main Mentor Dashboard ─────────────────────────────────────────────────── */
export default function MentorDashboard() {
  const { user } = useAuth();

  const [matches, setMatches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filter, setFilter] = useState('all'); // 'all' | 'pending' | 'accepted'

  const loadMatches = async () => {
    try {
      const res = await api.get('/recommendations/incoming');
      setMatches(res.data.matches || res.data || []);
    } catch (err) {
      if (err.response?.status !== 404) {
        setError('Could not load your connection requests. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadMatches();
  }, []);

  const handleAccept = async (matchid) => {
    try {
      await api.patch(`/recommendations/${matchid}/status`, { status: 'accepted' });
      setMatches((prev) => prev.map((m) => m.matchid === matchid ? { ...m, status: 'accepted' } : m));
    } catch (err) {
      alert('Could not accept request. Please try again.');
    }
  };

  const handleDecline = async (matchid) => {
    try {
      await api.patch(`/recommendations/${matchid}/status`, { status: 'rejected' });
      setMatches((prev) => prev.map((m) => m.matchid === matchid ? { ...m, status: 'rejected' } : m));
    } catch (err) {
      alert('Could not decline request. Please try again.');
    }
  };

  const pending  = matches.filter((m) => m.status === 'pending');
  const accepted = matches.filter((m) => m.status === 'accepted');
  const filtered = filter === 'all' ? matches : matches.filter((m) => m.status === filter);

  const initials = user?.name
    ? user.name.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2)
    : 'MP';

  if (loading) {
    return (
      <Container className="py-5 text-center">
        <Spinner animation="border" style={{ color: 'var(--mp-gold)' }} />
        <p className="text-themed-secondary mt-3 small">Loading your dashboard…</p>
      </Container>
    );
  }

  return (
    <Container className="py-5">
      {/* Header */}
      <div className="d-flex flex-column flex-md-row align-items-md-center justify-content-between gap-3 mb-5">
        <div className="d-flex align-items-center gap-3">
          <div className="avatar-placeholder" style={{ width: 60, height: 60, fontSize: '1.3rem' }}>{initials}</div>
          <div>
            <span className="text-gold fw-bold text-uppercase small d-block mb-1" style={{ letterSpacing: '0.1em' }}>Mentor Portal</span>
            <h1 className="h2 fw-bolder mb-0 text-themed-primary" style={{ fontFamily: 'var(--font-heading)' }}>
              {user?.name}'s Dashboard
            </h1>
          </div>
        </div>
        <Button as={Link} to="/profile" className="btn-outline-gold" style={{ whiteSpace: 'nowrap' }}>
          Edit My Profile
        </Button>
      </div>

      {/* Stat Cards */}
      <Row className="g-3 mb-5">
        <Col xs={6} md={3}>
          <StatCard label="Total Requests" value={matches.length} sub="from mentees" />
        </Col>
        <Col xs={6} md={3}>
          <StatCard label="Pending" value={pending.length} sub="awaiting your response" />
        </Col>
        <Col xs={6} md={3}>
          <StatCard label="Accepted" value={accepted.length} sub="active mentorships" />
        </Col>
        <Col xs={6} md={3}>
          <StatCard
            label="Avg. Fit Score"
            value={matches.length > 0
              ? Math.round(matches.reduce((s, m) => s + (m.similarity_score || 0), 0) / matches.length * 100) + '%'
              : '—'}
            sub="AI match quality"
          />
        </Col>
      </Row>

      {/* Error */}
      {error && (
        <div className="mb-4 p-4" style={{ background: 'rgba(220,53,69,0.08)', border: '1px solid rgba(220,53,69,0.3)', borderRadius: 'var(--mp-radius-card)', color: '#F87171' }}>
          {error}
        </div>
      )}

      {/* Section Header + Filter Pills */}
      <div className="d-flex flex-column flex-md-row align-items-md-center justify-content-between gap-3 mb-3">
        <h2 className="h5 fw-bold text-themed-primary mb-0" style={{ fontFamily: 'var(--font-heading)' }}>Connection Requests</h2>
        <div style={{ display: 'flex', gap: '0.5rem', background: 'var(--mp-bg-input)', padding: '0.3rem', borderRadius: 'var(--mp-radius-pill)', border: '1px solid var(--mp-border-subtle)' }}>
          {['all', 'pending', 'accepted'].map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              style={{
                background: filter === f ? 'var(--mp-gold)' : 'transparent',
                color: filter === f ? '#0A0A0A' : 'var(--mp-text-secondary)',
                border: 'none',
                borderRadius: 'var(--mp-radius-pill)',
                padding: '0.35rem 1rem',
                fontWeight: 600,
                fontSize: '0.85rem',
                cursor: 'pointer',
                textTransform: 'capitalize',
                transition: 'all 0.2s',
              }}
            >
              {f === 'all' ? `All (${matches.length})` : f === 'pending' ? `Pending (${pending.length})` : `Accepted (${accepted.length})`}
            </button>
          ))}
        </div>
      </div>

      {/* Empty State */}
      {!error && filtered.length === 0 && (
        <div className="card-mentor-custom p-5 text-center">
          <div className="step-icon-wrap mx-auto mb-4">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
              <circle cx="9" cy="7" r="4" />
              <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
              <path d="M16 3.13a4 4 0 0 1 0 7.75" />
            </svg>
          </div>
          <h4 className="fw-bold text-themed-primary mb-2">No requests yet</h4>
          <p className="text-themed-secondary mb-4">
            {filter === 'all'
              ? <>Make sure your <Link to="/profile" className="text-gold">profile is complete</Link> so mentees can discover and match with you.</>
              : `No ${filter} requests found.`}
          </p>
          {filter === 'all' && (
            <Button as={Link} to="/profile" className="btn-gold">
              Complete My Profile
            </Button>
          )}
        </div>
      )}

      {/* Request List */}
      {filtered.length > 0 && filtered.map((match, i) => (
        <RequestRow
          key={match.matchid || i}
          match={match}
          onAccept={handleAccept}
          onDecline={handleDecline}
        />
      ))}
    </Container>
  );
}
