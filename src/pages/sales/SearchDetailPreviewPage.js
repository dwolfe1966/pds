import React, { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';

/**
 * Preview page that shows a truncated preview of a search result.
 * Mimics the privaterecords.net flow - shows teaser and encourages signup.
 * When a user clicks on a result in the logged-out state, they land here.
 */
const SearchDetailPreviewPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [person, setPerson] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Get person data from sessionStorage
    const storedPerson = sessionStorage.getItem(`result_${id}`);
    if (storedPerson) {
      try {
        setPerson(JSON.parse(storedPerson));
      } catch (err) {
        console.error('Error parsing stored person:', err);
      }
    }
    setLoading(false);
  }, [id]);

  const handleSignup = () => {
    // Navigate to signup with person info
    const params = new URLSearchParams({
      selected: id,
      personName: person?.fullName || '',
      personLocation: person?.location || '',
      personAge: person?.ageRange || ''
    });
    navigate(`/signup?${params.toString()}`);
  };

  if (loading) {
    return (
      <main style={{ padding: '2rem', textAlign: 'center' }}>
        <p>Loading...</p>
      </main>
    );
  }

  if (!person) {
    return (
      <main style={{ padding: '2rem', textAlign: 'center' }}>
        <p>Person not found. Please try searching again.</p>
        <Link to="/name/landing" style={{ color: '#0d5d2f' }}>Back to Search</Link>
      </main>
    );
  }

  return (
    <main style={{ 
      padding: '3rem 2rem',
      maxWidth: '1000px',
      margin: '0 auto',
      minHeight: '60vh'
    }}>
      {/* Header */}
      <div style={{ marginBottom: '2rem' }}>
        <Link 
          to="/name/search-result" 
          style={{ 
            color: '#0d5d2f', 
            textDecoration: 'none',
            fontSize: '0.95rem',
            marginBottom: '1rem',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.5rem',
            fontWeight: 500,
            transition: 'color 0.2s ease'
          }}
          onMouseEnter={(e) => e.target.style.color = '#1a7a4a'}
          onMouseLeave={(e) => e.target.style.color = '#0d5d2f'}
        >
          ← Back to Results
        </Link>
        <h1 style={{ 
          color: '#0d5d2f', 
          marginTop: '1rem',
          marginBottom: '0.5rem',
          fontSize: '2.5rem',
          fontWeight: 700,
          letterSpacing: '-0.02em'
        }}>
          {person.fullName}
        </h1>
        {person.location && (
          <p style={{ 
            color: '#6b7280', 
            fontSize: '1.125rem', 
            marginBottom: '2rem',
            lineHeight: 1.5
          }}>
            {person.location}
            {person.ageRange && <span style={{ color: '#9ca3af' }}> • Age: {person.ageRange}</span>}
          </p>
        )}
      </div>

      {/* Preview/Teaser Section */}
      <div style={{ 
        backgroundColor: '#f9fafb',
        padding: '2.5rem',
        borderRadius: '0.75rem',
        marginBottom: '2rem',
        border: '1px solid #e5e7eb',
        boxShadow: '0 2px 4px rgba(0, 0, 0, 0.05)'
      }}>
        <h2 style={{ 
          color: '#0d5d2f', 
          marginTop: 0,
          marginBottom: '1rem',
          fontSize: '1.875rem',
          fontWeight: 700
        }}>
          Preview Report
        </h2>
        <p style={{ 
          color: '#6b7280', 
          lineHeight: 1.6, 
          marginBottom: '2rem',
          fontSize: '1.125rem'
        }}>
            This is a preview of the information available for <strong style={{ color: '#0d5d2f' }}>{person.fullName}</strong>.
          Sign up to view the complete report with full details.
        </p>

        {/* Available Information Grid */}
        <div style={{ 
          backgroundColor: '#fff',
          padding: '2rem',
          borderRadius: '0.5rem',
          border: '1px solid #e5e7eb',
          marginBottom: '2rem'
        }}>
          <h3 style={{ 
            color: '#0d5d2f', 
            marginTop: 0,
            marginBottom: '1.5rem',
            fontSize: '1.25rem',
            fontWeight: 600
          }}>
            Available Information
          </h3>
          <div style={{ 
            display: 'grid', 
            gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', 
            gap: '1rem' 
          }}>
            {[
              { label: 'Basic Information', available: true },
              { label: 'Contact Details', available: false },
              { label: 'Address History', available: false },
              { label: 'Phone Numbers', available: false },
              { label: 'Email Addresses', available: false },
              { label: 'Relatives & Family', available: false },
              { label: 'Social Media Profiles', available: false },
              { label: 'Public Records', available: false },
            ].map((item, index) => (
              <div
                key={index}
                style={{
                  padding: '0.75rem',
                  backgroundColor: item.available ? '#f0fdf4' : '#f9fafb',
                  borderRadius: '0.375rem',
                  border: `1px solid ${item.available ? '#86efac' : '#e5e7eb'}`
                }}
              >
                <p style={{ 
                  color: item.available ? '#166534' : '#9ca3af', 
                  margin: 0, 
                  fontSize: '0.95rem',
                  fontWeight: item.available ? 600 : 400
                }}>
                  {item.available ? '✓' : '🔒'} {item.label}
                </p>
              </div>
            ))}
          </div>
        </div>

        {/* CTA Section */}
        <div style={{ 
          background: 'linear-gradient(135deg, #0d5d2f 0%, #1a7a4a 100%)',
          color: '#fff',
          padding: '2.5rem',
          borderRadius: '0.75rem',
          textAlign: 'center',
          boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)'
        }}>
          <h3 style={{ 
            marginTop: 0,
            marginBottom: '1rem',
            fontSize: '1.5rem',
            fontWeight: 700
          }}>
            Unlock Full Report
          </h3>
          <p style={{ 
            marginBottom: '2rem',
            lineHeight: 1.6,
            fontSize: '1.125rem',
            color: 'rgba(255, 255, 255, 0.9)',
            maxWidth: '600px',
            margin: '0 auto 2rem auto'
          }}>
            Sign up now to access the complete report for <strong>{person.fullName}</strong>.
            Get instant access to contact information, addresses, relatives, and more.
          </p>
          <div style={{ 
            display: 'flex', 
            gap: '1rem', 
            justifyContent: 'center', 
            flexWrap: 'wrap' 
          }}>
            <button
              onClick={handleSignup}
              style={{
                padding: '1rem 2.5rem',
                backgroundColor: '#fff',
                color: '#0d5d2f',
                border: 'none',
                borderRadius: '0.5rem',
                cursor: 'pointer',
                fontSize: '1.125rem',
                fontWeight: 600,
                transition: 'all 0.2s ease',
                boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)'
              }}
              onMouseEnter={(e) => {
                e.target.style.backgroundColor = '#f9fafb';
                e.target.style.transform = 'translateY(-2px)';
                e.target.style.boxShadow = '0 6px 12px rgba(0, 0, 0, 0.15)';
              }}
              onMouseLeave={(e) => {
                e.target.style.backgroundColor = '#fff';
                e.target.style.transform = 'translateY(0)';
                e.target.style.boxShadow = '0 4px 6px rgba(0, 0, 0, 0.1)';
              }}
            >
              Sign Up to View Full Report
            </button>
            <Link
              to="/login"
              style={{
                padding: '1rem 2.5rem',
                backgroundColor: 'transparent',
                color: '#fff',
                border: '2px solid #fff',
                borderRadius: '0.5rem',
                textDecoration: 'none',
                fontSize: '1.125rem',
                fontWeight: 600,
                display: 'inline-block',
                transition: 'all 0.2s ease'
              }}
              onMouseEnter={(e) => {
                e.target.style.backgroundColor = 'rgba(255, 255, 255, 0.1)';
                e.target.style.transform = 'translateY(-2px)';
              }}
              onMouseLeave={(e) => {
                e.target.style.backgroundColor = 'transparent';
                e.target.style.transform = 'translateY(0)';
              }}
            >
              Already have an account? Log In
            </Link>
          </div>
        </div>
      </div>

      {/* Additional Info */}
      <div style={{ 
        padding: '2rem',
        backgroundColor: '#f0f7ff',
        borderRadius: '0.75rem',
        border: '1px solid #bfdbfe'
      }}>
        <h3 style={{ 
          color: '#0d5d2f', 
          marginTop: 0,
          marginBottom: '1rem',
          fontSize: '1.25rem',
          fontWeight: 600
        }}>
          What's Included in the Full Report?
        </h3>
        <ul style={{ 
          color: '#374151', 
          lineHeight: 1.8, 
          paddingLeft: '1.5rem',
          margin: 0,
          fontSize: '1rem'
        }}>
          <li>Complete contact information (phone numbers, email addresses)</li>
          <li>Current and previous addresses with dates</li>
          <li>Family members and relatives</li>
          <li>Social media profiles and online presence</li>
          <li>Public records and background information</li>
          <li>Associated records and connections</li>
        </ul>
      </div>
    </main>
  );
};

export default SearchDetailPreviewPage;