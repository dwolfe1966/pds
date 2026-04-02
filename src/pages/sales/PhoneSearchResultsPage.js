import React, { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import api from '../../api';
import ResultCard from '../../components/ResultCard';
import ZeroResultsPanel from '../../components/ZeroResultsPanel';
import { setSearchContext } from '../../services/searchContext';

/**
 * Displays phone search results for public searches.
 */
const PhoneSearchResultsPage = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const params = new URLSearchParams(location.search);
  const phone = params.get('phone');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchResults = async () => {
      // Check if we have results from the loader page
      const storedResults = sessionStorage.getItem('phoneSearchResults');
      if (storedResults) {
        try {
          const data = JSON.parse(storedResults);
          setResults(data.results || []);
          sessionStorage.removeItem('phoneSearchResults');
          setLoading(false);
          return;
        } catch (err) {
          console.error('Error parsing stored results:', err);
        }
      }

      if (!phone) {
        navigate('/phone/landing');
        return;
      }

      setLoading(true);
      try {
        const response = await api.searchPeople({
          phone,
          type: 'phone'
        });
        // Response is already adapted: { data: [...], pagination: {...}, searchContext: {...} }
        setResults(response.data || []);
        
        // Store search context for opt-out
        if (response.searchContext) {
          setSearchContext(response.searchContext);
        }
      } catch (err) {
        setError(err.message || 'An error occurred while searching.');
      } finally {
        setLoading(false);
      }
    };

    fetchResults();
  }, [phone, navigate]);

  const formatPhoneDisplay = (p) => {
    if (!p) return p;
    const digits = p.replace(/\D/g, '');
    if (digits.length === 10) return `(${digits.slice(0,3)}) ${digits.slice(3,6)}-${digits.slice(6)}`;
    return p;
  };

  return (
    <main style={{
      background: 'linear-gradient(135deg, rgb(236, 253, 245) 0%, rgb(239, 246, 255) 100%)',
      padding: '2.5rem 0',
      minHeight: '100vh'
    }}>
      <div style={{
        maxWidth: '1200px',
        margin: '0 auto',
        padding: '3rem',
        backgroundColor: '#ffffff',
        borderRadius: '0.75rem',
        boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)'
      }}>
        {/* Header */}
        <div style={{
          marginBottom: '3rem',
          paddingBottom: '2rem',
          borderBottom: '1px solid #e5e7eb'
        }}>
          <h1 style={{
            color: '#0d5d2f',
            fontSize: '1.875rem',
            fontWeight: 700,
            marginBottom: '1rem'
          }}>
            Phone Search Results
          </h1>
          <p style={{
            color: '#6b7280',
            fontSize: '1.125rem',
            lineHeight: 1.625,
            marginBottom: 0
          }}>
            Results for: <strong style={{ color: '#0d5d2f' }}>{formatPhoneDisplay(phone)}</strong>
          </p>
        </div>

        {/* Loading State */}
        {loading && (
          <div style={{ textAlign: 'center', padding: '6rem 0' }}>
            <div style={{
              width: '60px',
              height: '60px',
              border: '5px solid #e5e7eb',
              borderTop: '5px solid #0d5d2f',
              borderRadius: '50%',
              animation: 'spin 1s linear infinite',
              margin: '0 auto 1.5rem auto'
            }}></div>
            <p style={{ color: '#6b7280' }}>Loading results...</p>
          </div>
        )}

        {/* Error State */}
        {error && (
          <div style={{
            padding: '1.5rem',
            backgroundColor: '#fee',
            border: '1px solid #fcc',
            borderRadius: '0.375rem',
            color: '#c33',
            marginBottom: '1.5rem'
          }}>
            <p style={{ margin: 0, fontWeight: 600, marginBottom: '0.5rem' }}>Error:</p>
            <p style={{ margin: 0 }}>{error}</p>
          </div>
        )}

        {/* Results */}
        {!loading && !error && results.length > 0 && (
          <div>
            <div style={{
              marginTop: '1.5rem',
              paddingTop: '1.5rem',
              borderTop: '5px solid #0d5d2f',
              color: '#6b7280',
              fontSize: '1rem',
              marginBottom: '1rem'
            }}>
              Found <strong style={{ color: '#0d5d2f' }}>{results.length}</strong> {results.length === 1 ? 'result' : 'results'}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {results.map((result) => (
                <ResultCard key={result.id} result={result} />
              ))}
            </div>
          </div>
        )}

        {/* No Results */}
        {!loading && !error && results.length === 0 && (
          <ZeroResultsPanel searchType="phone" query={{ phone }} />
        )}
      </div>
    </main>
  );
};

export default PhoneSearchResultsPage;

