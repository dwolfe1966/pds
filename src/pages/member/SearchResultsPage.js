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
  // Name params from MemberGeneralSearchPage direct navigation
  const firstNameParam = params.get('firstName');
  const lastNameParam = params.get('lastName');
  const stateParam = params.get('state');
  const emailParam = params.get('email');
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
      setError('');
      try {
        // Email flow: email URL param (from MemberGeneralSearchPage email tab)
        if (emailParam) {
          const searchParams = {
            email: emailParam,
            type: 'email'
          };

          const response = await api.searchPeople(searchParams);
          setResults(response.data || []);
          setRawResponse(response.rawResponse || null);

          if (response.searchContext) {
            setSearchContext(response.searchContext);
          }
          setLoading(false);
          return;
        }

        // Primary flow: firstName/lastName/state URL params (from MemberGeneralSearchPage)
        if (firstNameParam && lastNameParam) {
          const searchParams = {
            firstName: firstNameParam,
            lastName: lastNameParam,
            type: 'name'
          };
          if (stateParam) {
            searchParams.state = stateParam;
          }

          const response = await api.searchPeople(searchParams);
          setResults(response.data || []);
          setRawResponse(response.rawResponse || null);

          if (response.searchContext) {
            setSearchContext(response.searchContext);
          }
          setLoading(false);
          return;
        }

        // Legacy flow: ?q=FirstName+LastName (e.g. from SearchBar)
        if (query) {
          const nameParts = query.trim().split(/\s+/);
          const firstName = nameParts[0] || '';
          const lastName = nameParts.slice(1).join(' ') || '';

          if (!firstName || !lastName) {
            setError('Please provide both first and last name');
            setLoading(false);
            return;
          }

          const searchParams = { firstName, lastName, type: 'name' };

          const response = await api.searchPeople(searchParams);
          setResults(response.data || []);
          setRawResponse(response.rawResponse || null);

          if (response.searchContext) {
            setSearchContext(response.searchContext);
          }
          setLoading(false);
          return;
        }

        // Check sessionStorage fallback (legacy — MemberGeneralSearchPage used to store here)
        const storedResults = sessionStorage.getItem('memberSearchResults');
        if (storedResults) {
          try {
            const parsed = JSON.parse(storedResults);
            setResults(parsed.results || []);
            sessionStorage.removeItem('memberSearchResults');
          } catch (e) {
            console.error('Failed to parse stored results:', e);
          }
        }
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };
    fetchResults();
  }, [firstNameParam, lastNameParam, stateParam, emailParam, query, zip, token]);

  const filterInputStyle = {
    width: '100%',
    padding: '0.5rem 0.75rem',
    borderRadius: '0.375rem',
    border: '1px solid #d1d5db',
    fontSize: '0.875rem',
    fontFamily: 'inherit',
    boxSizing: 'border-box',
    transition: 'border-color 0.2s ease'
  };

  const filterLabelStyle = {
    fontSize: '0.6875rem',
    color: '#6b7280',
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
    fontWeight: 600,
    marginBottom: '0.25rem',
    display: 'block'
  };

  return (
    <main style={{
      padding: '2.5rem 2rem',
      maxWidth: '1200px',
      margin: '0 auto',
      minHeight: '60vh'
    }}>
      {/* Header */}
      <div style={{
        marginBottom: '2rem',
        paddingBottom: '1.5rem',
        borderBottom: '1px solid #e5e7eb'
      }}>
        <h1 style={{
          color: '#0d5d2f',
          fontSize: '1.875rem',
          fontWeight: 700,
          marginBottom: '1rem',
          letterSpacing: '-0.02em'
        }}>
          Search Results
        </h1>
        <div style={{ maxWidth: '600px' }}>
          <SearchBar initialQuery={query || ''} />
        </div>
      </div>

      {/* Filter Bar */}
      <div style={{
        padding: '1.25rem',
        backgroundColor: '#f9fafb',
        borderRadius: '0.75rem',
        border: '1px solid #e5e7eb',
        marginBottom: '1.5rem'
      }}>
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
          gap: '0.75rem',
          alignItems: 'end'
        }}>
          <div>
            <label style={filterLabelStyle}>Name contains</label>
            <input
              value={nameFilter}
              onChange={(e) => setNameFilter(e.target.value)}
              placeholder="Filter by name"
              style={filterInputStyle}
            />
          </div>
          <div>
            <label style={filterLabelStyle}>State</label>
            <select
              value={stateFilter}
              onChange={(e) => setStateFilter(e.target.value)}
              style={{ ...filterInputStyle, backgroundColor: '#fff', cursor: 'pointer' }}
            >
              {usStates.map((stateOption) => (
                <option key={stateOption.value} value={stateOption.value}>
                  {stateOption.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label style={filterLabelStyle}>Min age</label>
            <input
              type="number"
              value={minAge}
              onChange={(e) => setMinAge(e.target.value)}
              placeholder="Any"
              min="0"
              style={filterInputStyle}
            />
          </div>
          <div>
            <label style={filterLabelStyle}>Max age</label>
            <input
              type="number"
              value={maxAge}
              onChange={(e) => setMaxAge(e.target.value)}
              placeholder="Any"
              min="0"
              style={filterInputStyle}
            />
          </div>
          <div>
            <label style={filterLabelStyle}>Sort by</label>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              style={{ ...filterInputStyle, backgroundColor: '#fff', cursor: 'pointer' }}
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
      </div>

      {/* Results count */}
      {!loading && (
        <p style={{
          marginBottom: '1rem',
          paddingTop: '1rem',
          borderTop: '3px solid #0d5d2f',
          color: '#6b7280',
          fontSize: '0.875rem',
          textTransform: 'uppercase',
          letterSpacing: '0.03em',
          fontWeight: 500
        }}>
          Showing <strong style={{ color: '#0d5d2f' }}>{filteredResults.length}</strong> of {results.length} results
          {rawResponse?.hasMore?.() && ' (more available)'}
        </p>
      )}

      {/* Loading */}
      {loading && (
        <div style={{ textAlign: 'center', padding: '4rem 0' }}>
          <div style={{
            width: '48px',
            height: '48px',
            border: '4px solid #e5e7eb',
            borderTop: '4px solid #0d5d2f',
            borderRadius: '50%',
            animation: 'spin 1s linear infinite',
            margin: '0 auto 1rem auto'
          }}></div>
          <p style={{ color: '#6b7280' }}>Loading results...</p>
        </div>
      )}

      {/* Error */}
      {error && (
        <div style={{
          padding: '1.25rem',
          backgroundColor: '#fee',
          border: '1px solid #fcc',
          borderRadius: '0.375rem',
          color: '#c33',
          marginBottom: '1rem'
        }}>
          <p style={{ margin: 0 }}>{error}</p>
        </div>
      )}

      {/* Results list */}
      {filteredResults && filteredResults.length > 0 ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
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
                {loadingMore ? 'Loading...' : 'Load more results'}
              </button>
            </div>
          )}
        </div>
      ) : !loading ? (
        <div style={{ textAlign: 'center', padding: '4rem 0' }}>
          <p style={{
            fontSize: '1.5rem',
            color: '#111827',
            marginBottom: '0.5rem'
          }}>
            No results found
          </p>
          <p style={{ color: '#6b7280', lineHeight: 1.625 }}>
            Try adjusting your search terms or filters.
          </p>
        </div>
      ) : null}
    </main>
  );
};

export default MemberSearchResultsPage;