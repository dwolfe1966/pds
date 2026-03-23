import React from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAdminAuth } from '../context/AdminAuthContext';

const NAV = [
  { label: 'Customers',       to: '/customers' },
  { label: 'Orders',          to: '/orders' },
  { label: 'Payments',        to: '/payments' },
  { label: 'Emails',          to: '/emails' },
  { label: 'Mail Sent',       to: '/mail-sent' },
  { label: 'User Mgmt',       to: '/user-management' },
  { label: 'Opt-Out',         to: '/optout/users' },
  { label: 'Notes',           to: '/notes' },
  { label: 'Content',         to: '/content' },
  { label: 'Permissions',     to: '/permissions' },
  { label: 'Offers',          to: '/offers' },
  { label: 'Unsubscribe',     to: '/unsubscribe' },
  { label: 'Logs',            to: '/logs' },
  { label: 'Tracking',        to: '/tracking' },
  { label: 'Timesheets',      to: '/timesheets' },
  { label: 'UX',              to: '/ux' },
  { label: 'UXC History',     to: '/ux-history' },
];

export default function AdminLayout({ children }) {
  const { user, logout } = useAdminAuth();
  const navigate = useNavigate();

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <header className="admin-header">
        <span className="brand" style={{ cursor: 'pointer' }} onClick={() => navigate('/customers')}>
          IDLookup Admin
        </span>
        <nav style={{ overflowX: 'auto', display: 'flex', gap: 0 }}>
          {NAV.map(item => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) => isActive ? 'nav-link active' : 'nav-link'}
              style={({ isActive }) => ({
                color: isActive ? '#fff' : 'rgba(255,255,255,0.85)',
                background: isActive ? 'rgba(255,255,255,0.2)' : 'none',
                fontWeight: 500,
                fontSize: '0.82rem',
                padding: '0.35rem 0.65rem',
                borderRadius: 4,
                textDecoration: 'none',
                whiteSpace: 'nowrap',
              })}
            >
              {item.label}
            </NavLink>
          ))}
        </nav>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexShrink: 0 }}>
          {user && <span className="user-pill">{user.firstName || user.email}</span>}
          <button className="btn btn-secondary btn-sm" style={{ color: '#fff', borderColor: 'rgba(255,255,255,0.5)' }} onClick={logout}>
            Logout
          </button>
        </div>
      </header>

      <main style={{ flex: 1 }}>
        <div className="admin-container">
          {children}
        </div>
      </main>

      <footer className="admin-footer">
        IDLookup.ai © {new Date().getFullYear()}. Internal use only.
      </footer>
    </div>
  );
}
