import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import styles from './AdminNav.module.css';
const logoSrc = new URL('../assets/idlookup_icon_transparent.png', import.meta.url).href;

const navLinks = [
  { path: '/users',        label: 'Customers' },
  { path: '/orders',       label: 'Orders' },
  { path: '/payments',     label: 'Payments' },
  { path: '/data-removal', label: 'Opt-Outs' },
  { path: '/phone-optout',  label: 'Phone Opt-Outs' },
  { path: '/unsubscribe',   label: 'Unsubscribed' },
  { path: '/email-search', label: 'Email Search' },
  { path: '/notes',        label: 'Notes' },
  { path: '/tickets',      label: 'Tickets' },
  { path: '/mail-log',     label: 'Mail Log' },
  { path: '/cs-reps',      label: 'CS Reps' },
  { path: '/email',        label: 'Broadcast' },
  { path: '/analytics',    label: 'Analytics' },
  { path: '/timesheets',   label: 'Timesheets' },
  { path: '/permissions',  label: 'Permissions' },
  { path: '/content',      label: 'Content' },
  { path: '/offers',       label: 'Offers' },
  { path: '/sessions',     label: 'Activity' },
  { path: '/logs',         label: 'Logs' },
  { path: '/ux',           label: 'UX Mgmt' },
  { path: '/uxc-history',  label: 'UXC History' },
];

const AdminNav = () => {
  const { logout } = useAuth();
  const location = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);

  const isActive = (path) => location.pathname === path || location.pathname.startsWith(path + '/');

  return (
    <nav className={styles.nav}>
      <Link to="/users" className={styles.logo}>
        <img src={logoSrc} alt="IDLookup.AI" className={styles.logoImg} />
        <span>Admin</span>
      </Link>

      {/* Desktop links */}
      <div className={styles.links}>
        {navLinks.map((l) => (
          <Link
            key={l.path}
            to={l.path}
            className={`${styles.link} ${isActive(l.path) ? styles.linkActive : ''}`}
          >
            {l.label}
          </Link>
        ))}
      </div>

      <button onClick={logout} className={styles.logoutBtn}>Sign out</button>

      {/* Mobile hamburger */}
      <button
        className={styles.hamburger}
        onClick={() => setMenuOpen(!menuOpen)}
        aria-label="Toggle menu"
      >
        <span /><span /><span />
      </button>

      {/* Mobile dropdown */}
      {menuOpen && (
        <div className={styles.mobileMenu}>
          {navLinks.map((l) => (
            <Link
              key={l.path}
              to={l.path}
              className={`${styles.mobileLink} ${isActive(l.path) ? styles.mobileLinkActive : ''}`}
              onClick={() => setMenuOpen(false)}
            >
              {l.label}
            </Link>
          ))}
          <button onClick={logout} className={styles.mobileLogout}>Sign out</button>
        </div>
      )}
    </nav>
  );
};

export default AdminNav;
