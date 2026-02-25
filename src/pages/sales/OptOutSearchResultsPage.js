import React, { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import api from '../../api';
import ResultCard from '../../components/ResultCard';
import { setSearchContext, updateSearchContext } from '../../services/searchContext';

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
  const state = params.get('state');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [checkingOptOut, setCheckingOptOut] = useState(null);
  const [alreadyOptedOut, setAlreadyOptedOut] = useState(null);

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
        const stateValue = state ? state.trim().toUpperCase() : '';
        
        if (!firstName || !lastName) {
          setError('Please provide both first and last name');
          return;
        }
        if (!stateValue || stateValue.length !== 2) {
          setError('State is required for opt-out search.');
          return;
        }
        
        const searchParams = {
          firstName,
          lastName,
          type: 'name',
          state: stateValue
        };
        
        const response = await api.searchPeople(searchParams);
        // Response is already adapted: { data: [...], pagination: {...}, searchContext: {...} }
        const fetchedResults = response.data || [];
        setResults(fetchedResults);
        
        // Store search context for opt-out request
        if (response.searchContext) {
          setSearchContext(response.searchContext);
        }
        // Cache results for the opt-out flow
        fetchedResults.forEach((result) => {
          const extId = result.extId || result.id;
          if (!extId) return;
          sessionStorage.setItem(
            `optout_result_${extId}`,
            JSON.stringify({
              id: result.id,
              extId,
              fullName: result.fullName,
              location: result.location,
              ageRange: result.ageRange,
              provider: result.provider || result.meta?.provider,
              _rawIdentity: result._rawIdentity || result,
            })
          );
        });
      } catch (err) {
        setError(err.message || 'An error occurred while searching.');
      } finally {
        setLoading(false);
      }
    };

    fetchResults();
  }, [query, zip, navigate]);

  const handleSelectResult = async (result) => {
    const extId = result.extId || result.id;
    if (!extId) return;

    updateSearchContext({
      identity: {
        extId,
        provider: result.provider || result.meta?.provider,
        fullName: result.fullName,
        _rawIdentity: result._rawIdentity || result,
      },
    });

    // Check opt-out status via ByteCrtrs API before proceeding
    setCheckingOptOut(extId);
    setAlreadyOptedOut(null);
    try {
      const searchResult = await api.searchOptOut({ targetId: extId, extId });
      const data = searchResult?.params?.response?.data ?? searchResult?.data ?? searchResult;
      const alreadyOpted = data?.alreadyOptedOut === true || data?.status === 'opted_out';
      if (alreadyOpted) {
        setAlreadyOptedOut(result.fullName || 'This record');
        setCheckingOptOut(null);
        return;
      }
    } catch (err) {
      // Proceed anyway - API may not be available or params may differ
      if (process.env.NODE_ENV === 'development') {
        console.warn('[OptOut] searchOptOut failed, proceeding:', err?.message);
      }
    }
    setCheckingOptOut(null);
    navigate(`/opt-out/request?resultId=${extId}`);
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

      {alreadyOptedOut && (
        <div style={{ padding: '1rem', backgroundColor: '#e8f5e9', color: '#2e7d32', borderRadius: '4px', marginBottom: '1rem' }}>
          <p style={{ margin: 0 }}>
            <strong>{alreadyOptedOut}</strong> has already been opted out. No further action needed.
          </p>
          <button
            onClick={() => setAlreadyOptedOut(null)}
            style={{ marginTop: '0.5rem', padding: '0.25rem 0.75rem', fontSize: '0.875rem' }}
          >
            Dismiss
          </button>
        </div>
      )}

      {checkingOptOut && (
        <div style={{ padding: '1rem', color: '#666', marginBottom: '1rem' }}>
          Checking opt-out status…
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
              onClick={() => handleSelectResult(result)}
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

