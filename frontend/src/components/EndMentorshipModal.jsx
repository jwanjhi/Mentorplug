import React, { useEffect, useState } from 'react';
import { Modal, Button, Form, Alert, Spinner } from 'react-bootstrap';
import api from '../services/api';

// Keep these codes in sync with END_REASONS in backend/controllers/recommendationController.js
const REASONS = {
  mentee: [
    { code: 'goals_achieved', label: 'Goals achieved' },
    { code: 'found_another_mentor', label: 'Found another mentor' },
    { code: 'focus_changed', label: 'My goals or interests changed' },
    { code: 'schedule_conflict', label: 'Schedule or availability conflict' },
    { code: 'not_a_good_fit', label: 'Not a good fit' },
    { code: 'unresponsive', label: 'My mentor stopped responding' },
    { code: 'other', label: 'Other (write your own reason)' },
  ],
  mentor: [
    { code: 'goals_achieved', label: 'Goals achieved' },
    { code: 'no_capacity', label: 'No longer have capacity to mentor' },
    { code: 'schedule_conflict', label: 'Schedule or availability conflict' },
    { code: 'not_a_good_fit', label: 'Not a good fit' },
    { code: 'unresponsive', label: 'My mentee stopped responding' },
    { code: 'other', label: 'Other (write your own reason)' },
  ],
};
const DETAIL_MAX = 500;

/**
 * EndMentorshipModal
 * Either participant ends an accepted mentorship, choosing a common reason or
 * writing their own ("Other"). Calls onEnded(match, endedInfo) on success.
 */
export default function EndMentorshipModal({ show, onHide, match, role, onEnded }) {
  const [reason, setReason] = useState('');
  const [detail, setDetail] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (show) {
      setReason('');
      setDetail('');
      setError(null);
    }
  }, [show]);

  if (!match) return null;

  const options = REASONS[role] || REASONS.mentee;
  const otherPerson = role === 'mentor' ? match.mentee : match.mentor;
  const otherName = otherPerson?.name || (role === 'mentor' ? 'your mentee' : 'your mentor');
  const isOther = reason === 'other';
  const trimmed = detail.trim();
  const canSubmit = reason && (!isOther || trimmed) && trimmed.length <= DETAIL_MAX && !submitting;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!canSubmit) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await api.post(`/recommendations/${match.matchid}/end`, { reason, detail: trimmed });
      onEnded(match, res.data.ended);
    } catch (err) {
      setError(err.response?.data?.error || 'Could not opt out. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal show={show} onHide={() => !submitting && onHide()} centered contentClassName="card-mentor-custom border-0 p-2">
      <Modal.Header closeButton={!submitting} className="border-0 pb-0">
        <Modal.Title className="fw-bold text-themed-primary h5">Opt out of your mentorship with {otherName}?</Modal.Title>
      </Modal.Header>
      <Form onSubmit={handleSubmit}>
        <Modal.Body className="pt-2">
          <p className="text-themed-secondary small mb-3">
            {otherName} will be emailed that you opted out, with the reason you choose.
            Your milestones and feedback are kept as read-only history. This can't be undone,
            {role === 'mentee' ? ' but you can send a new request later.' : ' but your mentee can send a new request later.'}
          </p>

          {error && (
            <Alert variant="danger" className="py-2 px-3 small border-0 mb-3" style={{ backgroundColor: 'rgba(239, 68, 68, 0.15)', color: '#EF4444' }}>
              {error}
            </Alert>
          )}

          <Form.Label className="small fw-semibold text-themed-primary mb-2">Why are you opting out?</Form.Label>
          <div className="d-flex flex-column gap-2 mb-3">
            {options.map((o) => (
              <Form.Check
                key={o.code}
                type="radio"
                id={`end-reason-${o.code}`}
                name="endReason"
                label={o.label}
                checked={reason === o.code}
                onChange={() => setReason(o.code)}
                disabled={submitting}
                className="small text-themed-primary"
              />
            ))}
          </div>

          {reason && (
            <Form.Group>
              <Form.Label htmlFor="endReasonDetail" className="small text-themed-secondary mb-1">
                {isOther ? 'Your reason (required)' : 'Anything else you want to add? (optional)'}
              </Form.Label>
              <Form.Control
                id="endReasonDetail"
                as="textarea"
                rows={3}
                maxLength={DETAIL_MAX}
                value={detail}
                onChange={(e) => setDetail(e.target.value)}
                disabled={submitting}
                autoFocus={isOther}
                placeholder={isOther ? 'Tell them briefly why you are opting out' : ''}
                style={{ background: 'var(--mp-bg-input)', color: 'var(--mp-text-primary)', borderColor: 'var(--mp-border-subtle)' }}
              />
              <div className="text-end text-themed-secondary" style={{ fontSize: '0.72rem' }}>
                {trimmed.length}/{DETAIL_MAX} · shared with {otherName}
              </div>
            </Form.Group>
          )}
        </Modal.Body>
        <Modal.Footer className="border-0 pt-0 gap-2">
          <Button
            size="sm"
            disabled={submitting}
            onClick={onHide}
            style={{ background: 'transparent', border: '1px solid var(--mp-border-subtle)', color: 'var(--mp-text-secondary)', borderRadius: 'var(--mp-radius-pill)' }}
          >
            Keep mentorship
          </Button>
          <Button type="submit" size="sm" variant="danger" disabled={!canSubmit} style={{ borderRadius: 'var(--mp-radius-pill)' }}>
            {submitting ? <><Spinner animation="border" size="sm" className="me-2" />Opting out…</> : 'Opt out'}
          </Button>
        </Modal.Footer>
      </Form>
    </Modal>
  );
}
