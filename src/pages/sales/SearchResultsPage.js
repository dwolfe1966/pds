import React, { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import api from '../../api';
import ResultCard from '../../components/ResultCard';
import SearchBar from '../../components/SearchBar';

/**
 * Displays search results for public searches on the marketing funnel.
 * Mimics the privaterecords.net/name/search-result flow with IDLookup design.
 * Fetches results from the public `/search` endpoint or from sessionStorage.
 */
const SalesSearchResultsPage = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const params = new URLSearchParams(location.search);
  const query = params.get('q');
  const zip = params.get('zip');
  const error = params.get('error');
  
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [searchQuery, setSearchQuery] = useState({ firstName: '', lastName: '', zip: '' });

  useEffect(() => {
    const fetchResults = async () => {
      // Check if we have results from the loader page
      const storedResults = sessionStorage.getItem('nameSearchResults');
      if (storedResults) {
        try {
          const data = JSON.parse(storedResults);
          setResults(data.results || []);
          setSearchQuery(data.query || {});
          sessionStorage.removeItem('nameSearchResults');
          return;
        } catch (err) {
          console.error('Error parsing stored results:', err);
        }
      }

      // Fallback: fetch from query params (legacy flow)
      if (!query && !error) return;
      
      if (error) {
        setErrorMessage('An error occurred during the search. Please try again.');
        return;
      }

      setLoading(true);
      try {
        // Parse query into firstName and lastName
        const nameParts = query.trim().split(/\s+/);
        const firstName = nameParts[0] || '';
        const lastName = nameParts.slice(1).join(' ') || '';
        
        if (!firstName || !lastName) {
          setErrorMessage('Please provide both first and last name');
          return;
        }
        
        setSearchQuery({ firstName, lastName, zip: zip || '' });
        
        // Only include zip if it has a value
        const searchParams = { firstName, lastName };
        if (zip && zip.trim()) {
          searchParams.zip = zip.trim();
        }
        
        const response = await api.get('/search', { params: searchParams });
        setResults(response.data || []);
      } catch (err) {
        setErrorMessage(err.message || 'An error occurred during the search.');
      } finally {
        setLoading(false);
      }
    };
    fetchResults();
  }, [query, zip, error]);

  const handleResultClick = (result) => {
    // Store result in sessionStorage for preview page
    sessionStorage.setItem(`result_${result.id}`, JSON.stringify(result));
    navigate(`/search/${result.id}`);
  };

  return (
    <main style={{ 
      padding: '2rem',
      maxWidth: '1200px',
      margin: '0 auto'
    }}>
      <div style={{ marginBottom: '2rem' }}>
        <h1 style={{ 
          color: '#0e123b', 
          marginBottom: '1rem',
          fontSize: '2rem'
        }}>
          Search Results
        </h1>
        {(searchQuery.firstName || query) && (
          <p style={{ color: '#666', fontSize: '1rem', marginBottom: '1.5rem' }}>
            Results for: <strong>{searchQuery.firstName || query} {searchQuery.lastName}</strong>
            {searchQuery.zip && ` • ${searchQuery.zip}`}
          </p>
        )}
        <SearchBar initialQuery={query || `${searchQuery.firstName} ${searchQuery.lastName}`.trim()} />
      </div>

      {loading && (
        <div style={{ textAlign: 'center', padding: '3rem' }}>
          <div style={{
            width: '50px',
            height: '50px',
            border: '4px solid #f3f3f3',
            borderTop: '4px solid #0e123b',
            borderRadius: '50%',
            animation: 'spin 1s linear infinite',
            margin: '0 auto'
          }}></div>
          <style>{`
            @keyframes spin {
              0% { transform: rotate(0deg); }
              100% { transform: rotate(360deg); }
            }
          `}</style>
          <p style={{ color: '#666', marginTop: '1rem' }}>Loading results...</p>
        </div>
      )}

      {errorMessage && (
        <div style={{ 
          padding: '1.5rem', 
          backgroundColor: '#fee', 
          color: '#c00', 
          borderRadius: '8px', 
          marginBottom: '2rem',
          border: '1px solid #fcc'
        }}>
          <p style={{ margin: 0, fontWeight: 'bold' }}>Error:</p>
          <p style={{ margin: '0.5rem 0 0 0' }}>{errorMessage}</p>
        </div>
      )}

      {!loading && !errorMessage && results && results.length > 0 ? (
        <div>
          <p style={{ 
            color: '#666', 
            marginBottom: '1.5rem',
            fontSize: '0.95rem'
          }}>
            Found {results.length} {results.length === 1 ? 'result' : 'results'}
          </p>
          <div style={{ 
            display: 'grid', 
            gap: '1.5rem'
          }}>
            {results.map((result) => (
              <div 
                key={result.id}
                onClick={() => handleResultClick(result)}
                style={{
                  cursor: 'pointer',
                  transition: 'transform 0.2s, box-shadow 0.2s'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = 'translateY(-2px)';
                  e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.1)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = 'translateY(0)';
                  e.currentTarget.style.boxShadow = 'none';
                }}
              >
                <ResultCard result={result} />
              </div>
            ))}
          </div>
        </div>
      ) : !loading && !errorMessage ? (
        <div style={{ 
          textAlign: 'center', 
          padding: '3rem',
          backgroundColor: '#f5f5f5',
          borderRadius: '8px'
        }}>
          <p style={{ color: '#666', fontSize: '1.1rem', marginBottom: '1rem' }}>
            No results found.
          </p>
          <p style={{ color: '#999', fontSize: '0.95rem' }}>
            Try adjusting your search terms or adding a ZIP code for more specific results.
          </p>
        </div>
      ) : null}
    </main>
  );
};

export default SalesSearchResultsPage;