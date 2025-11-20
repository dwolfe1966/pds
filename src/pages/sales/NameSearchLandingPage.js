import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';

/**
 * Name search landing page - Entry point for name searches.
 * Mimics the privaterecords.net/name/landing flow with IDLookup design.
 */
const NameSearchLandingPage = () => {
  const navigate = useNavigate();
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [zip, setZip] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!firstName.trim() || !lastName.trim()) {
      return;
    }
    
    // Navigate to loader page which will perform the search
    const params = new URLSearchParams();
    params.set('firstName', firstName.trim());
    params.set('lastName', lastName.trim());
    if (zip.trim()) {
      params.set('zip', zip.trim());
    }
    navigate(`/name/loader?${params.toString()}`);
  };

  return (
    <main style={{ 
      padding: '3rem 2rem', 
      maxWidth: '900px', 
      margin: '0 auto',
      minHeight: '60vh',
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'center'
    }}>
      <div style={{ textAlign: 'center', marginBottom: '3rem' }}>
        <h1 style={{ 
          color: '#0e123b', 
          marginBottom: '1rem', 
          fontSize: '2.5rem',
          fontWeight: 'bold'
        }}>
          Search by Name
        </h1>
        <p style={{ 
          color: '#666', 
          fontSize: '1.2rem', 
          lineHeight: '1.6', 
          marginBottom: '2rem',
          maxWidth: '600px',
          margin: '0 auto 2rem auto'
        }}>
          Enter a first and last name to search our comprehensive database of public records.
        </p>
      </div>

      <form onSubmit={handleSubmit} style={{ 
        maxWidth: '600px', 
        margin: '0 auto',
        backgroundColor: '#fff',
        padding: '2rem',
        borderRadius: '8px',
        boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
      }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
          <div>
            <label style={{ 
              display: 'block', 
              marginBottom: '0.5rem', 
              color: '#333', 
              fontWeight: 'bold',
              fontSize: '0.95rem'
            }}>
              First Name *
            </label>
            <input
              type="text"
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              placeholder="First Name"
              required
              style={{ 
                width: '100%', 
                padding: '0.75rem', 
                fontSize: '1rem', 
                border: '2px solid #ddd', 
                borderRadius: '4px',
                boxSizing: 'border-box'
              }}
            />
          </div>
          <div>
            <label style={{ 
              display: 'block', 
              marginBottom: '0.5rem', 
              color: '#333', 
              fontWeight: 'bold',
              fontSize: '0.95rem'
            }}>
              Last Name *
            </label>
            <input
              type="text"
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              placeholder="Last Name"
              required
              style={{ 
                width: '100%', 
                padding: '0.75rem', 
                fontSize: '1rem', 
                border: '2px solid #ddd', 
                borderRadius: '4px',
                boxSizing: 'border-box'
              }}
            />
          </div>
        </div>
        
        <div style={{ marginBottom: '1.5rem' }}>
          <label style={{ 
            display: 'block', 
            marginBottom: '0.5rem', 
            color: '#333', 
            fontWeight: 'bold',
            fontSize: '0.95rem'
          }}>
            ZIP Code (Optional)
          </label>
          <input
            type="text"
            value={zip}
            onChange={(e) => setZip(e.target.value)}
            placeholder="ZIP Code"
            pattern="[0-9]{5}"
            maxLength="5"
            style={{ 
              width: '100%', 
              padding: '0.75rem', 
              fontSize: '1rem', 
              border: '2px solid #ddd', 
              borderRadius: '4px',
              boxSizing: 'border-box'
            }}
          />
        </div>

        <button
          type="submit"
          style={{
            width: '100%',
            padding: '1rem',
            backgroundColor: '#0e123b',
            color: '#fff',
            border: 'none',
            borderRadius: '4px',
            fontSize: '1.1rem',
            fontWeight: 'bold',
            cursor: 'pointer',
            transition: 'background-color 0.2s'
          }}
          onMouseOver={(e) => e.target.style.backgroundColor = '#1a1f4d'}
          onMouseOut={(e) => e.target.style.backgroundColor = '#0e123b'}
        >
          Search Now
        </button>
      </form>

      <div style={{ 
        marginTop: '3rem', 
        padding: '2rem', 
        backgroundColor: '#f5f5f5', 
        borderRadius: '8px',
        maxWidth: '600px',
        margin: '3rem auto 0 auto'
      }}>
        <h3 style={{ color: '#0e123b', marginTop: 0, marginBottom: '1rem' }}>
          What You'll Find
        </h3>
        <div style={{ 
          display: 'grid', 
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', 
          gap: '1rem' 
        }}>
          <div>
            <p style={{ color: '#666', margin: 0, lineHeight: '1.6' }}>
              <strong style={{ color: '#0e123b' }}>Contact Info</strong><br />
              Phone numbers, email addresses
            </p>
          </div>
          <div>
            <p style={{ color: '#666', margin: 0, lineHeight: '1.6' }}>
              <strong style={{ color: '#0e123b' }}>Addresses</strong><br />
              Current and previous locations
            </p>
          </div>
          <div>
            <p style={{ color: '#666', margin: 0, lineHeight: '1.6' }}>
              <strong style={{ color: '#0e123b' }}>Relatives</strong><br />
              Family connections
            </p>
          </div>
          <div>
            <p style={{ color: '#666', margin: 0, lineHeight: '1.6' }}>
              <strong style={{ color: '#0e123b' }}>Public Records</strong><br />
              Background information
            </p>
          </div>
        </div>
      </div>
    </main>
  );
};

export default NameSearchLandingPage;

