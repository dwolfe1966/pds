import React from 'react';
import { useAuth } from '../context/AuthContext';
import SalesNav from './SalesNav';
import MemberNav from './MemberNav';
import styles from './Header.module.css';

const Header = () => {
  const { token } = useAuth();
  // Consumer app never renders AdminNav — admins use the separate CSR app build.
  const navComponent = token ? <MemberNav /> : <SalesNav />;
  return (
    <header className={styles.header}>
      {navComponent}
    </header>
  );
};

export default Header;