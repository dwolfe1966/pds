import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import styles from './AdminNav.module.css';
const logoSrc = new URL('../assets/idlookup_icon_transparent.png', import.meta.url).href;

const navLinks = [
  { path: '/admin/users',        label: 'Customers' },
  { path: '/admin/orders',       label: 'Orders' },
  { path: '/admin/payments',     label: 'Payments' },
  { path: '/admin/data-removal', label: 'Opt-Outs' },
  { path: '/admin/phone-optout',  label: 'Phone Opt-Outs' },
  { path: '/admin/unsubscribe',   label: 'Unsubscribed' },
  { path: '/admin/email-search', label: 'Email Search' },
  { path: '/admin/notes',        label: 'Notes' },
  { path: '/admin/tickets',      label: 'Tickets' },
  { path: '/admin/mail-log',     label: 'Mail Log' },
  { path: '/admin/cs-reps',      label: 'CS Reps' },
  { path: '/admin/email',        label: 'Broadcast' },
  { path: '/admin/analytics',    label: 'Analytics' },
  { path: '/admin/timesheets',   label: 'Timesheets' },
  { path: '/admin/permissions',  label: 'Permissions' },
  { path: '/admin/content',      label: 'Content' },
];

const AdminNav = () => {
  const { logout } = useAuth();
  const location = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);

  const isActive = (path) => location.pathname.startsWith(path);

  return (
    <nav className={styles.nav}>
      <Link to="/admin/users" className={styles.logo}>
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
