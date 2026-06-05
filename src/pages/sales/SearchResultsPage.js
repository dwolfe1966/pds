import React, { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import api from '../../api';
import ResultCard from '../../components/ResultCard';
import SearchBar from '../../components/SearchBar';
import ZeroResultsPanel from '../../components/ZeroResultsPanel';
import ThinMatchPreview from '../../components/ThinMatchPreview';
import { setSearchContext } from '../../services/searchContext';
import { track } from '../../services/trackingService';
import { readThinMatch } from '../../services/thinMatch';
import { useCampaign } from '../../context/CampaignContext';
import styles from './SearchResultsPage.module.css';
import { useBrand } from '../../services/brand';

/**
 * Displays search results for public searches on the marketing funnel.
 * Mimics the privaterecords.net/name/search-result flow with IDLookup design.
 * Fetches results from the public `/search` endpoint or from sessionStorage.
 */
const SalesSearchResultsPage = () => {
  const brand = useBrand();
  const campaign = useCampaign(); // bug #51: shN drives thin-match vs no-records
  const location = useLocation();
  const navigate = useNavigate();
  const params = new URLSearchParams(location.search);
  const query = params.get('q');
  // SearchBar emits firstName + lastName directly; legacy callers still send `q`.
  const firstNameParam = params.get('firstName') || '';
  const lastNameParam = params.get('lastName') || '';
  const state = params.get('state');
  const error = params.get('error');
  
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [searchQuery, setSearchQuery] = useState({ firstName: '', lastName: '', state: '' });
  const [rawResponse, setRawResponse] = useState(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [paginationExhausted, setPaginationExhausted] = useState(false);
  const [totalCount, setTotalCount] = useState(0);
  const [sortBy, setSortBy] = useState('relevance');

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
          // Validate that stored results match the current URL query before
          // rendering. Without this, a prior search's sessionStorage can leak
          // into a new search if the new search failed to write its own
          // payload (cancelled effect, BC error, etc.). Compare case-
          // insensitively since BC and form casing diverge.
          const norm = (s) => String(s || '').trim().toLowerCase();
          const expectedF = norm(firstNameParam) ||
            (query ? norm(query.split(/\s+/)[0]) : '');
          const expectedL = norm(lastNameParam) ||
            (query ? norm(query.split(/\s+/).slice(1).join(' ')) : '');
          const storedF = norm(data.query?.firstName);
          const storedL = norm(data.query?.lastName);
          const queryMatches =
            (!expectedF || expectedF === storedF) &&
            (!expectedL || expectedL === storedL);
          if (!queryMatches) {
            // Stale stored data — wipe and fall through to fresh fetch.
            try { sessionStorage.removeItem('nameSearchResults'); } catch {}
          } else {
            setResults(data.results || []);
            setSearchQuery(data.query || {});
            setTotalCount(data.pagination?.total || 0);
            if (data.searchContext) {
              setSearchContext(data.searchContext);
            }
            // Don't remove here: React Strict Mode double-mounts in dev, so the second
            // mount would see empty storage and show no results. Next search overwrites.
            return;
          }
        } catch (err) {
          console.error('Error parsing stored results:', err);
        }
      }

      // Fallback: fetch from query params (legacy + direct-link flow)
      if (!query && !firstNameParam && !lastNameParam && !error) return;

      if (error) {
        setErrorMessage('An error occurred during the search. Please try again.');
        return;
      }

      setLoading(true);
      try {
        // Prefer explicit first/last params (new SearchBar contract). Fall back
        // to whitespace-splitting the legacy `q` string for old links.
        let firstName = firstNameParam.trim();
        let lastName = lastNameParam.trim();
        if (!firstName && !lastName && query) {
          const nameParts = query.trim().split(/\s+/);
          firstName = nameParts[0] || '';
          lastName = nameParts.slice(1).join(' ') || '';
        }

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
        setTotalCount(response.pagination?.total || 0);

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
  }, [query, firstNameParam, lastNameParam, state, error]);

  // Partner feedback (bug 5): show exact count when BC knows ≤30 total,
  // collapse to "more than 30" otherwise so the UI pushes users to refine.
  const displayCount = totalCount || results.length;
  const countLabel = !displayCount
    ? null
    : displayCount > 30
    ? 'More than 30 results — refine your search to narrow down'
    : `${displayCount} result${displayCount !== 1 ? 's' : ''}`;

  // Sorted view (bug 11). BC returns results in its own relevance order; we
  // respect that by default and only re-sort client-side when the user picks
  // a different option. ageRange is a free-form string like "35-40" or "35" —
  // parse the leading integer for numeric sort; rows missing an age sink.
  const parseAge = (raw) => {
    const match = /\d+/.exec(raw || '');
    return match ? parseInt(match[0], 10) : null;
  };

  // Client-side narrowing for optional filters (bug 10). BC doesn't document
  // city/age as teaser inputs, so we apply them here against the full result
  // set. If narrowing would eliminate everything we fall back to the raw list
  // so the user isn't left staring at an empty page.
  const narrowedResults = useMemo(() => {
    const cityQ = (searchQuery.city || '').trim().toLowerCase();
    const ageQ = parseAge(searchQuery.age);
    if (!cityQ && ageQ == null) return results;
    const filtered = results.filter((r) => {
      if (cityQ && !(r.location || '').toLowerCase().includes(cityQ)) return false;
      if (ageQ != null) {
        const rAge = parseAge(r.ageRange);
        if (rAge == null) return false;
        if (Math.abs(rAge - ageQ) > 5) return false;
      }
      return true;
    });
    return filtered.length > 0 ? filtered : results;
  }, [results, searchQuery.city, searchQuery.age]);

  const sortedResults = useMemo(() => {
    if (sortBy === 'relevance') return narrowedResults;
    const copy = [...narrowedResults];
    if (sortBy === 'age-asc' || sortBy === 'age-desc') {
      copy.sort((a, b) => {
        const av = parseAge(a.ageRange);
        const bv = parseAge(b.ageRange);
        if (av == null && bv == null) return 0;
        if (av == null) return 1;
        if (bv == null) return -1;
        return sortBy === 'age-asc' ? av - bv : bv - av;
      });
    } else if (sortBy === 'name') {
      copy.sort((a, b) => (a.fullName || '').localeCompare(b.fullName || ''));
    }
    return copy;
  }, [narrowedResults, sortBy]);

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
            {results.length > 0 && countLabel
              ? `We found ${countLabel} for "${searchQuery.firstName ? `${searchQuery.firstName} ${searchQuery.lastName}`.trim() : (query || 'your search')}"`
              : 'Search Results'}
          </h1>
          {(searchQuery.firstName || query) && (
            <p className={styles.searchQuery}>
              Results for: <strong>{searchQuery.firstName || query} {searchQuery.lastName}</strong>
              {searchQuery.state && <span> • {searchQuery.state}</span>}
            </p>
          )}
          <div style={{ maxWidth: '600px' }}>
            <SearchBar
              initialFirstName={searchQuery.firstName || ''}
              initialLastName={searchQuery.lastName || ''}
              initialQuery={query || ''}
            />
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
              {totalCount > 30 ? (
                <>Showing <strong>{results.length}</strong> of <strong>30+</strong> matches — refine your search below for a narrower list</>
              ) : (
                <>Found <strong>{displayCount}</strong> {displayCount === 1 ? 'result' : 'results'} — select a name to view the full report</>
              )}
            </div>
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              flexWrap: 'wrap', gap: '0.5rem', margin: '0 0 1rem', padding: 0,
            }}>
              <p style={{ fontSize: '0.825rem', color: '#6b7280', margin: 0 }}>
                All data sourced from publicly available records.
              </p>
              {results.length > 1 && (
                <label style={{ fontSize: '0.825rem', color: '#374151', display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
                  Sort:
                  <select
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value)}
                    style={{
                      fontSize: '0.825rem', padding: '0.3rem 0.5rem',
                      borderRadius: '0.375rem', border: '1px solid #d1d5db',
                      background: '#fff', color: '#111827',
                    }}
                  >
                    <option value="relevance">Most relevant</option>
                    <option value="age-asc">Age (youngest first)</option>
                    <option value="age-desc">Age (oldest first)</option>
                    <option value="name">Name (A-Z)</option>
                  </select>
                </label>
              )}
            </div>
            <div className={styles.resultsList}>
              {sortedResults.map((result, index) => (
                <div key={result.id}>
                  <div
                    onClick={() => handleResultClick(result)}
                    style={{ cursor: 'pointer', transition: 'all 0.2s ease', position: 'relative' }}
                    onMouseEnter={(e) => { e.currentTarget.style.transform = 'translateY(-4px)'; }}
                    onMouseLeave={(e) => { e.currentTarget.style.transform = 'translateY(0)'; }}
                  >
                    {index === 0 && sortBy === 'relevance' && (
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
                  {index === 2 && sortedResults.length > 3 && (
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
            {rawResponse?.hasMore?.() && !paginationExhausted && (
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
                      } else {
                        setPaginationExhausted(true);
                      }
                    } catch (err) {
                      console.error('Load more failed:', err);
                      setPaginationExhausted(true);
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
          (() => {
            const flags = readThinMatch();
            return campaign?.search?.zeroState === 'thinMatch'
              ? <ThinMatchPreview searchType="name" query={searchQuery} flags={flags} />
              : <ZeroResultsPanel searchType="name" query={searchQuery} />;
          })()
        ) : null}
      </div>
    </main>
  );
};

export default SalesSearchResultsPage;