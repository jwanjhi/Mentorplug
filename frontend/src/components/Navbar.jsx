import React from 'react';
import { Navbar, Nav, Container, Button, Badge } from 'react-bootstrap';
import { Link, useNavigate, useLocation } from 'react-router-dom';

const AppNavbar = ({ user, onLogout }) => {
  const navigate = useNavigate();
  const location = useLocation();

  const handleLogout = () => {
    if (onLogout) {
      onLogout();
    }
    navigate('/login');
  };

  const isActive = (path) => location.pathname === path;

  return (
    <Navbar expand="lg" className="navbar-mentor sticky-top" variant="dark">
      <Container>
        <Navbar.Brand as={Link} to="/" className="brand-text d-flex align-items-center">
          <svg
            width="26"
            height="26"
            viewBox="0 0 24 24"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            className="me-2"
          >
            <circle cx="12" cy="12" r="10" stroke="#C9A84C" strokeWidth="2.2" />
            <path
              d="M8 12L11 15L16 9"
              stroke="#FFFFFF"
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          <span>
            Mentor<span className="brand-plug">Plug</span>
          </span>
        </Navbar.Brand>

        <Navbar.Toggle aria-controls="mentorplug-navbar-nav" />

        <Navbar.Collapse id="mentorplug-navbar-nav">
          <Nav className="me-auto ms-lg-3">
            <Nav.Link as={Link} to="/" className={isActive('/') ? 'active' : ''}>
              Home
            </Nav.Link>

            {user && user.role === 'mentee' && (
              <Nav.Link
                as={Link}
                to="/recommendations"
                className={isActive('/recommendations') ? 'active' : ''}
              >
                Recommendations
              </Nav.Link>
            )}

            {user && (
              <Nav.Link
                as={Link}
                to="/profile"
                className={isActive('/profile') ? 'active' : ''}
              >
                My Profile
              </Nav.Link>
            )}
          </Nav>

          <Nav className="align-items-lg-center gap-2 mt-3 mt-lg-0">
            {user ? (
              <>
                <div className="d-flex align-items-center me-lg-2 text-white">
                  <span className="me-2 text-white-50 small">Signed in as:</span>
                  <span className="fw-semibold me-2">{user.name || user.email}</span>
                  <Badge className={user.role === 'mentor' ? 'badge-role-mentor' : 'badge-role-mentee'}>
                    {user.role}
                  </Badge>
                </div>
                <Button
                  variant="outline-light"
                  size="sm"
                  onClick={handleLogout}
                  className="px-3"
                >
                  Logout
                </Button>
              </>
            ) : (
              <>
                <Button
                  as={Link}
                  to="/login"
                  variant="outline-light"
                  size="sm"
                  className="px-3 me-lg-2"
                >
                  Sign In
                </Button>
                <Button
                  as={Link}
                  to="/register"
                  className="btn-mentor-gold"
                  size="sm"
                >
                  Get Started
                </Button>
              </>
            )}
          </Nav>
        </Navbar.Collapse>
      </Container>
    </Navbar>
  );
};

export default AppNavbar;
