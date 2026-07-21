import React, { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import api from '../../api';
import ResultCard from '../../components/ResultCard';
import SignalTeaser from '../../components/SignalTeaser';
import SocialPresenceTeaser from '../../components/SocialPresenceTeaser';
import { getFlow } from '../../services/funnelFlow';
import US_STATES from './usStates';
import ZeroResultsPanel from '../../components/ZeroResultsPanel';
import ThinMatchPreview from '../../components/ThinMatchPreview';
import { setSearchContext } from '../../services/searchContext';
import { track } from '../../services/trackingService';
import { readThinMatch } from '../../services/thinMatch';
import { getCapturedEmail } from '../../services/emailCapture';
import { useCampaign } from '../../context/CampaignContext';
import styles from './SearchResultsPage.module.css';
import { useBrand } from '../../services/brand';
import { useFunnelTheme } from '../../hooks/useFunnelTheme';

/**
 * Displays search results for public searches on the marketing funnel.
 * Name search-result flow with IDLookup design.
 * Fetches results from the public `/search` endpoint or from sessionStorage.
 */
const SalesSearchResultsPage = () => {
  const brand = useBrand();
  const theme = useFunnelTheme(); // funnel palette carried from the landing; null = green
  const campaign = useCampaign(); // bug #51: shN drives thin-match vs no-records
  const location = useLocation();
  const navigate = useNavigate();
  const params = new URLSearchParams(location.search);
  const query = params.get('q');
  // SearchBar emits firstName + lastName directly; legacy callers still send `q`.
  const firstNameParam = params.get('firstName') || '';
  const lastNameParam = params.get('lastName') || '';
  const state = params.get('state');
  const cityParam = params.get('city') || '';
  const ageParam = params.get('age') || '';
  const error = params.get('error');

  // Thin-match A/B: version 1 (streamlined signup form) vs 2 (no signup form).
  // `?tmv=1` / `?tmv=2` forces a version (and sticks it); otherwise a stable 50/50
  // split held in sessionStorage.
  const thinMatchVersion = useMemo(() => {
    const override = params.get('tmv');
    try {
      if (override === '1' || override === '2') { sessionStorage.setItem('thinMatchVersion', override); return Number(override); }
      let v = sessionStorage.getItem('thinMatchVersion');
      if (v !== '1' && v !== '2') { v = Math.random() < 0.5 ? '1' : '2'; sessionStorage.setItem('thinMatchVersion', v); }
      return Number(v);
    } catch { return override === '2' ? 2 : 1; }
  }, [location.search]); // eslint-disable-line react-hooks/exhaustive-deps
  
  const [results, setResults] = useState([]);
  const [flow, setFlow] = useState(''); // 'inmate' → lead the SERP with the booking teaser
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [searchQuery, setSearchQuery] = useState({ firstName: '', lastName: '', state: '' });
  const [rawResponse, setRawResponse] = useState(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [paginationExhausted, setPaginationExhausted] = useState(false);
  const [loadMoreCount, setLoadMoreCount] = useState(0); // GAP-5: pagination engagement
  const [totalCount, setTotalCount] = useState(0);
  const [sortBy, setSortBy] = useState('relevance');
  // Client-side refine filters on the data BC already returns (no extra teaser call).
  const [filters, setFilters] = useState({ criminal: false, property: false, relatives: false, employment: false, gender: '' });
  const toggleFilter = (k) => setFilters((f) => ({ ...f, [k]: !f[k] }));
  const clearFilters = () => setFilters({ criminal: false, property: false, relatives: false, employment: false, gender: '' });

  useEffect(() => {
    track('results_view', { search_type: 'name', query: query || '', state: state || '', thin_match_version: thinMatchVersion });
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
            setFlow(data.flow || '');
            setSearchQuery({ ...(data.query || {}), city: cityParam || (data.query && data.query.city) || '', age: ageParam || (data.query && data.query.age) || '' });
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
        
        setSearchQuery({ firstName, lastName, state: state || '', city: cityParam, age: ageParam });

        // Build search parameters for new API
        const searchParams = {
          firstName,
          lastName,
          type: 'name'
        };
        if (state && state.trim()) {
          searchParams.state = state.trim();
        }
        if (cityParam.trim()) searchParams.city = cityParam.trim();
        // Validation escape hatch (BC case-building): ?debug_extras=1 forwards city/age
        // into the teaser (normally stripped) so we can measure their effect on IDI.
        if (params.get('debug_extras') === '1') {
          searchParams._keepExtras = true;
          if (ageParam && ageParam.trim()) searchParams.age = ageParam.trim();
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
    // city/age MUST be deps: refining by city or age (same name) is the common case, and without
    // them the effect never re-ran → the Refine CTA "did nothing". city now narrows server-side
    // (un-stripped); age re-narrows via searchQuery → narrowedResults.
  }, [query, firstNameParam, lastNameParam, state, cityParam, ageParam, error]);

  // displayCount / countLabel are computed after narrowedResults (below), so the
  // header reflects the NARROWED set when a city/age/filter is active.

  // Sorted view (bug 11). BC returns results in its own relevance order; we
  // respect that by default and only re-sort client-side when the user picks
  // a different option. ageRange is a free-form string like "35-40" or "35" —
  // parse the leading integer for numeric sort; rows missing an age sink.
  const parseAge = (raw) => {
    const match = /\d+/.exec(raw || '');
    return match ? parseInt(match[0], 10) : null;
  };

  // Client-side narrowing. BC doesn't accept city/age as teaser inputs (they're
  // stripped from the teaser query — sending them returns 0), so we narrow here.
  // Two tiers: the explicit refine-box filters are HARD (an active "criminal"
  // filter can legitimately show nothing); the city/age passed through from the
  // wizard/URL are SOFT — they narrow when they leave a match, but fall back to the
  // fuller set instead of dead-ending the user on an empty page (a strict city/age
  // filter over a ~5-row teaser would too often show nothing).
  const narrowedResults = useMemo(() => {
    const cityQ = (searchQuery.city || '').trim().toLowerCase();
    const ageQ = parseAge(searchQuery.age);
    const boxFiltered = results.filter((r) => {
      const R = r.records || {};
      const Fl = r.flags || {};
      if (filters.criminal && !(Fl.isCriminal || R.criminal > 0)) return false;
      if (filters.property && !(Fl.isPropertyOwner || R.property > 0)) return false;
      if (filters.relatives && !((r.relatives || []).length > 0 || R.relatives > 0)) return false;
      if (filters.employment && !(Fl.hasEmployment || R.employment > 0)) return false;
      if (filters.gender && String(r.gender || '').toLowerCase() !== filters.gender) return false;
      return true;
    });
    if (!cityQ && ageQ == null) return boxFiltered;
    const narrowed = boxFiltered.filter((r) => {
      if (cityQ && !(r.location || '').toLowerCase().includes(cityQ)) return false;
      if (ageQ != null) {
        const rAge = parseAge(r.ageRange);
        if (rAge == null || Math.abs(rAge - ageQ) > 5) return false;
      }
      return true;
    });
    return narrowed.length > 0 ? narrowed : boxFiltered;
  }, [results, searchQuery.city, searchQuery.age, filters]);

  // Header count: when a city/age/refine filter is active, show the NARROWED count
  // (what's actually on screen) instead of the teaser's full total — otherwise a
  // "1 in Modesto" result still reads "more than 30". No filter → the teaser total,
  // collapsed to "more than 30" per bug 5.
  const isNarrowed = !!((searchQuery.city || '').trim() || parseAge(searchQuery.age) != null
    || filters.criminal || filters.property || filters.relatives || filters.employment || filters.gender);
  const displayCount = isNarrowed ? narrowedResults.length : (totalCount || results.length);
  const countLabel = !displayCount
    ? null
    : (!isNarrowed && displayCount > 30)
    ? 'more than 30 results'
    : `${displayCount} result${displayCount !== 1 ? 's' : ''}`;

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
    // Store result in sessionStorage for the preview/payment page
    sessionStorage.setItem(`result_${result.id}`, JSON.stringify(result));
    // If we've already captured an email upstream (e.g. the BV mid-loader gate), don't
    // re-ask for it on the SUP — send the user straight to payment via a silent
    // auto-signup (captured email + generated password). Only for not-logged-in
    // visitors; logged-in members keep the normal path. If the account already exists,
    // SignupPage's auto path falls back to the form.
    const hasEmail = (() => { try { return !!getCapturedEmail(); } catch { return false; } })();
    const loggedIn = (() => { try { return !!localStorage.getItem('accessToken'); } catch { return false; } })();
    if (hasEmail && !loggedIn) {
      track('serp_result_autocheckout', { personId: result.id });
      navigate(`/signup?selected=${result.id}&redirect=/payment&auto=1`);
      return;
    }
    navigate(`/search/${result.id}`);
  };

  // Refine search — editable first/last/state/city/age (previously name-only).
  // Submitting re-runs the search and narrows by city/age (narrowedResults).
  const [refine, setRefine] = useState({ firstName: '', lastName: '', state: '', city: '', age: '' });
  useEffect(() => {
    setRefine({
      firstName: searchQuery.firstName || firstNameParam || '',
      lastName: searchQuery.lastName || lastNameParam || '',
      state: searchQuery.state || state || '',
      city: searchQuery.city || cityParam || '',
      age: searchQuery.age || ageParam || '',
    });
  }, [searchQuery.firstName, searchQuery.lastName, searchQuery.state, searchQuery.city, searchQuery.age]); // eslint-disable-line react-hooks/exhaustive-deps
  const submitRefine = (e) => {
    e.preventDefault();
    const p = new URLSearchParams();
    if (refine.firstName.trim()) p.set('firstName', refine.firstName.trim());
    if (refine.lastName.trim()) p.set('lastName', refine.lastName.trim());
    if (refine.state.trim()) p.set('state', refine.state.trim());
    if (refine.city.trim()) p.set('city', refine.city.trim());
    if (refine.age.trim()) p.set('age', refine.age.trim());
    try { sessionStorage.removeItem('nameSearchResults'); } catch { /* ignore */ }
    track('refine_search', { has_city: !!refine.city.trim(), has_age: !!refine.age.trim() });
    navigate(`/name/search-result?${p.toString()}`);
  };
  const rInput = { width: '100%', boxSizing: 'border-box', padding: '0.6rem 0.7rem', fontSize: '0.95rem', border: `1.5px solid ${theme ? theme.line : '#d1d5db'}`, borderRadius: 8, outline: 'none', background: theme && theme.onDark ? 'rgba(255,255,255,0.06)' : '#fff', color: theme ? theme.ink : '#111827' };
  const rLabel = { display: 'block', fontSize: '0.72rem', fontWeight: 600, color: theme ? theme.mut : '#6b7280', marginBottom: '0.25rem' };

  return (
    <main className={styles.main} style={theme ? { background: theme.pageBg, minHeight: '100vh' } : undefined}>
      {/* Minimal self-chrome header — matches the landing wizard (logo only, no nav). */}
      <header style={{ display: 'flex', alignItems: 'center', padding: '0.85rem 1.25rem', background: theme && theme.onDark ? theme.surface : '#0d5d2f', borderBottom: theme && theme.onDark ? `1px solid ${theme.line}` : 'none' }}>
        <a href="/" style={{ fontSize: '1.15rem', fontWeight: 800, color: theme && theme.onDark ? theme.accent : '#ffffff', textDecoration: 'none', letterSpacing: '-0.01em' }}>{brand.name}</a>
      </header>
      <div className={styles.contentContainer} style={theme ? { background: theme.surface, border: theme.onDark ? `1px solid ${theme.line}` : undefined } : undefined}>
        {/* Header Section */}
        <div className={styles.header} style={theme ? { borderBottomColor: theme.line } : undefined}>
          <h1 className={styles.title} style={theme ? { color: theme.ink } : undefined}>
            {results.length > 0 && countLabel
              ? `We found ${countLabel} for "${searchQuery.firstName ? `${searchQuery.firstName} ${searchQuery.lastName}`.trim() : (query || 'your search')}"`
              : 'Search Results'}
          </h1>
          {/* Context line only when the title is the generic "Search Results" — when results
              are found the title already names the person, so this would just repeat it. */}
          {!(results.length > 0 && countLabel) && (searchQuery.firstName || query) && (
            <p className={styles.searchQuery} style={theme ? { color: theme.mut } : undefined}>
              Results for: <strong style={theme ? { color: theme.accentDark } : undefined}>{searchQuery.firstName || query} {searchQuery.lastName}</strong>
              {searchQuery.state && <span> • {searchQuery.state}</span>}
            </p>
          )}
        </div>

        {/* Loading State */}
        {loading && (
          <div className={styles.loading} style={theme ? { color: theme.ink } : undefined}>
            <div style={{
              width: '60px',
              height: '60px',
              border: `5px solid ${theme ? theme.line : '#e5e7eb'}`,
              borderTop: `5px solid ${theme ? theme.accent : 'var(--color-primary)'}`,
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
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              flexWrap: 'wrap', gap: '0.5rem', margin: '0 0 1rem', padding: 0,
            }}>
              <p style={{ fontSize: '0.825rem', color: '#6b7280', margin: 0 }}>
                All data sourced from publicly available records.
              </p>
              {results.length > 1 && (
                <label className={styles.sortControl} style={{ fontSize: '0.825rem', color: '#374151' }}>
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
            {/* Record teaser above the results — the payoff the vertical searcher came for. Loose (name-search
                surface). Unified engine teaser: flow-prioritized lead + capped "also found"; self-gates to
                nothing without matching records. */}
            {searchQuery.lastName && (
              <div style={{ marginBottom: 28, paddingBottom: 4 }}>
                <SignalTeaser
                  subject={{ firstName: searchQuery.firstName, lastName: searchQuery.lastName, state: searchQuery.state }}
                  flow={getFlow() || flow || 'general'}
                  viewerRelation="prospect"
                  stage="pre-signup"
                />
              </div>
            )}
            {/* Social presence — standalone on the has-results SERP (NOT inside the flow teaser above), so it
                shows for the searched person on a normal search without competing with booking/divorce/SO.
                Self-gating (renders nothing without a match); experimental (REACT_APP_SIGNALS_SOCIAL). */}
            {searchQuery.lastName && (
              <SocialPresenceTeaser firstName={searchQuery.firstName} lastName={searchQuery.lastName} state={searchQuery.state} theme={theme} />
            )}
            {/* Filters moved to the Refine region at the bottom (owner — top placement
                pushed the results down on mobile). */}
            {sortedResults.length === 0 && (
              <div style={{ textAlign: 'center', padding: '2rem 1rem', color: '#6b7280' }}>
                <p style={{ margin: '0 0 0.75rem' }}>No results match your filters.</p>
                <button type="button" onClick={clearFilters} style={{ fontSize: '0.9rem', fontWeight: 600, color: '#0d5d2f', background: 'none', border: '1.5px solid #0d5d2f', borderRadius: 8, padding: '0.5rem 1.25rem', cursor: 'pointer' }}>Clear filters</button>
              </div>
            )}
            <div className={styles.resultsList}>
              {sortedResults.map((result, index) => (
                <div key={result.id}>
                  <div
                    onClick={() => handleResultClick(result)}
                    style={{ cursor: 'pointer', transition: 'all 0.2s ease', position: 'relative' }}
                    onMouseEnter={(e) => { e.currentTarget.style.transform = 'translateY(-4px)'; }}
                    onMouseLeave={(e) => { e.currentTarget.style.transform = 'translateY(0)'; }}
                  >
                    <ResultCard result={result} theme={theme} index={index} />
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
                      <span>Your search is <strong>100% secure</strong>.</span>
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
                    const page = loadMoreCount + 1;
                    setLoadMoreCount(page);
                    track('load_more', { page }); // GAP-5: CLIENT:load_more{page}
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
                    border: `2px solid ${theme ? theme.accent : '#0d5d2f'}`,
                    background: '#fff',
                    color: theme ? theme.accent : '#0d5d2f',
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
          <>
            {/* ZERO / THIN-MATCH RESCUE (owner VIP 2026-07-20): IDI returns TooManyMatches on common names (esp.
                from the SEO/ads funnel), leaving this page empty. The engine teaser pulls FIRST-PARTY data
                (incarceration/divorce, independent of IDI) — so it fills the dead-end with real records + a
                conversion path exactly when BC found nothing. Self-gates to nothing when we have no data. */}
            {searchQuery.lastName && (
              <div style={{ marginBottom: 28, paddingBottom: 4 }}>
                <SignalTeaser
                  subject={{ firstName: searchQuery.firstName, lastName: searchQuery.lastName, state: searchQuery.state }}
                  flow={getFlow() || flow || 'general'}
                  viewerRelation="prospect"
                  stage="pre-signup"
                />
              </div>
            )}
            {(() => {
              const flags = readThinMatch();
              return campaign?.search?.zeroState === 'thinMatch'
                ? <ThinMatchPreview searchType="name" query={searchQuery} flags={flags} theme={theme} />
                : <ZeroResultsPanel searchType="name" query={searchQuery} theme={theme} />;
            })()}
          </>
        ) : null}

        {/* Refine search — moved below results so results are immediately visible (not pushed
            down by a tall form). Matches the "refine your search below" copy above. */}
        {!loading && (
          <div style={{ marginTop: '2rem', paddingTop: '1.5rem', borderTop: `1px solid ${theme ? theme.line : 'var(--color-border-light)'}` }}>
            {/* Filter the current results — client-side, on data BC already returned. */}
            {results.length > 1 && (
              <div style={{ marginBottom: '1.5rem' }}>
                <p style={{ fontSize: '0.85rem', fontWeight: 700, margin: '0 0 0.6rem', color: theme ? theme.ink : 'var(--color-text-primary)' }}>Filter these results</p>
                <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '0.5rem' }}>
                  {[['criminal', '⚖️ Criminal'], ['property', '🏠 Property'], ['relatives', '👥 Relatives'], ['employment', '💼 Employment']].map(([key, label]) => {
                    const on = filters[key];
                    return (
                      <button key={key} type="button" onClick={() => toggleFilter(key)}
                        style={{ fontSize: '0.8rem', fontWeight: 600, padding: '0.3rem 0.7rem', borderRadius: '999px', cursor: 'pointer', border: `1.5px solid ${on ? '#0d5d2f' : '#d1d5db'}`, background: on ? '#0d5d2f' : '#fff', color: on ? '#fff' : '#374151' }}>
                        {label}
                      </button>
                    );
                  })}
                  <select value={filters.gender} onChange={(e) => setFilters((f) => ({ ...f, gender: e.target.value }))}
                    style={{ fontSize: '0.8rem', padding: '0.3rem 0.55rem', borderRadius: '999px', border: '1.5px solid #d1d5db', background: '#fff', color: '#374151' }}>
                    <option value="">Any gender</option>
                    <option value="male">Male</option>
                    <option value="female">Female</option>
                  </select>
                  {(filters.criminal || filters.property || filters.relatives || filters.employment || filters.gender) && (
                    <button type="button" onClick={clearFilters} style={{ fontSize: '0.78rem', color: '#6b7280', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline' }}>Clear</button>
                  )}
                </div>
              </div>
            )}
            <h2 style={{ fontSize: '1.05rem', fontWeight: 700, margin: '0 0 0.75rem', color: theme ? theme.ink : 'var(--color-text-primary)' }}>
              Refine Search
            </h2>
            <form onSubmit={submitRefine} style={{ maxWidth: '640px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                <div><label style={rLabel}>First name</label><input style={rInput} value={refine.firstName} onChange={(e) => setRefine((r) => ({ ...r, firstName: e.target.value }))} placeholder="First name" /></div>
                <div><label style={rLabel}>Last name</label><input style={rInput} value={refine.lastName} onChange={(e) => setRefine((r) => ({ ...r, lastName: e.target.value }))} placeholder="Last name" /></div>
                <div><label style={rLabel}>State</label><select style={rInput} value={refine.state} onChange={(e) => setRefine((r) => ({ ...r, state: e.target.value }))}>{US_STATES.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}</select></div>
                <div><label style={rLabel}>City</label><input style={rInput} value={refine.city} onChange={(e) => setRefine((r) => ({ ...r, city: e.target.value }))} placeholder="City (optional)" /></div>
                <div><label style={rLabel}>Age</label><input style={rInput} value={refine.age} onChange={(e) => setRefine((r) => ({ ...r, age: e.target.value }))} placeholder="Age (optional)" inputMode="numeric" /></div>
              </div>
              <button type="submit" style={{ marginTop: '0.85rem', padding: '0.7rem 1.5rem', fontSize: '0.95rem', fontWeight: 700, color: '#fff', background: theme ? theme.button : '#0d5d2f', border: 'none', borderRadius: 8, cursor: 'pointer' }}>Refine search</button>
            </form>
          </div>
        )}
      </div>
      {/* Minimal footer — was missing on the SERP; matches the landing chrome. */}
      <footer style={{ background: theme && theme.onDark ? theme.surface : '#0d5d2f', padding: '1.5rem 1rem 2rem', textAlign: 'center' }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: '0.4rem 1rem', marginBottom: '0.6rem' }}>
          <a href="/privacy" style={{ fontSize: '0.85rem', color: 'rgba(255,255,255,0.85)', textDecoration: 'none' }}>Privacy Policy</a>
          <a href="/terms" style={{ fontSize: '0.85rem', color: 'rgba(255,255,255,0.85)', textDecoration: 'none' }}>Terms</a>
          <a href="/contact" style={{ fontSize: '0.85rem', color: 'rgba(255,255,255,0.85)', textDecoration: 'none' }}>Contact</a>
        </div>
        <p style={{ margin: '0 auto', maxWidth: '40rem', fontSize: '0.72rem', lineHeight: 1.5, color: 'rgba(255,255,255,0.62)' }}>
          {brand.name} is not a consumer reporting agency as defined by the Fair Credit Reporting Act (FCRA). Do not use this site for employment, tenant screening, credit, or any other FCRA-regulated purpose.
        </p>
      </footer>
    </main>
  );
};

export default SalesSearchResultsPage;