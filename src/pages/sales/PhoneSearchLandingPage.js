import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';

/**
 * Phone search landing page for visitors.
 * Allows users to search by phone number.
 */
const PhoneSearchLandingPage = () => {
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
      <h1 style={{ color: '#0e123b', marginBottom: '1rem' }}>Search by Phone Number</h1>
      <p style={{ marginBottom: '2rem', color: '#333' }}>
        Enter a phone number below to find associated information.
      </p>
      <form onSubmit={handleSubmit} style={{ display: 'flex', gap: '0.5rem', marginBottom: '2rem' }}>
        <input
          type="tel"
          placeholder="Phone Number (e.g., 555-123-4567)"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          style={{ flex: 1, padding: '0.75rem', fontSize: '1rem', border: '1px solid #ccc', borderRadius: '4px' }}
          required
        />
        <button 
          type="submit" 
          style={{ 
            padding: '0.75rem 2rem', 
            cursor: 'pointer', 
            backgroundColor: '#0e123b', 
            color: '#fff', 
            border: 'none', 
            borderRadius: '4px',
            fontSize: '1rem',
            fontWeight: 'bold'
          }}
        >
          Search
        </button>
      </form>
      <div style={{ marginTop: '2rem', padding: '1rem', backgroundColor: '#f5f5f5', borderRadius: '4px' }}>
        <h3 style={{ color: '#0e123b', marginTop: 0 }}>About Phone Number Searches</h3>
        <p style={{ color: '#666', lineHeight: '1.6' }}>
          Our phone number search helps you find information associated with a phone number, 
          including the owner's name, location, and other publicly available details.
        </p>
      </div>
    </main>
  );
};

export default PhoneSearchLandingPage;

