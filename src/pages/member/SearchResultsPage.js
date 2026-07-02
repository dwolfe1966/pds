import React, { useEffect, useMemo, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import api from '../../api';
import ResultCard from '../../components/ResultCard';
import SearchBar from '../../components/SearchBar';
import { useAuth } from '../../context/AuthContext';
import { setSearchContext } from '../../services/searchContext';
import { track } from '../../services/trackingService';
import styles from './SearchResultsPage.module.css';

/**
 * Search results page for authenticated members.
 * Fetches results from the authenticated `/search` endpoint and includes the access token.
 */
const MemberSearchResultsPage = () => {
  const location = useLocation();
  const { token, isPaid } = useAuth();
  const params = new URLSearchParams(location.search);
  const query = params.get('q');
  const zip = params.get('zip');
  // Name params from MemberGeneralSearchPage direct navigation
  const firstNameParam = params.get('firstName');
  const lastNameParam = params.get('lastName');
  const stateParam = params.get('state');
  const emailParam = params.get('email');
  const phoneParam = params.get('phone');
  // Address search params
  const searchTypeParam = params.get('searchType');
  const cityParam = params.get('city');
  const zipParam = params.get('zip') || zip;
  const ageParam = params.get('age');
  const [results, setResults] = useState([]);
  // BC's true match count (transient.total via getTotalCount), independent of how
  // many we've actually loaded. The sales SRP already surfaces this; the member
  // SRP previously showed results.length, so "5 of 5" grew to "6 of 6" on Load
  // More instead of showing the real total up front (#69).
  const [totalCount, setTotalCount] = useState(0);
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
        // Address flow: searchType=address (from MemberGeneralSearchPage address tab)
        if (searchTypeParam === 'address') {
          const addrParams = {};
          if (cityParam) addrParams.city = cityParam;
          if (stateParam) addrParams.state = stateParam;
          if (zipParam) addrParams.zip = zipParam;

          const response = await api.get('/search/by-address', { params: addrParams, token });
          setResults(response?.data || []);
          setLoading(false);
          return;
        }

        // Phone flow: phone URL param (from MemberGeneralSearchPage phone tab —
        // free members get teaser results here instead of the paid direct-to-report
        // path; same sale.phone.teaser search the sales SRP runs)
        if (phoneParam) {
          const response = await api.searchPeople({ phone: phoneParam, type: 'phone' });
          setResults(response.data || []);
          setTotalCount(response.pagination?.total || (response.data?.length ?? 0));
          setRawResponse(response.rawResponse || null);

          if (response.searchContext) {
            setSearchContext(response.searchContext);
          }
          setLoading(false);
          return;
        }

        // Email flow: email URL param (from MemberGeneralSearchPage email tab)
        if (emailParam) {
          const searchParams = {
            email: emailParam,
            type: 'email'
          };

          const response = await api.searchPeople(searchParams);
          setResults(response.data || []);
          setTotalCount(response.pagination?.total || (response.data?.length ?? 0));
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
          if (cityParam && searchTypeParam !== 'address') {
            searchParams.city = cityParam;
          }
          if (ageParam) {
            searchParams.age = ageParam;
          }

          const response = await api.searchPeople(searchParams);
          setResults(response.data || []);
          setTotalCount(response.pagination?.total || (response.data?.length ?? 0));
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
          setTotalCount(response.pagination?.total || (response.data?.length ?? 0));
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
  }, [firstNameParam, lastNameParam, stateParam, emailParam, phoneParam, query, zip, searchTypeParam, cityParam, zipParam]);

  const queryLabel = searchTypeParam === 'address'
    ? [cityParam, stateParam, zipParam].filter(Boolean).join(', ')
    : firstNameParam
      ? `${firstNameParam} ${lastNameParam}${stateParam ? `, ${stateParam}` : ''}`
      : emailParam || phoneParam || query || '';

  return (
    <main className={styles.main}>
      {/* Header */}
      <div className={styles.pageHeader}>
        <h1 className={styles.pageTitle}>
          {!loading && results.length > 0
            ? `${filteredResults.length} result${filteredResults.length !== 1 ? 's' : ''} for "${queryLabel}"`
            : 'Search Results'}
        </h1>
        <div className={styles.searchBarWrap}>
          <SearchBar
            initialFirstName={firstNameParam || ''}
            initialLastName={lastNameParam || ''}
            initialQuery={query || ''}
          />
        </div>
      </div>

      {/* Filter Bar */}
      <div className={styles.filterBar}>
        <div className={styles.filterGrid}>
          <div className={styles.filterGroup}>
            <label className={styles.filterLabel}>Name contains</label>
            <input
              value={nameFilter}
              onChange={(e) => setNameFilter(e.target.value)}
              placeholder="Filter by name"
              className={styles.filterInput}
            />
          </div>
          <div className={styles.filterGroup}>
            <label className={styles.filterLabel}>State</label>
            <select
              value={stateFilter}
              onChange={(e) => setStateFilter(e.target.value)}
              className={styles.filterSelect}
            >
              {usStates.map((s) => (
                <option key={s.value} value={s.value}>{s.label}</option>
              ))}
            </select>
          </div>
          <div className={styles.filterGroup}>
            <label className={styles.filterLabel}>Min age</label>
            <input
              type="number"
              value={minAge}
              onChange={(e) => setMinAge(e.target.value)}
              placeholder="Any"
              min="0"
              className={styles.filterInput}
            />
          </div>
          <div className={styles.filterGroup}>
            <label className={styles.filterLabel}>Max age</label>
            <input
              type="number"
              value={maxAge}
              onChange={(e) => setMaxAge(e.target.value)}
              placeholder="Any"
              min="0"
              className={styles.filterInput}
            />
          </div>
          <div className={styles.filterGroup}>
            <label className={styles.filterLabel}>Sort by</label>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className={styles.filterSelect}
            >
              <option value="relevance">Relevance</option>
              <option value="name-asc">Name (A–Z)</option>
              <option value="name-desc">Name (Z–A)</option>
              <option value="age-asc">Age (Low–High)</option>
              <option value="age-desc">Age (High–Low)</option>
              <option value="location-asc">Location (A–Z)</option>
              <option value="location-desc">Location (Z–A)</option>
            </select>
          </div>
        </div>
      </div>

      {/* Results count */}
      {!loading && (
        <p className={styles.resultsCount}>
          Showing <strong className={styles.resultsCountHighlight}>{filteredResults.length}</strong> of {Math.max(totalCount, results.length)} results
          {rawResponse?.hasMore?.() && ' · more available below'}
        </p>
      )}

      {/* Loading */}
      {loading && (
        <div className={styles.loadingWrap}>
          <div className={styles.spinner} />
          <p className={styles.loadingText}>Searching records…</p>
        </div>
      )}

      {/* Error */}
      {error && <div className={styles.errorBox}>{error}</div>}

      {/* Results */}
      {filteredResults.length > 0 ? (
        <div className={styles.resultList}>
          {!isPaid && (
            <div style={{
              background: '#fef9c3',
              border: '1px solid #fde047',
              borderRadius: '0.5rem',
              padding: '0.75rem 1rem',
              marginBottom: '1rem',
              fontSize: '0.875rem',
              color: '#713f12',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
            }}>
              <span>Viewing full reports requires a Pro subscription.</span>
              <Link to="/payment" style={{ color: '#0d5d2f', fontWeight: 600, textDecoration: 'underline' }}>Upgrade now</Link>
            </div>
          )}
          {filteredResults.map((result) => (
            <ResultCard key={result.id} result={result} isMember={true} />
          ))}
          {rawResponse?.hasMore?.() && (
            <div className={styles.loadMoreWrap}>
              <button
                type="button"
                disabled={loadingMore}
                className={styles.loadMoreBtn}
                onClick={async () => {
                  setLoadingMore(true);
                  // #70: emit a client-side tracking event for the load-more
                  // interaction (data.refer attribution auto-attached by track).
                  track('search_load_more', { resultsSoFar: filteredResults.length });
                  try {
                    const more = await api.loadMoreSearchResults(rawResponse);
                    if (more?.data?.length) setResults(prev => [...prev, ...more.data]);
                  } catch (err) {
                    console.error('Load more failed:', err);
                  } finally {
                    setLoadingMore(false);
                  }
                }}
              >
                {loadingMore ? 'Loading…' : 'Load more results'}
              </button>
            </div>
          )}
        </div>
      ) : !loading ? (
        <div className={styles.emptyState}>
          <p className={styles.emptyStateTitle}>No results to display</p>
          <p className={styles.emptyStateText}>
            Common names with broad filters can return too many matches to show
            (e.g. <em>John Smith</em> nationwide). Try narrowing your search —
            add a middle initial, pick a specific state, or include a city or
            ZIP. If you already have a phone or email for the person, those
            searches tend to land more directly.
          </p>
        </div>
      ) : null}
    </main>
  );
};

export default MemberSearchResultsPage;