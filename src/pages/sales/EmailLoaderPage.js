import React, { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import api from '../../api';
import { setSearchContext } from '../../services/searchContext';

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
    <main style={{
      padding: 0,
      minHeight: '70vh',
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'center',
      alignItems: 'center',
      background: 'linear-gradient(135deg, #f9fafb 0%, #ffffff 100%)'
    }}>
      <div style={{
        maxWidth: '600px',
        width: '100%',
        padding: '3rem 2rem',
        textAlign: 'center'
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
        
        <h2 style={{ 
          color: '#0e123b', 
          marginBottom: '1rem',
          fontSize: '1.5rem',
          fontWeight: '600'
        }}>
          {status}
        </h2>
        
        <div style={{
          width: '100%',
          height: '8px',
          backgroundColor: '#e5e7eb',
          borderRadius: '4px',
          overflow: 'hidden',
          marginBottom: '1rem'
        }}>
          <div style={{
            width: `${progress}%`,
            height: '100%',
            backgroundColor: '#0d5d2f',
            transition: 'width 0.3s ease'
          }}></div>
        </div>
        
        {/* Search Query Display */}
        <div style={{
          marginTop: '2rem',
          padding: '1.5rem',
          backgroundColor: '#fff',
          borderRadius: '0.75rem',
          border: '1px solid #e5e7eb',
          boxShadow: '0 2px 4px rgba(0, 0, 0, 0.05)'
        }}>
          <p style={{
            color: '#6b7280',
            fontSize: '0.875rem',
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
            {email}
          </p>
        </div>

        <p style={{ 
          color: '#9ca3af', 
          fontSize: '0.875rem',
          marginTop: '2rem',
          lineHeight: 1.5
        }}>
          Searching through billions of public records...
        </p>
      </div>
    </main>
  );
};

export default EmailLoaderPage;
