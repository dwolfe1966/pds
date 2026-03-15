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
  const [status, setStatus] = useState('Initializing search...');
  const [progress, setProgress] = useState(0);

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
    <main style={{
      padding: 0,
      minHeight: '70vh',
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'center',
      alignItems: 'center',
      background: 'linear-gradient(135deg, #f3f4f6 0%, #ffffff 100%)'
    }}>
      <div style={{
        maxWidth: '640px',
        width: '100%',
        padding: '3rem 2rem',
        textAlign: 'center',
        backgroundColor: '#ffffff',
        borderRadius: '1rem',
        border: '1px solid #e5e7eb',
        boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)'
      }}>
        {/* Loading Spinner */}
        <div style={{
          width: '80px',
          height: '80px',
          border: '6px solid #e5e7eb',
          borderTop: '6px solid #0d5d2f',
          borderRadius: '50%',
          animation: 'spin 1s linear infinite',
          margin: '0 auto 2rem auto'
        }}></div>
        <style>{`
          @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
        `}</style>

        <h2 style={{
          color: '#0d5d2f',
          marginBottom: '0.75rem',
          fontSize: '2rem',
          fontWeight: 700
        }}>
          Searching
        </h2>
        <p style={{
          color: '#6b7280',
          fontSize: '1rem',
          marginBottom: '2rem',
          lineHeight: 1.6
        }}>
          {status}
        </p>

        <div style={{
          display: 'grid',
          gap: '0.5rem',
          color: '#6b7280',
          fontSize: '0.95rem',
          marginBottom: '2rem'
        }}>
          <span>Owner identification</span>
          <span>Location &amp; address history</span>
          <span>Contact information</span>
          <span>Associated people</span>
          <span>Public records</span>
        </div>

        {/* Search Query Display */}
        <div style={{
          padding: '1.25rem',
          backgroundColor: '#fff',
          borderRadius: '0.75rem',
          border: '1px solid #e5e7eb'
        }}>
          <p style={{
            color: '#6b7280',
            fontSize: '0.8rem',
            marginBottom: '0.5rem',
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
            fontWeight: 600
          }}>
            Searching for
          </p>
          <p style={{
            color: '#0d5d2f',
            fontSize: '1.25rem',
            lineHeight: 1.5,
            margin: 0,
            fontWeight: 600
          }}>
            {phone ? `(${phone.slice(0, 3)}) ${phone.slice(3, 6)}-${phone.slice(6)}` : phone}
          </p>
        </div>

        {/* Info Message */}
        <p style={{
          marginTop: '1.75rem',
          color: '#9ca3af',
          fontSize: '0.875rem',
          lineHeight: 1.5
        }}>
          Searching through billions of public records...
        </p>
        <p style={{
          marginTop: '0.5rem',
          color: '#9ca3af',
          fontSize: '0.875rem',
          lineHeight: 1.5
        }}>
          {progress}% complete
        </p>
      </div>
    </main>
  );
};

export default PhoneLoaderPage;

