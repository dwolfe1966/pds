import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import api from '../../api';
import { getSearchContext } from '../../services/searchContext';

/**
 * Opt-out information input page where users provide details to verify their identity
 * and complete the opt-out request.
 */
const OptOutInfoInputPage = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const params = new URLSearchParams(location.search);
  const resultId = params.get('resultId');
  const [form, setForm] = useState({
    name: '',
    middleName: '',
    street: '',
    city: '',
    state: '',
    zip: '',
    email: '',
    phone: ''
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (!resultId) {
      navigate('/opt-out');
    }
  }, [resultId, navigate]);

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const searchContext = getSearchContext();
      const storedResult =
        (resultId && sessionStorage.getItem(`optout_result_${resultId}`)) ||
        (resultId && sessionStorage.getItem(`result_${resultId}`));
      const parsedResult = storedResult ? JSON.parse(storedResult) : null;
      const identity = searchContext?.identity || parsedResult;

      const extId = identity?.extId || identity?.id || resultId;
      const provider = identity?.provider || searchContext?.provider || identity?.meta?.provider;
      const referenceId =
        searchContext?.commerceContentId ||
        searchContext?.identity?.commerceContentId ||
        null;

      const addressParts = [form.street, form.city, form.state, form.zip].filter(Boolean);
      const address = addressParts.join(', ');

      if (!extId || !provider || !referenceId) {
        throw new Error('Missing search context for opt-out. Please select a result from opt-out search results.');
      }

      await api.requestOptOut({
        extId,
        provider,
        referenceId,
        email: form.email,
        fullName: form.name,
        address,
        phone: form.phone
      });
      setSuccess(true);
    } catch (err) {
      setError(err.message || 'An error occurred. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <main style={{ padding: '2rem', maxWidth: '600px', margin: '0 auto', textAlign: 'center' }}>
        <div style={{ padding: '2rem', backgroundColor: '#e8f5e9', borderRadius: '0.375rem' }}>
          <h2 style={{ color: '#0d5d2f', marginBottom: '1rem' }}>Opt-Out Request Submitted</h2>
          <p style={{ color: '#6b7280', lineHeight: '1.6', marginBottom: '1rem' }}>
            Thank you for submitting your opt-out request. We have received your information and will 
            process your request within 5-7 business days.
          </p>
          <p style={{ color: '#6b7280', lineHeight: '1.6' }}>
            You will receive a confirmation email at the address you provided. If you have any questions, 
            please contact our support team.
          </p>
          <button
            onClick={() => navigate('/')}
            style={{
              marginTop: '2rem',
              padding: '0.75rem 2rem',
              backgroundColor: '#0d5d2f',
              color: '#fff',
              border: 'none',
              borderRadius: '0.375rem',
              cursor: 'pointer',
              fontSize: '1rem'
            }}
          >
            Return to Home
          </button>
        </div>
      </main>
    );
  }

  return (
    <main style={{ padding: '2rem', maxWidth: '600px', margin: '0 auto' }}>
      <h1 style={{ color: '#0d5d2f', marginBottom: '1rem' }}>Complete Your Opt-Out Request</h1>
      <p style={{ marginBottom: '2rem', color: '#6b7280', lineHeight: '1.6' }}>
        Please provide the following information to verify your identity and complete your opt-out request.
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
            Middle Name
          </label>
          <input
            type="text"
            name="middleName"
            value={form.middleName}
            onChange={handleChange}
            style={{ width: '100%', padding: '0.75rem', fontSize: '1rem', border: '1px solid #d1d5db', borderRadius: '0.375rem' }}
          />
        </div>

        <div style={{ marginBottom: '1.5rem' }}>
          <label style={{ display: 'block', marginBottom: '0.5rem', color: '#111827', fontWeight: 'bold' }}>
            Street Address *
          </label>
          <input
            type="text"
            name="street"
            value={form.street}
            onChange={handleChange}
            required
            style={{ width: '100%', padding: '0.75rem', fontSize: '1rem', border: '1px solid #d1d5db', borderRadius: '0.375rem' }}
          />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '1rem', marginBottom: '1.5rem' }}>
          <div>
            <label style={{ display: 'block', marginBottom: '0.5rem', color: '#111827', fontWeight: 'bold' }}>
              City *
            </label>
            <input
              type="text"
              name="city"
              value={form.city}
              onChange={handleChange}
              required
              style={{ width: '100%', padding: '0.75rem', fontSize: '1rem', border: '1px solid #d1d5db', borderRadius: '0.375rem' }}
            />
          </div>
          <div>
            <label style={{ display: 'block', marginBottom: '0.5rem', color: '#111827', fontWeight: 'bold' }}>
              State *
            </label>
            <input
              type="text"
              name="state"
              value={form.state}
              onChange={handleChange}
              required
              maxLength="2"
              placeholder="XX"
              style={{ width: '100%', padding: '0.75rem', fontSize: '1rem', border: '1px solid #d1d5db', borderRadius: '0.375rem', textTransform: 'uppercase' }}
            />
          </div>
        </div>

        <div style={{ marginBottom: '1.5rem' }}>
          <label style={{ display: 'block', marginBottom: '0.5rem', color: '#111827', fontWeight: 'bold' }}>
            ZIP Code
          </label>
          <input
            type="text"
            name="zip"
            value={form.zip}
            onChange={handleChange}
            style={{ width: '100%', padding: '0.75rem', fontSize: '1rem', border: '1px solid #d1d5db', borderRadius: '0.375rem' }}
          />
        </div>

        <div style={{ marginBottom: '1.5rem' }}>
          <label style={{ display: 'block', marginBottom: '0.5rem', color: '#111827', fontWeight: 'bold' }}>
            Email Address
          </label>
          <input
            type="email"
            name="email"
            value={form.email}
            onChange={handleChange}
            style={{ width: '100%', padding: '0.75rem', fontSize: '1rem', border: '1px solid #d1d5db', borderRadius: '0.375rem' }}
          />
        </div>

        <div style={{ marginBottom: '1.5rem' }}>
          <label style={{ display: 'block', marginBottom: '0.5rem', color: '#111827', fontWeight: 'bold' }}>
            Phone Number
          </label>
          <input
            type="tel"
            name="phone"
            value={form.phone}
            onChange={handleChange}
            style={{ width: '100%', padding: '0.75rem', fontSize: '1rem', border: '1px solid #d1d5db', borderRadius: '0.375rem' }}
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
          {loading ? 'Submitting...' : 'Submit Opt-Out Request'}
        </button>
      </form>
    </main>
  );
};

export default OptOutInfoInputPage;

