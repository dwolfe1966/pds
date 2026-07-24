import React, { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import api from '../../api';
import ZeroResultsPanel from '../../components/ZeroResultsPanel';
import ThinMatchPreview from '../../components/ThinMatchPreview';
import { useSignup, generatePassword } from '../../hooks/useSignup';
import { getCapturedEmail } from '../../services/emailCapture';
import { setSearchContext, setIdentityContext, getSearchContext } from '../../services/searchContext';
import { track } from '../../services/trackingService';
import { readThinMatch } from '../../services/thinMatch';
import { useCampaign } from '../../context/CampaignContext';
import SignalTeaser from '../../components/SignalTeaser';
import styles from './PhoneSearchResultsPage.module.css';

// Build a getPersonSignals subject (the person behind the number) so the reveal experience can enrich the
// owner with records/relatives — the single-owner reveal used by /phone/landing/v1 (2026-07-24).
function ownerSubject(r) {
  const parts = String(r?.fullName || '').trim().split(/\s+/);
  const loc = String(r?.location || '').split(',').map((s) => s.trim());
  const age = (String(r?.ageRange || '').match(/\d+/) || [])[0];
  return { firstName: parts[0] || '', lastName: parts.slice(1).join(' ') || '', city: loc[0] || '', state: loc[1] || '', age };
}

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
  // v1 reverse-lookup experience: single-owner reveal + enrichment (set by PhoneSearchLandingV1Page).
  const reveal = (() => { try { return sessionStorage.getItem('phoneReveal') === '1'; } catch { return false; } })();
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  // v1 reveal → email-only capture → payment (blessed thin-match pattern): one email field, auto-gen
  // password, straight to /payment. No "Create Account" form on the phone unlock path.
  const { submit: signupSubmit, loading: signupBusy, error: signupError } = useSignup();
  const [capturing, setCapturing] = useState(false);
  const [captureEmail, setCaptureEmailVal] = useState('');
  const [captureErr, setCaptureErr] = useState('');

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
          // Don't remove: React Strict Mode double-mounts in dev, so a second mount would see empty storage
          // and fall through to a fresh (possibly failing) fetch. The loader overwrites this on each search.
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

  // Route a selected owner into the paid unlock flow (shared by the list + the single-owner reveal).
  const unlock = (result) => {
    if (!result) return;
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
  };

  // ── v1 single-owner reveal: email-only capture → payment (no "Create Account" form) ──
  const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  const stashOwner = (result) => {
    const extId = result.extId || result.id;
    const ctx = getSearchContext();
    if (extId && ctx) setIdentityContext({ ...result, extId }, ctx);
    sessionStorage.setItem(`result_${result.id}`, JSON.stringify({
      id: result.id, extId, fullName: result.fullName, location: result.location,
      ageRange: result.ageRange, provider: result.provider, ...result,
    }));
    sessionStorage.setItem('selectedPersonId', result.id);
  };
  const startUnlock = (result) => {
    if (!result) return;
    track('result_click', { resultId: result.id, personName: 'masked', source: 'phone_reveal' });
    stashOwner(result);
    const known = getCapturedEmail();
    if (known && EMAIL_RE.test(known)) {
      // Email already known earlier in the funnel — skip the field, go straight to payment.
      signupSubmit({ email: known, password: generatePassword(), optin: true, selectedPersonId: result.id, redirectParam: '/payment' });
      return;
    }
    setCapturing(true);
  };
  const submitCaptureEmail = (e) => {
    e.preventDefault();
    const em = captureEmail.trim();
    if (!EMAIL_RE.test(em)) { setCaptureErr('Please enter a valid email address.'); return; }
    setCaptureErr('');
    track('email_capture', { source: 'phone_reveal' });
    signupSubmit({ email: em, password: generatePassword(), optin: true, selectedPersonId: results[0]?.id, redirectParam: '/payment' });
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
        {!loading && !error && results.length > 0 && (reveal ? (
          /* ── v1 SINGLE-OWNER REVEAL: a phone maps to one owner, so give one confident answer + enrichment ── */
          <div>
            <div style={{ marginTop: '1rem', paddingTop: '1.25rem', borderTop: '3px solid #0d5d2f', color: '#6b7280', fontSize: '0.95rem', marginBottom: '1rem' }}>
              ✅ We identified the owner of this number.
            </div>
            <button type="button" onClick={() => startUnlock(results[0])}
              style={{ width: '100%', textAlign: 'left', cursor: 'pointer', background: '#f0fdf4', border: '1px solid #0d5d2f55', borderRadius: '0.75rem', padding: '1.1rem 1.25rem', display: 'flex', alignItems: 'center', gap: '1rem' }}>
              <span style={{ width: 48, height: 48, borderRadius: '50%', background: '#dcfce7', color: '#0d5d2f', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.4rem', flexShrink: 0 }}>👤</span>
              <span style={{ flex: 1, minWidth: 0 }}>
                <span style={{ display: 'block', fontSize: '0.78rem', color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.04em' }}>This number belongs to</span>
                <span style={{ display: 'block', fontWeight: 800, fontSize: '1.15rem', color: '#111827', filter: 'blur(4px)', userSelect: 'none', marginTop: 2 }}>
                  {maskName(results[0].fullName)}
                </span>
                <span style={{ display: 'block', fontSize: '0.85rem', color: '#6b7280', marginTop: '0.25rem' }}>
                  {maskLocation(results[0].location)}{results[0].ageRange ? ` · Age ${results[0].ageRange}` : ''}
                </span>
              </span>
              <span style={{ flexShrink: 0, fontSize: '0.75rem', fontWeight: 700, background: '#0d5d2f', color: '#fff', padding: '0.4rem 0.8rem', borderRadius: '9999px' }}>🔒 Unlock</span>
            </button>
            {results.length > 1 && (
              <p style={{ fontSize: '0.82rem', color: '#6b7280', margin: '0.6rem 0 0' }}>
                + {results.length - 1} other record{results.length - 1 === 1 ? '' : 's'} linked to this number
              </p>
            )}
            {/* Enrichment on the owner (records / relatives) — same engine the name funnel uses. */}
            <SignalTeaser subject={ownerSubject(results[0])} flow="general" viewerRelation="prospect" stage="pre-signup" />
            {capturing ? (
              /* Single email field → auto-signup (auto-gen password) → payment. No account form. */
              <form onSubmit={submitCaptureEmail} style={{ marginTop: '1.25rem', background: '#f0fdf4', border: '1px solid #0d5d2f55', borderRadius: 12, padding: '1.15rem 1.2rem' }}>
                <div style={{ fontWeight: 800, fontSize: '1.05rem', color: '#111827', marginBottom: 4 }}>
                  Unlock the full report on this number
                </div>
                <p style={{ fontSize: 13, color: '#6b7280', margin: '0 0 12px', lineHeight: 1.5 }}>
                  Enter your email to continue — we'll set up your account and take you straight to unlock.
                </p>
                <input
                  type="email" inputMode="email" autoFocus autoComplete="email"
                  value={captureEmail}
                  onChange={(e) => { setCaptureEmailVal(e.target.value); if (captureErr) setCaptureErr(''); }}
                  placeholder="you@email.com"
                  style={{ width: '100%', boxSizing: 'border-box', padding: '13px 15px', fontSize: 16, border: `1px solid ${captureErr ? '#dc2626' : '#d1d5db'}`, borderRadius: 10, outline: 'none' }}
                />
                {(captureErr || signupError) && <p style={{ color: '#dc2626', fontSize: 13, margin: '8px 0 0' }}>{captureErr || signupError}</p>}
                <button type="submit" disabled={signupBusy}
                  style={{ width: '100%', marginTop: 12, padding: '15px', fontSize: 16, fontWeight: 800, color: '#fff', background: '#0d5d2f', border: 'none', borderRadius: 10, cursor: signupBusy ? 'default' : 'pointer', opacity: signupBusy ? 0.7 : 1 }}>
                  {signupBusy ? 'Setting up…' : 'Continue to unlock →'}
                </button>
                <p style={{ fontSize: 11, color: '#9ca3af', textAlign: 'center', margin: '10px 0 0' }}>🔒 Secure checkout · cancel anytime</p>
              </form>
            ) : (
              <button type="button" onClick={() => startUnlock(results[0])}
                style={{ width: '100%', marginTop: '1rem', padding: '15px', fontSize: 16, fontWeight: 800, color: '#fff', background: '#0d5d2f', border: 'none', borderRadius: 10, cursor: 'pointer' }}>
                See the full report on this number →
              </button>
            )}
          </div>
        ) : (
          /* ── legacy match-list SRP (v2–v6) ── */
          <div>
            <div style={{ marginTop: '1.5rem', paddingTop: '1.5rem', borderTop: '5px solid #0d5d2f', color: '#6b7280', fontSize: '1rem', marginBottom: '1rem' }}>
              Found <strong style={{ color: '#0d5d2f' }}>{results.length}</strong> possible {results.length === 1 ? 'match' : 'matches'} — sign up to see owner details
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {results.map((result) => (
                <button
                  key={result.id}
                  type="button"
                  onClick={() => unlock(result)}
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
        ))}

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

