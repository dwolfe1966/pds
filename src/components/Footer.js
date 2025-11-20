import React from 'react';
import { Link } from 'react-router-dom';

const Footer = () => (
  <footer style={{ backgroundColor: '#0e123b', color: '#fff', padding: '2rem 1rem', marginTop: 'auto' }}>
    <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', marginBottom: '1.5rem' }}>
        <div style={{ marginBottom: '1rem' }}>
          <h4 style={{ margin: '0 0 0.5rem 0', fontSize: '1rem' }}>IDLookup.AI</h4>
          <p style={{ margin: 0, fontSize: '0.9rem', color: '#ccc' }}>
            Find people and monitor who searches for you.
          </p>
        </div>
        <div style={{ display: 'flex', gap: '2rem', flexWrap: 'wrap' }}>
          <div>
            <h5 style={{ margin: '0 0 0.5rem 0', fontSize: '0.9rem' }}>Legal</h5>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
              <Link to="/privacy" style={{ color: '#fff', textDecoration: 'none', fontSize: '0.85rem' }}>
                Privacy Policy
              </Link>
              <Link to="/terms" style={{ color: '#fff', textDecoration: 'none', fontSize: '0.85rem' }}>
                Terms of Service
              </Link>
              <Link to="/refund" style={{ color: '#fff', textDecoration: 'none', fontSize: '0.85rem' }}>
                Refund Policy
              </Link>
              <Link to="/cpcc" style={{ color: '#fff', textDecoration: 'none', fontSize: '0.85rem' }}>
                California Privacy
              </Link>
            </div>
          </div>
          <div>
            <h5 style={{ margin: '0 0 0.5rem 0', fontSize: '0.9rem' }}>Resources</h5>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
              <Link to="/opt-out" style={{ color: '#fff', textDecoration: 'none', fontSize: '0.85rem' }}>
                Opt Out
              </Link>
              <Link to="/suppression-list" style={{ color: '#fff', textDecoration: 'none', fontSize: '0.85rem' }}>
                Suppression List
              </Link>
              <Link to="/partner" style={{ color: '#fff', textDecoration: 'none', fontSize: '0.85rem' }}>
                Partner With Us
              </Link>
              <Link to="/addon" style={{ color: '#fff', textDecoration: 'none', fontSize: '0.85rem' }}>
                Add-On Services
              </Link>
            </div>
          </div>
          <div>
            <h5 style={{ margin: '0 0 0.5rem 0', fontSize: '0.9rem' }}>Support</h5>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
              <Link to="/contact" style={{ color: '#fff', textDecoration: 'none', fontSize: '0.85rem' }}>
                Contact Us
              </Link>
              <Link to="/about" style={{ color: '#fff', textDecoration: 'none', fontSize: '0.85rem' }}>
                About
              </Link>
            </div>
          </div>
        </div>
      </div>
      <div style={{ borderTop: '1px solid rgba(255,255,255,0.2)', paddingTop: '1rem', textAlign: 'center' }}>
        <small style={{ fontSize: '0.85rem', color: '#ccc' }}>
          © {new Date().getFullYear()} IDLookup.AI. All rights reserved.
        </small>
      </div>
    </div>
  </footer>
);

export default Footer;