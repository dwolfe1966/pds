import React from 'react';
import { useNavigate } from 'react-router-dom';

const ResultCard = ({ result, onClick }) => {
  const navigate = useNavigate();

  const handleViewDetails = (e) => {
    e.stopPropagation(); // Prevent parent onClick if present
    // Store result in sessionStorage for preview/signup pages
    sessionStorage.setItem(`result_${result.id}`, JSON.stringify({
      id: result.id,
      fullName: result.fullName,
      location: result.location,
      ageRange: result.ageRange,
      ...result
    }));
    
    // Navigate to preview page (which will show teaser and link to signup)
    navigate(`/search/${result.id}`);
  };

  return (
    <div style={{ 
      border: '2px solid #ddd', 
      padding: '1.5rem', 
      marginBottom: '1rem', 
      borderRadius: '8px',
      backgroundColor: '#fff',
      transition: 'all 0.2s',
      cursor: 'pointer'
    }}
    onMouseEnter={(e) => {
      e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.1)';
      e.currentTarget.style.borderColor = '#0e123b';
    }}
    onMouseLeave={(e) => {
      e.currentTarget.style.boxShadow = 'none';
      e.currentTarget.style.borderColor = '#ddd';
    }}
    onClick={onClick || handleViewDetails}
    >
      <h3 style={{ 
        margin: 0, 
        color: '#0e123b', 
        marginBottom: '0.75rem',
        fontSize: '1.3rem',
        fontWeight: 'bold'
      }}>
        {result.fullName}
      </h3>
      {result.ageRange && (
        <p style={{ margin: '0.5rem 0', color: '#666', fontSize: '0.95rem' }}>
          <strong>Age:</strong> {result.ageRange}
        </p>
      )}
      {result.location && (
        <p style={{ margin: '0.5rem 0', color: '#666', fontSize: '0.95rem' }}>
          <strong>Location:</strong> {result.location}
        </p>
      )}
      <button
        onClick={handleViewDetails}
        style={{
          marginTop: '1rem',
          padding: '0.75rem 1.5rem',
          backgroundColor: '#0e123b',
          color: '#fff',
          border: 'none',
          borderRadius: '4px',
          cursor: 'pointer',
          fontSize: '1rem',
          fontWeight: 'bold',
          transition: 'background-color 0.2s'
        }}
        onMouseEnter={(e) => e.target.style.backgroundColor = '#1a1f4d'}
        onMouseLeave={(e) => e.target.style.backgroundColor = '#0e123b'}
      >
        View Full Report
      </button>
    </div>
  );
};

export default ResultCard;