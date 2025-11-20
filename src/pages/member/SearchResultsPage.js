import React, { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import api from '../../api';
import ResultCard from '../../components/ResultCard';
import SearchBar from '../../components/SearchBar';
import { useAuth } from '../../context/AuthContext';

/**
 * Search results page for authenticated members.
 * Fetches results from the authenticated `/search` endpoint and includes the access token.
 */
const MemberSearchResultsPage = () => {
  const location = useLocation();
  const { token } = useAuth();
  const params = new URLSearchParams(location.search);
  const query = params.get('q');
  const zip = params.get('zip');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchResults = async () => {
      if (!query) return;
      setLoading(true);
      try {
        // Parse query into firstName and lastName
        const nameParts = query.trim().split(/\s+/);
        const firstName = nameParts[0] || '';
        const lastName = nameParts.slice(1).join(' ') || '';
        
        if (!firstName || !lastName) {
          setError('Please provide both first and last name');
          return;
        }
        
        const response = await api.get('/search', { params: { firstName, lastName, zip }, token });
        setResults(response.data || []);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };
    fetchResults();
  }, [query, zip, token]);

  return (
    <main style={{ padding: '2rem' }}>
      <h1>Search Results</h1>
      <SearchBar initialQuery={query || ''} />
      {loading && <p>Loading…</p>}
      {error && <p style={{ color: 'red' }}>{error}</p>}
      {results && results.length > 0 ? (
        <div style={{ marginTop: '1rem' }}>
          {results.map((result) => (
            <ResultCard key={result.id} result={result} />
          ))}
        </div>
      ) : !loading ? (
        <p>No results found.</p>
      ) : null}
    </main>
  );
};

export default MemberSearchResultsPage;