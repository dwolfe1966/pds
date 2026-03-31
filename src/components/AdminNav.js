import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import styles from './AdminNav.module.css';
const logoSrc = new URL('../assets/idlookup_icon_transparent.png', import.meta.url).href;

const navLinks = [
  { path: '/admin/users',        label: 'Customers' },
  { path: '/admin/purchases',    label: 'Orders' },
  { path: '/admin/data-removal', label: 'Opt-Outs' },
  { path: '/admin/email-search', label: 'Email Search' },
  { path: '/admin/cs-reps',      label: 'CS Reps' },
  { path: '/admin/email',        label: 'Broadcast' },
  { path: '/admin/analytics',    label: 'Analytics' },
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
