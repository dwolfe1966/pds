import React, { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import styles from './AdminNav.module.css';
// Inlined data URI — the .png asset import resolves to an empty object {} in the
// Parcel build (→ broken <img src="[object Object]">, same as consumer bug #67).
import logoSrc from '../assets/idlookupLogo';

// Permissions / Content & UX / Offers are hidden from v1 nav — they're
// localStorage-only today (no BC endpoints exist). Mail Log, CS Reps,
// Analytics, and Activity & Logs were also removed from v1 nav (some
// depend on tracking-api, others on mock-only fetches). Routes still
// resolve if a URL is typed directly so in-progress work is preserved.
const navLinks = [
  { path: '/my-dashboard', label: 'My Dashboard' },
  { path: '/users',        label: 'Customers' },
  { path: '/orders',       label: 'Orders' },
  { path: '/data-removal', label: 'Opt-Outs' },
  { path: '/unsubscribe',  label: 'Unsubscribed' },
  { path: '/notes',        label: 'Notes' },
  { path: '/tickets',      label: 'Messages' },
];

const AdminNav = () => {
  const { user, logout } = useAuth();
  const location = useLocation();

  // Logged-in CSR identity: prefer a real name, fall back to email (staff/admin
  // accounts often have no firstName/lastName), then a generic label.
  const csrName = [user?.firstName, user?.lastName].filter(Boolean).join(' ').trim();
  const csrIdentity = csrName || user?.email || 'Account';
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
          placeholder="ID, email, phone, or ZIP…"
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

      {/* Logged-in CSR identity */}
      {user && (
        <Link to="/my-dashboard" className={styles.userIdentity} title={user.email || csrIdentity}>
          {csrIdentity}
        </Link>
      )}

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
              placeholder="ID, email, phone, or ZIP…"
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
          {user && (
            <Link
              to="/my-dashboard"
              className={styles.mobileUser}
              title={user.email || csrIdentity}
              onClick={() => setMenuOpen(false)}
            >
              {csrIdentity}
            </Link>
          )}
          <button onClick={logout} className={styles.mobileLogout}>Sign out</button>
        </div>
      )}
    </nav>
  );
};

export default AdminNav;
