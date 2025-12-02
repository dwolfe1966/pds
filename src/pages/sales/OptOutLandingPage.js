import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';

/**
 * Opt-out landing page where users can search for their information to opt out.
 */
const OptOutLandingPage = () => {
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [zip, setZip] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    if (query) {
      const params = new URLSearchParams();
      params.set('q', query);
      if (zip) params.set('zip', zip);
      navigate(`/opt-out-results?${params.toString()}`);
    }
  };

  return (
    <main style={{ padding: '2rem', maxWidth: '800px', margin: '0 auto' }}>
      <h1 style={{ color: '#0e123b', marginBottom: '1rem' }}>Opt Out of Public Records</h1>
      <p style={{ marginBottom: '2rem', color: '#333', lineHeight: '1.6' }}>
        If you would like to remove your information from public records searches, 
        please search for your name below to find your records and begin the opt-out process.
      </p>
      
      <form onSubmit={handleSubmit} style={{ marginBottom: '2rem' }}>
        <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem' }}>
          <input
            type="text"
            placeholder="Full Name"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            style={{ flex: 1, padding: '0.75rem', fontSize: '1rem', border: '1px solid #ccc', borderRadius: '4px' }}
            required
          />
          <input
            type="text"
            placeholder="ZIP Code (optional)"
            value={zip}
            onChange={(e) => setZip(e.target.value)}
            style={{ width: '150px', padding: '0.75rem', fontSize: '1rem', border: '1px solid #ccc', borderRadius: '4px' }}
          />
        </div>
        <button 
          type="submit" 
          style={{ 
            padding: '0.75rem 2rem', 
            cursor: 'pointer', 
            backgroundColor: '#0d5d2f', 
            color: '#fff', 
            border: 'none', 
            borderRadius: '4px',
            fontSize: '1rem',
            fontWeight: 'bold'
          }}
        >
          Search for My Records
        </button>
      </form>

      <div style={{ marginTop: '2rem', padding: '1.5rem', backgroundColor: '#f5f5f5', borderRadius: '4px' }}>
        <h3 style={{ color: '#0e123b', marginTop: 0 }}>About Opt-Out</h3>
        <p style={{ color: '#666', lineHeight: '1.6', marginBottom: '1rem' }}>
          We respect your privacy. If you find your information in our database and wish to have it removed, 
          you can submit an opt-out request. Once verified, we will remove your information from our search results.
        </p>
        <p style={{ color: '#666', lineHeight: '1.6' }}>
          <strong>Note:</strong> The opt-out process requires verification to ensure the request is legitimate. 
          This helps protect against fraudulent removal requests.
        </p>
      </div>
    </main>
  );
};

export default OptOutLandingPage;

