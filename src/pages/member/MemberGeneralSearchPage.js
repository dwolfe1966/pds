import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { createReportForPhone } from '../../services/reportService';
import DevBCSession from '../../components/DevBCSession';
import styles from './MemberGeneralSearchPage.module.css';

const US_STATES = [
  { value: '', label: 'Select State (Optional)' },
  { value: 'AL', label: 'Alabama' }, { value: 'AK', label: 'Alaska' },
  { value: 'AZ', label: 'Arizona' }, { value: 'AR', label: 'Arkansas' },
  { value: 'CA', label: 'California' }, { value: 'CO', label: 'Colorado' },
  { value: 'CT', label: 'Connecticut' }, { value: 'DE', label: 'Delaware' },
  { value: 'FL', label: 'Florida' }, { value: 'GA', label: 'Georgia' },
  { value: 'HI', label: 'Hawaii' }, { value: 'ID', label: 'Idaho' },
  { value: 'IL', label: 'Illinois' }, { value: 'IN', label: 'Indiana' },
  { value: 'IA', label: 'Iowa' }, { value: 'KS', label: 'Kansas' },
  { value: 'KY', label: 'Kentucky' }, { value: 'LA', label: 'Louisiana' },
  { value: 'ME', label: 'Maine' }, { value: 'MD', label: 'Maryland' },
  { value: 'MA', label: 'Massachusetts' }, { value: 'MI', label: 'Michigan' },
  { value: 'MN', label: 'Minnesota' }, { value: 'MS', label: 'Mississippi' },
  { value: 'MO', label: 'Missouri' }, { value: 'MT', label: 'Montana' },
  { value: 'NE', label: 'Nebraska' }, { value: 'NV', label: 'Nevada' },
  { value: 'NH', label: 'New Hampshire' }, { value: 'NJ', label: 'New Jersey' },
  { value: 'NM', label: 'New Mexico' }, { value: 'NY', label: 'New York' },
  { value: 'NC', label: 'North Carolina' }, { value: 'ND', label: 'North Dakota' },
  { value: 'OH', label: 'Ohio' }, { value: 'OK', label: 'Oklahoma' },
  { value: 'OR', label: 'Oregon' }, { value: 'PA', label: 'Pennsylvania' },
  { value: 'RI', label: 'Rhode Island' }, { value: 'SC', label: 'South Carolina' },
  { value: 'SD', label: 'South Dakota' }, { value: 'TN', label: 'Tennessee' },
  { value: 'TX', label: 'Texas' }, { value: 'UT', label: 'Utah' },
  { value: 'VT', label: 'Vermont' }, { value: 'VA', label: 'Virginia' },
  { value: 'WA', label: 'Washington' }, { value: 'WV', label: 'West Virginia' },
  { value: 'WI', label: 'Wisconsin' }, { value: 'WY', label: 'Wyoming' },
];

const SEARCH_TIPS = {
  name: [
    'Include state to narrow results by location',
    'Use full legal name for best accuracy',
    'Try alternate spellings if no results found',
  ],
  phone: [
    'Enter 10-digit US number (digits only or formatted)',
    'Phone search returns a full identity report directly',
    'International numbers are not currently supported',
  ],
  email: [
    'Enter the complete email address',
    'Searches public records and social registrations',
    'Works with known public email addresses only',
  ],
};

