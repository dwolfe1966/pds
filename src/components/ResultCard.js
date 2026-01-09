import React from 'react';
import { useNavigate } from 'react-router-dom';
import { setIdentityContext, getSearchContext } from '../services/searchContext';
import styles from './ResultCard.module.css';

const ResultCard = ({ result, onClick }) => {
  const navigate = useNavigate();

  const handleViewDetails = async (e) => {
    e.stopPropagation(); // Prevent parent onClick if present
    
    // Get current search context
    const searchContext = getSearchContext();
    
    // Store identity context for report creation
    if (result.extId && searchContext) {
      setIdentityContext(result, searchContext);
    }
    
    // Store result in sessionStorage for preview/signup pages
    sessionStorage.setItem(`result_${result.id}`, JSON.stringify({
      id: result.id,
      extId: result.extId,
      fullName: result.fullName,
      location: result.location,
      ageRange: result.ageRange,
      provider: result.provider,
      ...result
    }));
    
    // Navigate to preview page (which will show teaser and link to signup)
    navigate(`/search/${result.id}`);
  };

  return (
    <div 
      className={styles.card}
      onClick={onClick || handleViewDetails}
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
      >
        View Full Report
      </button>
    </div>
  );
};

export default ResultCard;