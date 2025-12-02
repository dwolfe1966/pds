import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import styles from './SalesNav.module.css';

/**
 * Navigation bar for unauthenticated (sales) pages.
 * Enhanced design based on PQS production site patterns.
 */
const SalesNav = () => {
  const location = useLocation();

  const navLinks = [
    { path: '/', label: 'Home' },
    { path: '/name/landing', label: 'Search' },
    { path: '/about', label: 'About' },
    { path: '/contact', label: 'Contact' },
  ];

  const isActive = (path) => {
    if (path === '/') {
      return location.pathname === '/';
    }
    return location.pathname.startsWith(path);
  };

  return (
    <nav className={styles.nav}>
      {/* Logo */}
      <div>
        <Link to="/" className={styles.logo}>
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

      {/* Auth Buttons */}
      <div className={styles.authButtons}>
        <Link to="/login" className={styles.loginLink}>
          Login
        </Link>
        <Link to="/signup" className={styles.signupButton}>
          Sign Up
        </Link>
      </div>
    </nav>
  );
};

export default SalesNav;