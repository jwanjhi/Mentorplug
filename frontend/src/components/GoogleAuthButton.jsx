import React, { useEffect, useRef, useState } from 'react';
import { Modal, Button, Alert, Spinner } from 'react-bootstrap';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';

/**
 * GoogleAuthButton
 * 
 * - Renders official Google Identity Services "Continue with Google" button.
 * - Handles token verification with Express backend.
 * - Prompts new users to select Mentor or Mentee role in a modal before finalizing registration.
 * - Displays actionable error if account already exists with password.
 */
export default function GoogleAuthButton({ buttonText = 'continue_with', onAuthSuccess, onError, onMfaRequired }) {
  const containerRef = useRef(null);
  const { loginWithGoogle, linkGoogle } = useAuth();
  const { isDark } = useTheme();
  const navigate = useNavigate();
  const location = useLocation();

  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState(null);

  // Modal state for role selection on first-time registration
  const [showRoleModal, setShowRoleModal] = useState(false);
  const [pendingToken, setPendingToken] = useState(null);
  const [pendingUserGoogleInfo, setPendingUserGoogleInfo] = useState(null);
  const [selectedRole, setSelectedRole] = useState('mentee');
  const [isSubmittingRole, setIsSubmittingRole] = useState(false);

  // Link-to-existing-account state (Google email matches an email/password account)
  const [linkState, setLinkState] = useState(null); // { linkToken, maskedEmail }
  const [linkPassword, setLinkPassword] = useState('');
  const [isLinking, setIsLinking] = useState(false);
  const [linkError, setLinkError] = useState(null);

  const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;

  // Handle successful navigation depending on user role
  const handleRedirect = (user, isNewUser) => {
    if (onAuthSuccess) {
      onAuthSuccess(user, isNewUser);
      return;
    }

    const from = location.state?.from?.pathname;
    if (isNewUser) {
      navigate('/profile', { replace: true, state: { isNewUser: true } });
    } else if (from) {
      navigate(from, { replace: true });
    } else if (user.role === 'mentor') {
      navigate('/mentor-dashboard', { replace: true });
    } else {
      navigate('/recommendations', { replace: true });
    }
  };

  const handleCredentialResponse = async (response) => {
    const idToken = response.credential;
    if (!idToken) return;

    setErrorMessage(null);
    setLoading(true);

    try {
      const result = await loginWithGoogle(idToken);

      // If user is brand new and needs to select their role
      if (result?.needsRole) {
        setPendingToken(idToken);
        setPendingUserGoogleInfo(result);
        setShowRoleModal(true);
        setLoading(false);
        return;
      }

      // Existing user or already role-assigned
      if (result?.user) {
        handleRedirect(result.user, result.isNewUser);
      }
    } catch (err) {
      const code = err.response?.data?.code;

      // An email/password account already exists: offer to link it by confirming the password
      if (code === 'ACCOUNT_EXISTS_WITH_PASSWORD' && err.response?.data?.linkToken) {
        setLinkState({
          linkToken: err.response.data.linkToken,
          maskedEmail: err.response.data.maskedEmail,
        });
        setLinkPassword('');
        setLinkError(null);
        return;
      }

      console.error('Google Sign-in error:', err);
      const msg = err.response?.data?.message || 'Google authentication failed. Please try again.';
      setErrorMessage(msg);
      if (onError) onError(msg, code);
    } finally {
      setLoading(false);
    }
  };

  // Confirm password to link Google to the existing account
  const handleConfirmLink = async (e) => {
    e.preventDefault();
    if (!linkState?.linkToken || !linkPassword) return;

    setIsLinking(true);
    setLinkError(null);
    try {
      const result = await linkGoogle(linkState.linkToken, linkPassword);
      setLinkState(null);
      setLinkPassword('');

      if (result?.mfaRequired) {
        const mfa = {
          required: true,
          tempToken: result.tempToken,
          maskedEmail: result.maskedEmail,
          linkingGoogle: true,
        };
        if (onMfaRequired) {
          onMfaRequired(mfa);
        } else {
          // e.g. from the Register page: finish on the login page's code screen
          navigate('/login', { state: { mfa, from: location.state?.from } });
        }
        return;
      }

      if (result?.user) {
        handleRedirect(result.user, false);
      }
    } catch (err) {
      setLinkError(err.response?.data?.message || 'Could not link your Google account. Please try again.');
    } finally {
      setIsLinking(false);
    }
  };

  // Finalize registration with chosen role
  const handleConfirmRole = async () => {
    if (!pendingToken || !selectedRole) return;
    setIsSubmittingRole(true);
    setErrorMessage(null);

    try {
      const result = await loginWithGoogle(pendingToken, selectedRole);
      setShowRoleModal(false);
      if (result?.user) {
        handleRedirect(result.user, true);
      }
    } catch (err) {
      const msg = err.response?.data?.message || 'Failed to complete registration with chosen role.';
      setErrorMessage(msg);
    } finally {
      setIsSubmittingRole(false);
    }
  };

  useEffect(() => {
    if (!clientId) {
      return;
    }

    const initGsi = () => {
      if (window.google?.accounts?.id && containerRef.current) {
        window.google.accounts.id.initialize({
          client_id: clientId,
          callback: handleCredentialResponse,
          auto_select: false,
          cancel_on_tap_outside: true,
        });

        // Clear any previous button iframe before rendering
        if (containerRef.current) {
          containerRef.current.innerHTML = '';
        }

        // Calculate responsive width (min 260px, max 320px)
        const computedWidth = Math.min(320, Math.max(260, (containerRef.current?.offsetWidth || 300) - 8));

        window.google.accounts.id.renderButton(containerRef.current, {
          theme: isDark ? 'filled_black' : 'outline',
          size: 'large',
          type: 'standard',
          shape: 'pill',
          text: buttonText,
          width: computedWidth,
          logo_alignment: 'left',
        });
      }
    };

    // If GSI script is already loaded
    if (window.google?.accounts?.id) {
      initGsi();
    } else {
      // Poll briefly if script is still downloading
      const interval = setInterval(() => {
        if (window.google?.accounts?.id) {
          clearInterval(interval);
          initGsi();
        }
      }, 100);
      return () => clearInterval(interval);
    }
  }, [clientId, buttonText, isDark]);

  return (
    <div className="google-auth-wrapper my-3 w-100">
      {errorMessage && (
        <Alert variant="danger" className="py-2 px-3 small border-0 mb-3" style={{ backgroundColor: 'rgba(239, 68, 68, 0.15)', color: '#EF4444' }}>
          {errorMessage}
        </Alert>
      )}

      {!clientId && (
        <Alert variant="warning" className="py-2 px-3 small border-0 mb-2">
          Google Client ID not configured. Set <code>VITE_GOOGLE_CLIENT_ID</code> in <code>frontend/.env</code>.
        </Alert>
      )}

      <div className="d-flex justify-content-center align-items-center w-100" style={{ minHeight: 44 }}>
        {loading ? (
          <div className="d-flex align-items-center gap-2 text-themed-secondary small">
            <Spinner animation="border" size="sm" style={{ color: 'var(--mp-gold)' }} />
            Verifying Google Account...
          </div>
        ) : (
          <div
            ref={containerRef}
            className="google-btn-container d-flex justify-content-center"
            style={{
              maxWidth: '100%',
              borderRadius: '24px',
              overflow: 'hidden',
              backgroundColor: 'transparent',
            }}
          />
        )}
      </div>

      {/* Role Selection Modal for First-Time Google Users */}
      <Modal
        show={showRoleModal}
        onHide={() => !isSubmittingRole && setShowRoleModal(false)}
        centered
        backdrop="static"
        contentClassName="card-mentor-custom border-0 p-3"
      >
        <Modal.Header closeButton={!isSubmittingRole} className="border-0 pb-0">
          <Modal.Title className="fw-bold text-themed-primary h5">
            Welcome to Mentor<span className="text-gold">plug</span>
          </Modal.Title>
        </Modal.Header>
        <Modal.Body className="pt-2">
          <p className="text-themed-secondary small mb-3">
            Hi {pendingUserGoogleInfo?.name || ''}! How would you like to use MentorPlug?
          </p>

          <div className="role-pill-group mb-4">
            <div
              className={`role-pill-btn ${selectedRole === 'mentee' ? 'active' : ''}`}
              onClick={() => setSelectedRole('mentee')}
            >
              Mentee (Learner)
            </div>
            <div
              className={`role-pill-btn ${selectedRole === 'mentor' ? 'active' : ''}`}
              onClick={() => setSelectedRole('mentor')}
            >
              Mentor (Guide)
            </div>
          </div>

          <div className="d-flex justify-content-end gap-2">
            <Button
              variant="secondary"
              size="sm"
              disabled={isSubmittingRole}
              onClick={() => setShowRoleModal(false)}
              style={{ background: 'transparent', border: '1px solid var(--mp-border-subtle)', color: 'var(--mp-text-secondary)', borderRadius: 'var(--mp-radius-pill)' }}
            >
              Cancel
            </Button>
            <Button
              className="btn-gold"
              size="sm"
              disabled={isSubmittingRole}
              onClick={handleConfirmRole}
            >
              {isSubmittingRole ? (
                <>
                  <Spinner animation="border" size="sm" className="me-2" />
                  Creating Account...
                </>
              ) : (
                `Continue as ${selectedRole === 'mentor' ? 'Mentor' : 'Mentee'}`
              )}
            </Button>
          </div>
        </Modal.Body>
      </Modal>

      {/* Link Google to an existing email/password account */}
      <Modal
        show={Boolean(linkState)}
        onHide={() => !isLinking && setLinkState(null)}
        centered
        backdrop="static"
        contentClassName="card-mentor-custom border-0 p-3"
      >
        <Modal.Header closeButton={!isLinking} className="border-0 pb-0">
          <Modal.Title className="fw-bold text-themed-primary h5">Link your Google account</Modal.Title>
        </Modal.Header>
        <form onSubmit={handleConfirmLink}>
          <Modal.Body className="pt-2">
            <p className="text-themed-secondary small mb-3">
              You already have a MentorPlug account for <strong className="text-gold">{linkState?.maskedEmail}</strong>.
              Enter its password to link Google, so you can use either way to sign in. If two-factor sign-in is on,
              we'll also email you a code.
            </p>

            {linkError && (
              <Alert variant="danger" className="py-2 px-3 small border-0 mb-3" style={{ backgroundColor: 'rgba(239, 68, 68, 0.15)', color: '#EF4444' }}>
                {linkError}
              </Alert>
            )}

            <label htmlFor="googleLinkPassword" className="form-label small text-themed-secondary mb-1">
              MentorPlug password
            </label>
            <input
              id="googleLinkPassword"
              type="password"
              className="form-control mb-4"
              autoComplete="current-password"
              autoFocus
              value={linkPassword}
              onChange={(e) => setLinkPassword(e.target.value)}
              disabled={isLinking}
              style={{
                background: 'var(--mp-bg-input)',
                color: 'var(--mp-text-primary)',
                borderColor: 'var(--mp-border-subtle)',
                borderRadius: 'var(--mp-radius-input)',
              }}
            />

            <div className="d-flex justify-content-end gap-2">
              <Button
                variant="secondary"
                size="sm"
                disabled={isLinking}
                onClick={() => setLinkState(null)}
                style={{ background: 'transparent', border: '1px solid var(--mp-border-subtle)', color: 'var(--mp-text-secondary)', borderRadius: 'var(--mp-radius-pill)' }}
              >
                Cancel
              </Button>
              <Button type="submit" className="btn-gold" size="sm" disabled={isLinking || !linkPassword}>
                {isLinking ? (
                  <>
                    <Spinner animation="border" size="sm" className="me-2" />
                    Checking...
                  </>
                ) : (
                  'Link and sign in'
                )}
              </Button>
            </div>
          </Modal.Body>
        </form>
      </Modal>
    </div>
  );
}
