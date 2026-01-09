import React, { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import api from '../../api';
import ResultCard from '../../components/ResultCard';
import { setSearchContext } from '../../services/searchContext';

/**
 * Displays phone search results for public searches.
 */
const PhoneSearchResultsPage = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const params = new URLSearchParams(location.search);
  const phone = params.get('phone');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchResults = async () => {
      // Check if we have results from the loader page
      const storedResults = sessionStorage.getItem('phoneSearchResults');
      if (storedResults) {
        try {
          const data = JSON.parse(storedResults);
          setResults(data.results || []);
          sessionStorage.removeItem('phoneSearchResults');
          setLoading(false);
          return;
        } catch (err) {
          console.error('Error parsing stored results:', err);
        }
      }

      if (!phone) {
        navigate('/phone-search');
        return;
      }

      setLoading(true);
      try {
        const response = await api.searchPeople({
          phone,
          type: 'phone'
        });
        // Response is already adapted: { data: [...], pagination: {...}, searchContext: {...} }
        setResults(response.data || []);
        
        // Store search context for opt-out
        if (response.searchContext) {
          setSearchContext(response.searchContext);
        }
      } catch (err) {
        setError(err.message || 'An error occurred while searching.');
      } finally {
        setLoading(false);
      }
    };

    fetchResults();
  }, [phone, navigate]);

  return (
    <main style={{ padding: '2rem', maxWidth: '1000px', margin: '0 auto' }}>
      <h1 style={{ color: '#0e123b', marginBottom: '1rem' }}>Phone Search Results</h1>
      
      <div style={{ marginBottom: '2rem', padding: '1rem', backgroundColor: '#f5f5f5', borderRadius: '4px' }}>
        <p style={{ margin: 0, color: '#666' }}>
          <strong>Searching for:</strong> {phone}
        </p>
      </div>

      {loading && (
        <div style={{ textAlign: 'center', padding: '2rem' }}>
          <p>Loading results...</p>
        </div>
      )}

      {error && (
        <div style={{ padding: '1rem', backgroundColor: '#fee', color: '#c00', borderRadius: '4px', marginBottom: '1rem' }}>
          <p style={{ margin: 0 }}>{error}</p>
        </div>
      )}

      {!loading && !error && results.length > 0 && (
        <div style={{ marginTop: '1rem' }}>
          <h2 style={{ color: '#0e123b', marginBottom: '1rem' }}>
            Found {results.length} result{results.length !== 1 ? 's' : ''}
          </h2>
          {results.map((result) => (
            <ResultCard key={result.id} result={result} />
          ))}
        </div>
      )}

      {!loading && !error && results.length === 0 && (
        <div style={{ textAlign: 'center', padding: '2rem' }}>
          <p style={{ color: '#666', fontSize: '1.1rem' }}>No results found for this phone number.</p>
          <button
            onClick={() => navigate('/phone-search')}
            style={{
              marginTop: '1rem',
              padding: '0.75rem 2rem',
              backgroundColor: '#0d5d2f',
              color: '#fff',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              fontSize: '1rem'
            }}
          >
            Try Another Search
          </button>
        </div>
      )}
    </main>
  );
};

export default PhoneSearchResultsPage;

