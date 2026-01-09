import React, { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import api from '../../api';
import { setSearchContext } from '../../services/searchContext';

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
  const state = params.get('state');

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

        // Build search parameters for the new API
        const searchParams = {
          firstName,
          lastName,
          type: 'name'
        };
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
          query: { firstName, lastName, state },
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
        setStatus('Error occurred. Redirecting...');
        setTimeout(() => {
          navigate('/name/search-result?error=true');
        }, 2000);
      }
    };

    // Small delay before starting search for better UX
    const timer = setTimeout(performSearch, 300);
    return () => clearTimeout(timer);
  }, [firstName, lastName, state, navigate]);

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
          marginBottom: '1rem',
          fontSize: '2rem',
          fontWeight: 700
        }}>
          Searching...
        </h2>
        <p style={{
          color: '#6b7280',
          fontSize: '1.125rem',
          marginBottom: '2rem',
          lineHeight: 1.6
        }}>
          {status}
        </p>

        {/* Progress bar */}
        <div style={{
          width: '100%',
          height: '10px',
          backgroundColor: '#e5e7eb',
          borderRadius: '9999px',
          overflow: 'hidden',
          marginBottom: '1rem',
          boxShadow: 'inset 0 2px 4px rgba(0, 0, 0, 0.06)'
        }}>
          <div style={{
            width: `${progress}%`,
            height: '100%',
            background: 'linear-gradient(90deg, #0d5d2f 0%, #1a7a4a 100%)',
            transition: 'width 0.3s ease',
            borderRadius: '9999px',
            boxShadow: '0 2px 4px rgba(14, 18, 59, 0.2)'
          }}></div>
        </div>
        <p style={{
          color: '#9ca3af',
          fontSize: '0.875rem',
          margin: 0,
          fontWeight: 500
        }}>
          {progress}% complete
        </p>

        {/* Search Query Display */}
        <div style={{
          marginTop: '3rem',
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
            {firstName} {lastName}
            {state && <span style={{ color: '#6b7280', fontWeight: 400 }}> • {state}</span>}
          </p>
        </div>

        {/* Info Message */}
        <p style={{
          marginTop: '2rem',
          color: '#9ca3af',
          fontSize: '0.875rem',
          lineHeight: 1.5
        }}>
          Searching through billions of public records...
        </p>
      </div>
    </main>
  );
};

export default NameSearchLoaderPage;


