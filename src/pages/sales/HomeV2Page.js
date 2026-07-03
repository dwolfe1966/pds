import React from 'react';
import { Link } from 'react-router-dom';
import SearchBar from '../../components/SearchBar';
import styles from './HomeV2Page.module.css';
import { useBrand } from '../../services/brand';
import { useLandingTrack } from '../../hooks/useLandingTrack';

/**
 * Home page rebuild (search-first, benefit-led) — served at /home for an A/B
 * against the current SaaS-style HomePage at / (owner 2026-07-03). Applies the
 * funnel principles: serve the info need, sell benefits not features, consumer
 * tone, clean IA. No "Why Choose Us" feature grid, no "create an account" CTA.
 */

// The payoff — what a search actually surfaces (the "what", desire-building).
const FIND = [
  { icon: '📍', label: 'Addresses' },
  { icon: '📞', label: 'Phone numbers' },
  { icon: '📧', label: 'Email addresses' },
  { icon: '👪', label: 'Relatives' },
  { icon: '⚖️', label: 'Criminal & court records' },
  { icon: '🏠', label: 'Property records' },
  { icon: '🌐', label: 'Social profiles' },
  { icon: '🪪', label: 'Age & aliases' },
];

// Benefit use-cases (the "why") — outcomes, not features.
const USE_CASES = [
  { icon: '🤝', title: 'Reconnect with your past', body: 'Find an old friend, lost family, a military buddy, or someone you’ve fallen out of touch with.' },
  { icon: '🔍', title: 'Know who you’re dealing with', body: 'Check out a new date, an online buyer, a neighbor, or a business contact before you trust them.' },
  { icon: '👁️', title: 'Protect yourself', body: 'See who’s searching for you and keep an eye on what your own public records reveal.' },
];

const HomeV2Page = () => {
  const brand = useBrand();
  useLandingTrack('home', 'home-v2');

  return (
    <main className={styles.main}>
      {/* Hero — the search IS the hero */}
      <section className={styles.hero}>
        <div className={styles.brandBanner}>
          <span className={styles.brandName}>{brand.name}</span> — Find Anyone, Anytime
        </div>
        <h1 className={styles.heroTitle}>Find the whole story on anyone.</h1>
        <p className={styles.heroSubtitle}>
          Reconnect with people from your past, find out who you&apos;re really dealing with, and
          see who&apos;s searching for you — from billions of public records.
        </p>
        <div className={styles.searchBarContainer}>
          <SearchBar />
        </div>
        <div className={styles.trustIndicators}>
          <div className={styles.trustItem}><strong className={styles.trustNumber}>12B+</strong>Public Records</div>
          <div className={styles.trustItem}><strong className={styles.trustNumber}>100M+</strong>People Searched</div>
          <div className={styles.trustItem}><strong className={styles.trustNumber}>24/7</strong>Instant Access</div>
        </div>
      </section>

      {/* What you can find — payoff preview */}
      <section className={styles.findSection}>
        <h2 className={styles.sectionTitle}>What you can find</h2>
        <p className={styles.sectionSub}>One search pulls together everything public records know about a person.</p>
        <div className={styles.findGrid}>
          {FIND.map((f) => (
            <span key={f.label} className={styles.findChip}>
              <span className={styles.findIcon} aria-hidden>{f.icon}</span>{f.label}
            </span>
          ))}
        </div>
      </section>

      {/* Benefit use-cases — replaces the old "Why Choose Us" feature grid */}
      <section className={styles.useSection}>
        <div className={styles.useGrid}>
          {USE_CASES.map((u) => (
            <div key={u.title} className={styles.useCard}>
              <div className={styles.useIcon} aria-hidden>{u.icon}</div>
              <h3 className={styles.useTitle}>{u.title}</h3>
              <p className={styles.useBody}>{u.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Final CTA — points back to the search, never "create an account" */}
      <section className={styles.ctaSection}>
        <h2 className={styles.ctaTitle}>Ready to find someone?</h2>
        <p className={styles.ctaSub}>It&apos;s free to search — enter a name and see what comes up.</p>
        <Link to="/name/landing" className={styles.ctaButton}>Start Your Search →</Link>
      </section>
    </main>
  );
};

export default HomeV2Page;
