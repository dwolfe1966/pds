import React, { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import styles from './MemberNav.module.css';

/**
 * Navigation bar for authenticated member pages.
 * Matches SalesNav styling for consistency.
 * Includes links to dashboard, profile, search, who is searching me, alerts,
 * account, settings and logout.
 * Includes responsive hamburger menu for mobile devices.
 */
const MemberNav = () => {
  const { logout, user } = useAuth();
  const location = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const navLinks = [
    { path: '/dashboard', label: 'Dashboard' },
    { path: '/people-search', label: 'Search' },
    { path: '/alerts', label: 'Alerts' },
    { path: '/account', label: 'Account' },
  ];

  const isActive = (path) => {
    if (path === '/dashboard') {
      return location.pathname === '/dashboard';
    }
    if (path === '/people-search') {
      return location.pathname.startsWith('/people');
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

  const handleLogout = () => {
    logout();
    setMobileMenuOpen(false);
  };

  return (
    <>
      <nav className={styles.nav}>
        {/* Logo */}
        <div>
          <Link to="/dashboard" className={styles.logo}>
            IDLookup.AI
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

        {/* Desktop Auth Section */}
        <div className={styles.authButtons}>
          {user && (
            <span style={{ 
              color: 'rgba(255, 255, 255, 0.9)', 
              fontSize: 'var(--font-size-sm)',
              padding: 'var(--spacing-sm) var(--spacing-md)'
            }}>
              {user.email || user.fullName || 'Member'}
            </span>
          )}
          <button onClick={handleLogout} className={styles.logoutButton}>
            Logout
          </button>
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
            <Link to="/dashboard" className={styles.mobileLogo} onClick={() => setMobileMenuOpen(false)}>
              IDLookup.AI
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
            <Link
              to="/profile"
              className={`${styles.mobileNavLink} ${location.pathname === '/profile' ? styles.mobileNavLinkActive : ''}`}
              onClick={() => setMobileMenuOpen(false)}
            >
              Profile
            </Link>
            <Link
              to="/who-is-searching"
              className={`${styles.mobileNavLink} ${location.pathname === '/who-is-searching' ? styles.mobileNavLinkActive : ''}`}
              onClick={() => setMobileMenuOpen(false)}
            >
              Who&#39;s Searching
            </Link>
            <Link
              to="/settings"
              className={`${styles.mobileNavLink} ${location.pathname === '/settings' ? styles.mobileNavLinkActive : ''}`}
              onClick={() => setMobileMenuOpen(false)}
            >
              Settings
            </Link>
          </div>

          <div className={styles.mobileAuthButtons}>
            {user && (
              <div style={{ 
                color: 'var(--color-text-secondary)', 
                fontSize: 'var(--font-size-sm)',
                padding: 'var(--spacing-sm) var(--spacing-md)',
                textAlign: 'center'
              }}>
                {user.email || user.fullName || 'Member'}
              </div>
            )}
            <button 
              onClick={handleLogout}
              className={styles.mobileLogoutButton}
            >
              Logout
            </button>
          </div>
        </div>
      </div>
    </>
  );
};

export default MemberNav;