import React, { useState } from 'react';
import api from '../../api';

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
      <main style={{ padding: '2rem', maxWidth: '600px', margin: '0 auto', textAlign: 'center' }}>
        <div style={{ padding: '2rem', backgroundColor: '#e8f5e9', borderRadius: '4px' }}>
          <h2 style={{ color: '#0e123b', marginBottom: '1rem' }}>Message Sent Successfully</h2>
          <p style={{ color: '#666', lineHeight: '1.6' }}>
            Thank you for contacting us. We'll get back to you as soon as possible.
          </p>
        </div>
      </main>
    );
  }

  return (
    <main style={{ padding: '2rem', maxWidth: '700px', margin: '0 auto' }}>
      <h1 style={{ color: '#0e123b', marginBottom: '1rem' }}>Contact Us</h1>
      <p style={{ marginBottom: '2rem', color: '#666', lineHeight: '1.6' }}>
        Have questions or need support? Fill out the form below and we'll get back to you as soon as possible.
      </p>

      <form onSubmit={handleSubmit}>
        <div style={{ marginBottom: '1.5rem' }}>
          <label style={{ display: 'block', marginBottom: '0.5rem', color: '#333', fontWeight: 'bold' }}>
            Name *
          </label>
          <input
            type="text"
            name="name"
            value={form.name}
            onChange={handleChange}
            required
            style={{ width: '100%', padding: '0.75rem', fontSize: '1rem', border: '1px solid #ccc', borderRadius: '4px' }}
          />
        </div>

        <div style={{ marginBottom: '1.5rem' }}>
          <label style={{ display: 'block', marginBottom: '0.5rem', color: '#333', fontWeight: 'bold' }}>
            Email *
          </label>
          <input
            type="email"
            name="email"
            value={form.email}
            onChange={handleChange}
            required
            style={{ width: '100%', padding: '0.75rem', fontSize: '1rem', border: '1px solid #ccc', borderRadius: '4px' }}
          />
        </div>

        <div style={{ marginBottom: '1.5rem' }}>
          <label style={{ display: 'block', marginBottom: '0.5rem', color: '#333', fontWeight: 'bold' }}>
            Subject *
          </label>
          <input
            type="text"
            name="subject"
            value={form.subject}
            onChange={handleChange}
            required
            style={{ width: '100%', padding: '0.75rem', fontSize: '1rem', border: '1px solid #ccc', borderRadius: '4px' }}
          />
        </div>

        <div style={{ marginBottom: '1.5rem' }}>
          <label style={{ display: 'block', marginBottom: '0.5rem', color: '#333', fontWeight: 'bold' }}>
            Message *
          </label>
          <textarea
            name="message"
            value={form.message}
            onChange={handleChange}
            required
            rows="6"
            style={{ width: '100%', padding: '0.75rem', fontSize: '1rem', border: '1px solid #ccc', borderRadius: '4px', fontFamily: 'inherit' }}
          />
        </div>

        {error && (
          <div style={{ padding: '1rem', backgroundColor: '#fee', color: '#c00', borderRadius: '4px', marginBottom: '1rem' }}>
            <p style={{ margin: 0 }}>{error}</p>
          </div>
        )}

        <button
          type="submit"
          disabled={loading}
          style={{
            width: '100%',
            padding: '0.75rem',
            backgroundColor: loading ? '#999' : '#0e123b',
            color: '#fff',
            border: 'none',
            borderRadius: '4px',
            cursor: loading ? 'not-allowed' : 'pointer',
            fontSize: '1rem',
            fontWeight: 'bold'
          }}
        >
          {loading ? 'Sending...' : 'Send Message'}
        </button>
      </form>

      <div style={{ marginTop: '2rem', padding: '1.5rem', backgroundColor: '#f5f5f5', borderRadius: '4px' }}>
        <h3 style={{ color: '#0e123b', marginTop: 0 }}>Other Ways to Reach Us</h3>
        <p style={{ color: '#666', lineHeight: '1.6', marginBottom: '0.5rem' }}>
          <strong>Email:</strong> support@idlookup.ai
        </p>
        <p style={{ color: '#666', lineHeight: '1.6' }}>
          <strong>Phone:</strong> [Your Support Phone Number]
        </p>
      </div>
    </main>
  );
};

export default ContactPage;