import React from 'react';
import { useAuth } from '../context/AuthContext';
import SalesNav from './SalesNav';
import MemberNav from './MemberNav';
import AdminNav from './AdminNav';
import styles from './Header.module.css';

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
    <header className={styles.header}>
      {navComponent}
    </header>
  );
};

export default Header;