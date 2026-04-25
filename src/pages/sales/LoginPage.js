import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { track } from '../../services/trackingService';
import { gtmLogin } from '../../services/gtm';
import { recordLogin } from '../../services/loginHistory';
import styles from './LoginPage.module.css';

/**
 * Login page for returning users.
 */
const LoginPage = () => {
  const { login, token, user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [form, setForm] = useState({ email: '', password: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // Redirect already-authenticated users away from the login page
  useEffect(() => {
    if (!authLoading && token) {
      navigate(user?.role === 'admin' ? '/admin/users' : '/dashboard', { replace: true });
    }
  }, [token, user, authLoading, navigate]);

  if (authLoading) return null;

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const loggedInUser = await login(form.email, form.password);
      track('login', { userRole: loggedInUser?.role || 'member' });
      gtmLogin({ method: 'email' });
      recordLogin({ method: 'password', source: 'login_page', email: form.email });
      const redirectTo = searchParams.get('redirect');
      const defaultDest = loggedInUser?.role === 'admin' ? '/admin/users' : '/dashboard';
      navigate(redirectTo ? decodeURIComponent(redirectTo) : defaultDest);
    } catch (err) {
      track('login_error', { errorMessage: err.message });
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className={styles.main}>
      <div className={styles.contentContainer}>
        <h1 className={styles.title}>Login</h1>
        <form onSubmit={handleSubmit} className={styles.form}>
          <div className={styles.fieldGroup}>
            <label className={styles.label}>Email</label>
            <input
              type="text"
              name="email"
              value={form.email}
              onChange={handleChange}
              required
              autoComplete="username"
              className={styles.input}
            />
          </div>
          <div className={styles.fieldGroup}>
            <label className={styles.label}>Password</label>
            <input
              type="password"
              name="password"
              value={form.password}
              onChange={handleChange}
              required
              autoComplete="current-password"
              className={styles.input}
            />
          </div>
          {error && <div className={styles.error}>{error}</div>}
          <button type="submit" disabled={loading} className={styles.submitButton}>
            {loading ? 'Logging in…' : 'Login'}
          </button>
        </form>
        <p className={styles.signupLink}>
          Don't have an account? <Link to="/signup">Sign up</Link>
        </p>
        <p className={styles.signupLink}>
          Forgot your password? <Link to="/forgot-password">Reset it</Link>
        </p>
      </div>
    </main>
  );
};

export default LoginPage;