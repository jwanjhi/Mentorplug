import React from 'react';
import { Modal, ProgressBar } from 'react-bootstrap';
import Avatar from './Avatar';

/**
 * ProfilePreviewModal
 *
 * Full profile of the other person in a match, shown before deciding:
 * - mentees see a suggested mentor's profile before requesting,
 * - mentors see a mentee's profile (and their request message) before accepting.
 * Contact details only appear in the data once the match is accepted, so this
 * modal never shows them; the cards handle WhatsApp/email after acceptance.
 *
 * `actions` renders in the footer (e.g. Request Match, or Accept / Decline).
 */
const Section = ({ title, children }) => (
  <div className="mb-4">
    <h6 className="text-themed-secondary text-uppercase fw-bold mb-2" style={{ fontSize: '0.72rem', letterSpacing: '0.06em' }}>
      {title}
    </h6>
    {children}
  </div>
);

const TagList = ({ items, empty }) =>
  items.length > 0 ? (
    <div className="d-flex flex-wrap gap-2">
      {items.map((t) => (
        <span key={t} className="tag-gold-outline">{t}</span>
      ))}
    </div>
  ) : (
    <span className="text-themed-secondary small">{empty}</span>
  );

export default function ProfilePreviewModal({ show, onHide, person, personRole = 'mentor', score, message, connected = false, actions }) {
  if (!person) return null;

  const profile = person.profile || {};
  const skills = profile.skills || [];
  const interests = profile.interests || [];
  const roleLabel = personRole === 'mentor' ? 'Mentor' : 'Mentee';
  const pct = score != null ? Math.round(score * 100) : null;

  return (
    <Modal show={show} onHide={onHide} centered size="lg" scrollable contentClassName="card-mentor-custom border-0">
      <Modal.Header closeButton className="border-0 px-4 pt-4 pb-2">
        <div className="d-flex align-items-center gap-3">
          <Avatar avatarUrl={profile.avatar_url} name={person.name || roleLabel} size={64} />
          <div>
            <Modal.Title className="fw-bold text-themed-primary h5 mb-1" style={{ fontFamily: 'var(--font-heading)' }}>
              {person.name || roleLabel}
            </Modal.Title>
            <div className="text-themed-secondary small">
              {roleLabel}
              {profile.experience_years != null && ` · ${profile.experience_years} yrs experience`}
            </div>
          </div>
        </div>
      </Modal.Header>

      <Modal.Body className="px-4 pt-3">
        {pct != null && (
          <div className="mb-4">
            <div className="d-flex justify-content-between align-items-center mb-2">
              <span className="small text-themed-secondary fw-semibold">Profile match</span>
              <span className="small text-gold fw-bold">{pct}%</span>
            </div>
            <ProgressBar now={pct} className="progress-gold" />
          </div>
        )}

        {message && (
          <Section title="Their request message">
            <p
              className="small text-themed-primary mb-0 fst-italic"
              style={{ whiteSpace: 'pre-wrap', background: 'var(--mp-bg-surface)', padding: '0.6rem 0.9rem', borderRadius: 'var(--mp-radius-sm)', borderLeft: '3px solid var(--mp-gold)' }}
            >
              "{message}"
            </p>
          </Section>
        )}

        <Section title="About">
          <p className="small text-themed-primary mb-0" style={{ whiteSpace: 'pre-wrap', lineHeight: 1.65 }}>
            {profile.bio || `This ${roleLabel.toLowerCase()} has not added a bio yet.`}
          </p>
        </Section>

        <Section title="Skills">
          <TagList items={skills} empty="No skills listed" />
        </Section>

        <Section title={personRole === 'mentee' ? 'Interests & goals' : 'Interests'}>
          <TagList items={interests} empty="No interests listed" />
        </Section>

        <p className="text-themed-secondary mb-0" style={{ fontSize: '0.75rem' }}>
          {connected
            ? "You're connected. Use the buttons on the card to get in touch."
            : 'Contact details (email, WhatsApp, LinkedIn) are shared once a match is accepted.'}
        </p>
      </Modal.Body>

      {actions && (
        <Modal.Footer className="border-0 px-4 pb-4 pt-0 gap-2">
          {actions}
        </Modal.Footer>
      )}
    </Modal>
  );
}
