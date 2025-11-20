import React from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

/**
 * Navigation bar for administrator pages.
 * Provides quick links to admin features and logout.
 */
const AdminNav = () => {
  const { logout } = useAuth();
  return (
    <nav style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
      <div>
        <Link to="/admin/users" style={{ color: '#fff', textDecoration: 'none', fontWeight: 'bold' }}>
          IDLookup.AI Admin
        </Link>
      </div>
      <div style={{ display: 'flex', gap: '1rem' }}>
        <Link to="/admin/users" style={{ color: '#fff' }}>Users</Link>
        <Link to="/admin/sessions" style={{ color: '#fff' }}>Sessions</Link>
        <Link to="/admin/purchases" style={{ color: '#fff' }}>Purchases</Link>
        <Link to="/admin/data-removal" style={{ color: '#fff' }}>Data Removal</Link>
        <Link to="/admin/analytics" style={{ color: '#fff' }}>Analytics</Link>
        <Link to="/admin/cs-reps" style={{ color: '#fff' }}>CS Reps</Link>
        <button onClick={logout} style={{ background: 'transparent', border: '1px solid #fff', color: '#fff', padding: '0.25rem 0.5rem', cursor: 'pointer' }}>
          Logout
        </button>
      </div>
    </nav>
  );
};

export default AdminNav;