const MemberGeneralSearchPage = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('name');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showTips, setShowTips] = useState(false);

  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [state, setState] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');

  const formatPhone = (digits) => {
    if (digits.length <= 3) return digits;
    if (digits.length <= 6) return `(${digits.slice(0, 3)}) ${digits.slice(3)}`;
    return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6, 10)}`;
  };

  const handlePhoneChange = (e) => {
    const digits = e.target.value.replace(/\D/g, '').slice(0, 10);
    setPhone(digits);
  };

  const handleTabChange = (tab) => {
    setActiveTab(tab);
    setError('');
    setShowTips(false);
  };

  const handleNameSubmit = (e) => {
    e.preventDefault();
    setError('');
    if (!firstName.trim() || !lastName.trim()) {
      setError('Please enter both first and last name.');
      return;
    }
    const params = new URLSearchParams({ firstName: firstName.trim(), lastName: lastName.trim() });
    if (state.trim()) params.set('state', state.trim().toUpperCase());
    navigate(`/people-results?${params.toString()}`);
  };

  const handlePhoneSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (!phone || phone.length < 10) {
      setError('Please enter a valid 10-digit phone number.');
      return;
    }
    setLoading(true);
    try {
      const result = await createReportForPhone(phone);
      if (result.success && result.commerceContentId) {
        navigate(`/people/${result.commerceContentId}`);
      } else {
        setError('No report found for that number. Please check and try again.');
      }
    } catch (err) {
      setError(err.message || 'Search failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleEmailSubmit = (e) => {
    e.preventDefault();
    setError('');
    if (!email.trim()) { setError('Please enter an email address.'); return; }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setError('Please enter a valid email address.');
      return;
    }
    navigate(`/people-results?email=${encodeURIComponent(email.trim())}`);
  };

  const tabTitle = {
    name: 'Search by Name',
    phone: 'Reverse Phone Lookup',
    email: 'Search by Email Address',
  }[activeTab];

  const tabSubtitle = {
    name: 'Search our database of over 12 billion public records by full name.',
    phone: 'Enter a phone number to find the owner and see their full identity report.',
    email: 'Find information associated with any public email address.',
  }[activeTab];

  return (
    <main className={styles.main}>
      <DevBCSession user={user} />

      <div className={styles.header}>
        <h1 className={styles.title}>{tabTitle}</h1>
        <p className={styles.subtitle}>{tabSubtitle}</p>
      </div>

      <div className={styles.formCard}>
        {/* Tabs */}
        <div className={styles.tabs}>
          {['name', 'phone', 'email'].map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => handleTabChange(tab)}
              className={`${styles.tab} ${activeTab === tab ? styles.tabActive : ''}`}
            >
              {tab === 'name' ? 'Name Search' : tab === 'phone' ? 'Phone Search' : 'Email Search'}
            </button>
          ))}
        </div>

        {error && <div className={styles.error}>{error}</div>}

        {/* Name form */}
        {activeTab === 'name' && (
          <form onSubmit={handleNameSubmit}>
            <div className={styles.nameGrid}>
              <div className={styles.fieldGroup} style={{ marginBottom: 0 }}>
                <label className={styles.label} htmlFor="gs-firstName">First Name *</label>
                <input
                  id="gs-firstName"
                  type="text"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  placeholder="First name"
                  required
                  disabled={loading}
                  className={`${styles.input} ${firstName.trim() ? styles.inputValid : ''}`}
                />
              </div>
              <div className={styles.fieldGroup} style={{ marginBottom: 0 }}>
                <label className={styles.label} htmlFor="gs-lastName">Last Name *</label>
                <input
                  id="gs-lastName"
                  type="text"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  placeholder="Last name"
                  required
                  disabled={loading}
                  className={`${styles.input} ${lastName.trim() ? styles.inputValid : ''}`}
                />
              </div>
            </div>
            <div className={styles.fieldGroup}>
              <label className={styles.label} htmlFor="gs-state">
                State <span className={styles.labelOptional}>(optional)</span>
              </label>
              <select
                id="gs-state"
                value={state}
                onChange={(e) => setState(e.target.value)}
                disabled={loading}
                className={styles.select}
              >
                {US_STATES.map((s) => (
                  <option key={s.value} value={s.value}>{s.label}</option>
                ))}
              </select>
            </div>
            <button
              type="submit"
              disabled={loading || !firstName.trim() || !lastName.trim()}
              className={styles.submitBtn}
            >
              {loading ? 'Searching…' : 'Search Records'}
            </button>
          </form>
        )}

        {/* Phone form */}
        {activeTab === 'phone' && (
          <form onSubmit={handlePhoneSubmit}>
            <div className={styles.fieldGroup}>
              <label className={styles.label} htmlFor="gs-phone">Phone Number *</label>
              <input
                id="gs-phone"
                type="tel"
                value={formatPhone(phone)}
                onChange={handlePhoneChange}
                placeholder="(555) 123-4567"
                required
                disabled={loading}
                inputMode="numeric"
                className={`${styles.input} ${phone.length === 10 ? styles.inputValid : ''}`}
              />
              <p className={styles.hint}>10-digit US number. International numbers not supported.</p>
            </div>
            <button
              type="submit"
              disabled={loading || phone.length < 10}
              className={styles.submitBtn}
            >
              {loading ? 'Searching…' : 'Search Records'}
            </button>
          </form>
        )}

        {/* Email form */}
        {activeTab === 'email' && (
          <form onSubmit={handleEmailSubmit}>
            <div className={styles.fieldGroup}>
              <label className={styles.label} htmlFor="gs-email">Email Address *</label>
              <input
                id="gs-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="example@email.com"
                required
                disabled={loading}
                className={styles.input}
              />
              <p className={styles.hint}>Searches public records and social media registrations.</p>
            </div>
            <button
              type="submit"
              disabled={loading || !email.trim()}
              className={styles.submitBtn}
            >
              {loading ? 'Searching…' : 'Search Records'}
            </button>
          </form>
        )}
      </div>

      {/* Search tips */}
      <div className={styles.tipsSection}>
        <button
          type="button"
          className={styles.tipsToggle}
          onClick={() => setShowTips((v) => !v)}
        >
          <span>{showTips ? '▲' : '▼'}</span>
          Search tips
        </button>
        {showTips && (
          <div className={styles.tipsList}>
            {SEARCH_TIPS[activeTab].map((tip) => (
              <div key={tip} className={styles.tipsItem}>
                <span className={styles.tipsCheck}>✓</span>
                {tip}
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  );
};

export default MemberGeneralSearchPage;
