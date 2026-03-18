import React, { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import api from '../../api';
import ResultCard from '../../components/ResultCard';
import SearchBar from '../../components/SearchBar';
import { setSearchContext } from '../../services/searchContext';
import { track } from '../../services/trackingService';
import styles from './SearchResultsPage.module.css';

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
  const state = params.get('state');
  const error = params.get('error');
  
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [searchQuery, setSearchQuery] = useState({ firstName: '', lastName: '', state: '' });
  const [rawResponse, setRawResponse] = useState(null);
  const [loadingMore, setLoadingMore] = useState(false);

  useEffect(() => {
    track('results_view', { search_type: 'name', query: query || '', state: state || '' });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const fetchResults = async () => {
      // Check if we have results from the loader page
      const storedResults = sessionStorage.getItem('nameSearchResults');
      if (storedResults) {
        try {
          const data = JSON.parse(storedResults);
          setResults(data.results || []);
          setSearchQuery(data.query || {});
          if (data.searchContext) {
            setSearchContext(data.searchContext);
          }
          // Don't remove here: React Strict Mode double-mounts in dev, so the second
          // mount would see empty storage and show no results. Next search overwrites.
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
        
        setSearchQuery({ firstName, lastName, state: state || '' });
        
        // Build search parameters for new API
        const searchParams = {
          firstName,
          lastName,
          type: 'name'
        };
        if (state && state.trim()) {
          searchParams.state = state.trim();
        }
        
        const response = await api.searchPeople(searchParams);
        
        // Response is already adapted: { data: [...], pagination: {...}, searchContext: {...}, rawResponse? }
        setResults(response.data || []);
        setRawResponse(response.rawResponse || null);
        
        // Store search context for report creation and opt-out
        if (response.searchContext) {
          setSearchContext(response.searchContext);
        }
      } catch (err) {
        setErrorMessage(err.message || 'An error occurred during the search.');
      } finally {
        setLoading(false);
      }
    };
    fetchResults();
  }, [query, state, error]);

  const handleResultClick = (result) => {
    // Store result in sessionStorage for preview page
    sessionStorage.setItem(`result_${result.id}`, JSON.stringify(result));
    navigate(`/search/${result.id}`);
  };

  return (
    <main className={styles.main}>
      <div className={styles.contentContainer}>
        {/* Header Section */}
        <div className={styles.header}>
          <h1 className={styles.title}>
            {results.length > 0
              ? `We found ${results.length} result${results.length !== 1 ? 's' : ''} for "${searchQuery.firstName ? `${searchQuery.firstName} ${searchQuery.lastName}`.trim() : (query || 'your search')}"`
              : 'Search Results'}
          </h1>
          {(searchQuery.firstName || query) && (
            <p className={styles.searchQuery}>
              Results for: <strong>{searchQuery.firstName || query} {searchQuery.lastName}</strong>
              {searchQuery.state && <span> • {searchQuery.state}</span>}
            </p>
          )}
          <div style={{ maxWidth: '600px' }}>
            <SearchBar initialQuery={query || `${searchQuery.firstName} ${searchQuery.lastName}`.trim()} />
          </div>
        </div>

        {/* Loading State */}
        {loading && (
          <div className={styles.loading}>
            <div style={{
              width: '60px',
              height: '60px',
              border: '5px solid #e5e7eb',
              borderTop: '5px solid var(--color-primary)',
              borderRadius: '50%',
              animation: 'spin 1s linear infinite',
              margin: '0 auto 1.5rem auto'
            }}></div>
            <style>{`
              @keyframes spin {
                0% { transform: rotate(0deg); }
                100% { transform: rotate(360deg); }
              }
            `}</style>
            <p>Loading results...</p>
          </div>
        )}

        {/* Error State */}
        {errorMessage && (
          <div className={styles.error}>
            <p style={{ margin: 0, fontWeight: 600, marginBottom: '0.5rem' }}>Error:</p>
            <p style={{ margin: 0 }}>{errorMessage}</p>
          </div>
        )}

        {/* Results */}
        {!loading && !errorMessage && results && results.length > 0 ? (
          <div>
            <div className={styles.resultsCount}>
              Found <strong>{results.length}</strong> {results.length === 1 ? 'result' : 'results'} — select a name to view the full report
            </div>
            <p style={{ fontSize: '0.825rem', color: '#6b7280', margin: '0 0 1rem', padding: 0 }}>
              All data sourced from publicly available records.
            </p>
            <div className={styles.resultsList}>
              {results.map((result, index) => (
                <div key={result.id}>
                  <div
                    onClick={() => handleResultClick(result)}
                    style={{ cursor: 'pointer', transition: 'all 0.2s ease', position: 'relative' }}
                    onMouseEnter={(e) => { e.currentTarget.style.transform = 'translateY(-4px)'; }}
                    onMouseLeave={(e) => { e.currentTarget.style.transform = 'translateY(0)'; }}
                  >
                    {index === 0 && (
                      <div style={{
                        position: 'absolute', top: '-10px', left: '1rem', zIndex: 1,
                        background: '#d97706', color: '#fff',
                        fontSize: '0.7rem', fontWeight: 700, letterSpacing: '0.05em',
                        padding: '0.2rem 0.625rem', borderRadius: '9999px',
                        textTransform: 'uppercase', boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
                      }}>
                        ⭐ Most Likely Match
                      </div>
                    )}
                    <ResultCard result={result} />
                  </div>
                  {index === 2 && results.length > 3 && (
                    <div style={{
                      margin: '0.5rem 0',
                      padding: '0.75rem 1.25rem',
                      background: '#f0fdf4',
                      border: '1px solid #bbf7d0',
                      borderRadius: '0.625rem',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.625rem',
                      fontSize: '0.85rem',
                      color: '#166534',
                    }}>
                      <span>🔒</span>
                      <span>Your search is <strong>100% confidential</strong>. We never notify the person you searched.</span>
                    </div>
                  )}
                </div>
              ))}
            </div>
            {rawResponse?.hasMore?.() && (
              <div style={{ marginTop: '1.5rem', textAlign: 'center' }}>
                <button
                  type="button"
                  disabled={loadingMore}
                  onClick={async () => {
                    setLoadingMore(true);
                    try {
                      const more = await api.loadMoreSearchResults(rawResponse);
                      if (more?.data?.length) {
                        setResults(prev => [...prev, ...more.data]);
                      }
                    } catch (err) {
                      console.error('Load more failed:', err);
                    } finally {
                      setLoadingMore(false);
                    }
                  }}
                  style={{
                    padding: '0.75rem 2rem',
                    borderRadius: '0.375rem',
                    border: '2px solid #0d5d2f',
                    background: '#fff',
                    color: '#0d5d2f',
                    fontWeight: 600,
                    fontSize: '1rem',
                    cursor: loadingMore ? 'wait' : 'pointer',
                    transition: 'all 0.2s ease'
                  }}
                  onMouseEnter={(e) => { if (!loadingMore) { e.currentTarget.style.backgroundColor = '#0d5d2f'; e.currentTarget.style.color = '#fff'; }}}
                  onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = '#fff'; e.currentTarget.style.color = '#0d5d2f'; }}
                >
                  {loadingMore ? 'Loading…' : 'Load more results'}
                </button>
              </div>
            )}
          </div>
        ) : !loading && !errorMessage ? (
          <div className={styles.noResults}>
            <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>🔍</div>
            <p className={styles.noResultsTitle}>
              No results found
            </p>
            <p className={styles.noResultsText}>
              Try adjusting your search terms or adding a state for more specific results.
            </p>
          </div>
        ) : null}
      </div>
    </main>
  );
};

export default SalesSearchResultsPage;