/**
 * PaidRoute — guards routes that require an active paid subscription.
 * Must be nested inside ProtectedRoute (auth guard runs first).
 *
 * Reads { isPaid, loading, subscriptionLoading } from AuthContext:
 *   - loading=true OR subscriptionLoading=true → render null (wait for BC fetch)
 *   - isPaid=true   → render children
 *   - isPaid=false  → <Navigate to="/payment?upgrade=1" replace />
 */

import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const PaidRoute = ({ children }) => {
  const { isPaid, loading, subscriptionLoading } = useAuth();

  if (loading || subscriptionLoading) {
    return null;
  }

  if (!isPaid) {
    return <Navigate to="/payment?upgrade=1" replace />;
  }

  return children;
};

export default PaidRoute;
