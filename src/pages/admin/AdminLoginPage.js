import React, { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

const AdminLoginPage = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (!email || !password) { setError('Please enter email and password.'); return; }
    setLoading(true);
    try {
      const result = await login(email, password);
      if (result?.user?.role !== 'admin') {
        setError('Access denied. Admin credentials required.');
        setLoading(false);
        return;
      }
      const redirect = searchParams.get('redirect') || '/admin/users';
      navigate(redirect, { replace: true });
    } catch (err) {
      setError(err?.message || 'Login failed. Please check your credentials.');
    } finally {
      setLoading(false);
    }
  };

  const inputStyle = {
    width: '100%', padding: '0.75rem 0.875rem', fontSize: '0.95rem',
    border: '1px solid #334155', borderRadius: '0.5rem', boxSizing: 'border-box',
    fontFamily: 'inherit', outline: 'none', background: '#1e293b', color: '#e2e8f0',
    transition: 'border-color 0.15s ease',
  };

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(145deg, #0f172a 0%, #1e293b 50%, #0f172a 100%)',
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      padding: '2rem 1rem',
    }}>
      {/* Logo */}
      <Link to="/" style={{ textDecoration: 'none', marginBottom: '2rem', textAlign: 'center' }}>
        <div style={{
          width: '48px', height: '48px', borderRadius: '12px',
          background: 'linear-gradient(135deg, #3b82f6 0%, #8b5cf6 100%)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: '1.3rem', fontWeight: 800, color: '#fff', margin: '0 auto 0.75rem',
        }}>BC</div>
        <div style={{ fontSize: '1.1rem', fontWeight: 700, color: '#f1f5f9', letterSpacing: '-0.02em' }}>
          ByteCrtrs Admin
        </div>
      </Link>

      {/* Login card */}
      <div style={{
        width: '100%', maxWidth: '400px',
        background: 'rgba(255,255,255,0.04)',
        border: '1px solid rgba(255,255,255,0.1)',
        borderRadius: '0.875rem', padding: '2rem',
      }}>
        <h1 style={{
          fontSize: '1.35rem', fontWeight: 700, color: '#f1f5f9',
          margin: '0 0 0.35rem', textAlign: 'center',
        }}>
          Admin Sign In
        </h1>
        <p style={{
          fontSize: '0.85rem', color: '#64748b', textAlign: 'center',
          margin: '0 0 1.5rem',
        }}>
          Enter your admin credentials to access the dashboard.
        </p>

        <form onSubmit={handleSubmit} noValidate>
          <div style={{ marginBottom: '1rem' }}>
            <label style={{
              display: 'block', fontSize: '0.82rem', fontWeight: 600,
              color: '#94a3b8', marginBottom: '0.35rem',
            }} htmlFor="admin-email">Email</label>
            <input
              id="admin-email"
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              style={inputStyle}
              placeholder="admin@example.com"
              required
              autoComplete="email"
              autoFocus
            />
          </div>
          <div style={{ marginBottom: '1rem' }}>
            <label style={{
              display: 'block', fontSize: '0.82rem', fontWeight: 600,
              color: '#94a3b8', marginBottom: '0.35rem',
            }} htmlFor="admin-password">Password</label>
            <input
              id="admin-password"
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              style={inputStyle}
              placeholder="Enter password"
              required
              autoComplete="current-password"
            />
          </div>

          {error && (
            <div style={{
              padding: '0.7rem 0.875rem', background: 'rgba(239,68,68,0.15)',
              border: '1px solid rgba(239,68,68,0.3)', borderRadius: '0.5rem',
              marginBottom: '1rem', fontSize: '0.85rem', color: '#fca5a5',
            }}>
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            style={{
              width: '100%', padding: '0.8rem',
              background: loading ? '#475569' : 'linear-gradient(135deg, #3b82f6 0%, #8b5cf6 100%)',
              color: '#ffffff', border: 'none', borderRadius: '0.5rem',
              fontSize: '0.95rem', fontWeight: 700, cursor: loading ? 'wait' : 'pointer',
              transition: 'opacity 0.15s ease',
              boxShadow: '0 2px 12px rgba(99,102,241,0.3)',
            }}
          >
            {loading ? 'Signing in\u2026' : 'Sign In'}
          </button>
        </form>

        <div style={{
          textAlign: 'center', marginTop: '1.25rem',
          fontSize: '0.78rem', color: '#475569',
        }}>
          <Link to="/" style={{ color: '#818cf8', textDecoration: 'none', fontWeight: 500 }}>
            &larr; Back to home
          </Link>
        </div>
      </div>

      {/* Footer */}
      <div style={{
        marginTop: '2rem', fontSize: '0.72rem', color: '#334155',
        textAlign: 'center',
      }}>
        &copy; {new Date().getFullYear()} ByteCreators Inc.
      </div>
    </div>
  );
};

export default AdminLoginPage;
