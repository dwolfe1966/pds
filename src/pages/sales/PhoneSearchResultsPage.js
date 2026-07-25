import React, { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import api from '../../api';
import ZeroResultsPanel from '../../components/ZeroResultsPanel';
import ThinMatchPreview from '../../components/ThinMatchPreview';
import { setSearchContext, setIdentityContext, getSearchContext } from '../../services/searchContext';
import { track } from '../../services/trackingService';
import { readThinMatch } from '../../services/thinMatch';
import { useCampaign } from '../../context/CampaignContext';
import SignalTeaser from '../../components/SignalTeaser';
import { fetchPhoneIntel, describeLine } from '../../services/phoneIntelService';
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
  // P2 "is this call safe?" — show the line-safety signal (line type/carrier/risk) FREE as the hook.
  const safety = (() => { try { return sessionStorage.getItem('phoneSafety') === '1'; } catch { return false; } })();
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [intel, setIntel] = useState(null);

  // Fetch the Twilio line-safety signal once we have the number (safety funnel only, to bound cost).
  useEffect(() => {
    if (!safety || !phone) return;
    let alive = true;
    fetchPhoneIntel(phone).then((r) => { if (alive) setIntel(r); }).catch(() => {});
    return () => { alive = false; };
  }, [safety, phone]);

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

  // v1 single-owner reveal → the payment page's email-capture step (?capture=email): one email
  // field below the checkout header, auto-gen password, no "Create Account" form. Owner stays masked.
  const startUnlock = (result) => {
    if (!result) return;
    track('result_click', { resultId: result.id, personName: 'masked', source: 'phone_reveal' });
    const extId = result.extId || result.id;
    const ctx = getSearchContext();
    if (extId && ctx) setIdentityContext({ ...result, extId }, ctx);
    sessionStorage.setItem(`result_${result.id}`, JSON.stringify({
      id: result.id, extId, fullName: result.fullName, location: result.location,
      ageRange: result.ageRange, provider: result.provider, ...result,
    }));
    sessionStorage.setItem('selectedPersonId', result.id);
    navigate('/payment?capture=email');
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
            {/* P2 line-safety panel — FREE hook (Twilio line type/carrier/descriptive risk). Owner stays gated. */}
            {safety && intel && intel.available && (() => {
              const d = describeLine(intel);
              const tone = d.tone === 'warn' ? { bg: '#fffbeb', bd: '#fde68a', fg: '#b45309', ic: '⚠️' }
                : d.tone === 'ok' ? { bg: '#f0fdf4', bd: '#bbf7d0', fg: '#15803d', ic: '✅' }
                : { bg: '#f8fafc', bd: '#e2e8f0', fg: '#64748b', ic: 'ℹ️' };
              return (
                <div style={{ marginTop: '1rem', background: tone.bg, border: `1px solid ${tone.bd}`, borderRadius: 12, padding: '1rem 1.15rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                    <span aria-hidden="true" style={{ fontSize: 22 }}>{tone.ic}</span>
                    <span style={{ fontWeight: 800, fontSize: '1.05rem', color: tone.fg }}>{d.label}</span>
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px 16px', fontSize: '0.86rem', color: '#374151' }}>
                    <span>📶 <strong>{d.typeLabel}</strong> line</span>
                    {d.carrier && <span>🏢 {d.carrier}</span>}
                  </div>
                  <p style={{ margin: '8px 0 0', fontSize: '0.82rem', color: '#6b7280', lineHeight: 1.45 }}>{d.note}</p>
                </div>
              );
            })()}
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
            {/* P1: name the incarceration moat — our first-party booking data is the differentiator competitors
                lack. Capability claim (not a per-person assertion); the real per-owner record, when it exists,
                is surfaced dynamically by the records-forward teaser below. */}
            <div style={{ marginTop: '0.9rem', background: '#fff7ed', border: '1px solid #fed7aa', borderRadius: 10, padding: '0.7rem 0.9rem', display: 'flex', alignItems: 'center', gap: 8 }}>
              <span aria-hidden="true" style={{ fontSize: 18 }}>📋</span>
              <span style={{ fontSize: '0.85rem', color: '#9a3412', fontWeight: 700, lineHeight: 1.4 }}>Includes booking &amp; incarceration records — data most people-search sites miss.</span>
            </div>
            {/* Records-forward enrichment: real booking teaser leads when the owner has one (the moat, proven
                CVR); otherwise a public-records capability checklist. publicRecords (vs general) = always shows a
                records value prop, and is the compliance-safe framing (not "background check"). */}
            <SignalTeaser subject={ownerSubject(results[0])} flow="publicRecords" viewerRelation="prospect" stage="pre-signup" anonymize subjectLabel="this number’s owner" />
            <button type="button" onClick={() => startUnlock(results[0])}
              style={{ width: '100%', marginTop: '1rem', padding: '15px', fontSize: 16, fontWeight: 800, color: '#fff', background: '#0d5d2f', border: 'none', borderRadius: 10, cursor: 'pointer' }}>
              See the full report on this number →
            </button>
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

