import React from 'react';
import { useNavigate } from 'react-router-dom';

const ResultCard = ({ result }) => {
  const navigate = useNavigate();

  const handleViewDetails = () => {
    // Store result in sessionStorage for signup page
    sessionStorage.setItem(`result_${result.id}`, JSON.stringify({
      fullName: result.fullName,
      location: result.location,
      ageRange: result.ageRange
    }));
    
    // Navigate to signup with person info in URL
    const params = new URLSearchParams({
      selected: result.id,
      personName: result.fullName,
      personLocation: result.location || '',
      personAge: result.ageRange || ''
    });
    navigate(`/signup?${params.toString()}`);
  };

  return (
    <div style={{ 
      border: '1px solid #ccc', 
      padding: '1.5rem', 
      marginBottom: '1rem', 
      borderRadius: '4px',
      transition: 'box-shadow 0.2s',
      cursor: 'pointer'
    }}
    onMouseEnter={(e) => e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,0.1)'}
    onMouseLeave={(e) => e.currentTarget.style.boxShadow = 'none'}
    >
      <h3 style={{ margin: 0, color: '#0e123b', marginBottom: '0.5rem' }}>{result.fullName}</h3>
      <p style={{ margin: '0.5rem 0', color: '#666' }}>Age: {result.ageRange}</p>
      <p style={{ margin: '0.5rem 0', color: '#666' }}>Location: {result.location}</p>
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
          fontWeight: 'bold'
        }}
      >
        View Full Report
      </button>
    </div>
  );
};

export default ResultCard;