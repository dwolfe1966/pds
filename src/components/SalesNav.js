import React, { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import styles from './SalesNav.module.css';
import BrandLogo from './BrandLogo';
import { useBrand } from '../services/brand';

/**
 * Navigation bar for unauthenticated (sales) pages.
 * Enhanced design based on PQS production site patterns.
 * Includes responsive hamburger menu for mobile devices.
 */
const SalesNav = () => {
  const location = useLocation();
  const brand = useBrand();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const navLinks = [
    { path: '/', label: 'Home' },
    { path: '/search/all', label: 'Search' },
    { path: '/about', label: 'About' },
    { path: '/contact', label: 'Contact' },
  ];

  const isActive = (path) => {
    if (path === '/') {
      return location.pathname === '/';
    }
    if (path === '/search/all') {
      // Highlight search link for all search-related pages
      return location.pathname.startsWith('/search') || 
             location.pathname.startsWith('/name/') || 
             location.pathname.startsWith('/phone/') || 
             location.pathname.startsWith('/email/');
    }
    return location.pathname.startsWith(path);
  };

  // Close mobile menu when route changes
  useEffect(() => {
    setMobileMenuOpen(false);
  }, [location.pathname]);

  // Close mobile menu on escape key
  useEffect(() => {
    const handleEscape = (e) => {
      if (e.key === 'Escape' && mobileMenuOpen) {
        setMobileMenuOpen(false);
      }
    };
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [mobileMenuOpen]);

  // Prevent body scroll when mobile menu is open
  useEffect(() => {
    if (mobileMenuOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [mobileMenuOpen]);

  return (
    <>
      <nav className={styles.nav}>
        {/* Logo */}
        <div>
          <Link to="/" className={styles.logo}>
            <BrandLogo height={36} style={{ marginRight: '0.5rem' }} />
            <span style={{ verticalAlign: 'middle' }}>{brand.name}</span>
          </Link>
        </div>

        {/* Desktop Navigation */}
        <div className={styles.navLinks}>
          {navLinks.map((link) => (
            <Link
              key={link.path}
              to={link.path}
              className={`${styles.navLink} ${isActive(link.path) ? styles.navLinkActive : ''}`}
            >
              {link.label}
            </Link>
          ))}
        </div>

        {/* Desktop Auth Buttons */}
        <div className={styles.authButtons}>
          <Link to="/login" className={styles.loginLink}>
            Login
          </Link>
          <Link to="/signup" className={styles.signupButton}>
            Sign Up
          </Link>
        </div>

        {/* Mobile Hamburger Button */}
        <button
          className={styles.hamburger}
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          aria-label="Toggle menu"
          aria-expanded={mobileMenuOpen}
        >
          <span className={`${styles.hamburgerLine} ${mobileMenuOpen ? styles.hamburgerLineOpen : ''}`}></span>
          <span className={`${styles.hamburgerLine} ${mobileMenuOpen ? styles.hamburgerLineOpen : ''}`}></span>
          <span className={`${styles.hamburgerLine} ${mobileMenuOpen ? styles.hamburgerLineOpen : ''}`}></span>
        </button>
      </nav>

      {/* Mobile Menu Overlay */}
      <div 
        className={`${styles.mobileMenuOverlay} ${mobileMenuOpen ? styles.mobileMenuOverlayOpen : ''}`}
        onClick={() => setMobileMenuOpen(false)}
      >
        <div 
          className={`${styles.mobileMenu} ${mobileMenuOpen ? styles.mobileMenuOpen : ''}`}
          onClick={(e) => e.stopPropagation()}
        >
          <div className={styles.mobileMenuHeader}>
            <Link to="/" className={styles.mobileLogo} onClick={() => setMobileMenuOpen(false)}>
              <BrandLogo height={30} style={{ marginRight: '0.4rem' }} />
              <span style={{ verticalAlign: 'middle' }}>{brand.name}</span>
            </Link>
            <button
              className={styles.mobileMenuClose}
              onClick={() => setMobileMenuOpen(false)}
              aria-label="Close menu"
            >
              ×
            </button>
          </div>
          
          <div className={styles.mobileNavLinks}>
            {navLinks.map((link) => (
              <Link
                key={link.path}
                to={link.path}
                className={`${styles.mobileNavLink} ${isActive(link.path) ? styles.mobileNavLinkActive : ''}`}
                onClick={() => setMobileMenuOpen(false)}
              >
                {link.label}
              </Link>
            ))}
          </div>

          <div className={styles.mobileAuthButtons}>
            <Link 
              to="/login" 
              className={styles.mobileLoginLink}
              onClick={() => setMobileMenuOpen(false)}
            >
              Login
            </Link>
            <Link 
              to="/signup" 
              className={styles.mobileSignupButton}
              onClick={() => setMobileMenuOpen(false)}
            >
              Sign Up
            </Link>
          </div>
        </div>
      </div>
    </>
  );
};

export default SalesNav;