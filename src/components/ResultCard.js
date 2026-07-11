import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { setIdentityContext, getSearchContext } from '../services/searchContext';
import { createReportForIdentity } from '../services/reportService';
import { track } from '../services/trackingService';
import { gtmSelectContent } from '../services/gtm';
import { setSearchTarget as gtmSetSearchTarget } from '../services/gtmContext';
import { getCapturedEmail } from '../services/emailCapture';
import styles from './ResultCard.module.css';
import { PersonAvatar, properCaseName } from './PersonAvatar';

const ResultCard = ({ result, onClick, isMember = false, theme = null, index = 0 }) => {
  const navigate = useNavigate();
  const { token, isPaid } = useAuth();
  const [loading, setLoading] = useState(false);
  const [createError, setCreateError] = useState('');

  const handleViewDetails = async (e) => {
    e.stopPropagation(); // Prevent parent onClick if present

    const ctx = (typeof getSearchContext === 'function' ? getSearchContext() : {}) || {};
    const searchType = ctx.teaserInput?.type || ctx.type || undefined;
    // Capture the selected identity into the GTM dataLayer context BEFORE
    // any push so target* fields populate the resulting select_content event.
    gtmSetSearchTarget({
      firstName: result.firstName,
      lastName: result.lastName,
      middleName: result.middleName,
      city: result.city || result.address?.city,
      state: result.state || result.address?.state,
      age: result.age,
      phone: result.phone || result.phones?.[0]?.number,
      extId: result.extId || result.id,
    });
    track('result_click', { resultId: result.id, personName: result.fullName, searchType });
    gtmSelectContent({ content_type: 'person', content_id: result.id, search_type: searchType });

    // If custom onClick handler provided, use it
    if (onClick) {
      onClick(result);
      return;
    }
    
    // Normalize extId for mock API results (use id if extId missing)
    const extId = result.extId || result.id;
    const isValidId = (value) => Boolean(value) && value !== 'undefined' && value !== 'null';

    // Get current search context
    const searchContext = getSearchContext();
    
    // Store identity context for report creation
    if (isValidId(extId) && searchContext) {
      setIdentityContext({ ...result, extId }, searchContext);
    }
    
    // Store result in sessionStorage for preview/signup pages
    sessionStorage.setItem(`result_${result.id}`, JSON.stringify({
      id: result.id,
      extId,
      fullName: result.fullName,
      location: result.location,
      ageRange: result.ageRange,
      provider: result.provider,
      ...result
    }));
    
    // If this is a member context and user is authenticated, use isPaid from AuthContext
    if (isMember && token) {
      setLoading(true);
      try {
        if (isPaid) {
          // User has active subscription - create/get report and navigate to it
          if (isValidId(extId)) {
            try {
              // Create report (API will return existing report if it already exists)
              setCreateError('');
              const createResult = await createReportForIdentity(extId, { ...result, extId });
              if (createResult.success && createResult.commerceContentId) {
                navigate(`/people/${createResult.commerceContentId}`);
              } else {
                throw new Error('Failed to create report');
              }
            } catch (err) {
              // Stash the error for post-mortem inspection without dev console.
              try {
                if (typeof window !== 'undefined') {
                  window._lastCreateReportError = { error: err, when: new Date().toISOString(), extId };
                }
              } catch {}
              // Surface inline error on the card. Do NOT navigate to /people/{extId}:
              // {extId} is a teaser id, not a real commerceContentId, so
              // SearchResultDetailPage would 404 on /report/detail/{extId} and
              // then loop right back into create. The inline message lets the
              // user retry without bouncing through a misleading downstream URL.
              setCreateError(
                err?.message?.includes('412') || err?.httpStatus === 412
                  ? "We couldn't open this report right now. Please try again in a moment."
                  : err?.message || "Couldn't load this report. Please try again."
              );
            }
          } else {
            // No extId, can't create report - send to search instead of payment
            navigate('/people-search');
          }
        } else {
          // No active subscription, go to payment page
          sessionStorage.setItem('selectedPersonId', result.id);
          navigate('/payment');
        }
      } finally {
        setLoading(false);
      }
    } else {
      // Non-member flow. If we already captured an email upstream (e.g. the BV
      // mid-loader gate), skip the SUP re-ask and go straight to payment via a silent
      // auto-signup (captured email + generated password). SignupPage falls back to the
      // form if the account already exists. (result_${id} is already stashed above.)
      let capturedEmail = '';
      try { capturedEmail = getCapturedEmail(); } catch { /* ignore */ }
      if (capturedEmail) {
        navigate(`/signup?selected=${result.id}&redirect=/payment&auto=1`);
      } else {
        navigate(`/search/${result.id}`);
      }
    }
  };

  // Locations (4.d): up to two, then "+N more".
  const locs = (Array.isArray(result.locations) && result.locations.length ? result.locations : [result.location].filter(Boolean));
  const locShown = locs.slice(0, 2);
  const locExtra = Math.max(locs.length - 2, 0);

  // Relatives (4.e): up to two names, then "+N more".
  const rels = (Array.isArray(result.relatives) ? result.relatives : []).map(r => (typeof r === 'string' ? r : r?.name)).filter(Boolean);
  const relShown = rels.slice(0, 2);
  const relExtra = Math.max(rels.length - 2, 0);

  // Record bubbles (4.f): any other info on file, as chips.
  const R = result.records || {};
  const Fl = result.flags || {};
  const bubbles = [];
  if (Fl.isCriminal || R.criminal > 0) bubbles.push(R.criminal > 0 ? `${R.criminal} criminal` : 'Criminal record');
  if (Fl.isPropertyOwner || R.property > 0) bubbles.push(R.property > 0 ? `${R.property} propert${R.property > 1 ? 'ies' : 'y'}` : 'Property');
  if (R.judgment > 0) bubbles.push('Judgment');
  if (R.lien > 0) bubbles.push('Lien');
  if (R.bankruptcy > 0) bubbles.push('Bankruptcy');
  if (Fl.hasEmployment || R.employment > 0) bubbles.push('Employment');
  if (Fl.hasProfessionalLicense || R.professionalLicense > 0) bubbles.push('License');
  if (Fl.hasVehicle) bubbles.push('Vehicle');
  if (R.business > 0) bubbles.push('Business');
  if (R.phone > 0) bubbles.push(`${R.phone} phone${R.phone > 1 ? 's' : ''}`);
  if (R.email > 0) bubbles.push(`${R.email} email${R.email > 1 ? 's' : ''}`);

  const ageText = result.age ? `Age ${result.age}` : (result.ageRange ? `Age ${result.ageRange}` : '');
  const subLabel = { fontSize: '0.68rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: '#9ca3af', fontWeight: 700, marginRight: '0.35rem' };

  return (
    <div
      className={styles.card}
      onClick={!onClick ? handleViewDetails : undefined}
    >
      {/* Ribbon header — avatar + name + age, banded to separate stacked cards (owner). */}
      <div className={styles.ribbon} style={index % 2 === 1 ? { background: '#f1f5f9', borderBottomColor: '#e5e7eb' } : undefined}>
        <PersonAvatar person={result} size={40} />
        <div style={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: '0.75rem' }}>
          <h3 className={styles.cardTitle} style={{ margin: 0 }}>{properCaseName(result.fullName)}</h3>
          {ageText && <span style={{ fontSize: '0.85rem', fontWeight: 600, color: '#374151', whiteSpace: 'nowrap', flexShrink: 0 }}>{ageText}</span>}
        </div>
      </div>

      {/* Body — records + CTA */}
      <div className={styles.cardBody}>
        {Array.isArray(result.aliases) && result.aliases.length > 0 && (
          <p style={{ margin: '0 0 0', fontSize: '0.78rem', color: '#6b7280' }}>
            <span style={{ fontWeight: 600 }}>AKA:</span> {result.aliases.slice(0, 3).join(', ')}
            {result.aliases.length > 3 && ` +${result.aliases.length - 3} more`}
          </p>
        )}
        {locShown.length > 0 && (
          <p style={{ margin: result.aliases?.length ? '0.4rem 0 0' : '0', fontSize: '0.85rem', color: '#374151' }}>
            <span style={subLabel}>Location</span>
            {locShown.join(' · ')}{locExtra > 0 && <span style={{ color: '#6b7280' }}> +{locExtra} more</span>}
          </p>
        )}
        {relShown.length > 0 && (
          <p style={{ margin: '0.3rem 0 0', fontSize: '0.85rem', color: '#374151' }}>
            <span style={subLabel}>Relatives</span>
            {relShown.join(', ')}{relExtra > 0 && <span style={{ color: '#6b7280' }}> +{relExtra} more</span>}
          </p>
        )}
        {bubbles.length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem', marginTop: '0.55rem' }}>
            {bubbles.map((b) => (
              <span key={b} style={{ fontSize: '0.72rem', fontWeight: 600, color: '#475569', background: '#f1f5f9', border: '1px solid #e2e8f0', borderRadius: '999px', padding: '0.15rem 0.55rem' }}>{b}</span>
            ))}
          </div>
        )}
        <div style={{ marginTop: '0.85rem' }}>
          <button
            onClick={handleViewDetails}
            className={styles.cardButton}
            disabled={loading}
            style={theme ? { background: theme.button, borderColor: 'transparent' } : undefined}
          >
            {loading ? 'Loading...' : 'View Details →'}
          </button>
        </div>
        {createError && (
          <div
            role="alert"
            style={{
              marginTop: '0.75rem',
              padding: '0.625rem 0.75rem',
              background: '#fef2f2',
              border: '1px solid #fecaca',
              borderRadius: 6,
              color: '#991b1b',
              fontSize: '0.875rem',
              lineHeight: 1.5,
            }}
          >
            {createError}
          </div>
        )}
      </div>
    </div>
  );
};

export default ResultCard;