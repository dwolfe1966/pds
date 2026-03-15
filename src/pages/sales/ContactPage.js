import React, { useState } from 'react';
import api from '../../api';
import '../../styles/contentContainer.css';

/**
 * Contact page where users can reach out for support or inquiries.
 */
const ContactPage = () => {
  const [form, setForm] = useState({ name: '', email: '', subject: '', message: '' });
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
      await api.post('/contact', form);
      setSuccess(true);
      setForm({ name: '', email: '', subject: '', message: '' });
    } catch (err) {
      setError(err.message || 'An error occurred. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <main className="pageBackground">
        <div className="contentContainer contentContainerNarrow" style={{ textAlign: 'center' }}>
          <div style={{ padding: '2rem', backgroundColor: '#e8f5e9', borderRadius: '0.375rem' }}>
            <h2 style={{ color: '#0d5d2f', marginBottom: '1rem' }}>Message Sent Successfully</h2>
            <p style={{ color: '#6b7280', lineHeight: '1.6' }}>
              Thank you for contacting us. We'll get back to you as soon as possible.
            </p>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="pageBackground">
      <div className="contentContainer contentContainerNarrow">
      <h1 style={{ color: '#0d5d2f', marginBottom: '1rem' }}>Contact Us</h1>
      <p style={{ marginBottom: '2rem', color: '#6b7280', lineHeight: '1.6' }}>
        Have questions or need support? Fill out the form below and we'll get back to you as soon as possible.
      </p>

      <form onSubmit={handleSubmit}>
        <div style={{ marginBottom: '1.5rem' }}>
          <label style={{ display: 'block', marginBottom: '0.5rem', color: '#111827', fontWeight: 'bold' }}>
            Name *
          </label>
          <input
            type="text"
            name="name"
            value={form.name}
            onChange={handleChange}
            required
            style={{ width: '100%', padding: '0.75rem', fontSize: '1rem', border: '1px solid #d1d5db', borderRadius: '0.375rem' }}
          />
        </div>

        <div style={{ marginBottom: '1.5rem' }}>
          <label style={{ display: 'block', marginBottom: '0.5rem', color: '#111827', fontWeight: 'bold' }}>
            Email *
          </label>
          <input
            type="email"
            name="email"
            value={form.email}
            onChange={handleChange}
            required
            style={{ width: '100%', padding: '0.75rem', fontSize: '1rem', border: '1px solid #d1d5db', borderRadius: '0.375rem' }}
          />
        </div>

        <div style={{ marginBottom: '1.5rem' }}>
          <label style={{ display: 'block', marginBottom: '0.5rem', color: '#111827', fontWeight: 'bold' }}>
            Subject *
          </label>
          <input
            type="text"
            name="subject"
            value={form.subject}
            onChange={handleChange}
            required
            style={{ width: '100%', padding: '0.75rem', fontSize: '1rem', border: '1px solid #d1d5db', borderRadius: '0.375rem' }}
          />
        </div>

        <div style={{ marginBottom: '1.5rem' }}>
          <label style={{ display: 'block', marginBottom: '0.5rem', color: '#111827', fontWeight: 'bold' }}>
            Message *
          </label>
          <textarea
            name="message"
            value={form.message}
            onChange={handleChange}
            required
            rows="6"
            style={{ width: '100%', padding: '0.75rem', fontSize: '1rem', border: '1px solid #d1d5db', borderRadius: '0.375rem', fontFamily: 'inherit' }}
          />
        </div>

        {error && (
          <div style={{ padding: '1rem', backgroundColor: '#fee', color: '#c00', borderRadius: '0.375rem', marginBottom: '1rem' }}>
            <p style={{ margin: 0 }}>{error}</p>
          </div>
        )}

        <button
          type="submit"
          disabled={loading}
          style={{
            width: '100%',
            padding: '0.75rem',
            backgroundColor: loading ? '#9ca3af' : '#0d5d2f',
            color: '#fff',
            border: 'none',
            borderRadius: '0.375rem',
            cursor: loading ? 'not-allowed' : 'pointer',
            fontSize: '1rem',
            fontWeight: 'bold',
            boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
            transition: 'all 0.2s ease',
          }}
        >
          {loading ? 'Sending...' : 'Send Message'}
        </button>
      </form>

      <div style={{ marginTop: '2rem', padding: '1.5rem', backgroundColor: '#f9fafb', borderRadius: '0.375rem' }}>
        <h3 style={{ color: '#0d5d2f', marginTop: 0 }}>Other Ways to Reach Us</h3>
        <p style={{ color: '#6b7280', lineHeight: '1.6', marginBottom: '0.5rem' }}>
          <strong>Email:</strong> support@idlookup.ai
        </p>
        <p style={{ color: '#6b7280', lineHeight: '1.6' }}>
          <strong>Phone:</strong> [Your Support Phone Number]
        </p>
      </div>
      </div>
    </main>
  );
};

export default ContactPage;