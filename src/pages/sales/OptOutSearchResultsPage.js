import React, { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import api from '../../api';
import ResultCard from '../../components/ResultCard';

/**
 * Displays search results for opt-out requests.
 * Users can select a result to proceed with the opt-out process.
 */
const OptOutSearchResultsPage = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const params = new URLSearchParams(location.search);
  const query = params.get('q');
  const zip = params.get('zip');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchResults = async () => {
      if (!query) {
        navigate('/opt-out');
        return;
      }

      setLoading(true);
      try {
        const nameParts = query.trim().split(/\s+/);
        const firstName = nameParts[0] || '';
        const lastName = nameParts.slice(1).join(' ') || '';
        
        if (!firstName || !lastName) {
          setError('Please provide both first and last name');
          return;
        }
        
        const response = await api.get('/search', { params: { firstName, lastName, zip } });
        setResults(response.data || []);
      } catch (err) {
        setError(err.message || 'An error occurred while searching.');
      } finally {
        setLoading(false);
      }
    };

    fetchResults();
  }, [query, zip, navigate]);

  const handleSelectResult = (resultId) => {
    navigate(`/opt-out/request?resultId=${resultId}`);
  };

  return (
    <main style={{ padding: '2rem', maxWidth: '1000px', margin: '0 auto' }}>
      <h1 style={{ color: '#0e123b', marginBottom: '1rem' }}>Opt-Out Search Results</h1>
      
      <div style={{ marginBottom: '2rem', padding: '1rem', backgroundColor: '#f5f5f5', borderRadius: '4px' }}>
        <p style={{ margin: 0, color: '#666' }}>
          <strong>Searching for:</strong> {query} {zip && `(${zip})`}
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
          <p style={{ color: '#666', marginBottom: '1rem' }}>
            Select the record that matches you to proceed with the opt-out request.
          </p>
          {results.map((result) => (
            <div 
              key={result.id} 
              style={{ 
                border: '1px solid #ccc', 
                padding: '1rem', 
                marginBottom: '1rem', 
                borderRadius: '4px',
                cursor: 'pointer',
                transition: 'background-color 0.2s'
              }}
              onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f9f9f9'}
              onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#fff'}
              onClick={() => handleSelectResult(result.id)}
            >
              <h3 style={{ margin: 0, color: '#0e123b' }}>{result.fullName}</h3>
              <p style={{ margin: '0.5rem 0', color: '#666' }}>Age: {result.ageRange}</p>
              <p style={{ margin: '0.5rem 0', color: '#666' }}>Location: {result.location}</p>
              <button
                style={{
                  marginTop: '0.5rem',
                  padding: '0.5rem 1rem',
                  backgroundColor: '#0d5d2f',
                  color: '#fff',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer'
                }}
              >
                Request Opt-Out
              </button>
            </div>
          ))}
        </div>
      )}

      {!loading && !error && results.length === 0 && (
        <div style={{ textAlign: 'center', padding: '2rem' }}>
          <p style={{ color: '#666', fontSize: '1.1rem' }}>No results found.</p>
          <button
            onClick={() => navigate('/opt-out')}
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

export default OptOutSearchResultsPage;

