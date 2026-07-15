import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { createReportForPhone } from '../../services/reportService';
import DevBCSession from '../../components/DevBCSession';
import PageHeader, { PageShell } from '../../components/PageHeader';
import { setSearchInput as gtmSetSearchInput } from '../../services/gtmContext';
import styles from './MemberGeneralSearchPage.module.css';

// Top US cities by population — used for City field typeahead (partner bug 23c).
// Kept intentionally short; the datalist is a suggestion source, not a
// restricted picker — users can still type any city name freely.
const COMMON_US_CITIES = [
  'New York, NY', 'Los Angeles, CA', 'Chicago, IL', 'Houston, TX', 'Phoenix, AZ',
  'Philadelphia, PA', 'San Antonio, TX', 'San Diego, CA', 'Dallas, TX', 'San Jose, CA',
  'Austin, TX', 'Jacksonville, FL', 'Fort Worth, TX', 'Columbus, OH', 'Charlotte, NC',
  'Indianapolis, IN', 'San Francisco, CA', 'Seattle, WA', 'Denver, CO', 'Washington, DC',
  'Boston, MA', 'Nashville, TN', 'Baltimore, MD', 'Oklahoma City, OK', 'Portland, OR',
  'Las Vegas, NV', 'Memphis, TN', 'Louisville, KY', 'Detroit, MI', 'El Paso, TX',
  'Milwaukee, WI', 'Albuquerque, NM', 'Tucson, AZ', 'Fresno, CA', 'Sacramento, CA',
  'Kansas City, MO', 'Atlanta, GA', 'Miami, FL', 'Raleigh, NC', 'Omaha, NE',
  'Long Beach, CA', 'Virginia Beach, VA', 'Oakland, CA', 'Minneapolis, MN', 'Tulsa, OK',
  'Arlington, TX', 'Tampa, FL', 'New Orleans, LA', 'Cleveland, OH', 'Honolulu, HI',
  'Anaheim, CA', 'Orlando, FL', 'Saint Paul, MN', 'Pittsburgh, PA', 'Cincinnati, OH',
  'Anchorage, AK', 'Buffalo, NY', 'Plano, TX', 'Lincoln, NE', 'Henderson, NV',
  'Fort Wayne, IN', 'Jersey City, NJ', 'Saint Louis, MO', 'Chula Vista, CA',
  'Newark, NJ', 'Norfolk, VA', 'Chandler, AZ', 'Lexington, KY', 'Madison, WI',
  'Scottsdale, AZ', 'Fort Lauderdale, FL', 'Salt Lake City, UT', 'Spokane, WA', 'Tacoma, WA',
];

const US_STATES = [
  { value: '', label: 'Select State' },
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
    'Add city and state to narrow results by location',
    'Use full legal name for best accuracy',
    'Select an age range to filter by approximate age',
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
  address: [
    'Enter city and/or state to find residents in that area',
    'Adding a ZIP code narrows results significantly',
    'Combine with name search for more precise results',
  ],
};

