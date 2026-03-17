import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import styles from './NameSearchLandingPage.module.css';

/**
 * Phone search landing page - Entry point for phone searches.
 * Enhanced design with PQS production site styling and marketing content.
 */
const PhoneLandingPage = () => {
  const navigate = useNavigate();
  const [phone, setPhone] = useState('');

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

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!phone || phone.length < 10) {
      return;
    }
    
    // Navigate to loader page which will perform the search
    const params = new URLSearchParams();
    params.set('phone', phone);
    navigate(`/phone/loader?${params.toString()}`);
  };

  return (
    <main className={styles.main}>
      {/* Hero Section */}
      <section className={styles.hero}>
        <div className={styles.heroContent}>
          <div className={styles.recordBadge}>
            🔍 12B+ Public Records
          </div>
          <h1 className={styles.heroTitle}>
            Search by Phone Number
          </h1>
          <p className={styles.heroSubtitle}>
            Enter a phone number to search our comprehensive database of over 12 billion public records and find associated information.
          </p>
        </div>
      </section>

      {/* Search Form Section */}
      <section className={styles.searchFormSection}>
        <div className={styles.searchFormContainer}>
          <form onSubmit={handleSubmit} className={styles.searchForm}>
            <div className={styles.fieldGroup}>
              <label className={styles.label}>
                Phone Number *
              </label>
              <div className={styles.inputWrapper}>
                <span className={styles.inputIcon}>🔍</span>
                <input
                  type="tel"
                  value={formatPhone(phone)}
                  onChange={handlePhoneChange}
                  placeholder="(555) 123-4567"
                  required
                  className={styles.inputWithIcon}
                  maxLength={14}
                />
              </div>
              <p style={{
                marginTop: '0.5rem',
                fontSize: '0.875rem',
                color: '#6b7280'
              }}>
                Enter a 10-digit phone number (digits only or formatted)
              </p>
            </div>

            {/* Blurred phone result preview */}
            <div className={styles.phonePreviewCard}>
              <div className={styles.phonePreviewInner}>
                <div className={styles.previewCardName}>Unknown Caller</div>
                <div className={styles.previewCardMeta}>📞 (***) ***-4567</div>
                <div className={styles.previewCardDetails}>
                  <span>👤 Jane D. &bull; Age 30–40</span>
                  <span>📍 Austin, TX</span>
                  <span>📶 AT&amp;T Wireless</span>
                </div>
              </div>
              <div className={styles.previewLockOverlay}>
                <span className={styles.previewLockBadge}>🔒 Sign up to unlock</span>
              </div>
            </div>

            <button
              type="submit"
              className={styles.submitButton}
              disabled={!phone || phone.length < 10}
            >
              Search Now
            </button>

            <p className={styles.socialProof}>
              <span className={styles.socialProofDot} />
              Over 1,800 phone lookups completed in the last hour
            </p>
          </form>
        </div>
      </section>

      {/* Trust Bar */}
      <div className={styles.trustBar}>
        <div className={styles.trustBarInner}>
          <span className={styles.trustItem}>🔒 SSL Encrypted</span>
          <span className={styles.trustDivider}>|</span>
          <span className={styles.trustItem}>✓ FCRA Compliant</span>
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

export default PhoneLandingPage;
