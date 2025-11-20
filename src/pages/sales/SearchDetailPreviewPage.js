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
        <Link to="/name/landing" style={{ color: '#0e123b' }}>Back to Search</Link>
      </main>
    );
  }

  return (
    <main style={{ 
      padding: '2rem',
      maxWidth: '900px',
      margin: '0 auto'
    }}>
      <div style={{ marginBottom: '2rem' }}>
        <Link 
          to="/name/search-result" 
          style={{ 
            color: '#0e123b', 
            textDecoration: 'none',
            fontSize: '0.95rem',
            marginBottom: '1rem',
            display: 'inline-block'
          }}
        >
          ← Back to Results
        </Link>
        <h1 style={{ 
          color: '#0e123b', 
          marginTop: '1rem',
          marginBottom: '0.5rem',
          fontSize: '2rem'
        }}>
          {person.fullName}
        </h1>
        {person.location && (
          <p style={{ color: '#666', fontSize: '1rem', marginBottom: '2rem' }}>
            {person.location}
            {person.ageRange && ` • Age: ${person.ageRange}`}
          </p>
        )}
      </div>

      {/* Preview/Teaser Section */}
      <div style={{ 
        backgroundColor: '#f5f5f5',
        padding: '2rem',
        borderRadius: '8px',
        marginBottom: '2rem',
        border: '2px solid #ddd'
      }}>
        <h2 style={{ 
          color: '#0e123b', 
          marginTop: 0,
          marginBottom: '1rem',
          fontSize: '1.5rem'
        }}>
          Preview Report
        </h2>
        <p style={{ color: '#666', lineHeight: '1.6', marginBottom: '1.5rem' }}>
          This is a preview of the information available for <strong>{person.fullName}</strong>.
          Sign up to view the complete report with full details.
        </p>

        <div style={{ 
          backgroundColor: '#fff',
          padding: '1.5rem',
          borderRadius: '4px',
          border: '1px solid #ddd',
          marginBottom: '1.5rem'
        }}>
          <h3 style={{ 
            color: '#0e123b', 
            marginTop: 0,
            marginBottom: '1rem',
            fontSize: '1.2rem'
          }}>
            Available Information (Preview)
          </h3>
          <div style={{ 
            display: 'grid', 
            gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', 
            gap: '1rem' 
          }}>
            <div>
              <p style={{ color: '#666', margin: '0.5rem 0', fontSize: '0.95rem' }}>
                <strong style={{ color: '#0e123b' }}>✓</strong> Basic Information
              </p>
            </div>
            <div>
              <p style={{ color: '#999', margin: '0.5rem 0', fontSize: '0.95rem' }}>
                <strong style={{ color: '#999' }}>🔒</strong> Contact Details
              </p>
            </div>
            <div>
              <p style={{ color: '#999', margin: '0.5rem 0', fontSize: '0.95rem' }}>
                <strong style={{ color: '#999' }}>🔒</strong> Address History
              </p>
            </div>
            <div>
              <p style={{ color: '#999', margin: '0.5rem 0', fontSize: '0.95rem' }}>
                <strong style={{ color: '#999' }}>🔒</strong> Phone Numbers
              </p>
            </div>
            <div>
              <p style={{ color: '#999', margin: '0.5rem 0', fontSize: '0.95rem' }}>
                <strong style={{ color: '#999' }}>🔒</strong> Email Addresses
              </p>
            </div>
            <div>
              <p style={{ color: '#999', margin: '0.5rem 0', fontSize: '0.95rem' }}>
                <strong style={{ color: '#999' }}>🔒</strong> Relatives & Family
              </p>
            </div>
            <div>
              <p style={{ color: '#999', margin: '0.5rem 0', fontSize: '0.95rem' }}>
                <strong style={{ color: '#999' }}>🔒</strong> Social Media Profiles
              </p>
            </div>
            <div>
              <p style={{ color: '#999', margin: '0.5rem 0', fontSize: '0.95rem' }}>
                <strong style={{ color: '#999' }}>🔒</strong> Public Records
              </p>
            </div>
          </div>
        </div>

        <div style={{ 
          backgroundColor: '#0e123b',
          color: '#fff',
          padding: '2rem',
          borderRadius: '8px',
          textAlign: 'center'
        }}>
          <h3 style={{ 
            marginTop: 0,
            marginBottom: '1rem',
            fontSize: '1.3rem'
          }}>
            Unlock Full Report
          </h3>
          <p style={{ 
            marginBottom: '1.5rem',
            lineHeight: '1.6',
            fontSize: '1rem'
          }}>
            Sign up now to access the complete report for <strong>{person.fullName}</strong>.
            Get instant access to contact information, addresses, relatives, and more.
          </p>
          <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center', flexWrap: 'wrap' }}>
            <button
              onClick={handleSignup}
              style={{
                padding: '1rem 2rem',
                backgroundColor: '#fff',
                color: '#0e123b',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
                fontSize: '1.1rem',
                fontWeight: 'bold',
                transition: 'background-color 0.2s'
              }}
              onMouseEnter={(e) => e.target.style.backgroundColor = '#f5f5f5'}
              onMouseLeave={(e) => e.target.style.backgroundColor = '#fff'}
            >
              Sign Up to View Full Report
            </button>
            <Link
              to="/login"
              style={{
                padding: '1rem 2rem',
                backgroundColor: 'transparent',
                color: '#fff',
                border: '2px solid #fff',
                borderRadius: '4px',
                textDecoration: 'none',
                fontSize: '1.1rem',
                fontWeight: 'bold',
                display: 'inline-block',
                transition: 'background-color 0.2s'
              }}
              onMouseEnter={(e) => e.target.style.backgroundColor = 'rgba(255,255,255,0.1)'}
              onMouseLeave={(e) => e.target.style.backgroundColor = 'transparent'}
            >
              Already have an account? Log In
            </Link>
          </div>
        </div>
      </div>

      {/* Additional Info */}
      <div style={{ 
        padding: '1.5rem',
        backgroundColor: '#f0f7ff',
        borderRadius: '8px',
        border: '1px solid #0e123b'
      }}>
        <h3 style={{ 
          color: '#0e123b', 
          marginTop: 0,
          marginBottom: '1rem'
        }}>
          What's Included in the Full Report?
        </h3>
        <ul style={{ 
          color: '#666', 
          lineHeight: '1.8', 
          paddingLeft: '1.5rem',
          margin: 0
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