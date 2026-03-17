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
 * Phone search loading page that shows a loading state while searching.
 * Automatically redirects to results when search completes.
 */
const PhoneLoaderPage = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const params = new URLSearchParams(location.search);
  const phone = params.get('phone');
  const [status, setStatus] = useState('Initializing search...');
  const [progress, setProgress] = useState(0);
  const [phaseIndex, setPhaseIndex] = useState(0);

  useEffect(() => {
    const id = setInterval(() => setPhaseIndex(i => (i + 1) % SCAN_PHASES.length), 800);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    const performSearch = async () => {
      if (!phone) {
        navigate('/phone/landing');
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
          phone,
          type: 'phone'
        });

        clearInterval(progressInterval);
        setProgress(100);
        setStatus('Search complete!');

        // Store search context
        if (response.searchContext) {
          setSearchContext(response.searchContext);
        }

        // Store results for results page
        sessionStorage.setItem('phoneSearchResults', JSON.stringify({
          results: response.data || [],
          query: { phone },
          searchContext: response.searchContext || {},
          pagination: response.pagination || {}
        }));

        // Redirect to results page after a brief delay
        setTimeout(() => {
          navigate(`/phone/search-result?phone=${encodeURIComponent(phone)}`);
        }, 500);
      } catch (err) {
        console.error('Search error:', err);
        setStatus('Error occurred. Redirecting...');
        setTimeout(() => {
          navigate(`/phone/search-result?phone=${encodeURIComponent(phone)}&error=true`);
        }, 2000);
      }
    };

    // Small delay before starting search for better UX
    const timer = setTimeout(performSearch, 300);
    return () => clearTimeout(timer);
  }, [phone, navigate]);

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
          <span>Owner identification</span>
          <span>Location &amp; address history</span>
          <span>Contact information</span>
          <span>Associated people</span>
          <span>Public records</span>
        </div>
        <div className={styles.queryCard}>
          <p className={styles.queryLabel}>Searching for</p>
          <p className={styles.queryValue}>
            {phone ? `(${phone.slice(0, 3)}) ${phone.slice(3, 6)}-${phone.slice(6)}` : phone}
          </p>
        </div>
      </div>
    </main>
  );
};

export default PhoneLoaderPage;

