import React from 'react';
import { useLocation } from 'react-router-dom';
import SearchBar from '../components/SearchBar';

const LandingPage = () => {
  const location = useLocation();
  // Pre-populate search from query params if arriving from ad
  const params = new URLSearchParams(location.search);
  const q = params.get('q') || '';
  return (
    <main style={{ padding: '2rem' }}>
      <h1>Find people & monitor who searches for you</h1>
      <p>Enter a name below to begin your search.</p>
      <SearchBar initialQuery={q} />
    </main>
  );
};

export default LandingPage;