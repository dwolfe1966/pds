import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import styles from './NameSearchLandingPage.module.css';

/**
 * Name search landing page - Entry point for name searches.
 * Enhanced design with PQS production site styling and marketing content.
 */
const NameSearchLandingPage = () => {
  const navigate = useNavigate();
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [state, setState] = useState('');

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

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!firstName.trim() || !lastName.trim()) {
      return;
    }
    
    // Navigate to loader page which will perform the search
    const params = new URLSearchParams();
    params.set('firstName', firstName.trim());
    params.set('lastName', lastName.trim());
    if (state.trim()) {
      params.set('state', state.trim());
    }
    navigate(`/name/loader?${params.toString()}`);
  };

  return (
    <main className={styles.main}>
      {/* Hero Section */}
      <section className={styles.hero}>
        <div className={styles.heroContent}>
          <h1 className={styles.heroTitle}>
            Find Anyone — Search by Name
          </h1>
          <p className={styles.heroSubtitle}>
            Enter a first and last name to search 12 billion+ public records. Instant results.
          </p>
        </div>
      </section>

      {/* Search Form Section */}
      <section className={styles.searchFormSection}>
        <div className={styles.searchFormContainer}>
          <form onSubmit={handleSubmit} className={styles.searchForm}>
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
                State (Optional)
              </label>
              <select
                value={state}
                onChange={(e) => setState(e.target.value)}
                className={styles.select}
              >
                {usStates.map((stateOption) => (
                  <option key={stateOption.value} value={stateOption.value}>
                    {stateOption.label}
                  </option>
                ))}
              </select>
            </div>

            <button type="submit" className={styles.submitButton}>
              Search Now
            </button>
            <div style={{
              display: 'flex', gap: '1.5rem', flexWrap: 'wrap', justifyContent: 'center',
              marginTop: '1rem', fontSize: '0.8rem', color: '#6b7280',
            }}>
              <span>🔍 2,400+ searches in the last hour</span>
              <span>👥 Trusted by 3M+ members</span>
              <span>🔒 100% confidential</span>
            </div>
            <p style={{
              textAlign: 'center',
              color: '#9ca3af',
              fontSize: '0.75rem',
              marginTop: '1rem',
              textTransform: 'uppercase',
              letterSpacing: '0.05em'
            }}>
              Your search is confidential and secure
            </p>
          </form>
        </div>
      </section>

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


