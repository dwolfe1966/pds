import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const ProtectedRoute = ({ children, role }) => {
  const { token, user, loading } = useAuth();
  const location = useLocation();
  if (loading) {
    return <div>Loading…</div>;
  }
  // Redirect unauthenticated users, preserving the intended destination
  if (!token) {
    return <Navigate to={`/login?redirect=${encodeURIComponent(location.pathname + location.search)}`} replace />;
  }
  // If a role is specified, ensure the user has it
  if (role && user?.role !== role) {
    return <Navigate to="/" replace />;
  }
  return children;
};

export default ProtectedRoute;