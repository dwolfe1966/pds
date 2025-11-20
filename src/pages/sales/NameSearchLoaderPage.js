import React, { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import api from '../../api';

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
  const zip = params.get('zip');
  
  const [status, setStatus] = useState('Initializing search...');
  const [progress, setProgress] = useState(0);

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
        
        // Build search parameters
        const searchParams = { firstName, lastName };
        if (zip && zip.trim()) {
          searchParams.zip = zip.trim();
        }

        // Perform the search
        const response = await api.searchPublic(searchParams);
        
        clearInterval(progressInterval);
        setProgress(100);
        setStatus('Search complete!');

        // Store results in sessionStorage for the results page
        sessionStorage.setItem('nameSearchResults', JSON.stringify({
          results: response.data || [],
          query: { firstName, lastName, zip }
        }));

        // Redirect to results page after a brief delay
        setTimeout(() => {
          navigate('/name/search-result');
        }, 500);
      } catch (err) {
        console.error('Search error:', err);
        setStatus('Error occurred. Redirecting...');
        setTimeout(() => {
          navigate('/name/search-result?error=true');
        }, 2000);
      }
    };

    // Small delay before starting search for better UX
    const timer = setTimeout(performSearch, 300);
    return () => clearTimeout(timer);
  }, [firstName, lastName, zip, navigate]);

  return (
    <main style={{ 
      padding: '4rem 2rem', 
      textAlign: 'center', 
      maxWidth: '600px', 
      margin: '0 auto',
      minHeight: '60vh',
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'center',
      alignItems: 'center'
    }}>
      <div style={{ width: '100%', marginBottom: '2rem' }}>
        <div style={{
          width: '80px',
          height: '80px',
          border: '6px solid #f3f3f3',
          borderTop: '6px solid #0e123b',
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
          color: '#0e123b', 
          marginBottom: '1rem',
          fontSize: '1.8rem'
        }}>
          Searching...
        </h2>
        <p style={{ 
          color: '#666', 
          fontSize: '1.1rem',
          marginBottom: '2rem'
        }}>
          {status}
        </p>

        {/* Progress bar */}
        <div style={{
          width: '100%',
          height: '8px',
          backgroundColor: '#f3f3f3',
          borderRadius: '4px',
          overflow: 'hidden',
          marginBottom: '1rem'
        }}>
          <div style={{
            width: `${progress}%`,
            height: '100%',
            backgroundColor: '#0e123b',
            transition: 'width 0.3s ease',
            borderRadius: '4px'
          }}></div>
        </div>
        <p style={{ 
          color: '#999', 
          fontSize: '0.9rem',
          margin: 0
        }}>
          {progress}% complete
        </p>
      </div>

      <div style={{ 
        marginTop: '3rem',
        padding: '1.5rem',
        backgroundColor: '#f5f5f5',
        borderRadius: '8px',
        width: '100%'
      }}>
        <p style={{ 
          color: '#666', 
          fontSize: '0.95rem',
          lineHeight: '1.6',
          margin: 0
        }}>
          <strong style={{ color: '#0e123b' }}>Searching for:</strong><br />
          {firstName} {lastName}
          {zip && ` • ${zip}`}
        </p>
      </div>
    </main>
  );
};

export default NameSearchLoaderPage;

