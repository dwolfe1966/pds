import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAdminAuth } from '../context/AdminAuthContext';

export default function LoginPage() {
  const { login, user } = useAdminAuth();
  const navigate = useNavigate();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [remember, setRemember] = useState(false);
  const [error, setError]       = useState('');
  const [loading, setLoading]   = useState(false);

  if (user) { navigate('/customers', { replace: true }); return null; }

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(username, password);
      navigate('/customers', { replace: true });
    } catch (err) {
      setError(err.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
      <header className="admin-header">
        <span className="brand">IDLookup Admin</span>
      </header>

      <div style={{ display: 'flex', flex: 1 }}>
        {/* Form panel */}
        <div style={{ flex: 1, padding: '4rem 3rem', background: '#f7fafc', display: 'flex', flexDirection: 'column', justifyContent: 'center', maxWidth: 480 }}>
          <h1 style={{ color: '#174e3c', marginBottom: '0.5rem' }}>CSR App Login</h1>
          <p style={{ color: '#4a5568', marginBottom: '1.5rem', fontSize: '0.9rem' }}>Sign in to access the IDLookup admin panel.</p>

          {error && <div className="error-msg">{error}</div>}

          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label>Email</label>
              <input type="email" value={username} onChange={e => setUsername(e.target.value)} required placeholder="admin@idlookup.ai" />
            </div>
            <div className="form-group">
              <label>Password</label>
              <input type="password" value={password} onChange={e => setPassword(e.target.value)} required placeholder="••••••••" />
            </div>
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem', fontSize: '0.85rem', cursor: 'pointer' }}>
              <input type="checkbox" checked={remember} onChange={e => setRemember(e.target.checked)} />
              Remember Me
            </label>
            <button type="submit" className="btn btn-primary" style={{ width: '100%' }} disabled={loading}>
              {loading ? 'Signing in…' : 'Login'}
            </button>
          </form>

          <p className="mini-text" style={{ marginTop: '1.5rem' }}>
            Stub credentials: <code>admin@idlookup.ai</code> / <code>admin123</code>
          </p>
        </div>

        {/* Hero panel */}
        <div style={{
          flex: 1,
          background: 'linear-gradient(135deg, #017a53 0%, #014d34 100%)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          minHeight: 400,
        }}>
          <div style={{ textAlign: 'center', color: '#fff', padding: '2rem' }}>
            <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>🔒</div>
            <h2 style={{ color: '#fff', marginBottom: '0.5rem' }}>IDLookup Admin</h2>
            <p style={{ color: 'rgba(255,255,255,0.75)', fontSize: '0.9rem' }}>Internal use only</p>
          </div>
        </div>
      </div>

      <footer className="admin-footer">
        IDLookup.ai © {new Date().getFullYear()}. Internal use only.
      </footer>
    </div>
  );
}
