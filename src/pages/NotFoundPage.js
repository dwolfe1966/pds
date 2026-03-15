import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const NotFoundPage = () => {
  const navigate = useNavigate();
  const { token } = useAuth();

  const handleGoHome = () => {
    navigate(token ? '/dashboard' : '/');
  };

  return (
    <main style={{
      padding: '3rem 2rem',
      maxWidth: '600px',
      margin: '2rem auto',
      textAlign: 'center',
    }}>
      <h1 style={{ fontSize: '4rem', color: '#0d5d2f', margin: '0 0 0.5rem' }}>404</h1>
      <h2 style={{ color: '#111827', marginBottom: '1rem' }}>Page Not Found</h2>
      <p style={{ color: '#6b7280', marginBottom: '2rem', lineHeight: 1.6 }}>
        The page you are looking for does not exist or has been moved.
      </p>
      <button
        onClick={handleGoHome}
        style={{
          padding: '0.75rem 1.5rem',
          backgroundColor: '#0d5d2f',
          color: '#fff',
          border: 'none',
          borderRadius: '0.375rem',
          cursor: 'pointer',
          fontSize: '1rem',
          fontWeight: 600,
          boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
          transition: 'all 0.2s ease',
        }}
      >
        {token ? 'Go to Dashboard' : 'Go Home'}
      </button>
    </main>
  );
};

export default NotFoundPage;
