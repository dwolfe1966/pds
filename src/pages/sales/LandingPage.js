import React, { useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import SearchBar from '../../components/SearchBar';

/**
 * Search landing page for visitors coming from marketing campaigns.
 * Pre‑populates the search bar from query parameters.
 * If a query is present, automatically redirects to search results.
 */
const LandingPage = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const params = new URLSearchParams(location.search);
  const q = params.get('q') || '';
  const zip = params.get('zip') || '';

  // If query parameter exists, redirect to search results
  useEffect(() => {
    if (q) {
      const searchParams = new URLSearchParams();
      searchParams.set('q', q);
      if (zip) searchParams.set('zip', zip);
      navigate(`/search-results?${searchParams.toString()}`, { replace: true });
    }
  }, [q, zip, navigate]);

  return (
    <main style={{ padding: '2rem', maxWidth: '800px', margin: '0 auto' }}>
      <h1 style={{ color: '#0e123b', marginBottom: '1rem', fontSize: '2rem' }}>
        Find people & monitor who searches for you
      </h1>
      <p style={{ marginBottom: '2rem', color: '#666', fontSize: '1.1rem', lineHeight: '1.6' }}>
        Enter a name below to begin your search. Discover comprehensive information about people 
        and see who's searching for you.
      </p>
      <SearchBar initialQuery={q} />
      <div style={{ marginTop: '2rem', padding: '1.5rem', backgroundColor: '#f5f5f5', borderRadius: '4px' }}>
        <h3 style={{ color: '#0e123b', marginTop: 0 }}>What You Can Find</h3>
        <ul style={{ color: '#666', lineHeight: '1.8', paddingLeft: '1.5rem' }}>
          <li>Contact information and addresses</li>
          <li>Public records and background information</li>
          <li>Social media profiles</li>
          <li>Family and relatives</li>
        </ul>
      </div>
    </main>
  );
};

export default LandingPage;