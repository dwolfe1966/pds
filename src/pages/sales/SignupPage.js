import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import api from '../../api';
import '../../styles/contentContainer.css';

/**
 * Sign‑up page collects basic information and creates a new account.
 * Shows a teaser when user comes from a search result.
 */
const SignupPage = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { setToken, setUser } = useAuth();
  
  const [form, setForm] = useState({ fullName: '', zip: '', email: '', password: '' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [selectedPerson, setSelectedPerson] = useState(null);
  const [loadingPerson, setLoadingPerson] = useState(false);

  // Fetch selected person details if coming from search result
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const selectedPersonId = params.get('selected');
    
    const fetchSelectedPerson = async () => {
      if (!selectedPersonId) return;
      
      setLoadingPerson(true);
      try {
        // Since we don't have a public endpoint to get person by ID,
        // we'll need to get it from the search results or store it in sessionStorage
        // For now, let's check if we can get it from the search results
        // The person info should be passed via URL params or stored in sessionStorage
        const storedResult = sessionStorage.getItem(`result_${selectedPersonId}`);
        if (storedResult) {
          setSelectedPerson(JSON.parse(storedResult));
        } else {
          // Try to get from URL params if passed
          const personName = params.get('personName');
          const personLocation = params.get('personLocation');
          const personAge = params.get('personAge');
          if (personName) {
            setSelectedPerson({
              fullName: personName,
              location: personLocation || '',
              ageRange: personAge || ''
            });
          }
        }
      } catch (err) {
        console.error('Error fetching person details:', err);
      } finally {
        setLoadingPerson(false);
      }
    };

    fetchSelectedPerson();
  }, [location.search]);

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      console.log('Submitting signup form:', { email: form.email, fullName: form.fullName });
      const response = await api.signup(form);
      console.log('Signup response:', response);
      
      // Set token and user in AuthContext
      if (response.accessToken) {
        setToken(response.accessToken);
        setUser(response.user || { 
          email: form.email, 
          fullName: form.fullName, 
          role: 'member',
          emailVerified: response.user?.emailVerified || false
        });
      }
      
      setSuccess(true);
      
      // Store selected person ID in sessionStorage for payment page
      const params = new URLSearchParams(location.search);
      const selectedPersonId = params.get('selected');
      if (selectedPersonId) {
        sessionStorage.setItem('selectedPersonId', selectedPersonId);
      }
      
      // Redirect to payment page after a brief delay
      setTimeout(() => {
        navigate('/payment');
      }, 2000);
    } catch (err) {
      console.error('Signup error:', err);
      setError(err.message || 'An error occurred during signup. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="pageBackground">
      <div className="contentContainer contentContainerNarrow">
      <h1 style={{ color: '#0e123b', marginBottom: '1rem' }}>Create your account</h1>
      
      {/* Teaser block when coming from search result */}
      {selectedPerson && !success && (
        <div style={{ 
          padding: '1.5rem', 
          backgroundColor: '#f0f7ff', 
          border: '2px solid #0d5d2f',
          borderRadius: '8px', 
          marginBottom: '2rem' 
        }}>
          <h2 style={{ color: '#0e123b', marginTop: 0, marginBottom: '0.5rem', fontSize: '1.3rem' }}>
            View Full Report for {selectedPerson.fullName}
          </h2>
          <p style={{ color: '#666', marginBottom: '1rem', lineHeight: '1.6' }}>
            You're viewing a preview for <strong>{selectedPerson.fullName}</strong>
            {selectedPerson.location && ` from ${selectedPerson.location}`}.
            {selectedPerson.ageRange && ` Age: ${selectedPerson.ageRange}`}
          </p>
          <div style={{ 
            padding: '1rem', 
            backgroundColor: '#fff', 
            borderRadius: '4px',
            border: '1px solid #ddd'
          }}>
            <p style={{ margin: 0, color: '#333', fontWeight: 'bold', marginBottom: '0.5rem' }}>
              Sign up now to unlock:
            </p>
            <ul style={{ margin: 0, paddingLeft: '1.5rem', color: '#666', lineHeight: '1.8' }}>
              <li>Complete contact information</li>
              <li>Address history and current location</li>
              <li>Phone numbers and email addresses</li>
              <li>Relatives and family connections</li>
              <li>Social media profiles</li>
              <li>Public records and background information</li>
            </ul>
          </div>
        </div>
      )}
      
      {!selectedPerson && (
        <p style={{ marginBottom: '2rem', color: '#666', lineHeight: '1.6' }}>
          Sign up to unlock full access to detailed reports and monitor who's searching for you.
        </p>
      )}
      {success ? (
        <div style={{ padding: '2rem', backgroundColor: '#e8f5e9', borderRadius: '4px', textAlign: 'center' }}>
          <h2 style={{ color: '#0e123b', marginBottom: '1rem' }}>Thank you for signing up!</h2>
          <p style={{ color: '#666', lineHeight: '1.6', marginBottom: '1rem' }}>
            Account created successfully! Redirecting to payment...
          </p>
          {selectedPerson && (
            <p style={{ color: '#666', lineHeight: '1.6', marginBottom: '1rem', fontSize: '0.9rem' }}>
              Complete your purchase to view the full report for {selectedPerson.fullName}.
            </p>
          )}
        </div>
      ) : (
        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: '1.5rem' }}>
            <label style={{ display: 'block', marginBottom: '0.5rem', color: '#333', fontWeight: 'bold' }}>
              Full Name *
            </label>
            <input
              type="text"
              name="fullName"
              value={form.fullName}
              onChange={handleChange}
              required
              style={{ width: '100%', padding: '0.75rem', fontSize: '1rem', border: '1px solid #ccc', borderRadius: '4px' }}
            />
          </div>
          <div style={{ marginBottom: '1.5rem' }}>
            <label style={{ display: 'block', marginBottom: '0.5rem', color: '#333', fontWeight: 'bold' }}>
              ZIP Code
            </label>
            <input
              type="text"
              name="zip"
              value={form.zip}
              onChange={handleChange}
              style={{ width: '100%', padding: '0.75rem', fontSize: '1rem', border: '1px solid #ccc', borderRadius: '4px' }}
            />
          </div>
          <div style={{ marginBottom: '1.5rem' }}>
            <label style={{ display: 'block', marginBottom: '0.5rem', color: '#333', fontWeight: 'bold' }}>
              Email *
            </label>
            <input
              type="email"
              name="email"
              value={form.email}
              onChange={handleChange}
              required
              style={{ width: '100%', padding: '0.75rem', fontSize: '1rem', border: '1px solid #ccc', borderRadius: '4px' }}
            />
          </div>
          <div style={{ marginBottom: '1.5rem' }}>
            <label style={{ display: 'block', marginBottom: '0.5rem', color: '#333', fontWeight: 'bold' }}>
              Password *
            </label>
            <input
              type="password"
              name="password"
              value={form.password}
              onChange={handleChange}
              required
              style={{ width: '100%', padding: '0.75rem', fontSize: '1rem', border: '1px solid #ccc', borderRadius: '4px' }}
            />
          </div>
          {error && (
            <div style={{ padding: '1rem', backgroundColor: '#fee', color: '#c00', borderRadius: '4px', marginBottom: '1rem' }}>
              <p style={{ margin: 0, fontWeight: 'bold' }}>Error:</p>
              <p style={{ margin: '0.5rem 0 0 0' }}>{error}</p>
              <p style={{ margin: '0.5rem 0 0 0', fontSize: '0.9rem', color: '#a00' }}>
                Please check that the server is running on http://localhost:3001
              </p>
            </div>
          )}
          <button
            type="submit"
            disabled={loading}
            style={{
              width: '100%',
              padding: '0.75rem',
              backgroundColor: loading ? '#999' : '#0d5d2f',
              color: '#fff',
              border: 'none',
              borderRadius: '4px',
              cursor: loading ? 'not-allowed' : 'pointer',
              fontSize: '1rem',
              fontWeight: 'bold'
            }}
          >
            {loading ? 'Signing up…' : 'Sign Up'}
          </button>
          <p style={{ marginTop: '1rem', textAlign: 'center', color: '#666' }}>
            Already have an account? <a href="/login" style={{ color: '#0e123b' }}>Log in</a>
          </p>
        </form>
      )}
      </div>
    </main>
  );
};

export default SignupPage;