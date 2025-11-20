import React from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

/**
 * Navigation bar for authenticated member pages.
 * Includes links to dashboard, profile, search, who is searching me, alerts,
 * account, settings and logout.
 */
const MemberNav = () => {
  const { logout } = useAuth();
  return (
    <nav style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
      <div>
        <Link to="/dashboard" style={{ color: '#fff', textDecoration: 'none', fontWeight: 'bold' }}>
          IDLookup.AI
        </Link>
      </div>
      <div style={{ display: 'flex', gap: '1rem' }}>
        <Link to="/dashboard" style={{ color: '#fff' }}>Dashboard</Link>
        <Link to="/profile" style={{ color: '#fff' }}>Profile</Link>
        <Link to="/people-search" style={{ color: '#fff' }}>Search</Link>
        <Link to="/who-is-searching" style={{ color: '#fff' }}>Who&#39;s Searching</Link>
        <Link to="/alerts" style={{ color: '#fff' }}>Alerts</Link>
        <Link to="/account" style={{ color: '#fff' }}>Account</Link>
        <Link to="/settings" style={{ color: '#fff' }}>Settings</Link>
        <button onClick={logout} style={{ background: 'transparent', border: '1px solid #fff', color: '#fff', padding: '0.25rem 0.5rem', cursor: 'pointer' }}>
          Logout
        </button>
      </div>
    </nav>
  );
};

export default MemberNav;