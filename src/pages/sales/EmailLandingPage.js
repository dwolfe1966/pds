import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import styles from './NameSearchLandingPage.module.css';
import { useLandingTrack } from '../../hooks/useLandingTrack';

/**
 * Email search landing page - Entry point for email searches.
 * Enhanced design with PQS production site styling and marketing content.
 */
const EmailLandingPage = () => {
  useLandingTrack('email', 'v1');
  const navigate = useNavigate();
  const [email, setEmail] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!email.trim()) {
      return;
    }
    
    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email.trim())) {
      alert('Please enter a valid email address');
      return;
    }
    
    // Navigate to loader page which will perform the search
    const params = new URLSearchParams();
    params.set('email', email.trim());
    navigate(`/email/loader?${params.toString()}`);
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
            Search by Email Address
          </h1>
          <p className={styles.heroSubtitle}>
            Enter an email address to search our comprehensive database of over 12 billion public records and find associated information.
          </p>
        </div>
      </section>

      {/* Search Form Section */}
      <section className={styles.searchFormSection}>
        <div className={styles.searchFormContainer}>
          <form onSubmit={handleSubmit} className={styles.searchForm}>
            <div className={styles.fieldGroup}>
              <label className={styles.label}>
                Email Address *
              </label>
              <div className={styles.inputWrapper}>
                <span className={styles.inputIcon}>🔍</span>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="example@email.com"
                  required
                  className={styles.inputWithIcon}
                />
              </div>
              <p style={{
                marginTop: '0.5rem',
                fontSize: '0.875rem',
                color: '#6b7280'
              }}>
                Enter a complete email address to search
              </p>
            </div>

            {/* Blurred email result preview */}
            <div className={styles.phonePreviewCard}>
              <div className={styles.phonePreviewInner}>
                <div className={styles.previewCardName}>Unknown Sender</div>
                <div className={styles.previewCardMeta}>✉️ j***@***.com</div>
                <div className={styles.previewCardDetails}>
                  <span>👤 Jane D. &bull; Age 28–38</span>
                  <span>📍 Seattle, WA</span>
                  <span>🔗 3 associated accounts</span>
                </div>
              </div>
              <div className={styles.previewLockOverlay}>
                <span className={styles.previewLockBadge}>🔒 Sign up to unlock</span>
              </div>
            </div>

            <button
              type="submit"
              className={styles.submitButton}
              disabled={!email.trim()}
            >
              Search Now
            </button>

            <p className={styles.socialProof}>
              <span className={styles.socialProofDot} />
              Over 900 email lookups completed in the last hour
            </p>
          </form>
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

export default EmailLandingPage;