const MemberGeneralSearchPage = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, isPaid } = useAuth();
  const [activeTab, setActiveTab] = useState('name');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showTips, setShowTips] = useState(false);

  // Name search fields
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [state, setState] = useState('');
  const [nameCity, setNameCity] = useState('');
  const [ageRange, setAgeRange] = useState('');

  // Phone search
  const [phone, setPhone] = useState('');

  // Email search
  const [email, setEmail] = useState('');

  // Address search fields
  const [city, setCity] = useState('');
  const [addressState, setAddressState] = useState('');
  const [zip, setZip] = useState('');

  // Pre-populate form fields from URL params (e.g. from Search History "Search Again")
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const fn = params.get('firstName');
    const ln = params.get('lastName');
    const st = params.get('state');
    const em = params.get('email');
    const ph = params.get('phone');

    if (fn || ln) {
      setActiveTab('name');
      if (fn) setFirstName(fn);
      if (ln) setLastName(ln);
      if (st) setState(st);
    } else if (em) {
      setActiveTab('email');
      setEmail(em);
    } else if (ph) {
      setActiveTab('phone');
      setPhone(ph.replace(/\D/g, '').slice(0, 10));
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
    // First, last, AND state are required on name searches. City and age stay
    // optional — they narrow results client-side. (Phone/email tabs don't take
    // state at all.)
    if (!firstName.trim() || !lastName.trim()) {
      setError('Please enter both first and last name.');
      return;
    }
    if (!state.trim()) {
      setError('Please select a state.');
      return;
    }
    gtmSetSearchInput({
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      state: state.trim().toUpperCase(),
      city: nameCity.trim() || undefined,
    });
    const params = new URLSearchParams({ firstName: firstName.trim(), lastName: lastName.trim() });
    params.set('state', state.trim().toUpperCase());
    if (nameCity.trim()) params.set('city', nameCity.trim());
    if (ageRange) params.set('age', ageRange);
    navigate(`/people-results?${params.toString()}`);
  };

  const handlePhoneSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (!phone || phone.length < 10) {
      setError('Please enter a valid 10-digit phone number.');
      return;
    }
    // Free members can't create reports (BC 403s pre-payment), so the old
    // direct-to-report path surfaced a fake system error (bug list 7/2 #4).
    // Route them to teaser results instead — same phone teaser the sales
    // funnel runs — and let the report gate upsell on result click.
    if (!isPaid) {
      navigate(`/people-results?phone=${encodeURIComponent(phone)}`);
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

  const handleAddressSubmit = (e) => {
    e.preventDefault();
    setError('');
    if (!city.trim() && !addressState && !zip.trim()) {
      setError('Please enter at least a city, state, or ZIP code.');
      return;
    }
    const params = new URLSearchParams();
    if (city.trim()) params.set('city', city.trim());
    if (addressState) params.set('state', addressState);
    if (zip.trim()) params.set('zip', zip.trim());
    params.set('searchType', 'address');
    navigate(`/people-results?${params.toString()}`);
  };

  const tabTitle = {
    name: 'Search by Name',
    phone: 'Reverse Phone Lookup',
    email: 'Search by Email Address',
    address: 'Search by Address / Location',
  }[activeTab];

  const tabSubtitle = {
    name: 'Search our database of over 12 billion public records by full name.',
    phone: 'Enter a phone number to find the owner and see their full identity report.',
    email: 'Find information associated with any public email address.',
    address: 'Find people who live or have lived in a specific city, state, or ZIP code.',
  }[activeTab];

  return (
    <PageShell>
      <DevBCSession user={user} />

      <PageHeader title={tabTitle} subtitle={tabSubtitle} />

      <div className={styles.formCard}>
        {/* Tabs */}
        <div className={styles.tabs}>
          {/* Address/location search removed (bug #42): City/State/Zip search
              had no useful BC-backed result. Name/Phone/Email only. The address
              form + handler below are now unreachable (no tab, no URL path). */}
          {['name', 'phone', 'email'].map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => handleTabChange(tab)}
              className={`${styles.tab} ${activeTab === tab ? styles.tabActive : ''}`}
            >
              {tab === 'name' ? 'Name' : tab === 'phone' ? 'Phone' : tab === 'email' ? 'Email' : 'Address'}
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
            <div className={styles.nameGrid}>
              <div className={styles.fieldGroup} style={{ marginBottom: 0 }}>
                <label className={styles.label} htmlFor="gs-city">
                  City <span className={styles.labelOptional}>(optional)</span>
                </label>
                <input
                  id="gs-city"
                  type="text"
                  value={nameCity}
                  onChange={(e) => setNameCity(e.target.value)}
                  placeholder="e.g. Austin"
                  disabled={loading}
                  list="gs-city-suggestions"
                  autoComplete="off"
                  className={`${styles.input} ${nameCity.trim() ? styles.inputValid : ''}`}
                />
                <datalist id="gs-city-suggestions">
                  {COMMON_US_CITIES.map((c) => (
                    <option key={c} value={c} />
                  ))}
                </datalist>
              </div>
              <div className={styles.fieldGroup} style={{ marginBottom: 0 }}>
                <label className={styles.label} htmlFor="gs-state">
                  State *
                </label>
                <select
                  id="gs-state"
                  value={state}
                  onChange={(e) => setState(e.target.value)}
                  disabled={loading}
                  required
                  className={styles.select}
                >
                  {US_STATES.map((s) => (
                    <option key={s.value} value={s.value}>{s.label}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className={styles.fieldGroup}>
              <label className={styles.label} htmlFor="gs-age">
                Age Range <span className={styles.labelOptional}>(optional)</span>
              </label>
              <select
                id="gs-age"
                value={ageRange}
                onChange={(e) => setAgeRange(e.target.value)}
                disabled={loading}
                className={styles.select}
              >
                <option value="">Any Age</option>
                <option value="18-25">18-25</option>
                <option value="26-35">26-35</option>
                <option value="36-45">36-45</option>
                <option value="46-55">46-55</option>
                <option value="56-65">56-65</option>
                <option value="66-75">66-75</option>
                <option value="76+">76+</option>
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

        {/* Address form */}
        {activeTab === 'address' && (
          <form onSubmit={handleAddressSubmit}>
            <div className={styles.fieldGroup}>
              <label className={styles.label} htmlFor="gs-city">
                City <span className={styles.labelOptional}>(optional)</span>
              </label>
              <input
                id="gs-city"
                type="text"
                value={city}
                onChange={(e) => setCity(e.target.value)}
                placeholder="e.g. Austin"
                disabled={loading}
                className={`${styles.input} ${city.trim() ? styles.inputValid : ''}`}
              />
            </div>
            <div className={styles.nameGrid}>
              <div className={styles.fieldGroup} style={{ marginBottom: 0 }}>
                <label className={styles.label} htmlFor="gs-addr-state">
                  State <span className={styles.labelOptional}>(optional)</span>
                </label>
                <select
                  id="gs-addr-state"
                  value={addressState}
                  onChange={(e) => setAddressState(e.target.value)}
                  disabled={loading}
                  className={styles.select}
                >
                  {US_STATES.map((s) => (
                    <option key={s.value} value={s.value}>{s.label}</option>
                  ))}
                </select>
              </div>
              <div className={styles.fieldGroup} style={{ marginBottom: 0 }}>
                <label className={styles.label} htmlFor="gs-zip">
                  ZIP Code <span className={styles.labelOptional}>(optional)</span>
                </label>
                <input
                  id="gs-zip"
                  type="text"
                  value={zip}
                  onChange={(e) => setZip(e.target.value.replace(/\D/g, '').slice(0, 5))}
                  placeholder="e.g. 78701"
                  inputMode="numeric"
                  disabled={loading}
                  className={`${styles.input} ${zip.length === 5 ? styles.inputValid : ''}`}
                />
              </div>
            </div>
            <p className={styles.hint} style={{ marginTop: '0.75rem' }}>
              Enter at least one field. Combine city + state for best results.
            </p>
            <button
              type="submit"
              disabled={loading || (!city.trim() && !addressState && !zip.trim())}
              className={styles.submitBtn}
            >
              {loading ? 'Searching…' : 'Search by Location'}
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
    </PageShell>
  );
};

export default MemberGeneralSearchPage;
