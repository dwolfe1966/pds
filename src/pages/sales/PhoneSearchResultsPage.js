import React, { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import api from '../../api';
import ZeroResultsPanel from '../../components/ZeroResultsPanel';
import ThinMatchPreview from '../../components/ThinMatchPreview';
import { setSearchContext, setIdentityContext, getSearchContext } from '../../services/searchContext';
import { track } from '../../services/trackingService';
import { readThinMatch } from '../../services/thinMatch';
import { useCampaign } from '../../context/CampaignContext';
import styles from './PhoneSearchResultsPage.module.css';

// Partner bugs 15a/15b: phone SRP previously rendered unobscured owner details
// via ResultCard and clicks led to a generic "signup free" preview. Phone
// searches are pure sales funnel — obscure everything, route clicks straight
// to the paid signup flow.
function maskName(name = '') {
  const parts = String(name).trim().split(/\s+/);
  return parts
    .map((p) => (p.length <= 1 ? p : `${p[0]}${'•'.repeat(Math.max(2, p.length - 1))}`))
    .join(' ');
}
function maskLocation(loc = '') {
  if (!loc) return '••••••, ••';
  // Keep state-only portion visible: "Los Angeles, CA" -> "••••••••, CA"
  const parts = String(loc).split(',').map((s) => s.trim()).filter(Boolean);
  if (parts.length >= 2) return `${'•'.repeat(Math.max(6, parts[0].length))}, ${parts[parts.length - 1]}`;
  return '•'.repeat(Math.max(6, parts[0]?.length || 6));
}

/**
 * Displays phone search results for public searches.
 */
const PhoneSearchResultsPage = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const campaign = useCampaign(); // bug #51: shN drives thin-match vs no-records
  const params = new URLSearchParams(location.search);
  const phone = params.get('phone');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    track('results_view', { search_type: 'phone', query: phone || '' });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
    <main className={styles.page}>
      <div className={styles.card}>
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

        {/* Results — obscured by design (bug 15a). Click routes to signup (15b). */}
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
              Found <strong style={{ color: '#0d5d2f' }}>{results.length}</strong> possible {results.length === 1 ? 'match' : 'matches'} — sign up to see owner details
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {results.map((result) => (
                <button
                  key={result.id}
                  type="button"
                  onClick={() => {
                    track('result_click', { resultId: result.id, personName: 'masked', source: 'phone_srp' });
                    const extId = result.extId || result.id;
                    const ctx = getSearchContext();
                    if (extId && ctx) setIdentityContext({ ...result, extId }, ctx);
                    sessionStorage.setItem(`result_${result.id}`, JSON.stringify({
                      id: result.id, extId, fullName: result.fullName, location: result.location,
                      ageRange: result.ageRange, provider: result.provider, ...result,
                    }));
                    sessionStorage.setItem('selectedPersonId', result.id);
                    navigate(`/signup?selected=${encodeURIComponent(result.id)}&source=phone`);
                  }}
                  style={{
                    width: '100%', textAlign: 'left', cursor: 'pointer',
                    background: '#fff', border: '1px solid #e5e7eb',
                    borderRadius: '0.625rem', padding: '1rem 1.25rem',
                    display: 'flex', alignItems: 'center', gap: '1rem',
                    transition: 'all 0.15s ease',
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.borderColor = '#0d5d2f'; e.currentTarget.style.transform = 'translateY(-1px)'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.borderColor = '#e5e7eb'; e.currentTarget.style.transform = 'translateY(0)'; }}
                >
                  <span style={{
                    width: 42, height: 42, borderRadius: '50%',
                    background: '#e5e7eb', color: '#6b7280',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: '1.1rem', fontWeight: 600, flexShrink: 0,
                  }}>?</span>
                  <span style={{ flex: 1, minWidth: 0 }}>
                    <span style={{ display: 'block', fontWeight: 600, color: '#111827', filter: 'blur(3px)', userSelect: 'none' }}>
                      {maskName(result.fullName)}
                    </span>
                    <span style={{ display: 'block', fontSize: '0.85rem', color: '#6b7280', marginTop: '0.2rem' }}>
                      {maskLocation(result.location)}
                      {result.ageRange ? ` · Age ${result.ageRange}` : ''}
                    </span>
                  </span>
                  <span style={{
                    flexShrink: 0, fontSize: '0.75rem', fontWeight: 700,
                    background: '#0d5d2f', color: '#fff',
                    padding: '0.4rem 0.8rem', borderRadius: '9999px',
                    textTransform: 'uppercase', letterSpacing: '0.04em',
                  }}>🔒 Sign up to unlock</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* No Results */}
        {!loading && !error && results.length === 0 && (
          (() => {
            const flags = readThinMatch();
            return campaign?.search?.zeroState === 'thinMatch'
              ? <ThinMatchPreview searchType="phone" query={{ phone }} flags={flags} />
              : <ZeroResultsPanel searchType="phone" query={{ phone }} />;
          })()
        )}
      </div>
    </main>
  );
};

export default PhoneSearchResultsPage;

