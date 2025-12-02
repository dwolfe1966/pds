import React from 'react';
import { Link } from 'react-router-dom';
import styles from './Footer.module.css';

const Footer = () => (
  <footer className={styles.footer}>
    <div className={styles.footerContent}>
      <div className={styles.footerGrid}>
        {/* Brand Section */}
        <div className={styles.brandSection}>
          <h4>IDLookup.AI</h4>
          <p>
            Find people and monitor who searches for you. Access comprehensive public records and stay informed.
          </p>
        </div>

        {/* Legal Section */}
        <div>
          <h5 className={styles.sectionTitle}>Legal</h5>
          <div className={styles.sectionLinks}>
            {[
              { to: '/privacy', label: 'Privacy Policy' },
              { to: '/terms', label: 'Terms of Service' },
              { to: '/refund', label: 'Refund Policy' },
              { to: '/cpcc', label: 'California Privacy' },
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
          </div>
        </div>
      </div>

      {/* Copyright Section */}
      <div className={styles.copyright}>
        <small className={styles.copyrightText}>
          © {new Date().getFullYear()} IDLookup.AI. All rights reserved.
        </small>
      </div>
    </div>
  </footer>
);

export default Footer;