import React, { useEffect, useMemo, useState } from 'react';
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
  const [rawResponse, setRawResponse] = useState(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [nameFilter, setNameFilter] = useState('');
  const [stateFilter, setStateFilter] = useState('');
  const [minAge, setMinAge] = useState('');
  const [maxAge, setMaxAge] = useState('');
  const [sortBy, setSortBy] = useState('relevance');

  const usStates = [
    { value: '', label: 'All States' },
    { value: 'AL', label: 'AL' },
    { value: 'AK', label: 'AK' },
    { value: 'AZ', label: 'AZ' },
    { value: 'AR', label: 'AR' },
    { value: 'CA', label: 'CA' },
    { value: 'CO', label: 'CO' },
    { value: 'CT', label: 'CT' },
    { value: 'DE', label: 'DE' },
    { value: 'FL', label: 'FL' },
    { value: 'GA', label: 'GA' },
    { value: 'HI', label: 'HI' },
    { value: 'ID', label: 'ID' },
    { value: 'IL', label: 'IL' },
    { value: 'IN', label: 'IN' },
    { value: 'IA', label: 'IA' },
    { value: 'KS', label: 'KS' },
    { value: 'KY', label: 'KY' },
    { value: 'LA', label: 'LA' },
    { value: 'ME', label: 'ME' },
    { value: 'MD', label: 'MD' },
    { value: 'MA', label: 'MA' },
    { value: 'MI', label: 'MI' },
    { value: 'MN', label: 'MN' },
    { value: 'MS', label: 'MS' },
    { value: 'MO', label: 'MO' },
    { value: 'MT', label: 'MT' },
    { value: 'NE', label: 'NE' },
    { value: 'NV', label: 'NV' },
    { value: 'NH', label: 'NH' },
    { value: 'NJ', label: 'NJ' },
    { value: 'NM', label: 'NM' },
    { value: 'NY', label: 'NY' },
    { value: 'NC', label: 'NC' },
    { value: 'ND', label: 'ND' },
    { value: 'OH', label: 'OH' },
    { value: 'OK', label: 'OK' },
    { value: 'OR', label: 'OR' },
    { value: 'PA', label: 'PA' },
    { value: 'RI', label: 'RI' },
    { value: 'SC', label: 'SC' },
    { value: 'SD', label: 'SD' },
    { value: 'TN', label: 'TN' },
    { value: 'TX', label: 'TX' },
    { value: 'UT', label: 'UT' },
    { value: 'VT', label: 'VT' },
    { value: 'VA', label: 'VA' },
    { value: 'WA', label: 'WA' },
    { value: 'WV', label: 'WV' },
    { value: 'WI', label: 'WI' },
    { value: 'WY', label: 'WY' }
  ];

  const parseAgeRange = (range) => {
    if (!range) return null;
    const match = String(range).match(/(\d{1,3})/g);
    if (!match || match.length === 0) return null;
    const numbers = match.map(Number).filter(n => !Number.isNaN(n));
    if (numbers.length === 0) return null;
    const min = Math.min(...numbers);
    const max = Math.max(...numbers);
    return { min, max };
  };

  const extractState = (locationValue) => {
    if (!locationValue) return '';
    const parts = String(locationValue).split(',').map(part => part.trim());
    if (parts.length < 2) return '';
    const statePart = parts[1] || '';
    return statePart.slice(0, 2).toUpperCase();
  };

  const filteredResults = useMemo(() => {
    const minValue = minAge ? Number(minAge) : null;
    const maxValue = maxAge ? Number(maxAge) : null;

    return results
      .filter((result) => {
        if (nameFilter.trim()) {
          const name = (result.fullName || '').toLowerCase();
          if (!name.includes(nameFilter.trim().toLowerCase())) {
            return false;
          }
        }

        if (stateFilter) {
          const resultState = extractState(result.location);
          if (resultState !== stateFilter) {
            return false;
          }
        }

        if (minValue !== null || maxValue !== null) {
          const range = parseAgeRange(result.ageRange);
          if (!range) {
            return false;
          }
          if (minValue !== null && range.max < minValue) {
            return false;
          }
          if (maxValue !== null && range.min > maxValue) {
            return false;
          }
        }

        return true;
      })
      .sort((a, b) => {
        if (sortBy === 'name-asc') {
          return (a.fullName || '').localeCompare(b.fullName || '');
        }
        if (sortBy === 'name-desc') {
          return (b.fullName || '').localeCompare(a.fullName || '');
        }
        if (sortBy === 'age-asc') {
          const aRange = parseAgeRange(a.ageRange)?.min ?? Number.POSITIVE_INFINITY;
          const bRange = parseAgeRange(b.ageRange)?.min ?? Number.POSITIVE_INFINITY;
          return aRange - bRange;
        }
        if (sortBy === 'age-desc') {
          const aRange = parseAgeRange(a.ageRange)?.min ?? Number.NEGATIVE_INFINITY;
          const bRange = parseAgeRange(b.ageRange)?.min ?? Number.NEGATIVE_INFINITY;
          return bRange - aRange;
        }
        if (sortBy === 'location-asc') {
          return (a.location || '').localeCompare(b.location || '');
        }
        if (sortBy === 'location-desc') {
          return (b.location || '').localeCompare(a.location || '');
        }
        return 0;
      });
  }, [results, nameFilter, stateFilter, minAge, maxAge, sortBy]);


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
        // Response is already adapted: { data: [...], pagination: {...}, searchContext: {...}, rawResponse? }
        setResults(response.data || []);
        setRawResponse(response.rawResponse || null);

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
      <div style={{
        marginTop: '1rem',
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
        gap: '0.75rem',
        alignItems: 'end'
      }}>
        <div>
          <label style={{ fontSize: '0.75rem', color: '#6b7280' }}>Name contains</label>
          <input
            value={nameFilter}
            onChange={(e) => setNameFilter(e.target.value)}
            placeholder="Filter by name"
            style={{ width: '100%', padding: '0.5rem', borderRadius: '6px', border: '1px solid #d1d5db' }}
          />
        </div>
        <div>
          <label style={{ fontSize: '0.75rem', color: '#6b7280' }}>State</label>
          <select
            value={stateFilter}
            onChange={(e) => setStateFilter(e.target.value)}
            style={{ width: '100%', padding: '0.5rem', borderRadius: '6px', border: '1px solid #d1d5db' }}
          >
            {usStates.map((stateOption) => (
              <option key={stateOption.value} value={stateOption.value}>
                {stateOption.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label style={{ fontSize: '0.75rem', color: '#6b7280' }}>Min age</label>
          <input
            type="number"
            value={minAge}
            onChange={(e) => setMinAge(e.target.value)}
            placeholder="Any"
            min="0"
            style={{ width: '100%', padding: '0.5rem', borderRadius: '6px', border: '1px solid #d1d5db' }}
          />
        </div>
        <div>
          <label style={{ fontSize: '0.75rem', color: '#6b7280' }}>Max age</label>
          <input
            type="number"
            value={maxAge}
            onChange={(e) => setMaxAge(e.target.value)}
            placeholder="Any"
            min="0"
            style={{ width: '100%', padding: '0.5rem', borderRadius: '6px', border: '1px solid #d1d5db' }}
          />
        </div>
        <div>
          <label style={{ fontSize: '0.75rem', color: '#6b7280' }}>Sort by</label>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            style={{ width: '100%', padding: '0.5rem', borderRadius: '6px', border: '1px solid #d1d5db' }}
          >
            <option value="relevance">Relevance</option>
            <option value="name-asc">Name (A-Z)</option>
            <option value="name-desc">Name (Z-A)</option>
            <option value="age-asc">Age (Low to High)</option>
            <option value="age-desc">Age (High to Low)</option>
            <option value="location-asc">Location (A-Z)</option>
            <option value="location-desc">Location (Z-A)</option>
          </select>
        </div>
      </div>
      {!loading && (
        <p style={{ marginTop: '0.75rem', color: '#6b7280' }}>
          Showing {filteredResults.length} of {results.length} results
          {rawResponse?.hasMore?.() && ` (more available)`}
        </p>
      )}
      {loading && <p>Loading…</p>}
      {error && <p style={{ color: 'red' }}>{error}</p>}
      {filteredResults && filteredResults.length > 0 ? (
        <div style={{ marginTop: '1rem' }}>
          {filteredResults.map((result) => (
            <ResultCard key={result.id} result={result} isMember={true} />
          ))}
          {rawResponse?.hasMore?.() && (
            <div style={{ marginTop: '1rem', textAlign: 'center' }}>
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
                  padding: '0.5rem 1.5rem',
                  borderRadius: '6px',
                  border: '1px solid #d1d5db',
                  background: '#fff',
                  cursor: loadingMore ? 'wait' : 'pointer'
                }}
              >
                {loadingMore ? 'Loading…' : 'Load more results'}
              </button>
            </div>
          )}
        </div>
      ) : !loading ? (
        <p>No results found.</p>
      ) : null}
    </main>
  );
};

export default MemberSearchResultsPage;