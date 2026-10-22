import React from 'react';
import { Navbar, Nav, Container, Button } from 'react-bootstrap';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';

const AppNavbar = () => {
  const { user, isAuthenticated, logout } = useAuth();
  const { isDark, toggleTheme } = useTheme();
  const location = useLocation();

  const isActive = (path) => location.pathname === path;

  const scrollToAbout = (e) => {
    if (location.pathname === '/') {
      e.preventDefault();
      const section = document.getElementById('how-it-works');
      if (section) {
        section.scrollIntoView({ behavior: 'smooth' });
      }
    }
  };

  return (
    <Navbar className="floating-bottom-nav" variant={isDark ? 'dark' : 'light'}>
      <Container fluid className="d-flex align-items-center justify-content-between p-0">
        {/* Left: Text-only Logo ("Mentor" in white/navy and "plug" in gold) */}
        <Navbar.Brand as={Link} to="/" className="brand-text me-3 p-0">
          Mentor<span className="brand-plug">plug</span>
        </Navbar.Brand>

        {/* Right Links */}
        <Nav className="d-flex flex-row align-items-center gap-1">
          <Nav.Link as={Link} to="/" className={isActive('/') ? 'active' : ''}>
            Home
          </Nav.Link>

          <Nav.Link as={Link} to="/#how-it-works" onClick={scrollToAbout}>
            About
          </Nav.Link>

          {isAuthenticated ? (
            <>
              {user?.role === 'mentee' && (
                <Nav.Link as={Link} to="/recommendations" className={isActive('/recommendations') ? 'active' : ''}>
                  Matches
                </Nav.Link>
              )}
              {user?.role === 'mentor' && (
                <Nav.Link as={Link} to="/mentor-dashboard" className={isActive('/mentor-dashboard') ? 'active' : ''}>
                  Dashboard
                </Nav.Link>
              )}
              <Nav.Link as={Link} to="/profile" className={isActive('/profile') ? 'active' : ''}>
                Profile
              </Nav.Link>
              <Button
                variant={isDark ? 'outline-light' : 'outline-dark'}
                size="sm"
                onClick={logout}
                className="ms-1"
                style={{ borderRadius: '50px', fontSize: '0.82rem', padding: '0.35rem 0.85rem' }}
              >
                Sign Out
              </Button>
            </>
          ) : (
            <>
              <Nav.Link
                as={Link}
                to="/login"
                className={isActive('/login') ? 'active' : ''}
              >
                Sign In
              </Nav.Link>
              <Button
                as={Link}
                to="/register"
                className="btn-gold ms-1"
                size="sm"
                style={{ fontSize: '0.84rem', padding: '0.4rem 1rem' }}
              >
                Get Started
              </Button>
            </>
          )}

          {/* Theme Toggle (Sun/Moon) */}
          <button
            onClick={toggleTheme}
            className="theme-toggle-btn ms-1"
            title={isDark ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
            aria-label="Toggle theme"
          >
            {isDark ? (
              // Sun Icon (Switch to Light)
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="5" />
                <line x1="12" y1="1" x2="12" y2="3" />
                <line x1="12" y1="21" x2="12" y2="23" />
                <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
                <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
                <line x1="1" y1="12" x2="3" y2="12" />
                <line x1="21" y1="12" x2="23" y2="12" />
                <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
                <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
              </svg>
            ) : (
              // Moon Icon (Switch to Dark)
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
              </svg>
            )}
          </button>
        </Nav>
      </Container>
    </Navbar>
  );
};

export default AppNavbar;
