import React, { useState, useEffect } from 'react';
import { Modal, Button, Form, Alert, Spinner } from 'react-bootstrap';
import api from '../services/api';

const RATING_LABELS = {
  1: 'Poor Match (Low Relevance)',
  2: 'Fair Match',
  3: 'Good Recommendation',
  4: 'Very Relevant Match',
  5: 'Outstanding Match & Guidance',
};

export default function FeedbackModal({ show, onHide, match, onFeedbackSubmitted }) {
  const [rating, setRating] = useState(5);
  const [hoverRating, setHoverRating] = useState(0);
  const [comment, setComment] = useState('');
  const [category, setCategory] = useState('recommendation');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);

  const targetName = match?.mentor?.name || match?.mentee?.name || 'this mentor';

  useEffect(() => {
    if (show && match) {
      if (match.feedback) {
        setRating(match.feedback.rating || 5);
        setComment(match.feedback.comment || '');
      } else {
        setRating(5);
        setComment('');
      }
      setCategory('recommendation');
      setError(null);
      setSuccess(false);
    }
  }, [show, match]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!rating || rating < 1 || rating > 5) {
      setError('Please select a rating between 1 and 5 stars.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const payload = {
        matchID: match.matchid,
        receiverID: match.mentor?.accountID || match.mentee?.accountID,
        rating,
        comment: comment.trim(),
        category,
      };

      const res = await api.post('/feedback', payload);
      setSuccess(true);
      if (onFeedbackSubmitted) {
        onFeedbackSubmitted(match.matchid, res.data.feedback);
      }
      setTimeout(() => {
        onHide();
      }, 900);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to submit feedback. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const activeRating = hoverRating || rating;

  return (
    <Modal show={show} onHide={onHide} centered contentClassName="card-mentor-custom">
      <Modal.Header closeButton closeVariant="white" className="border-0 px-4 pt-4 pb-2">
        <div>
          <span className="tag-gold-outline mb-1 d-inline-block" style={{ fontSize: '0.72rem' }}>
            System Feedback &amp; Evaluation
          </span>
          <Modal.Title className="h5 fw-bold text-themed-primary mb-0">
            Rate Your Match with {targetName}
          </Modal.Title>
        </div>
      </Modal.Header>

      <Modal.Body className="px-4 py-2">
        <p className="text-themed-secondary small mb-3" style={{ lineHeight: '1.6' }}>
          Your feedback is saved in accordance with MentorPlug evaluation criteria (Section 3.8.5) to assess semantic match relevance and mentor guidance quality.
        </p>

        {error && <Alert variant="danger" className="py-2 small">{error}</Alert>}
        {success && (
          <Alert variant="success" className="py-2 small">
            ✓ Feedback recorded! Thank you for evaluating this recommendation.
          </Alert>
        )}

        <Form onSubmit={handleSubmit}>
          {/* Interactive Star Rating */}
          <div className="text-center p-3 mb-3" style={{ background: 'var(--mp-bg-card)', border: '1px solid var(--mp-border-subtle)', borderRadius: 'var(--mp-radius-input)' }}>
            <span className="small text-themed-secondary d-block mb-2 fw-semibold">
              Recommendation Quality &amp; Fit
            </span>
            <div className="d-flex justify-content-center gap-2 mb-2">
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  type="button"
                  key={star}
                  onClick={() => setRating(star)}
                  onMouseEnter={() => setHoverRating(star)}
                  onMouseLeave={() => setHoverRating(0)}
                  style={{
                    background: 'none',
                    border: 'none',
                    padding: '4px',
                    cursor: 'pointer',
                    transition: 'transform 0.15s ease',
                  }}
                  className="star-btn"
                >
                  <svg
                    width="32"
                    height="32"
                    viewBox="0 0 24 24"
                    fill={star <= activeRating ? 'var(--mp-gold)' : 'none'}
                    stroke="var(--mp-gold)"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    style={{
                      filter: star <= activeRating ? 'drop-shadow(0 0 6px rgba(201,168,76,0.45))' : 'none',
                    }}
                  >
                    <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                  </svg>
                </button>
              ))}
            </div>
            <span className="text-gold fw-bold small">
              {RATING_LABELS[activeRating]} ({activeRating} / 5)
            </span>
          </div>

          {/* Feedback Category */}
          <Form.Group className="mb-3">
            <Form.Label className="small fw-semibold text-themed-primary">Feedback Focus</Form.Label>
            <Form.Select
              className="form-dark-control"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
            >
              <option value="recommendation">AI Recommendation Relevance &amp; Topic Fit</option>
              <option value="mentorship_session">Mentorship Interaction / Advisory Session</option>
              <option value="platform">Platform Usability &amp; Experience</option>
            </Form.Select>
          </Form.Group>

          {/* Comment / Review */}
          <Form.Group className="mb-3">
            <Form.Label className="small fw-semibold text-themed-primary">
              Comments &amp; Reflections (Optional)
            </Form.Label>
            <Form.Control
              as="textarea"
              rows={3}
              className="form-dark-control"
              placeholder="Share how relevant the mentor's skills and experience were to your goals, or reflections from your session..."
              value={comment}
              onChange={(e) => setComment(e.target.value)}
            />
          </Form.Group>

          <Modal.Footer className="border-0 px-0 pb-1 pt-2 d-flex justify-content-end gap-2">
            <Button variant="outline-secondary" size="sm" onClick={onHide} disabled={loading}>
              Cancel
            </Button>
            <Button type="submit" className="btn-gold" size="sm" disabled={loading}>
              {loading ? <><Spinner size="sm" className="me-2" />Submitting…</> : (match?.feedback ? 'Update Feedback' : 'Submit Feedback')}
            </Button>
          </Modal.Footer>
        </Form>
      </Modal.Body>
    </Modal>
  );
}
