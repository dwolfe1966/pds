import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { track } from '../../services/trackingService';

/**
 * Simple page that logs the user out and redirects to the homepage.
 */
const LogoutPage = () => {
  const { logout } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    track('logout');
    logout();
    navigate('/');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <main style={{ padding: '2rem' }}>
      <p>Logging out…</p>
    </main>
  );
};

export default LogoutPage;