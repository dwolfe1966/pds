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
  const middleName = params.get('middleName');
  const age = params.get('age');
  const city = params.get('city');
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
          <span>Possible relatives</span>
          <span>Job &amp; education</span>
          <span>Person information</span>
          <span>Contact information</span>
          <span>Social media profiles</span>
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
            {firstName} {middleName ? `${middleName} ` : ''}{lastName}
            {age && <span style={{ color: '#6b7280', fontWeight: 400 }}> • {age}</span>}
            {city && <span style={{ color: '#6b7280', fontWeight: 400 }}> • {city}</span>}
            {state && <span style={{ color: '#6b7280', fontWeight: 400 }}> • {state}</span>}
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

export default NameSearchLoaderPage;


