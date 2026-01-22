import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../api';
import { setIdentityContext, getSearchContext } from '../services/searchContext';
import { createReportForIdentity } from '../services/reportService';
import styles from './ResultCard.module.css';

const ResultCard = ({ result, onClick, isMember = false }) => {
  const navigate = useNavigate();
  const { token } = useAuth();
  const [loading, setLoading] = useState(false);

  const handleViewDetails = async (e) => {
    e.stopPropagation(); // Prevent parent onClick if present
    
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
    
    // If this is a member context and user is authenticated, check subscription
    if (isMember && token) {
      setLoading(true);
      try {
        // Check subscription status
        let subscription = null;
        try {
          if (process.env.NODE_ENV === 'development') {
            console.log('[ResultCard] Fetching subscription with token:', token ? 'present' : 'missing');
          }
          subscription = await api.get('/subscription', { token });
          if (process.env.NODE_ENV === 'development') {
            console.log('[ResultCard] Subscription response:', subscription);
          }
        } catch (err) {
          // Subscription not found or error - treat as no subscription
          if (process.env.NODE_ENV === 'development') {
            console.warn('[ResultCard] Failed to fetch subscription:', {
              message: err?.message,
              status: err?.status,
              statusText: err?.statusText,
              data: err?.data
            });
          }
        }
        
        // Check subscription status - handle both direct response and wrapped response
        const subscriptionStatus = subscription?.status || subscription?.data?.status;
        const isActive = subscriptionStatus === 'active';
        
        if (process.env.NODE_ENV === 'development') {
          console.log('[ResultCard] Subscription check:', {
            hasSubscription: !!subscription,
            subscription,
            status: subscriptionStatus,
            isActive
          });
        }
        
        // If user has active subscription, go directly to report detail
        if (isActive) {
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
          if (process.env.NODE_ENV === 'development') {
            console.warn('[ResultCard] No active subscription found, redirecting to payment');
          }
          sessionStorage.setItem('selectedPersonId', result.id);
          navigate('/payment');
        }
      } catch (err) {
        if (process.env.NODE_ENV === 'development') {
          console.warn('[ResultCard] Error checking subscription:', err);
        }
        // On error, default to payment page
        sessionStorage.setItem('selectedPersonId', result.id);
        navigate('/payment');
      } finally {
        setLoading(false);
      }
    } else {
      // Non-member flow: navigate to preview page (which will show teaser and link to signup)
      navigate(`/search/${result.id}`);
    }
  };

  return (
    <div 
      className={styles.card}
      onClick={!onClick ? handleViewDetails : undefined}
    >
      <h3 className={styles.cardTitle}>
        {result.fullName}
      </h3>
      {result.ageRange && (
        <p className={styles.cardInfo}>
          <strong>Age:</strong> {result.ageRange}
        </p>
      )}
      {result.location && (
        <p className={styles.cardInfo}>
          <strong>Location:</strong> {result.location}
        </p>
      )}
      <button
        onClick={handleViewDetails}
        className={styles.cardButton}
        disabled={loading}
      >
        {loading ? 'Loading...' : 'View Full Report'}
      </button>
    </div>
  );
};

export default ResultCard;