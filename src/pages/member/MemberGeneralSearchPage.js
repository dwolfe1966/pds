import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import api from '../../api';
import { setSearchContext } from '../../services/searchContext';
import { createReportForPhone } from '../../services/reportService';

/**
 * General search page for authenticated members.
 * Mimics /search/all but navigates to member results pages.
 * Allows members to search by name, phone, or email with tabbed interface.
 */
const MemberGeneralSearchPage = () => {
  const navigate = useNavigate();
  const { token } = useAuth();
  const [activeTab, setActiveTab] = useState('name'); // 'name', 'phone', or 'email'
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  
  // Name search state
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [state, setState] = useState('');
  
  // Phone search state
  const [phone, setPhone] = useState('');
  
  // Email search state
  const [email, setEmail] = useState('');

  const usStates = [
    { value: '', label: 'Select State (Optional)' },
    { value: 'AL', label: 'Alabama' },
    { value: 'AK', label: 'Alaska' },
    { value: 'AZ', label: 'Arizona' },
    { value: 'AR', label: 'Arkansas' },
    { value: 'CA', label: 'California' },
    { value: 'CO', label: 'Colorado' },
    { value: 'CT', label: 'Connecticut' },
    { value: 'DE', label: 'Delaware' },
    { value: 'FL', label: 'Florida' },
    { value: 'GA', label: 'Georgia' },
    { value: 'HI', label: 'Hawaii' },
    { value: 'ID', label: 'Idaho' },
    { value: 'IL', label: 'Illinois' },
    { value: 'IN', label: 'Indiana' },
    { value: 'IA', label: 'Iowa' },
    { value: 'KS', label: 'Kansas' },
    { value: 'KY', label: 'Kentucky' },
    { value: 'LA', label: 'Louisiana' },
    { value: 'ME', label: 'Maine' },
    { value: 'MD', label: 'Maryland' },
    { value: 'MA', label: 'Massachusetts' },
    { value: 'MI', label: 'Michigan' },
    { value: 'MN', label: 'Minnesota' },
    { value: 'MS', label: 'Mississippi' },
    { value: 'MO', label: 'Missouri' },
    { value: 'MT', label: 'Montana' },
    { value: 'NE', label: 'Nebraska' },
    { value: 'NV', label: 'Nevada' },
    { value: 'NH', label: 'New Hampshire' },
    { value: 'NJ', label: 'New Jersey' },
    { value: 'NM', label: 'New Mexico' },
    { value: 'NY', label: 'New York' },
    { value: 'NC', label: 'North Carolina' },
    { value: 'ND', label: 'North Dakota' },
    { value: 'OH', label: 'Ohio' },
    { value: 'OK', label: 'Oklahoma' },
    { value: 'OR', label: 'Oregon' },
    { value: 'PA', label: 'Pennsylvania' },
    { value: 'RI', label: 'Rhode Island' },
    { value: 'SC', label: 'South Carolina' },
    { value: 'SD', label: 'South Dakota' },
    { value: 'TN', label: 'Tennessee' },
    { value: 'TX', label: 'Texas' },
    { value: 'UT', label: 'Utah' },
    { value: 'VT', label: 'Vermont' },
    { value: 'VA', label: 'Virginia' },
    { value: 'WA', label: 'Washington' },
    { value: 'WV', label: 'West Virginia' },
    { value: 'WI', label: 'Wisconsin' },
    { value: 'WY', label: 'Wyoming' },
  ];

  // Normalize phone number (remove non-digits)
  const normalizePhone = (value) => {
    return value.replace(/\D/g, '');
  };

  // Format phone number for display
  const formatPhone = (value) => {
    const digits = normalizePhone(value);
    if (digits.length <= 3) return digits;
    if (digits.length <= 6) return `(${digits.slice(0, 3)}) ${digits.slice(3)}`;
    return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6, 10)}`;
  };

  const handlePhoneChange = (e) => {
    const value = e.target.value;
    const digits = normalizePhone(value);
    // Limit to 10 digits
    if (digits.length <= 10) {
      setPhone(digits);
    }
  };


  const handleNameSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (!firstName.trim() || !lastName.trim()) {
      setError('Please enter both first and last name');
      return;
    }
    
    setLoading(true);
    try {
      const searchParams = {
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        type: 'name'
      };
      if (state.trim()) {
        searchParams.state = state.trim().toUpperCase();
      }
      
      const response = await api.searchPeople(searchParams);
      
      // Store search context
      if (response.searchContext) {
        setSearchContext(response.searchContext);
      }
      
      // Store results in sessionStorage for results page
      sessionStorage.setItem('memberSearchResults', JSON.stringify({
        results: response.data || [],
        query: { firstName: firstName.trim(), lastName: lastName.trim(), state: state.trim() },
        pagination: response.pagination
      }));

      // Navigate to member results page
      navigate('/people-results');
    } catch (err) {
      setError(err.message || 'Search failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handlePhoneSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (!phone || phone.length < 10) {
      setError('Please enter a valid 10-digit phone number');
      return;
    }

    setLoading(true);
    try {
      // Phone search for members uses report/create (type: reversePhone) directly.
      // This returns a full report — identities + fullContact + familyWatchdog — in a
      // single call, bypassing the teaser search entirely.
      const result = await createReportForPhone(phone);

      if (result.success && result.commerceContentId) {
        navigate(`/people/${result.commerceContentId}`);
      } else {
        setError('No report found for that phone number. Please check the number and try again.');
      }
    } catch (err) {
      setError(err.message || 'Search failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleEmailSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (!email.trim()) {
      setError('Please enter an email address');
      return;
    }
    
    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email.trim())) {
      setError('Please enter a valid email address');
      return;
    }
    
    setLoading(true);
    try {
      const searchParams = {
        email: email.trim(),
        type: 'email'
      };
      
      const response = await api.searchPeople(searchParams);
      
      // Store search context
      if (response.searchContext) {
        setSearchContext(response.searchContext);
      }
      
      // Store results in sessionStorage
      sessionStorage.setItem('memberSearchResults', JSON.stringify({
        results: response.data || [],
        query: { email: email.trim() },
        pagination: response.pagination
      }));

      // Navigate to member results page
      navigate('/people-results');
    } catch (err) {
      setError(err.message || 'Search failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <main style={{ 
      padding: '2rem', 
      maxWidth: '1200px', 
      margin: '0 auto',
      minHeight: '60vh'
    }}>
      {/* Header */}
      <div style={{ textAlign: 'center', marginBottom: '3rem' }}>
        <h1 style={{ 
          color: '#0d5d2f', 
          fontSize: '2.5rem',
          fontWeight: 700,
          marginBottom: '1rem'
        }}>
          {activeTab === 'name' ? 'Search by Name' : activeTab === 'phone' ? 'Search by Phone Number' : 'Search by Email Address'}
        </h1>
        <p style={{ 
          color: '#6b7280', 
          fontSize: '1.125rem',
          maxWidth: '600px',
          margin: '0 auto'
        }}>
          {activeTab === 'name' 
            ? 'Enter a first and last name to search our comprehensive database of over 12 billion public records.'
            : activeTab === 'phone'
            ? 'Enter a phone number to search our comprehensive database and find associated information.'
            : 'Enter an email address to search our comprehensive database and find associated information.'}
        </p>
      </div>

      {/* Search Form Section */}
      <div style={{ 
        backgroundColor: '#f9fafb',
        padding: '2.5rem',
        borderRadius: '0.75rem',
        border: '1px solid #e5e7eb',
        marginBottom: '2rem'
      }}>
        {/* Tabs */}
        <div style={{
          display: 'flex',
          gap: '0.5rem',
          marginBottom: '2rem',
          borderBottom: '2px solid #e5e7eb'
        }}>
          <button
            type="button"
            onClick={() => setActiveTab('name')}
            style={{
              padding: '0.75rem 1.5rem',
              backgroundColor: 'transparent',
              border: 'none',
              borderBottom: activeTab === 'name' ? '3px solid #0d5d2f' : '3px solid transparent',
              color: activeTab === 'name' ? '#0d5d2f' : '#6b7280',
              fontWeight: activeTab === 'name' ? '600' : '400',
              cursor: 'pointer',
              fontSize: '1rem',
              transition: 'all 0.2s ease',
              marginBottom: '-2px'
            }}
          >
            Name Search
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('phone')}
            style={{
              padding: '0.75rem 1.5rem',
              backgroundColor: 'transparent',
              border: 'none',
              borderBottom: activeTab === 'phone' ? '3px solid #0d5d2f' : '3px solid transparent',
              color: activeTab === 'phone' ? '#0d5d2f' : '#6b7280',
              fontWeight: activeTab === 'phone' ? '600' : '400',
              cursor: 'pointer',
              fontSize: '1rem',
              transition: 'all 0.2s ease',
              marginBottom: '-2px'
            }}
          >
            Phone Search
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('email')}
            style={{
              padding: '0.75rem 1.5rem',
              backgroundColor: 'transparent',
              border: 'none',
              borderBottom: activeTab === 'email' ? '3px solid #0d5d2f' : '3px solid transparent',
              color: activeTab === 'email' ? '#0d5d2f' : '#6b7280',
              fontWeight: activeTab === 'email' ? '600' : '400',
              cursor: 'pointer',
              fontSize: '1rem',
              transition: 'all 0.2s ease',
              marginBottom: '-2px'
            }}
          >
            Email Search
          </button>
        </div>

        {/* Error Message */}
        {error && (
          <div style={{
            padding: '1rem',
            backgroundColor: '#fee',
            color: '#c00',
            borderRadius: '0.5rem',
            marginBottom: '1.5rem',
            border: '1px solid #fcc'
          }}>
            {error}
          </div>
        )}

        {/* Name Search Form */}
        {activeTab === 'name' && (
          <form onSubmit={handleNameSubmit}>
            <div style={{ 
              display: 'grid', 
              gridTemplateColumns: '1fr 1fr',
              gap: '1rem',
              marginBottom: '1rem'
            }}>
              <div>
                <label style={{ 
                  display: 'block',
                  marginBottom: '0.5rem',
                  color: '#374151',
                  fontWeight: 500
                }}>
                  First Name *
                </label>
                <input
                  type="text"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  placeholder="First Name"
                  required
                  disabled={loading}
                  style={{
                    width: '100%',
                    padding: '0.75rem',
                    border: '1px solid #d1d5db',
                    borderRadius: '0.5rem',
                    fontSize: '1rem'
                  }}
                />
              </div>
              <div>
                <label style={{ 
                  display: 'block',
                  marginBottom: '0.5rem',
                  color: '#374151',
                  fontWeight: 500
                }}>
                  Last Name *
                </label>
                <input
                  type="text"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  placeholder="Last Name"
                  required
                  disabled={loading}
                  style={{
                    width: '100%',
                    padding: '0.75rem',
                    border: '1px solid #d1d5db',
                    borderRadius: '0.5rem',
                    fontSize: '1rem'
                  }}
                />
              </div>
            </div>
            
            <div style={{ marginBottom: '1.5rem' }}>
              <label style={{ 
                display: 'block',
                marginBottom: '0.5rem',
                color: '#374151',
                fontWeight: 500
              }}>
                State (Optional)
              </label>
              <select
                value={state}
                onChange={(e) => setState(e.target.value)}
                disabled={loading}
                style={{
                  width: '100%',
                  padding: '0.75rem',
                  border: '1px solid #d1d5db',
                  borderRadius: '0.5rem',
                  fontSize: '1rem',
                  backgroundColor: '#fff'
                }}
              >
                {usStates.map((stateOption) => (
                  <option key={stateOption.value} value={stateOption.value}>
                    {stateOption.label}
                  </option>
                ))}
              </select>
            </div>

            <button 
              type="submit" 
              disabled={loading || !firstName.trim() || !lastName.trim()}
              style={{
                width: '100%',
                padding: '1rem',
                backgroundColor: loading ? '#9ca3af' : '#0d5d2f',
                color: '#fff',
                border: 'none',
                borderRadius: '0.5rem',
                fontSize: '1.125rem',
                fontWeight: 600,
                cursor: loading ? 'not-allowed' : 'pointer',
                transition: 'all 0.2s ease'
              }}
            >
              {loading ? 'Searching...' : 'Search Now'}
            </button>
          </form>
        )}

        {/* Phone Search Form */}
        {activeTab === 'phone' && (
          <form onSubmit={handlePhoneSubmit}>
            <div style={{ marginBottom: '1.5rem' }}>
              <label style={{ 
                display: 'block',
                marginBottom: '0.5rem',
                color: '#374151',
                fontWeight: 500
              }}>
                Phone Number *
              </label>
              <input
                type="tel"
                value={formatPhone(phone)}
                onChange={handlePhoneChange}
                placeholder="(555) 123-4567"
                required
                disabled={loading}
                maxLength={14}
                style={{
                  width: '100%',
                  padding: '0.75rem',
                  border: '1px solid #d1d5db',
                  borderRadius: '0.5rem',
                  fontSize: '1rem'
                }}
              />
              <p style={{ 
                marginTop: '0.5rem', 
                fontSize: '0.875rem', 
                color: '#6b7280' 
              }}>
                Enter a 10-digit phone number (digits only or formatted)
              </p>
            </div>

            <button 
              type="submit" 
              disabled={loading || !phone || phone.length < 10}
              style={{
                width: '100%',
                padding: '1rem',
                backgroundColor: loading || !phone || phone.length < 10 ? '#9ca3af' : '#0d5d2f',
                color: '#fff',
                border: 'none',
                borderRadius: '0.5rem',
                fontSize: '1.125rem',
                fontWeight: 600,
                cursor: loading || !phone || phone.length < 10 ? 'not-allowed' : 'pointer',
                transition: 'all 0.2s ease'
              }}
            >
              {loading ? 'Searching...' : 'Search Now'}
            </button>
          </form>
        )}

        {/* Email Search Form */}
        {activeTab === 'email' && (
          <form onSubmit={handleEmailSubmit}>
            <div style={{ marginBottom: '1.5rem' }}>
              <label style={{ 
                display: 'block',
                marginBottom: '0.5rem',
                color: '#374151',
                fontWeight: 500
              }}>
                Email Address *
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="example@email.com"
                required
                disabled={loading}
                style={{
                  width: '100%',
                  padding: '0.75rem',
                  border: '1px solid #d1d5db',
                  borderRadius: '0.5rem',
                  fontSize: '1rem'
                }}
              />
              <p style={{ 
                marginTop: '0.5rem', 
                fontSize: '0.875rem', 
                color: '#6b7280' 
              }}>
                Enter a complete email address to search
              </p>
            </div>

            <button 
              type="submit" 
              disabled={loading || !email.trim()}
              style={{
                width: '100%',
                padding: '1rem',
                backgroundColor: loading || !email.trim() ? '#9ca3af' : '#0d5d2f',
                color: '#fff',
                border: 'none',
                borderRadius: '0.5rem',
                fontSize: '1.125rem',
                fontWeight: 600,
                cursor: loading || !email.trim() ? 'not-allowed' : 'pointer',
                transition: 'all 0.2s ease'
              }}
            >
              {loading ? 'Searching...' : 'Search Now'}
            </button>
          </form>
        )}
      </div>
    </main>
  );
};

export default MemberGeneralSearchPage;
