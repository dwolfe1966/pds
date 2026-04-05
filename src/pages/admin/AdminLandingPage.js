import React from 'react';
import { Link } from 'react-router-dom';

const AdminLandingPage = () => {
  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(145deg, #0f172a 0%, #1e293b 50%, #0f172a 100%)',
      display: 'flex', flexDirection: 'column',
    }}>
      {/* Header */}
      <header style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '1.25rem 2rem',
        borderBottom: '1px solid rgba(255,255,255,0.08)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <div style={{
            width: '36px', height: '36px', borderRadius: '8px',
            background: 'linear-gradient(135deg, #3b82f6 0%, #8b5cf6 100%)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '1rem', fontWeight: 800, color: '#fff',
          }}>BC</div>
          <span style={{
            fontSize: '1.1rem', fontWeight: 700, color: '#f1f5f9',
            letterSpacing: '-0.02em',
          }}>ByteCrtrs</span>
        </div>
        <Link to="/login" style={{
          padding: '0.55rem 1.5rem', background: 'rgba(255,255,255,0.1)',
          color: '#e2e8f0', border: '1px solid rgba(255,255,255,0.15)',
          borderRadius: '0.5rem', fontSize: '0.88rem', fontWeight: 600,
          textDecoration: 'none', transition: 'all 0.2s ease',
        }}>
          Sign In
        </Link>
      </header>

      {/* Hero */}
      <main style={{
        flex: 1, display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        padding: '3rem 1.5rem', textAlign: 'center',
      }}>
        <div style={{
          fontSize: '0.7rem', fontWeight: 700, color: '#818cf8',
          letterSpacing: '0.2em', textTransform: 'uppercase',
          marginBottom: '1rem',
        }}>
          Administration Portal
        </div>

        <h1 style={{
          fontSize: 'clamp(2rem, 6vw, 3.5rem)', fontWeight: 800,
          color: '#f1f5f9', margin: '0 0 1rem',
          letterSpacing: '-0.04em', lineHeight: 1.1,
          maxWidth: '700px',
        }}>
          ByteCrtrs<br />
          <span style={{ color: '#818cf8' }}>Admin Dashboard</span>
        </h1>

        <p style={{
          fontSize: '1.1rem', color: '#94a3b8', margin: '0 0 2.5rem',
          maxWidth: '520px', lineHeight: 1.6,
        }}>
          Manage customers, orders, support tickets, analytics, and platform
          operations from a single unified dashboard.
        </p>

        <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', justifyContent: 'center' }}>
          <Link to="/login" style={{
            padding: '0.85rem 2.25rem',
            background: 'linear-gradient(135deg, #3b82f6 0%, #8b5cf6 100%)',
            color: '#ffffff', border: 'none', borderRadius: '0.5rem',
            fontSize: '1rem', fontWeight: 700, textDecoration: 'none',
            boxShadow: '0 4px 20px rgba(99,102,241,0.35)',
            transition: 'all 0.2s ease',
          }}>
            Admin Login
          </Link>
        </div>

        {/* Feature grid */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: '1rem', maxWidth: '800px', width: '100%',
          marginTop: '4rem',
        }}>
          {[
            { icon: '\uD83D\uDC65', title: 'Customer Management', desc: 'View accounts, orders, and activity' },
            { icon: '\uD83D\uDCCA', title: 'Analytics', desc: 'Revenue, funnels, and conversion metrics' },
            { icon: '\uD83C\uDFAB', title: 'Support Tickets', desc: 'Manage CS workflows and escalations' },
            { icon: '\u2699\uFE0F', title: 'Platform Config', desc: 'Offers, content, permissions, and UX' },
          ].map(({ icon, title, desc }) => (
            <div key={title} style={{
              background: 'rgba(255,255,255,0.04)',
              border: '1px solid rgba(255,255,255,0.08)',
              borderRadius: '0.75rem', padding: '1.25rem',
              textAlign: 'left',
            }}>
              <div style={{ fontSize: '1.5rem', marginBottom: '0.5rem' }}>{icon}</div>
              <h3 style={{
                fontSize: '0.95rem', fontWeight: 700, color: '#e2e8f0',
                margin: '0 0 0.3rem',
              }}>{title}</h3>
              <p style={{ fontSize: '0.82rem', color: '#64748b', margin: 0, lineHeight: 1.4 }}>
                {desc}
              </p>
            </div>
          ))}
        </div>
      </main>

      {/* Footer */}
      <footer style={{
        padding: '1.5rem 2rem', textAlign: 'center',
        borderTop: '1px solid rgba(255,255,255,0.06)',
        fontSize: '0.78rem', color: '#475569',
      }}>
        &copy; {new Date().getFullYear()} ByteCreators Inc. All rights reserved.
      </footer>
    </div>
  );
};

export default AdminLandingPage;
