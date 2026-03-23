import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import api from '../../api';
import { track } from '../../services/trackingService';
import '../../styles/contentContainer.css';
import styles from './SignupPage.module.css';

/**
 * Sign‑up page collects basic information and creates a new account.
 * Shows a teaser when user comes from a search result.
 */
const SignupPage = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { setToken, setUser } = useAuth();
  
  const [form, setForm] = useState({ fullName: '', zip: '', email: '', password: '', optin: false });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [successRedirectTo, setSuccessRedirectTo] = useState('/dashboard');
  const [selectedPerson, setSelectedPerson] = useState(null);
  const [loadingPerson, setLoadingPerson] = useState(false);

  // Track page entry
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    track('signup_start', {
      source: params.get('selected') ? 'teaser' : 'direct',
      has_selected: !!params.get('selected'),
    });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

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
    const { name, value, type, checked } = e.target;
    setForm((prev) => ({ ...prev, [name]: type === 'checkbox' ? checked : value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    // Client-side validation
    const nameParts = form.fullName.trim().split(/\s+/);
    if (nameParts.length < 2 || !nameParts[1]) {
      setError('Please enter your full name (first and last name).');
      return;
    }
    if (form.password.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }

    setLoading(true);
    try {
      // api.signup() routes to ByteCrtrs billing.signup (user creation) then auto-login.
      // Returns { accessToken, user } — same shape as login.
      const response = await api.signup({
        ...form,
        optin: !!form.optin,
        queryString: window.location.search.replace(/^\?/, '') || undefined,
      });
      console.log('Signup response:', response);
      
      // Set token and user in AuthContext and persist (so payment page has auth)
      if (response.accessToken) {
        const userData = response.user || {
          id: response.user?.id || response.user?._id || response.userId || null,
          email: form.email,
          fullName: form.fullName,
          optin: form.optin,
          role: 'member',
          emailVerified: false,
        };
        setToken(response.accessToken);
        setUser(userData);
        localStorage.setItem('accessToken', response.accessToken);
        localStorage.setItem('user', JSON.stringify(userData));
        if (response.refreshToken) {
          localStorage.setItem('refreshToken', response.refreshToken);
        }
      }

      // Store selected person ID in sessionStorage for payment page
      const params = new URLSearchParams(location.search);
      const selectedPersonId = params.get('selected');
      if (selectedPersonId) {
        sessionStorage.setItem('selectedPersonId', selectedPersonId);
      }

      // Determine redirect destination BEFORE showing success state
      const redirectTo = params.get('redirect') || (selectedPersonId ? '/payment' : '/dashboard');
      const normalizedRedirect = redirectTo.startsWith('/') ? redirectTo : `/${redirectTo}`;
      setSuccessRedirectTo(normalizedRedirect);
      track('signup_complete', { source: 'signup_page' });
      setSuccess(true);

      setTimeout(() => {
        navigate(normalizedRedirect);
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
      <div className={styles.container}>
        <div className={styles.card}>
          <h1 className={styles.title}>Create Your Free Account</h1>

          {/* Teaser block when coming from search result */}
          {selectedPerson && !success && (
            <div className={styles.teaserBox}>
              <h2>Unlock Full Report for {selectedPerson.fullName}</h2>
              <p style={{ fontSize: '0.85rem', color: '#16a34a', fontWeight: 600, margin: '0 0 0.5rem' }}>
                No credit card required to create your account.
              </p>
              <p>
                You're one step away from the complete report for <strong>{selectedPerson.fullName}</strong>
                {selectedPerson.location && ` from ${selectedPerson.location}`}.
                {selectedPerson.ageRange && ` Age: ${selectedPerson.ageRange}`}
              </p>
              <div className={styles.teaserUnlockBox}>
                <p>Sign up now to unlock:</p>
                <ul>
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

          {!selectedPerson && !success && (
            <p className={styles.subtitle}>
              Unlock full access to detailed reports and monitor who&apos;s searching for you.
              <span style={{ display: 'block', marginTop: '0.375rem', fontSize: '0.85rem', color: '#16a34a', fontWeight: 600 }}>
                No credit card required.
              </span>
            </p>
          )}

          {success ? (
            <div className={styles.successMsg}>
              <h2>Thank you for signing up!</h2>
              <p>
                Account created successfully!{' '}
                {successRedirectTo === '/dashboard'
                  ? 'Redirecting to your dashboard…'
                  : 'Redirecting to complete your purchase…'}
              </p>
              {selectedPerson && (
                <p>Complete your purchase to view the full report for {selectedPerson.fullName}.</p>
              )}
            </div>
          ) : (
            <form onSubmit={handleSubmit}>
              <div className={styles.formGroup}>
                <label className={styles.label} htmlFor="fullName">Full Name *</label>
                <input
                  id="fullName"
                  type="text"
                  name="fullName"
                  value={form.fullName}
                  onChange={handleChange}
                  required
                  className={styles.input}
                />
              </div>
              <div className={styles.formGroup}>
                <label className={styles.label} htmlFor="zip">ZIP Code</label>
                <input
                  id="zip"
                  type="text"
                  name="zip"
                  value={form.zip}
                  onChange={handleChange}
                  className={styles.input}
                />
              </div>
              <div className={styles.formGroup}>
                <label className={styles.label} htmlFor="email">Email *</label>
                <input
                  id="email"
                  type="email"
                  name="email"
                  value={form.email}
                  onChange={handleChange}
                  required
                  className={styles.input}
                />
              </div>
              <div className={styles.formGroup}>
                <label className={styles.label} htmlFor="password">Password *</label>
                <input
                  id="password"
                  type="password"
                  name="password"
                  value={form.password}
                  onChange={handleChange}
                  required
                  className={styles.input}
                />
              </div>
              <label className={styles.optinRow}>
                <input
                  type="checkbox"
                  name="optin"
                  checked={form.optin}
                  onChange={handleChange}
                />
                <span>I agree to receive marketing communications and emails</span>
              </label>
              {error && (
                <div className={styles.errorMsg}>
                  <p><strong>Error:</strong></p>
                  <p>{error}</p>
                </div>
              )}
              <button type="submit" disabled={loading} className={styles.submitBtn}>
                {loading ? 'Creating account…' : 'Create My Free Account'}
              </button>
              <p className={styles.loginLink}>
                Already have an account? <a href="/login">Log in</a>
              </p>
            </form>
          )}
        </div>
      </div>
    </main>
  );
};

export default SignupPage;