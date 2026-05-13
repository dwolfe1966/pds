import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { setIdentityContext, getSearchContext } from '../services/searchContext';
import { createReportForIdentity } from '../services/reportService';
import { track } from '../services/trackingService';
import { gtmSelectContent } from '../services/gtm';
import { setSearchTarget as gtmSetSearchTarget } from '../services/gtmContext';
import styles from './ResultCard.module.css';

const ResultCard = ({ result, onClick, isMember = false }) => {
  const navigate = useNavigate();
  const { token, isPaid } = useAuth();
  const [loading, setLoading] = useState(false);

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
              const createResult = await createReportForIdentity(extId, { ...result, extId });
              if (createResult.success && createResult.commerceContentId) {
                navigate(`/people/${createResult.commerceContentId}`);
              } else {
                throw new Error('Failed to create report');
              }
            } catch (err) {
              if (process.env.NODE_ENV === 'development') {
                console.warn('[ResultCard] Failed to create report:', err);
              }
              // Paid users should not see payment form; go to detail page to show graceful error
              if (isValidId(extId)) {
                navigate(`/people/${extId}`);
              } else {
                navigate('/people-search');
              }
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
      // Non-member flow: navigate to preview page (which will show teaser and link to signup)
      navigate(`/search/${result.id}`);
    }
  };

  // Extract initials for avatar
  const initials = (result.fullName || '')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map(n => n[0])
    .join('')
    .toUpperCase();

  return (
    <div
      className={styles.card}
      onClick={!onClick ? handleViewDetails : undefined}
    >
      <div className={styles.cardRow}>
        {/* Avatar placeholder */}
        <div style={{
          width: '48px',
          height: '48px',
          borderRadius: '50%',
          backgroundColor: '#ecfdf5',
          border: '2px solid #d1fae5',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
          color: '#0d5d2f',
          fontWeight: 700,
          fontSize: '0.875rem',
          letterSpacing: '0.02em'
        }}>
          {initials || '?'}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <h3 className={styles.cardTitle}>
            {result.fullName}
          </h3>
          <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
            {result.ageRange && (
              <p className={styles.cardInfo}>
                <span style={{
                  fontSize: '0.6875rem',
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                  color: '#9ca3af',
                  fontWeight: 600,
                  display: 'block',
                  marginBottom: '0.125rem'
                }}>Age</span>
                {result.ageRange}
              </p>
            )}
            {result.location && (
              <p className={styles.cardInfo}>
                <span style={{
                  fontSize: '0.6875rem',
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                  color: '#9ca3af',
                  fontWeight: 600,
                  display: 'block',
                  marginBottom: '0.125rem'
                }}>Location</span>
                {result.location}
              </p>
            )}
          </div>
        </div>
        <button
          onClick={handleViewDetails}
          className={styles.cardButton}
          disabled={loading}
        >
          {loading ? 'Loading...' : 'View Full Report →'}
        </button>
      </div>
    </div>
  );
};

export default ResultCard;