import React from 'react';
import { Link } from 'react-router-dom';

/**
 * Navigation bar for unauthenticated (sales) pages.
 * Shows links to home, about, contact, search and account actions.
 */
const SalesNav = () => {
  return (
    <nav style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
      <div>
        <Link to="/" style={{ color: '#fff', textDecoration: 'none', fontWeight: 'bold' }}>
          IDLookup.AI
        </Link>
      </div>
      <div style={{ display: 'flex', gap: '1rem' }}>
        <Link to="/" style={{ color: '#fff' }}>Home</Link>
        <Link to="/about" style={{ color: '#fff' }}>About</Link>
        <Link to="/contact" style={{ color: '#fff' }}>Contact</Link>
        <Link to="/search" style={{ color: '#fff' }}>Search</Link>
        <Link to="/login" style={{ color: '#fff' }}>Login</Link>
        <Link to="/signup" style={{ color: '#fff' }}>Sign Up</Link>
      </div>
    </nav>
  );
};

export default SalesNav;