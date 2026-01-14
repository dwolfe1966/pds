import React, { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import api from '../../api';
import ResultCard from '../../components/ResultCard';
import SearchBar from '../../components/SearchBar';
import { useAuth } from '../../context/AuthContext';
import { setSearchContext } from '../../services/searchContext';

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
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchResults = async () => {
      setLoading(true);
      try {
        // First, check sessionStorage for results from MemberGeneralSearchPage
        const storedResults = sessionStorage.getItem('memberSearchResults');
        if (storedResults) {
          try {
            const parsed = JSON.parse(storedResults);
            setResults(parsed.results || []);
            // Clear sessionStorage after reading
            sessionStorage.removeItem('memberSearchResults');
            setLoading(false);
            return;
          } catch (e) {
            console.error('Failed to parse stored results:', e);
          }
        }

        // Fallback to query params (legacy flow)
        if (!query) {
          setLoading(false);
          return;
        }

        // Parse query into firstName and lastName
        const nameParts = query.trim().split(/\s+/);
        const firstName = nameParts[0] || '';
        const lastName = nameParts.slice(1).join(' ') || '';
        
        if (!firstName || !lastName) {
          setError('Please provide both first and last name');
          setLoading(false);
          return;
        }
        
        const searchParams = {
          firstName,
          lastName,
          type: 'name'
        };
        if (zip) {
          // Note: zip is not directly supported by new API, but we can pass it
          // The mock API will use it if available
        }
        
        const response = await api.searchPeople(searchParams);
        // Response is already adapted: { data: [...], pagination: {...}, searchContext: {...} }
        setResults(response.data || []);
        
        // Store search context for report creation
        if (response.searchContext) {
          setSearchContext(response.searchContext);
        }
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
            <ResultCard key={result.id} result={result} isMember={true} />
          ))}
        </div>
      ) : !loading ? (
        <p>No results found.</p>
      ) : null}
    </main>
  );
};

export default MemberSearchResultsPage;