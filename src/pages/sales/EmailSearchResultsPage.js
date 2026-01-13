import React, { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import api from '../../api';
import ResultCard from '../../components/ResultCard';
import { setSearchContext } from '../../services/searchContext';

/**
 * Displays email search results for public searches.
 * Mimics the name search results flow with IDLookup design.
 */
const EmailSearchResultsPage = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const params = new URLSearchParams(location.search);
  const email = params.get('email');
  const error = params.get('error');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    const fetchResults = async () => {
      // Check if we have results from the loader page
      const storedResults = sessionStorage.getItem('emailSearchResults');
      if (storedResults) {
        try {
          const data = JSON.parse(storedResults);
          setResults(data.results || []);
          
          // Store search context
          if (data.searchContext) {
            setSearchContext(data.searchContext);
          }
          
          sessionStorage.removeItem('emailSearchResults');
          setLoading(false);
          return;
        } catch (err) {
          console.error('Error parsing stored results:', err);
        }
      }

      if (!email) {
        navigate('/email/landing');
        return;
      }

      if (error) {
        setErrorMessage('An error occurred during the search. Please try again.');
        setLoading(false);
        return;
      }

      setLoading(true);
      try {
        const response = await api.searchPeople({
          email,
          type: 'email'
        });
        
        // Response is already adapted: { data: [...], pagination: {...}, searchContext: {...} }
        setResults(response.data || []);
        
        // Store search context for report creation and opt-out
        if (response.searchContext) {
          setSearchContext(response.searchContext);
        }
      } catch (err) {
        setErrorMessage(err.message || 'An error occurred during the search.');
      } finally {
        setLoading(false);
      }
    };

    fetchResults();
  }, [email, error, navigate]);

  return (
    <main style={{ padding: '2rem', maxWidth: '1000px', margin: '0 auto' }}>
      <h1 style={{ color: '#0e123b', marginBottom: '1rem' }}>Email Search Results</h1>
      
      <div style={{ 
        marginBottom: '2rem', 
        padding: '1rem', 
        backgroundColor: '#f5f5f5', 
        borderRadius: '4px' 
      }}>
        <p style={{ margin: 0, color: '#666' }}>
          <strong>Searching for:</strong> {email}
        </p>
      </div>

      {loading && (
        <div style={{ textAlign: 'center', padding: '2rem' }}>
          <p>Loading results...</p>
        </div>
      )}

      {errorMessage && (
        <div style={{ 
          padding: '1rem', 
          backgroundColor: '#fee', 
          color: '#c00', 
          borderRadius: '4px', 
          marginBottom: '1rem' 
        }}>
          <p style={{ margin: 0 }}>{errorMessage}</p>
        </div>
      )}

      {!loading && !errorMessage && results.length > 0 && (
        <div style={{ marginTop: '1rem' }}>
          <h2 style={{ color: '#0e123b', marginBottom: '1rem' }}>
            Found {results.length} result{results.length !== 1 ? 's' : ''}
          </h2>
          {results.map((result) => (
            <ResultCard key={result.id || result.extId} result={result} />
          ))}
        </div>
      )}

      {!loading && !errorMessage && results.length === 0 && (
        <div style={{ textAlign: 'center', padding: '2rem' }}>
          <p style={{ color: '#666', fontSize: '1.1rem' }}>
            No results found for this email address.
          </p>
          <button
            onClick={() => navigate('/email/landing')}
            style={{
              marginTop: '1rem',
              padding: '0.75rem 2rem',
              backgroundColor: '#0d5d2f',
              color: '#fff',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              fontSize: '1rem'
            }}
          >
            Try Another Search
          </button>
        </div>
      )}
    </main>
  );
};

export default EmailSearchResultsPage;
