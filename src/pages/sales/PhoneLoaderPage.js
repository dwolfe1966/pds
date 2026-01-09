import React, { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import api from '../../api';
import { setSearchContext } from '../../services/searchContext';

/**
 * Phone search loading page that shows a loading state while searching.
 * Automatically redirects to results when search completes.
 */
const PhoneLoaderPage = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const params = new URLSearchParams(location.search);
  const phone = params.get('phone');
  const [status, setStatus] = useState('Searching...');

  useEffect(() => {
    const performSearch = async () => {
      if (!phone) {
        navigate('/phone-search');
        return;
      }

      try {
        setStatus('Processing your request...');
        const response = await api.searchPeople({
          phone,
          type: 'phone'
        });
        
        // Store search context
        if (response.searchContext) {
          setSearchContext(response.searchContext);
        }
        
        // Store results for results page
        sessionStorage.setItem('phoneSearchResults', JSON.stringify({
          results: response.data || [],
          query: { phone },
          searchContext: response.searchContext || {}
        }));
        
        if (response.data && response.data.length > 0) {
          navigate(`/phone-search-results?phone=${encodeURIComponent(phone)}`);
        } else {
          navigate(`/phone-search-results?phone=${encodeURIComponent(phone)}&noResults=true`);
        }
      } catch (err) {
        setStatus('Error occurred. Redirecting...');
        setTimeout(() => {
          navigate(`/phone-search-results?phone=${encodeURIComponent(phone)}&error=true`);
        }, 2000);
      }
    };

    // Simulate search delay for better UX
    const timer = setTimeout(performSearch, 1500);
    return () => clearTimeout(timer);
  }, [phone, navigate]);

  return (
    <main style={{ 
      padding: '4rem 2rem', 
      textAlign: 'center', 
      maxWidth: '600px', 
      margin: '0 auto',
      minHeight: '50vh',
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'center',
      alignItems: 'center'
    }}>
      <div style={{ marginBottom: '2rem' }}>
        <div style={{
          width: '60px',
          height: '60px',
          border: '4px solid #f3f3f3',
          borderTop: '4px solid #0d5d2f',
          borderRadius: '50%',
          animation: 'spin 1s linear infinite',
          margin: '0 auto'
        }}></div>
        <style>{`
          @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
        `}</style>
      </div>
      <h2 style={{ color: '#0e123b', marginBottom: '1rem' }}>Searching...</h2>
      <p style={{ color: '#666' }}>{status}</p>
      <p style={{ color: '#999', fontSize: '0.9rem', marginTop: '1rem' }}>
        Please wait while we search our database.
      </p>
    </main>
  );
};

export default PhoneLoaderPage;

