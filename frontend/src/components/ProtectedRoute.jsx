import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Spinner, Container } from 'react-bootstrap';

const ProtectedRoute = ({ children, allowedRoles }) => {
  const { user, token, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <Container className="d-flex justify-content-center align-items-center" style={{ minHeight: '60vh' }}>
        <div className="text-center">
          <Spinner animation="border" variant="warning" style={{ color: '#C9A84C', width: '3rem', height: '3rem' }} />
          <p className="mt-3 text-secondary small">Verifying authentication...</p>
        </div>
      </Container>
    );
  }

  // Case 1: No token / not logged in -> redirect to /login
  if (!token || !user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // Case 2: Role-based route guard
  if (allowedRoles && allowedRoles.length > 0 && !allowedRoles.includes(user.role)) {
    // If a mentor tries to access a mentee-only route (e.g. /recommendations)
    if (user.role === 'mentor') {
      return <Navigate to="/mentor-dashboard" replace />;
    }
    // If a mentee tries to access a mentor-only route (e.g. /mentor-dashboard)
    if (user.role === 'mentee') {
      return <Navigate to="/recommendations" replace />;
    }
  }

  return children;
};

export default ProtectedRoute;
