import React from 'react';

/**
 * Partner page for businesses interested in partnering with IDLookup.AI.
 */
const PartnerPage = () => {
  return (
    <main style={{ padding: '2rem', maxWidth: '900px', margin: '0 auto' }}>
      <h1 style={{ color: '#0d5d2f', marginBottom: '1rem' }}>Partner With Us</h1>
      <p style={{ marginBottom: '2rem', color: '#111827', lineHeight: '1.6', fontSize: '1.1rem' }}>
        IDLookup.AI offers partnership opportunities for businesses looking to integrate 
        public records search capabilities into their platforms.
      </p>

      <div style={{ marginBottom: '2rem' }}>
        <h2 style={{ color: '#0d5d2f', marginBottom: '1rem' }}>Why Partner With IDLookup.AI?</h2>
        <ul style={{ color: '#6b7280', lineHeight: '1.8', paddingLeft: '1.5rem' }}>
          <li>Access to comprehensive public records database</li>
          <li>Reliable API integration for seamless user experience</li>
          <li>Competitive pricing and flexible partnership models</li>
          <li>Dedicated support team for technical assistance</li>
          <li>Regular updates and new data sources</li>
        </ul>
      </div>

      <div style={{ marginBottom: '2rem' }}>
        <h2 style={{ color: '#0d5d2f', marginBottom: '1rem' }}>Partnership Options</h2>
        <div style={{ display: 'grid', gap: '1.5rem', marginBottom: '2rem' }}>
          <div style={{ padding: '1.5rem', border: '1px solid #d1d5db', borderRadius: '0.375rem' }}>
            <h3 style={{ color: '#0d5d2f', marginTop: 0 }}>API Integration</h3>
            <p style={{ color: '#6b7280', lineHeight: '1.6' }}>
              Integrate our search API directly into your application. Perfect for businesses 
              that want to offer search functionality to their users.
            </p>
          </div>
          <div style={{ padding: '1.5rem', border: '1px solid #d1d5db', borderRadius: '0.375rem' }}>
            <h3 style={{ color: '#0d5d2f', marginTop: 0 }}>White Label Solutions</h3>
            <p style={{ color: '#6b7280', lineHeight: '1.6' }}>
              Offer IDLookup.AI services under your own brand. We handle the backend while 
              you maintain your brand identity.
            </p>
          </div>
          <div style={{ padding: '1.5rem', border: '1px solid #d1d5db', borderRadius: '0.375rem' }}>
            <h3 style={{ color: '#0d5d2f', marginTop: 0 }}>Data Licensing</h3>
            <p style={{ color: '#6b7280', lineHeight: '1.6' }}>
              License our data for use in your own products and services. Ideal for 
              companies building their own search platforms.
            </p>
          </div>
        </div>
      </div>

      <div style={{ padding: '2rem', backgroundColor: '#f9fafb', borderRadius: '0.375rem', marginBottom: '2rem' }}>
        <h2 style={{ color: '#0d5d2f', marginTop: 0, marginBottom: '1rem' }}>Get Started</h2>
        <p style={{ color: '#6b7280', lineHeight: '1.6', marginBottom: '1rem' }}>
          Interested in partnering with us? Contact our partnership team to discuss how we can work together.
        </p>
        <a
          href="/contact"
          style={{
            display: 'inline-block',
            padding: '0.75rem 2rem',
            backgroundColor: '#0d5d2f',
            color: '#fff',
            textDecoration: 'none',
            borderRadius: '0.375rem',
            fontWeight: 'bold'
          }}
        >
          Contact Partnership Team
        </a>
      </div>
    </main>
  );
};

export default PartnerPage;

