import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { track } from '../../services/trackingService';
import styles from './NameSearchLandingPage.module.css';

/**
 * Name search landing page - Entry point for name searches.
 * Enhanced design with PQS production site styling and marketing content.
 */
const NameSearchLandingPage = () => {
  const navigate = useNavigate();

  useEffect(() => {
    track('landing_view', { search_type: 'name', variant: 'v1' });
  }, []);
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [state, setState] = useState('');
  const [errors, setErrors] = useState({});

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

  const handleSubmit = (e) => {
    e.preventDefault();
    // First, last, AND state are required on name searches — first+last alone
    // returns unreliable BC matches. Phone/email searches don't take state.
    const next = {};
    if (!firstName.trim()) next.firstName = 'Please enter a first name.';
    if (!lastName.trim()) next.lastName = 'Please enter a last name.';
    if (!state.trim()) next.state = 'Please select a state.';
    setErrors(next);
    if (Object.keys(next).length > 0) return;

    const params = new URLSearchParams();
    params.set('firstName', firstName.trim());
    params.set('lastName', lastName.trim());
    params.set('state', state.trim());
    navigate(`/name/loader?${params.toString()}`);
  };

  return (
    <main className={styles.main}>
      {/* Hero + Search Section — two-column layout */}
      <section className={styles.heroSearchSection}>
        <div className={styles.heroTwoCol}>
          {/* Left column: headline + form */}
          <div className={styles.heroFormCol}>
            <div className={styles.recordBadge}>
              🔍 12B+ Public Records Searched
            </div>
            <h1 className={styles.heroTitleTwoCol}>
              Find Anyone — Search by Name
            </h1>
            <p className={styles.heroSubtitleTwoCol}>
              Enter a first and last name to instantly search 12 billion+ public records.
            </p>

            <div className={styles.heroFormCard}>
              <form onSubmit={handleSubmit} className={styles.searchForm}>
                <div className={styles.nameFields}>
                  <div className={styles.fieldGroup}>
                    <label className={styles.label}>
                      First Name *
                    </label>
                    <div className={styles.inputWrapper}>
                      <span className={styles.inputIcon}>🔍</span>
                      <input
                        type="text"
                        value={firstName}
                        onChange={(e) => { setFirstName(e.target.value); if (errors.firstName) setErrors((p) => ({ ...p, firstName: undefined })); }}
                        placeholder="First (ex. John)"
                        aria-invalid={!!errors.firstName}
                        className={styles.inputWithIcon}
                        style={errors.firstName ? { borderColor: '#b91c1c' } : undefined}
                      />
                    </div>
                    {errors.firstName && (
                      <p role="alert" style={{ margin: '0.25rem 0 0', fontSize: '0.8rem', color: '#b91c1c' }}>{errors.firstName}</p>
                    )}
                  </div>
                  <div className={styles.fieldGroup}>
                    <label className={styles.label}>
                      Last Name *
                    </label>
                    <input
                      type="text"
                      value={lastName}
                      onChange={(e) => { setLastName(e.target.value); if (errors.lastName) setErrors((p) => ({ ...p, lastName: undefined })); }}
                      placeholder="Last (ex. Smith)"
                      aria-invalid={!!errors.lastName}
                      className={styles.input}
                      style={errors.lastName ? { borderColor: '#b91c1c' } : undefined}
                    />
                    {errors.lastName && (
                      <p role="alert" style={{ margin: '0.25rem 0 0', fontSize: '0.8rem', color: '#b91c1c' }}>{errors.lastName}</p>
                    )}
                  </div>
                </div>

                <div className={styles.fieldGroup}>
                  <label className={styles.label}>
                    State *
                  </label>
                  <select
                    value={state}
                    onChange={(e) => { setState(e.target.value); if (errors.state) setErrors((p) => ({ ...p, state: undefined })); }}
                    aria-invalid={!!errors.state}
                    className={styles.select}
                    style={errors.state ? { borderColor: '#b91c1c' } : undefined}
                  >
                    {usStates.map((stateOption) => (
                      <option key={stateOption.value} value={stateOption.value}>
                        {stateOption.label}
                      </option>
                    ))}
                  </select>
                  {errors.state && (
                    <p role="alert" style={{ margin: '0.25rem 0 0', fontSize: '0.8rem', color: '#b91c1c' }}>{errors.state}</p>
                  )}
                </div>

                <button type="submit" className={styles.submitButton}>
                  Search Now
                </button>

                <p className={styles.socialProof}>
                  <span className={styles.socialProofDot} />
                  Over 2,400 searches completed in the last hour
                </p>
              </form>
            </div>
          </div>

          {/* Right column: blurred result preview (desktop only) */}
          <div className={styles.heroPreviewCol}>
            <div className={styles.previewStack}>
              {/* Card 1 — lock overlay */}
              <div className={styles.previewCard}>
                <div className={styles.previewCardInner}>
                  <div className={styles.previewCardName}>John S.</div>
                  <div className={styles.previewCardMeta}>Age 34–44 &bull; Los Angeles, CA</div>
                  <div className={styles.previewCardDetails}>
                    <span>📞 (***) ***-1234</span>
                    <span>📍 *** Oak St</span>
                    <span>👥 3 relatives</span>
                  </div>
                </div>
                <div className={styles.previewLockOverlay}>
                  <span className={styles.previewLockBadge}>🔒 Sign up to unlock</span>
                </div>
              </div>

              {/* Card 2 */}
              <div className={styles.previewCard}>
                <div className={styles.previewCardInner}>
                  <div className={styles.previewCardName}>John S.</div>
                  <div className={styles.previewCardMeta}>Age 45–54 &bull; Phoenix, AZ</div>
                  <div className={styles.previewCardDetails}>
                    <span>📞 (***) ***-5678</span>
                    <span>📍 *** Elm Ave</span>
                  </div>
                </div>
              </div>

              {/* Card 3 */}
              <div className={styles.previewCard}>
                <div className={styles.previewCardInner}>
                  <div className={styles.previewCardName}>John S.</div>
                  <div className={styles.previewCardMeta}>Age 25–34 &bull; Chicago, IL</div>
                  <div className={styles.previewCardDetails}>
                    <span>📞 (***) ***-9012</span>
                    <span>📍 *** Pine Rd</span>
                  </div>
                </div>
              </div>
            </div>
            <p className={styles.previewLabel}>Sample results — sign up to view full details</p>
          </div>
        </div>
      </section>

      {/* Trust Bar */}
      <div className={styles.trustBar}>
        <div className={styles.trustBarInner}>
          <span className={styles.trustItem}>🔒 SSL Encrypted</span>
          <span className={styles.trustDivider}>|</span>
          <span className={styles.trustItem}>★★★★★ 50,000+ Members</span>
          <span className={styles.trustDivider}>|</span>
          <span className={styles.trustItem}>Trusted by millions</span>
        </div>
      </div>

      {/* Benefits Section */}
      <section className={styles.benefits}>
        <div className={styles.benefitsContent}>
          <h2 className={styles.benefitsTitle}>
            What You'll Find
          </h2>
          <div className={styles.benefitsGrid}>
            {[
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
            ].map((item, index) => (
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

export default NameSearchLandingPage;


