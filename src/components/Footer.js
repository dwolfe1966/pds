import React from 'react';
import { Link } from 'react-router-dom';
import styles from './Footer.module.css';
import BrandLogo from './BrandLogo';
import { useBrand } from '../services/brand';

const Footer = () => {
  const brand = useBrand();
  return (
    <footer className={styles.footer}>
      <div className={styles.footerContent}>
        <div className={styles.footerGrid}>
          {/* Brand Section */}
          <div className={styles.brandSection}>
            <div style={{ marginBottom: '0.5rem' }}>
              <BrandLogo height={32} />
            </div>
            <h4>{brand.name}</h4>
            <p>
              Find people and monitor who searches for you. Access comprehensive public records and stay informed.
            </p>
          </div>

          {/* Legal Section — Refund policy folded into Terms; California Privacy
              folded into Privacy Policy (partner bug 25). */}
          <div>
            <h5 className={styles.sectionTitle}>Legal</h5>
            <div className={styles.sectionLinks}>
              {[
                { to: '/privacy', label: 'Privacy Policy' },
                { to: '/terms', label: 'Terms of Service' },
              ].map((link) => (
                <Link key={link.to} to={link.to} className={styles.sectionLink}>
                  {link.label}
                </Link>
              ))}
            </div>
          </div>

          {/* Resources Section */}
          <div>
            <h5 className={styles.sectionTitle}>Resources</h5>
            <div className={styles.sectionLinks}>
              {[
                { to: '/opt-out', label: 'Opt Out' },
                { to: '/suppression-list', label: 'Suppression List' },
                { to: '/partner', label: 'Partner With Us' },
                { to: '/addon', label: 'Add-On Services' },
              ].map((link) => (
                <Link key={link.to} to={link.to} className={styles.sectionLink}>
                  {link.label}
                </Link>
              ))}
            </div>
          </div>

          {/* Support Section */}
          <div>
            <h5 className={styles.sectionTitle}>Support</h5>
            <div className={styles.sectionLinks}>
              {[
                { to: '/contact', label: 'Contact Us' },
                { to: '/about', label: 'About' },
              ].map((link) => (
                <Link key={link.to} to={link.to} className={styles.sectionLink}>
                  {link.label}
                </Link>
              ))}
              <a href={`mailto:${brand.supportEmail}`} className={styles.sectionLink}>
                {brand.supportEmail}
              </a>
            </div>
            <div className={styles.csSupportNote}>
              Our customer support team is available Monday&ndash;Friday, 9am&ndash;5pm EST.
              For account issues, billing questions, or data removal requests,
              please email us or visit our <Link to="/contact" className={styles.csSupportLink}>contact page</Link>.
            </div>
          </div>
        </div>

        {/* Copyright Section */}
        <div className={styles.copyright}>
          <small className={styles.copyrightText}>
            © {new Date().getFullYear()} {brand.name}. All rights reserved.
          </small>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
