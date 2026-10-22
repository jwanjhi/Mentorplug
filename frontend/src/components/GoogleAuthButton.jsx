import React, { useEffect, useRef, useState } from 'react';
import { Modal, Button, Alert, Spinner } from 'react-bootstrap';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

/**
 * GoogleAuthButton
 * 
 * - Renders official Google Identity Services "Continue with Google" button.
 * - Handles token verification with Express backend.
 * - Prompts new users to select Mentor or Mentee role in a modal before finalizing registration.
 * - Displays actionable error if account already exists with password.
 */
export default function GoogleAuthButton({ buttonText = 'continue_with', onAuthSuccess, onError }) {
  const containerRef = useRef(null);
  const { loginWithGoogle } = useAuth();
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
      console.error('Google Sign-in error:', err);
      const code = err.response?.data?.code;
      const msg = err.response?.data?.message || 'Google authentication failed. Please try again.';
      setErrorMessage(msg);
      if (onError) onError(msg, code);
    } finally {
      setLoading(false);
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

        // Determine current theme for button design
        const isDarkMode = document.documentElement.getAttribute('data-theme') !== 'light';

        window.google.accounts.id.renderButton(containerRef.current, {
          theme: isDarkMode ? 'filled_black' : 'outline',
          size: 'large',
          type: 'standard',
          shape: 'pill',
          text: buttonText,
          width: 320,
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
  }, [clientId, buttonText]);

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
          <div ref={containerRef} className="d-flex justify-content-center w-100" />
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
    </div>
  );
}
