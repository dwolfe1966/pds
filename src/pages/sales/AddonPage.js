import React from 'react';

/**
 * Addon page for additional services and features that can be added to searches.
 */
const AddonPage = () => {
  return (
    <main style={{ padding: '2rem', maxWidth: '900px', margin: '0 auto' }}>
      <h1 style={{ color: '#0d5d2f', marginBottom: '1rem' }}>Additional Services & Add-Ons</h1>
      <p style={{ marginBottom: '2rem', color: '#111827', lineHeight: '1.6', fontSize: '1.1rem' }}>
        Enhance your search results with our premium add-on services. Get deeper insights and more 
        comprehensive information about the people you're searching for.
      </p>

      <div style={{ display: 'grid', gap: '1.5rem', marginBottom: '2rem' }}>
        <div style={{ padding: '1.5rem', border: '1px solid #d1d5db', borderRadius: '0.375rem' }}>
          <h3 style={{ color: '#0d5d2f', marginTop: 0 }}>Background Check Report</h3>
          <p style={{ color: '#6b7280', lineHeight: '1.6', marginBottom: '1rem' }}>
            Get a comprehensive background check report including criminal records, employment history, 
            and education verification.
          </p>
          <p style={{ color: '#0d5d2f', fontWeight: 'bold', fontSize: '1.2rem' }}>$29.99</p>
        </div>

        <div style={{ padding: '1.5rem', border: '1px solid #d1d5db', borderRadius: '0.375rem' }}>
          <h3 style={{ color: '#0d5d2f', marginTop: 0 }}>Social Media Profile Search</h3>
          <p style={{ color: '#6b7280', lineHeight: '1.6', marginBottom: '1rem' }}>
            Discover social media profiles associated with the person you're searching for across 
            multiple platforms.
          </p>
          <p style={{ color: '#0d5d2f', fontWeight: 'bold', fontSize: '1.2rem' }}>$19.99</p>
        </div>

        <div style={{ padding: '1.5rem', border: '1px solid #d1d5db', borderRadius: '0.375rem' }}>
          <h3 style={{ color: '#0d5d2f', marginTop: 0 }}>Property Records Search</h3>
          <p style={{ color: '#6b7280', lineHeight: '1.6', marginBottom: '1rem' }}>
            Access detailed property ownership records, property values, and real estate transaction history.
          </p>
          <p style={{ color: '#0d5d2f', fontWeight: 'bold', fontSize: '1.2rem' }}>$24.99</p>
        </div>

        <div style={{ padding: '1.5rem', border: '1px solid #d1d5db', borderRadius: '0.375rem' }}>
          <h3 style={{ color: '#0d5d2f', marginTop: 0 }}>Financial Records Search</h3>
          <p style={{ color: '#6b7280', lineHeight: '1.6', marginBottom: '1rem' }}>
            View bankruptcy records, liens, judgments, and other financial public records.
          </p>
          <p style={{ color: '#0d5d2f', fontWeight: 'bold', fontSize: '1.2rem' }}>$34.99</p>
        </div>

        <div style={{ padding: '1.5rem', border: '1px solid #d1d5db', borderRadius: '0.375rem' }}>
          <h3 style={{ color: '#0d5d2f', marginTop: 0 }}>Family Tree & Relatives</h3>
          <p style={{ color: '#6b7280', lineHeight: '1.6', marginBottom: '1rem' }}>
            Discover family relationships, relatives, and build a family tree for the person you're searching for.
          </p>
          <p style={{ color: '#0d5d2f', fontWeight: 'bold', fontSize: '1.2rem' }}>$39.99</p>
        </div>

        <div style={{ padding: '1.5rem', border: '1px solid #d1d5db', borderRadius: '0.375rem' }}>
          <h3 style={{ color: '#0d5d2f', marginTop: 0 }}>Email Address Search</h3>
          <p style={{ color: '#6b7280', lineHeight: '1.6', marginBottom: '1rem' }}>
            Find email addresses associated with the person, including current and historical email accounts.
          </p>
          <p style={{ color: '#0d5d2f', fontWeight: 'bold', fontSize: '1.2rem' }}>$14.99</p>
        </div>
      </div>

      <div style={{ padding: '2rem', backgroundColor: '#f9fafb', borderRadius: '0.375rem', marginBottom: '2rem' }}>
        <h2 style={{ color: '#0d5d2f', marginTop: 0, marginBottom: '1rem' }}>Bundle Packages</h2>
        <p style={{ color: '#6b7280', lineHeight: '1.6', marginBottom: '1rem' }}>
          Save money with our bundle packages that combine multiple add-on services:
        </p>
        <ul style={{ color: '#6b7280', lineHeight: '1.8', paddingLeft: '1.5rem' }}>
          <li><strong>Complete Report Bundle:</strong> All add-ons included - $149.99 (Save $50)</li>
          <li><strong>Professional Bundle:</strong> Background Check + Property + Financial - $79.99 (Save $20)</li>
          <li><strong>Social Bundle:</strong> Social Media + Email Search - $29.99 (Save $5)</li>
        </ul>
      </div>

      <div style={{ padding: '2rem', backgroundColor: '#e8f5e9', borderRadius: '0.375rem', marginBottom: '2rem' }}>
        <h2 style={{ color: '#0d5d2f', marginTop: 0, marginBottom: '1rem' }}>How It Works</h2>
        <ol style={{ color: '#6b7280', lineHeight: '1.8', paddingLeft: '1.5rem' }}>
          <li>Perform a basic search to find the person you're looking for</li>
          <li>View the search results and select the person</li>
          <li>Choose the add-on services you want to purchase</li>
          <li>Complete your purchase and receive your enhanced report</li>
        </ol>
      </div>

      <div style={{ textAlign: 'center', padding: '2rem' }}>
        <p style={{ color: '#6b7280', marginBottom: '1rem' }}>
          Ready to get started? Begin with a basic search to see available add-ons.
        </p>
        <a
          href="/search"
          style={{
            display: 'inline-block',
            padding: '0.75rem 2rem',
            backgroundColor: '#0d5d2f',
            color: '#fff',
            textDecoration: 'none',
            borderRadius: '0.375rem',
            fontWeight: 'bold',
            fontSize: '1.1rem'
          }}
        >
          Start Your Search
        </a>
      </div>
    </main>
  );
};

export default AddonPage;

