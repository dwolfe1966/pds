import React, { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import api from '../../api';
import { setSearchContext } from '../../services/searchContext';
import { track } from '../../services/trackingService';
import { gtmSearchSubmit } from '../../services/gtm';
import { deriveThinMatchFlags, persistThinMatch } from '../../services/thinMatch';
import { appendSearch } from '../../services/visitorSearchLog';
import { setSearchInput as gtmSetSearchInput } from '../../services/gtmContext';
import styles from './LoaderPage.module.css';
import { useBrand } from '../../services/brand';
import { useFunnelTheme } from '../../hooks/useFunnelTheme';
import ThemedFunnelHeader from '../../components/ThemedFunnelHeader';

const SCAN_PHASES = [
  'Searching 247 million records\u2026',
  'Analyzing matches\u2026',
  'Compiling your results\u2026',
];

/**
 * Name search loader page - Shows loading state while performing search.
 * Name loader flow with IDLookup design.
 * Automatically redirects to search results when complete.
 */
const NameSearchLoaderPage = () => {
  const brand = useBrand();
  const theme = useFunnelTheme(); // funnel palette (blue/dark) carried from the landing; null = green
  const location = useLocation();
  const navigate = useNavigate();
  const params = new URLSearchParams(location.search);
  const firstName = params.get('firstName');
  const lastName = params.get('lastName');
  const middleName = params.get('middleName');
  const age = params.get('age');
  const city = params.get('city');
  const state = params.get('state');

  const [status, setStatus] = useState('Initializing search...');
  const [progress, setProgress] = useState(0);
  const [phaseIndex, setPhaseIndex] = useState(0);

  useEffect(() => {
    const id = setInterval(() => setPhaseIndex(i => (i + 1) % SCAN_PHASES.length), 800);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    const performSearch = async () => {
      if (!firstName || !lastName) {
        navigate('/name/landing');
        return;
      }

      // Defensive: populate the GTM search* fields from URL params in case
      // the user landed on /name/loader directly (e.g. partner deep-link)
      // without going through a wired search-submit handler.
      gtmSetSearchInput({
        firstName,
        lastName,
        middleName: middleName || undefined,
        city: city || undefined,
        state: state || undefined,
      });

      // Clear any previous search's results so the downstream results page
      // can't render stale data if this search fails or is cancelled before
      // the new payload is written below.
      try { sessionStorage.removeItem('nameSearchResults'); } catch {}

      try {
        // Simulate search progress
        const progressInterval = setInterval(() => {
          setProgress(prev => {
            if (prev >= 90) {
              clearInterval(progressInterval);
              return 90;
            }
            return prev + 10;
          });
        }, 200);

        setStatus('Searching our database...');

        // Build search parameters for the new API
        const searchParams = {
          firstName,
          lastName,
          type: 'name'
        };
        if (middleName && middleName.trim()) {
          searchParams.middleName = middleName.trim();
        }
        if (age && age.trim()) {
          searchParams.age = age.trim();
        }
        if (city && city.trim()) {
          searchParams.city = city.trim();
        }
        if (state && state.trim()) {
          searchParams.state = state.trim();
        }

        const response = await api.searchPeople(searchParams);
        const identityCount = (response.data || []).length;
        track('search_submit', { type: 'name', resultCount: identityCount });
        gtmSearchSubmit({ search_type: 'name', result_count: identityCount, state: state || undefined });
        // Persist visitor search intent — replayed to /searches on signup so
        // members find their pre-signup searches in their history.
        appendSearch({
          type: 'name',
          query: { firstName, lastName, middleName: middleName || undefined, age: age || undefined, city: city || undefined, state: state || undefined },
          resultCount: identityCount,
        });

        // Capture BC's thin-match signal so SRP + PaymentPage can react.
        const flags = deriveThinMatchFlags(response.rawResponse || response, { identityCount });
        persistThinMatch(flags);

        clearInterval(progressInterval);
        setProgress(100);
        setStatus('Search complete!');

        // Response is already adapted by the API router
        // It has the format: { data: [...], pagination: {...}, searchContext: {...} }
        const mappedResults = (response.data || []).map(result => ({
          ...result,
          // Ensure we have all required fields
          id: result.id || result.extId,
          extId: result.extId,
          fullName: result.fullName || 'Unknown',
          location: result.location || '',
          ageRange: result.ageRange || '',
          provider: result.provider
        }));

        // Store results and search context in sessionStorage for the results page
        sessionStorage.setItem('nameSearchResults', JSON.stringify({
          results: mappedResults,
          query: { firstName, lastName, middleName, age, city, state },
          searchContext: response.searchContext || {},
          pagination: response.pagination || {}
        }));

        // Also store search context globally for report creation and opt-out
        if (response.searchContext) {
          setSearchContext(response.searchContext);
        }

        // Redirect to results page after a brief delay
        setTimeout(() => {
          navigate('/name/search-result');
        }, 500);
      } catch (err) {
        if (process.env.NODE_ENV === 'development') {
          console.error('Search error:', err);
          if (err?.apiResponse) console.error('API response:', err.apiResponse);
        }
        track('search_failed', { type: 'name', errorMessage: err?.message });
        // Generic message — never surface raw upstream errors to users.
        setStatus('Something went wrong. Redirecting...');
        setTimeout(() => {
          navigate('/name/search-result?error=true');
        }, 2000);
      }
    };

    // Small delay before starting search for better UX
    const timer = setTimeout(performSearch, 300);
    return () => clearTimeout(timer);
  }, [firstName, lastName, middleName, age, city, state, navigate]);

  return (
    <main className={styles.loaderMain} style={theme ? { background: theme.pageBg, position: 'relative' } : undefined}>
      {theme && <div style={{ position: 'absolute', top: 0, left: 0, right: 0 }}><ThemedFunnelHeader theme={theme} /></div>}
      <div className={styles.loaderCard}>
        <div className={styles.spinner} style={theme ? { borderTopColor: theme.accent } : undefined} />
        <h2 className={styles.heading} style={theme ? { color: theme.accentDark } : undefined}>Searching</h2>
        <p className={styles.phaseMessage}>{SCAN_PHASES[phaseIndex]}</p>
        <div className={styles.progressBarWrap}>
          <span className={styles.progressBarFill} style={theme ? { background: theme.accent } : undefined} />
        </div>
        <div className={styles.dataPoints}>
          <span>Possible relatives</span>
          <span>Job &amp; education</span>
          <span>Person information</span>
          <span>Contact information</span>
          <span>Social media profiles</span>
        </div>
        <div className={styles.queryCard}>
          <p className={styles.queryLabel}>Searching for</p>
          <p className={styles.queryValue} style={theme ? { color: theme.ink } : undefined}>
            {firstName} {middleName ? `${middleName} ` : ''}{lastName}
            {age && <span style={{ color: '#6b7280', fontWeight: 400 }}> &bull; {age}</span>}
            {city && <span style={{ color: '#6b7280', fontWeight: 400 }}> &bull; {city}</span>}
            {state && <span style={{ color: '#6b7280', fontWeight: 400 }}> &bull; {state}</span>}
          </p>
        </div>
      </div>
    </main>
  );
};

export default NameSearchLoaderPage;


