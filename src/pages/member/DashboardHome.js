import React from 'react';
import { Link } from 'react-router-dom';

/**
 * Home dashboard for members. Shows high‑level stats and links to detail pages.
 */
const DashboardHome = () => {
  return (
    <main style={{ padding: '2rem' }}>
      <h1>Dashboard</h1>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
        <div style={{ border: '1px solid #ccc', padding: '1rem' }}>
          <h3>Who searched for you</h3>
          <p>0 searches this month</p>
          <Link to="/who-is-searching">View details</Link>
        </div>
        <div style={{ border: '1px solid #ccc', padding: '1rem' }}>
          <h3>Alerts</h3>
          <p>0 active alerts</p>
          <Link to="/alerts">Manage alerts</Link>
        </div>
        <div style={{ border: '1px solid #ccc', padding: '1rem' }}>
          <h3>Subscription</h3>
          <p>Basic Plan</p>
          <Link to="/account">Manage subscription</Link>
        </div>
      </div>
    </main>
  );
};

export default DashboardHome;