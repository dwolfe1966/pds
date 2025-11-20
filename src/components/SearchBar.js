import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';

const SearchBar = ({ initialQuery = '' }) => {
  const [query, setQuery] = useState(initialQuery);
  const [zip, setZip] = useState('');
  const navigate = useNavigate();

  const handleSubmit = (e) => {
    e.preventDefault();
    // Navigate to search results page with query params
    const params = new URLSearchParams();
    if (query) params.set('q', query);
    if (zip) params.set('zip', zip);
    navigate(`/search-results?${params.toString()}`);
  };

  return (
    <form onSubmit={handleSubmit} style={{ display: 'flex', gap: '0.5rem' }}>
      <input
        type="text"
        placeholder="Name"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        style={{ flex: 1, padding: '0.5rem' }}
        required
      />
      <input
        type="text"
        placeholder="ZIP (optional)"
        value={zip}
        onChange={(e) => setZip(e.target.value)}
        style={{ width: '100px', padding: '0.5rem' }}
      />
      <button type="submit" style={{ padding: '0.5rem 1rem', cursor: 'pointer' }}>Search</button>
    </form>
  );
};

export default SearchBar;