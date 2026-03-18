import React, { useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import SearchBar from '../../components/SearchBar';
import { useLandingTrack } from '../../hooks/useLandingTrack';

/**
 * Search landing page for visitors coming from marketing campaigns.
 * Pre‑populates the search bar from query parameters.
 * If a query is present, automatically redirects to search results.
 */
const LandingPage = () => {
  useLandingTrack('name', 'v1');
  const location = useLocation();
  const navigate = useNavigate();
  const params = new URLSearchParams(location.search);
  const q = params.get('q') || '';
  const state = params.get('state') || '';

  // If query parameter exists, redirect to search results
  useEffect(() => {
    if (q) {
      const searchParams = new URLSearchParams();
      searchParams.set('q', q);
      if (state) searchParams.set('state', state);
      navigate(`/search-results?${searchParams.toString()}`, { replace: true });
    }
  }, [q, state, navigate]);

  return (
    <main style={{ padding: 0, minHeight: '70vh' }}>
      {/* Hero Section */}
      <section style={{
        background: 'linear-gradient(135deg, rgb(236, 253, 245) 0%, rgb(239, 246, 255) 100%)',
        padding: '4rem 1.5rem',
        textAlign: 'center'
      }}>
        <div style={{ maxWidth: '700px', margin: '0 auto' }}>
          <h1 style={{
            color: '#111827',
            marginBottom: '1rem',
            fontSize: '2.25rem',
            fontWeight: 700,
            lineHeight: 1.25,
            letterSpacing: '-0.02em'
          }}>
            Find Anyone in Seconds
          </h1>
          <p style={{
            marginBottom: '2rem',
            color: '#6b7280',
            fontSize: '1.125rem',
            lineHeight: 1.625,
            maxWidth: '560px',
            marginLeft: 'auto',
            marginRight: 'auto'
          }}>
            Search by name, phone, or email across 12 billion+ public records. Instant results. No hidden fees.
          </p>
          <div style={{ maxWidth: '600px', margin: '0 auto 2rem' }}>
            <SearchBar initialQuery={q} />
          </div>
          <div style={{
            display: 'flex', gap: '1.5rem', flexWrap: 'wrap', justifyContent: 'center',
            margin: '1rem 0 0', fontSize: '0.8rem', color: '#6b7280',
          }}>
            <span>🔍 2,400+ searches in the last hour</span>
            <span>👥 Trusted by 3M+ members</span>
            <span>🔒 100% confidential</span>
          </div>
          {/* Trust signal */}
          <p style={{
            color: '#9ca3af',
            fontSize: '0.75rem',
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
            marginTop: '1rem'
          }}>
            Your search is confidential and secure
          </p>
        </div>
      </section>

      {/* Benefits Section */}
      <section style={{
        padding: '3rem 1.5rem',
        backgroundColor: '#ffffff'
      }}>
        <div style={{
          maxWidth: '700px',
          margin: '0 auto',
          backgroundColor: '#f9fafb',
          borderRadius: '0.75rem',
          border: '1px solid #e5e7eb',
          padding: '2rem'
        }}>
          <h3 style={{
            color: '#0d5d2f',
            marginTop: 0,
            marginBottom: '1rem',
            fontSize: '1.25rem',
            fontWeight: 600
          }}>
            What You Can Find
          </h3>
          <ul style={{
            color: '#4b5563',
            lineHeight: 2,
            paddingLeft: '1.25rem',
            margin: 0,
            fontSize: '0.9375rem'
          }}>
            <li>Contact information and addresses</li>
            <li>Public records and background information</li>
            <li>Social media profiles</li>
            <li>Family and relatives</li>
          </ul>
        </div>
      </section>
    </main>
  );
};

export default LandingPage;