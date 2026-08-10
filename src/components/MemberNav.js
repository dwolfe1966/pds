import React, { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import styles from './MemberNav.module.css';
import BrandLogo from './BrandLogo';
import { useBrand } from '../services/brand';
import NotificationBell from './NotificationBell';

/**
 * Navigation bar for authenticated member pages.
 * Matches SalesNav styling for consistency.
 * Includes links to dashboard, profile, search, who is searching me, alerts,
 * account, settings and logout.
 * Includes responsive hamburger menu for mobile devices.
 */
const MemberNav = () => {
  const { logout, user, isPaid } = useAuth();
  const location = useLocation();
  const brand = useBrand();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const navLinks = [
    { path: '/dashboard', label: 'Dashboard' },
    { path: '/people-search', label: 'Search' },
    { path: '/who-is-searching', label: "Who's Searching" },
    { path: '/my-identity', label: 'My Identity' },
    // Activity = searches + logins + notifications + everything we track. Sits just left of Account.
    // (Alerts hidden for now; WSFY stays top-level for now — later linked from Dashboard/Activity/My Identity.)
    { path: '/activity', label: 'Activity' },
    { path: '/account', label: 'Account' },
  ];

  // Account sub-sections — shown as indented sub-nav under Account in the mobile hamburger
  // (on mobile the AccountPage's horizontal tab bar is hidden; these deep-link to ?tab=).
  const accountSubTabs = [
    { tab: 'overview', label: 'Overview' },
    { tab: 'contact', label: 'Contact' },
    { tab: 'security', label: 'Security' },
    { tab: 'billing', label: 'Subscription & Billing' },
    { tab: 'messages', label: 'Messages' },
    { tab: 'communications', label: 'Communications' },
  ];
  const currentAccountTab = (() => {
    if (location.pathname !== '/account') return null;
    const t = new URLSearchParams(location.search).get('tab');
    return accountSubTabs.some((s) => s.tab === t) ? t : 'overview';
  })();

  // My Identity sub-tabs — shown in the mobile hamburger (the page's inline subnav is hidden on mobile);
  // deep-link via ?sub=. Overview = protection at a glance, My Profile = the modular profile, Footprint.
  const identitySubTabs = [
    { sub: 'profile', label: 'Overview' },
    { sub: 'modular', label: 'My Profile' },
    { sub: 'footprint', label: 'Digital Footprint' },
    { sub: 'extension', label: 'Browser Assistant' },
  ];
  const currentIdentitySub = (() => {
    if (location.pathname !== '/my-identity') return null;
    const s = new URLSearchParams(location.search).get('sub');
    return identitySubTabs.some((x) => x.sub === s) ? s : 'profile';
  })();

  const isActive = (path) => {
    if (path === '/dashboard') {
      return location.pathname === '/dashboard';
    }
    if (path === '/people-search') {
      return location.pathname.startsWith('/people');
    }
    if (path === '/who-is-searching') {
      return location.pathname === '/who-is-searching';
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

        {/* Desktop Auth Section */}
        <div className={styles.authButtons}>
          {user && <NotificationBell />}
          {user && (
            <div className={styles.userDisplay}>
              <div className={styles.userAvatar}>
                {(user.fullName || user.email || 'M').charAt(0).toUpperCase()}
              </div>
              <span className={styles.userEmail}>
                {user.fullName || user.email || 'Member'}
              </span>
              <span className={isPaid ? styles.tierBadgePro : styles.tierBadgeFree}>
                {isPaid ? 'Pro' : 'Free'}
              </span>
            </div>
          )}
          <button onClick={handleLogout} className={styles.logoutButton}>
            Sign out
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
              <React.Fragment key={link.path}>
                <Link
                  to={link.path}
                  className={`${styles.mobileNavLink} ${isActive(link.path) ? styles.mobileNavLinkActive : ''}`}
                  onClick={() => setMobileMenuOpen(false)}
                >
                  {link.label}
                </Link>
                {link.path === '/account' && accountSubTabs.map((st) => (
                  <Link
                    key={st.tab}
                    to={`/account?tab=${st.tab}`}
                    className={`${styles.mobileNavSubLink} ${currentAccountTab === st.tab ? styles.mobileNavSubLinkActive : ''}`}
                    onClick={() => setMobileMenuOpen(false)}
                  >
                    {st.label}
                  </Link>
                ))}
                {link.path === '/my-identity' && identitySubTabs.map((st) => (
                  <Link
                    key={st.sub}
                    to={`/my-identity?sub=${st.sub}`}
                    className={`${styles.mobileNavSubLink} ${currentIdentitySub === st.sub ? styles.mobileNavSubLinkActive : ''}`}
                    onClick={() => setMobileMenuOpen(false)}
                  >
                    {st.label}
                  </Link>
                ))}
              </React.Fragment>
            ))}
          </div>

          <div className={styles.mobileAuthButtons}>
            {user && (
              <div className={styles.mobileUserRow}>
                <span className={styles.mobileUserEmail}>{user.fullName || user.email || 'Member'}</span>
                <span className={isPaid ? styles.tierBadgePro : styles.tierBadgeFree}>
                  {isPaid ? 'Pro' : 'Free'}
                </span>
              </div>
            )}
            <button
              onClick={handleLogout}
              className={styles.mobileLogoutButton}
            >
              Sign out
            </button>
          </div>
        </div>
      </div>
    </>
  );
};

export default MemberNav;