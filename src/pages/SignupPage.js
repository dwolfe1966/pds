import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api';

const SignupPage = () => {
  const navigate = useNavigate();
  const [form, setForm] = useState({ fullName: '', zip: '', email: '', password: '' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const data = await api.post('/signup', form);
      setSuccess(true);
      // Redirect to login or show verification instructions
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <main style={{ padding: '2rem' }}>
      <h1>Create your account</h1>
      {success ? (
        <div>
          <p>Thank you for signing up! Please check your email to verify your account.</p>
          <button onClick={() => navigate('/login')}>Go to Login</button>
        </div>
      ) : (
        <form onSubmit={handleSubmit} style={{ maxWidth: '400px' }}>
          <div style={{ marginBottom: '1rem' }}>
            <label>Full Name</label>
            <input
              type="text"
              name="fullName"
              value={form.fullName}
              onChange={handleChange}
              required
              style={{ width: '100%', padding: '0.5rem' }}
            />
          </div>
          <div style={{ marginBottom: '1rem' }}>
            <label>ZIP Code</label>
            <input
              type="text"
              name="zip"
              value={form.zip}
              onChange={handleChange}
              style={{ width: '100%', padding: '0.5rem' }}
            />
          </div>
          <div style={{ marginBottom: '1rem' }}>
            <label>Email</label>
            <input
              type="email"
              name="email"
              value={form.email}
              onChange={handleChange}
              required
              style={{ width: '100%', padding: '0.5rem' }}
            />
          </div>
          <div style={{ marginBottom: '1rem' }}>
            <label>Password</label>
            <input
              type="password"
              name="password"
              value={form.password}
              onChange={handleChange}
              required
              style={{ width: '100%', padding: '0.5rem' }}
            />
          </div>
          {error && <p style={{ color: 'red' }}>{error}</p>}
          <button type="submit" disabled={loading} style={{ padding: '0.5rem 1rem' }}>
            {loading ? 'Signing up…' : 'Sign Up'}
          </button>
        </form>
      )}
    </main>
  );
};

export default SignupPage;