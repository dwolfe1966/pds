import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const ProtectedRoute = ({ children, role }) => {
  const { token, user, loading } = useAuth();
  if (loading) {
    return <div>Loading…</div>;
  }
  // Redirect unauthenticated users
  if (!token) {
    return <Navigate to="/login" replace />;
  }
  // If a role is specified, ensure the user has it
  if (role && user?.role !== role) {
    return <Navigate to="/" replace />;
  }
  return children;
};

export default ProtectedRoute;