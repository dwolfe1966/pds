import React from 'react';
import { Link } from 'react-router-dom';
import SearchBar from '../../components/SearchBar';

/**
 * Home page for public visitors.
 * This page introduces IDLookup.AI and encourages users to start a search or sign up.
 */
const HomePage = () => {
  return (
    <main style={{ padding: '2rem', maxWidth: '1000px', margin: '0 auto' }}>
      <div style={{ textAlign: 'center', marginBottom: '3rem' }}>
        <h1 style={{ color: '#0e123b', marginBottom: '1rem', fontSize: '2.5rem' }}>
          Welcome to IDLookup.AI
        </h1>
        <p style={{ color: '#666', fontSize: '1.2rem', lineHeight: '1.6', marginBottom: '2rem' }}>
          Find people and monitor when others search for you. Get comprehensive information 
          from public records and discover who's looking for you.
        </p>
        <div style={{ maxWidth: '600px', margin: '0 auto' }}>
          <SearchBar />
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '2rem', marginBottom: '3rem' }}>
        <div style={{ padding: '1.5rem', backgroundColor: '#f5f5f5', borderRadius: '4px' }}>
          <h3 style={{ color: '#0e123b', marginTop: 0 }}>Find People</h3>
          <p style={{ color: '#666', lineHeight: '1.6' }}>
            Search for anyone using their name, phone number, or other identifiers. 
            Get comprehensive public records information.
          </p>
        </div>
        <div style={{ padding: '1.5rem', backgroundColor: '#f5f5f5', borderRadius: '4px' }}>
          <h3 style={{ color: '#0e123b', marginTop: 0 }}>Monitor Searches</h3>
          <p style={{ color: '#666', lineHeight: '1.6' }}>
            Create an account to see who's searching for you. Get alerts when someone 
            looks up your information.
          </p>
        </div>
        <div style={{ padding: '1.5rem', backgroundColor: '#f5f5f5', borderRadius: '4px' }}>
          <h3 style={{ color: '#0e123b', marginTop: 0 }}>Detailed Reports</h3>
          <p style={{ color: '#666', lineHeight: '1.6' }}>
            Access comprehensive reports with contact information, addresses, 
            social media profiles, and more.
          </p>
        </div>
      </div>

      <div style={{ textAlign: 'center', padding: '2rem', backgroundColor: '#0e123b', color: '#fff', borderRadius: '4px' }}>
        <h2 style={{ marginTop: 0, marginBottom: '1rem' }}>Ready to Get Started?</h2>
        <p style={{ marginBottom: '1.5rem', fontSize: '1.1rem' }}>
          Create a free account to unlock full access to detailed reports and search monitoring.
        </p>
        <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center' }}>
          <Link
            to="/signup"
            style={{
              padding: '0.75rem 2rem',
              backgroundColor: '#fff',
              color: '#0e123b',
              textDecoration: 'none',
              borderRadius: '4px',
              fontWeight: 'bold'
            }}
          >
            Sign Up Free
          </Link>
          <Link
            to="/search"
            style={{
              padding: '0.75rem 2rem',
              backgroundColor: 'transparent',
              color: '#fff',
              textDecoration: 'none',
              borderRadius: '4px',
              border: '2px solid #fff',
              fontWeight: 'bold'
            }}
          >
            Start Searching
          </Link>
        </div>
      </div>
    </main>
  );
};

export default HomePage;