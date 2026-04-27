import React, { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import styles from './AdminNav.module.css';
// Use static import so Parcel bundles the image without import.meta (needed for classic script mode)
import logoSrc from '../assets/idlookup_icon_transparent.png';

// Permissions / Content & UX / Offers are hidden from v1 nav — they're
// localStorage-only today (no BC endpoints exist). Routes still resolve if
// a URL is typed directly so in-progress work there is preserved. Re-add the
// entries here once the BC surface for each lands.
const navLinks = [
  { path: '/my-dashboard', label: 'My Dashboard' },
  { path: '/users',        label: 'Customers' },
  { path: '/orders',       label: 'Orders' },
  { path: '/data-removal', label: 'Opt-Outs' },
  { path: '/unsubscribe',  label: 'Unsubscribed' },
  { path: '/notes',        label: 'Notes' },
  { path: '/tickets',      label: 'Tickets' },
  { path: '/mail-log',     label: 'Mail Log' },
  { path: '/cs-reps',      label: 'CS Reps' },
  { path: '/analytics',    label: 'Analytics' },
  { path: '/sessions',     label: 'Activity & Logs' },
];

const AdminNav = () => {
  const { logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const isActive = (path) => location.pathname === path || location.pathname.startsWith(path + '/');

  const handleSearch = (e) => {
    e.preventDefault();
    const q = searchQuery.trim();
    if (!q) return;
    navigate(`/users?q=${encodeURIComponent(q)}`);
    setSearchQuery('');
    setMenuOpen(false);
  };

  return (
    <nav className={styles.nav}>
      <Link to="/my-dashboard" className={styles.logo}>
        <img src={logoSrc} alt="IDLookup.AI" className={styles.logoImg} />
        <span>Admin</span>
      </Link>

      {/* Customer search */}
      <form className={styles.navSearch} onSubmit={handleSearch}>
        <input
          type="text"
          className={styles.navSearchInput}
          placeholder="Search by ID, email…"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          aria-label="Search customers"
        />
      </form>

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
          <form className={styles.mobileSearch} onSubmit={handleSearch}>
            <input
              type="text"
              className={styles.navSearchInput}
              placeholder="Search by ID, email…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </form>
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
