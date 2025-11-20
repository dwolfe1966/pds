import React from 'react';
import { useAuth } from '../context/AuthContext';
import SalesNav from './SalesNav';
import MemberNav from './MemberNav';
import AdminNav from './AdminNav';

const Header = () => {
  const { token, user } = useAuth();
  // Decide which navigation bar to render
  let navComponent;
  if (!token) {
    navComponent = <SalesNav />;
  } else if (user && user.role === 'admin') {
    navComponent = <AdminNav />;
  } else {
    navComponent = <MemberNav />;
  }
  return (
    <header style={{ backgroundColor: '#0e123b', color: '#fff', padding: '1rem' }}>
      {navComponent}
    </header>
  );
};

export default Header;