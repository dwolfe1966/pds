import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import SearchBar from '../../components/SearchBar';
import styles from './HomePage.module.css';
import { useBrand } from '../../services/brand';
import { useLandingTrack } from '../../hooks/useLandingTrack';
import { useCampaign } from '../../context/CampaignContext';

/**
 * Home page for public visitors.
 * Enhanced design with marketing content.
 * Uses PQS production site design system.
 */
const HomePage = () => {
  const brand = useBrand();
  const navigate = useNavigate();
  const campaign = useCampaign();
  // Visitor LP event (#63) — the homepage previously fired nothing. Carries
  // data.refer attribution via trackingService.
  // Suppress the `home/home` landing_view when this is a campaign that
  // HomePageRedirect is about to send to a vertical LP — otherwise we double-fire
  // (junk home/home then the real name/v3), polluting per-page funnel reporting.
  const willRedirect = !!(campaign?.landing?.route && campaign.landing.route !== '/');
  useLandingTrack('home', 'home', !willRedirect);

  return (
    <main className={styles.main}>
      {/* Hero Section */}
      <section className={styles.hero}>
        <div className={styles.heroContent}>
          <h1 className={styles.heroTitle}>
            Find Anyone, Anytime
          </h1>
          <p className={styles.heroSubtitle}>
            Search billions of public records to find people, verify identities, and discover 
            comprehensive information. Monitor who's searching for you and stay informed.
          </p>
          
          {/* Search Bar */}
          <div className={styles.searchBarContainer}>
            <SearchBar />
          </div>

          {/* Trust Indicators */}
          <div className={styles.trustIndicators}>
            <div className={styles.trustItem}>
              <strong className={styles.trustNumber}>12B+</strong>
              Public Records
            </div>
            <div className={styles.trustItem}>
              <strong className={styles.trustNumber}>100M+</strong>
              People Searched
            </div>
            <div className={styles.trustItem}>
              <strong className={styles.trustNumber}>24/7</strong>
              Access Available
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className={styles.features}>
        <div className={styles.featuresContent}>
          <h2 className={styles.featuresTitle}>
            Why Choose {brand.name}?
          </h2>
          
          <div className={styles.featuresGrid}>
            {[
              {
                title: 'Comprehensive Search',
                description: 'Search by name, phone number, email, or address. Access billions of public records from multiple sources in one place.',
                icon: '🔍'
              },
              {
                title: 'Detailed Reports',
                description: 'Get complete information including contact details, address history, relatives, social media profiles, and public records.',
                icon: '📋'
              },
              {
                title: 'Monitor Your Digital Footprint',
                description: 'See who\'s searching for you. Get real-time alerts when someone looks up your information and track your online presence.',
                icon: '👁️'
              },
              {
                title: 'Privacy Protection',
                description: 'Control your information with easy opt-out options, suppression lists, and privacy tools. We respect your privacy rights.',
                icon: '🔒'
              },
              {
                title: 'Fast & Accurate',
                description: 'Get instant results with our advanced search technology. Accurate data from verified public record sources.',
                icon: '⚡'
              },
              {
                title: 'Secure & Compliant',
                description: 'Fully compliant with privacy laws including CCPA. Your searches and data are protected with enterprise-grade security.',
                icon: '🛡️'
              }
            ].map((feature, index) => (
              <div key={index} className={styles.featureCard}>
                <div className={styles.featureIcon}>
                  {feature.icon}
                </div>
                <h3 className={styles.featureTitle}>
                  {feature.title}
                </h3>
                <p className={styles.featureDescription}>
                  {feature.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className={styles.cta}>
        <div className={styles.ctaContent}>
          <h2 className={styles.ctaTitle}>
            Ready to Get Started?
          </h2>
          <p className={styles.ctaSubtitle}>
            Create an account to unlock full access to detailed reports, search monitoring,
            and advanced features.
          </p>
          <div className={styles.ctaButtons}>
            <Link to="/signup" className={styles.buttonPrimary}>
              Sign Up
            </Link>
            <Link to="/name/landing" className={styles.buttonSecondary}>
              Start Searching
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
};

export default HomePage;