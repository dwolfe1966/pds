import React, { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import api from '../../api';
import { setSearchContext } from '../../services/searchContext';
import styles from './LoaderPage.module.css';

const SCAN_PHASES = [
  'Searching 247 million records\u2026',
  'Analyzing matches\u2026',
  'Compiling your results\u2026',
];

/**
 * Name search loader page - Shows loading state while performing search.
 * Mimics the privaterecords.net/name/loader flow with IDLookup design.
 * Automatically redirects to search results when complete.
 */
const NameSearchLoaderPage = () => {
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

        // Perform the search using ByteCreators ApiWrapper via our helper
        const response = await api.searchPeople(searchParams);

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
        console.error('Search error:', err);
        if (process.env.NODE_ENV === 'development' && err?.apiResponse) {
          console.error('[ByteCrtrs] API response:', err.apiResponse);
        }
        setStatus(err?.message || 'Error occurred. Redirecting...');
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
    <main className={styles.loaderMain}>
      <div className={styles.loaderCard}>
        <div className={styles.spinner} />
        <h2 className={styles.heading}>Searching</h2>
        <p className={styles.phaseMessage}>{SCAN_PHASES[phaseIndex]}</p>
        <div className={styles.progressBarWrap}>
          <span className={styles.progressBarFill} />
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
          <p className={styles.queryValue}>
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


