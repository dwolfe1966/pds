import React, { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import api from '../../api';
import { setSearchContext } from '../../services/searchContext';
import { track } from '../../services/trackingService';
import { gtmSearchSubmit } from '../../services/gtm';
import { deriveThinMatchFlags, persistThinMatch } from '../../services/thinMatch';
import { appendSearch } from '../../services/visitorSearchLog';
import styles from './LoaderPage.module.css';

const SCAN_PHASES = [
  'Searching 247 million records\u2026',
  'Analyzing matches\u2026',
  'Compiling your results\u2026',
];

/**
 * Email search loading page that shows a loading state while searching.
 * Automatically redirects to results when search completes.
 */
const EmailLoaderPage = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const params = new URLSearchParams(location.search);
  const email = params.get('email');
  const [status, setStatus] = useState('Searching...');
  const [progress, setProgress] = useState(0);
  const [phaseIndex, setPhaseIndex] = useState(0);

  useEffect(() => {
    const id = setInterval(() => setPhaseIndex(i => (i + 1) % SCAN_PHASES.length), 800);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    const performSearch = async () => {
      if (!email) {
        navigate('/email/landing');
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

        // Perform the search using ByteCreators ApiWrapper via our helper
        const response = await api.searchPeople({
          email,
          type: 'email'
        });

        clearInterval(progressInterval);
        setProgress(100);
        setStatus('Search complete!');

        const identityCount = (response.data || []).length;
        track('search_submit', { type: 'email', resultCount: identityCount });
        gtmSearchSubmit({ search_type: 'email', result_count: identityCount });
        // Persist visitor search intent for replay on signup.
        appendSearch({ type: 'email', query: { email }, resultCount: identityCount });

        // Capture BC's thin-match signal so SRP + PaymentPage can react.
        const flags = deriveThinMatchFlags(response.rawResponse || response, { identityCount });
        persistThinMatch(flags);

        // Store search context
        if (response.searchContext) {
          setSearchContext(response.searchContext);
        }

        // Store results for results page
        sessionStorage.setItem('emailSearchResults', JSON.stringify({
          results: response.data || [],
          query: { email },
          searchContext: response.searchContext || {},
          pagination: response.pagination || {}
        }));

        // Redirect to results page after a brief delay
        setTimeout(() => {
          navigate(`/email/search-result?email=${encodeURIComponent(email)}`);
        }, 500);
      } catch (err) {
        console.error('Search error:', err);
        setStatus('Error occurred. Redirecting...');
        setTimeout(() => {
          navigate(`/email/search-result?email=${encodeURIComponent(email)}&error=true`);
        }, 2000);
      }
    };

    // Small delay before starting search for better UX
    const timer = setTimeout(performSearch, 300);
    return () => clearTimeout(timer);
  }, [email, navigate]);

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
          <span>Account identification</span>
          <span>Associated names &amp; aliases</span>
          <span>Contact information</span>
          <span>Location &amp; address history</span>
          <span>Social media profiles</span>
        </div>
        <div className={styles.queryCard}>
          <p className={styles.queryLabel}>Searching for</p>
          <p className={styles.queryValue}>{email}</p>
        </div>
      </div>
    </main>
  );
};

export default EmailLoaderPage;
