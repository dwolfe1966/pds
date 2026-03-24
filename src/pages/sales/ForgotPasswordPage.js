import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import apiWrapper from '../../services/apiWrapper';
import styles from './LoginPage.module.css';

/**
 * Forgot password page — sends a BC password reset email.
 */
const ForgotPasswordPage = () => {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const wrapper = await apiWrapper.getWrapper();
      // Try known BC method names for password reset
      const resetFn = wrapper.api?.user?.resetPassword
        ?? wrapper.api?.user?.forgotPassword
        ?? wrapper.api?.auth?.resetPassword
        ?? wrapper.api?.auth?.forgotPassword;
      if (typeof resetFn === 'function') {
        await resetFn.call(wrapper.api.user ?? wrapper.api.auth, { email });
      } else {
        throw new Error('Password reset is not available. Please contact support.');
      }
      setSent(true);
    } catch (err) {
      setError(err?.message || 'Failed to send reset email. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className={styles.main}>
      <div className={styles.contentContainer}>
        <h1 className={styles.title}>Reset Password</h1>
        {sent ? (
          <div>
            <p style={{ color: '#16a34a', marginBottom: '1rem' }}>
              If an account exists for <strong>{email}</strong>, a password reset link has been sent.
              Check your inbox and follow the link to set a new password.
            </p>
            <p className={styles.signupLink}>
              <Link to="/login">Back to Login</Link>
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className={styles.form}>
            <p style={{ color: '#6b7280', marginBottom: '1rem', fontSize: '0.9rem' }}>
              Enter the email address for your account and we'll send a reset link.
            </p>
            <div className={styles.fieldGroup}>
              <label className={styles.label}>Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
                className={styles.input}
              />
            </div>
            {error && <div className={styles.error}>{error}</div>}
            <button type="submit" disabled={loading} className={styles.submitButton}>
              {loading ? 'Sending…' : 'Send Reset Link'}
            </button>
            <p className={styles.signupLink}>
              <Link to="/login">Back to Login</Link>
            </p>
          </form>
        )}
      </div>
    </main>
  );
};

export default ForgotPasswordPage;
