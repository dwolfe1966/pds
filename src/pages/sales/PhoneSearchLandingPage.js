import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLandingTrack } from '../../hooks/useLandingTrack';

/**
 * Phone search landing page for visitors.
 * Allows users to search by phone number.
 */
const PhoneSearchLandingPage = () => {
  useLandingTrack('phone', 'v1');
  const navigate = useNavigate();
  const [phone, setPhone] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    if (phone) {
      navigate(`/phone-search-results?phone=${encodeURIComponent(phone)}`);
    }
  };

  return (
    <main style={{ padding: '2rem', maxWidth: '800px', margin: '0 auto' }}>
      <h1 style={{ color: '#0d5d2f', marginBottom: '1rem' }}>Search by Phone Number</h1>
      <p style={{ marginBottom: '2rem', color: '#111827' }}>
        Enter a phone number below to find associated information.
      </p>
      <form onSubmit={handleSubmit} style={{ display: 'flex', gap: '0.5rem', marginBottom: '2rem' }}>
        <input
          type="tel"
          placeholder="Phone Number (e.g., 555-123-4567)"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          style={{ flex: 1, padding: '0.75rem', fontSize: '1rem', border: '1px solid #d1d5db', borderRadius: '0.375rem' }}
          required
        />
        <button 
          type="submit" 
          style={{ 
            padding: '0.75rem 2rem', 
            cursor: 'pointer', 
            backgroundColor: '#0d5d2f', 
            color: '#fff', 
            border: 'none', 
            borderRadius: '0.375rem',
            fontSize: '1rem',
            fontWeight: 'bold'
          }}
        >
          Search
        </button>
      </form>
      <div style={{ marginTop: '2rem', padding: '1rem', backgroundColor: '#f9fafb', borderRadius: '0.375rem' }}>
        <h3 style={{ color: '#0d5d2f', marginTop: 0 }}>About Phone Number Searches</h3>
        <p style={{ color: '#6b7280', lineHeight: '1.6' }}>
          Our phone number search helps you find information associated with a phone number, 
          including the owner's name, location, and other publicly available details.
        </p>
      </div>
    </main>
  );
};

export default PhoneSearchLandingPage;

