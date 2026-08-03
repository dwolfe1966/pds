import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { setSearchInput as gtmSetSearchInput } from '../../services/gtmContext';
import styles from './NameSearchLandingPage.module.css';

/**
 * General search page with tabs for name, phone, and email search.
 * Enhanced design with PQS production site styling and marketing content.
 */
const GeneralSearchPage = () => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('name'); // 'name', 'phone', or 'email'
  
  // Name search state
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [state, setState] = useState('');
  const [nameError, setNameError] = useState('');
  
  // Phone search state
  const [phone, setPhone] = useState('');
  
  // Email search state
  const [email, setEmail] = useState('');
  const [emailError, setEmailError] = useState('');

  const usStates = [
    { value: '', label: 'Select State' },
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

  const handleNameSubmit = (e) => {
    e.preventDefault();
    setNameError('');
    if (!firstName.trim() || !lastName.trim()) {
      setNameError('Please enter a first and last name.');
      return;
    }
    if (!state.trim()) {
      setNameError('Please select a state.');
      return;
    }

    gtmSetSearchInput({
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      state: state.trim(),
    });

    const params = new URLSearchParams();
    params.set('firstName', firstName.trim());
    params.set('lastName', lastName.trim());
    params.set('state', state.trim());
    navigate(`/name/loader?${params.toString()}`);
  };

  const handlePhoneSubmit = (e) => {
    e.preventDefault();
    if (!phone || phone.length < 10) {
      return;
    }
    
    const params = new URLSearchParams();
    params.set('phone', phone);
    navigate(`/phone/loader?${params.toString()}`);
  };

  const handleEmailSubmit = (e) => {
    e.preventDefault();
    setEmailError('');
    if (!email.trim()) {
      setEmailError('Enter an email address to search.');
      return;
    }

    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email.trim())) {
      setEmailError('That doesn\'t look like a valid email address.');
      return;
    }

    const params = new URLSearchParams();
    params.set('email', email.trim());
    navigate(`/email/loader?${params.toString()}`);
  };

  // Get benefits based on active tab
  const getBenefits = () => {
    switch (activeTab) {
      case 'name':
        return [
          {
            title: 'Contact Information',
            description: 'Phone numbers, email addresses, and social media profiles',
            icon: '📞'
          },
          {
            title: 'Address History',
            description: 'Current and previous addresses with dates and locations',
            icon: '📍'
          },
          {
            title: 'Family & Relatives',
            description: 'Family connections, relatives, and associated people',
            icon: '👨‍👩‍👧‍👦'
          },
          {
            title: 'Public Records',
            description: 'Background information, court records, and more',
            icon: '📋'
          }
        ];
      case 'phone':
        return [
          {
            title: 'Owner Information',
            description: 'Name, age, and personal details associated with the phone number',
            icon: '👤'
          },
          {
            title: 'Location Data',
            description: 'Current and previous addresses linked to the phone number',
            icon: '📍'
          },
          {
            title: 'Contact History',
            description: 'Email addresses and other contact methods associated with the number',
            icon: '📧'
          },
          {
            title: 'Public Records',
            description: 'Background information and public records connected to the phone number',
            icon: '📋'
          }
        ];
      case 'email':
        return [
          {
            title: 'Owner Information',
            description: 'Name, age, and personal details associated with the email address',
            icon: '👤'
          },
          {
            title: 'Location Data',
            description: 'Current and previous addresses linked to the email address',
            icon: '📍'
          },
          {
            title: 'Phone Numbers',
            description: 'Phone numbers and contact methods associated with the email',
            icon: '📞'
          },
          {
            title: 'Public Records',
            description: 'Background information and public records connected to the email address',
            icon: '📋'
          }
        ];
      default:
        return [];
    }
  };

  const getHeroTitle = () => {
    switch (activeTab) {
      case 'name':
        return 'Search by Name';
      case 'phone':
        return 'Search by Phone Number';
      case 'email':
        return 'Search by Email Address';
      default:
        return 'Search';
    }
  };

  const getHeroSubtitle = () => {
    switch (activeTab) {
      case 'name':
        return 'Enter a first and last name to search our comprehensive database of over 12 billion public records.';
      case 'phone':
        return 'Enter a phone number to search our comprehensive database of over 12 billion public records and find associated information.';
      case 'email':
        return 'Enter an email address to search our comprehensive database of over 12 billion public records and find associated information.';
      default:
        return 'Search our comprehensive database of over 12 billion public records.';
    }
  };

  return (
    <main className={styles.main}>
      {/* Hero Section */}
      <section className={styles.hero}>
        <div className={styles.heroContent}>
          <h1 className={styles.heroTitle}>
            {getHeroTitle()}
          </h1>
          <p className={styles.heroSubtitle}>
            {getHeroSubtitle()}
          </p>
        </div>
      </section>

      {/* Search Form Section */}
      <section className={styles.searchFormSection}>
        <div className={styles.searchFormContainer}>
          {/* Tabs */}
          <div style={{
            display: 'flex',
            gap: '0.5rem',
            marginBottom: '1.5rem',
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

          {/* Name Search Form */}
          {activeTab === 'name' && (
            <form onSubmit={handleNameSubmit} className={styles.searchForm}>
              <div className={styles.nameFields}>
                <div className={styles.fieldGroup}>
                  <label className={styles.label}>
                    First Name *
                  </label>
                  <input
                    type="text"
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    placeholder="First Name"
                    required
                    className={styles.input}
                  />
                </div>
                <div className={styles.fieldGroup}>
                  <label className={styles.label}>
                    Last Name *
                  </label>
                  <input
                    type="text"
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    placeholder="Last Name"
                    required
                    className={styles.input}
                  />
                </div>
              </div>
              
              <div className={styles.fieldGroup}>
                <label className={styles.label}>
                  State *
                </label>
                <select
                  value={state}
                  onChange={(e) => { setState(e.target.value); if (nameError) setNameError(''); }}
                  required
                  aria-invalid={!!nameError}
                  className={styles.select}
                  style={nameError ? { borderColor: '#b91c1c' } : undefined}
                >
                  {usStates.map((stateOption) => (
                    <option key={stateOption.value} value={stateOption.value}>
                      {stateOption.label}
                    </option>
                  ))}
                </select>
              </div>

              {nameError && (
                <p style={{ color: '#b91c1c', fontSize: '0.85rem', margin: '0 0 0.75rem' }} role="alert">{nameError}</p>
              )}

              <button type="submit" className={styles.submitButton}>
                Search Records
              </button>
              <p style={{
                textAlign: 'center',
                color: '#9ca3af',
                fontSize: '0.75rem',
                marginTop: '1rem',
                textTransform: 'uppercase',
                letterSpacing: '0.05em'
              }}>
                Secure &amp; encrypted connection
              </p>
            </form>
          )}

          {/* Phone Search Form */}
          {activeTab === 'phone' && (
            <form onSubmit={handlePhoneSubmit} className={styles.searchForm}>
              <div className={styles.fieldGroup}>
                <label className={styles.label}>
                  Phone Number *
                </label>
                <input
                  type="tel"
                  value={formatPhone(phone)}
                  onChange={handlePhoneChange}
                  placeholder="(555) 123-4567"
                  required
                  className={styles.input}
                  maxLength={14}
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
                className={styles.submitButton}
                disabled={!phone || phone.length < 10}
              >
                Search Records
              </button>
              <p style={{
                textAlign: 'center',
                color: '#9ca3af',
                fontSize: '0.75rem',
                marginTop: '1rem',
                textTransform: 'uppercase',
                letterSpacing: '0.05em'
              }}>
                Secure &amp; encrypted connection
              </p>
            </form>
          )}

          {/* Email Search Form */}
          {activeTab === 'email' && (
            <form onSubmit={handleEmailSubmit} className={styles.searchForm}>
              <div className={styles.fieldGroup}>
                <label className={styles.label}>
                  Email Address *
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => { setEmail(e.target.value); if (emailError) setEmailError(''); }}
                  placeholder="example@email.com"
                  required
                  className={styles.input}
                  aria-invalid={emailError ? 'true' : 'false'}
                />
                {emailError ? (
                  <p role="alert" style={{
                    marginTop: '0.5rem',
                    fontSize: '0.875rem',
                    color: '#b91c1c',
                  }}>
                    {emailError}
                  </p>
                ) : (
                  <p style={{
                    marginTop: '0.5rem',
                    fontSize: '0.875rem',
                    color: '#6b7280'
                  }}>
                    Enter a complete email address to search
                  </p>
                )}
              </div>

              <button
                type="submit"
                className={styles.submitButton}
                disabled={!email.trim()}
              >
                Search Records
              </button>
              <p style={{
                textAlign: 'center',
                color: '#9ca3af',
                fontSize: '0.75rem',
                marginTop: '1rem',
                textTransform: 'uppercase',
                letterSpacing: '0.05em'
              }}>
                Secure &amp; encrypted connection
              </p>
            </form>
          )}
        </div>
      </section>

      {/* Benefits Section */}
      <section className={styles.benefits}>
        <div className={styles.benefitsContent}>
          <h2 className={styles.benefitsTitle}>
            What You'll Find
          </h2>
          <div className={styles.benefitsGrid}>
            {getBenefits().map((item, index) => (
              <div key={index} className={styles.benefitCard}>
                <div className={styles.benefitIcon}>
                  {item.icon}
                </div>
                <h3 className={styles.benefitTitle}>
                  {item.title}
                </h3>
                <p className={styles.benefitDescription}>
                  {item.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </main>
  );
};

export default GeneralSearchPage;
