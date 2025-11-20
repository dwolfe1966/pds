import React from 'react';

/**
 * Suppression List page explaining how users can add themselves to a suppression list
 * to limit their information in search results.
 */
const SuppressionListPage = () => {
  return (
    <main style={{ padding: '2rem', maxWidth: '900px', margin: '0 auto' }}>
      <h1 style={{ color: '#0e123b', marginBottom: '1rem' }}>Suppression List</h1>
      <p style={{ marginBottom: '2rem', color: '#333', lineHeight: '1.6', fontSize: '1.1rem' }}>
        The IDLookup.AI Suppression List allows individuals to limit the display of their information 
        in search results while maintaining compliance with public records laws.
      </p>

      <section style={{ marginBottom: '2rem' }}>
        <h2 style={{ color: '#0e123b', marginBottom: '1rem' }}>What is a Suppression List?</h2>
        <p style={{ color: '#666', lineHeight: '1.8' }}>
          A suppression list is a registry of individuals who have requested that their information 
          be suppressed or limited in search results. When you add yourself to our suppression list, 
          we will take steps to reduce the visibility of your information in our search results, 
          subject to applicable laws and regulations.
        </p>
      </section>

      <section style={{ marginBottom: '2rem' }}>
        <h2 style={{ color: '#0e123b', marginBottom: '1rem' }}>How to Add Yourself to the Suppression List</h2>
        <div style={{ padding: '1.5rem', backgroundColor: '#f5f5f5', borderRadius: '4px', marginBottom: '1rem' }}>
          <h3 style={{ color: '#0e123b', marginTop: 0 }}>Step 1: Search for Your Information</h3>
          <p style={{ color: '#666', lineHeight: '1.6' }}>
            First, search for your name to find your records in our database. This helps us identify 
            which records need to be suppressed.
          </p>
        </div>
        <div style={{ padding: '1.5rem', backgroundColor: '#f5f5f5', borderRadius: '4px', marginBottom: '1rem' }}>
          <h3 style={{ color: '#0e123b', marginTop: 0 }}>Step 2: Submit Suppression Request</h3>
          <p style={{ color: '#666', lineHeight: '1.6' }}>
            Once you've identified your records, you can submit a suppression request through our 
            opt-out process. You'll need to provide verification information to confirm your identity.
          </p>
        </div>
        <div style={{ padding: '1.5rem', backgroundColor: '#f5f5f5', borderRadius: '4px' }}>
          <h3 style={{ color: '#0e123b', marginTop: 0 }}>Step 3: Verification and Processing</h3>
          <p style={{ color: '#666', lineHeight: '1.6' }}>
            We will verify your identity and process your request. This typically takes 5-7 business days. 
            Once processed, your information will be suppressed from search results.
          </p>
        </div>
      </section>

      <section style={{ marginBottom: '2rem' }}>
        <h2 style={{ color: '#0e123b', marginBottom: '1rem' }}>Important Information</h2>
        <div style={{ padding: '1.5rem', backgroundColor: '#fff3cd', border: '1px solid #ffc107', borderRadius: '4px', marginBottom: '1rem' }}>
          <h3 style={{ color: '#856404', marginTop: 0 }}>Legal Limitations</h3>
          <p style={{ color: '#856404', lineHeight: '1.6' }}>
            Please note that we are required by law to maintain certain public records. Suppression 
            does not mean complete removal, but rather limiting the visibility of information in 
            search results. Some information may still be accessible through direct database queries 
            or other legal means.
          </p>
        </div>
        <ul style={{ color: '#666', lineHeight: '1.8', paddingLeft: '1.5rem' }}>
          <li>Suppression requests require identity verification</li>
          <li>Processing time is typically 5-7 business days</li>
          <li>Suppression applies to search results, not source data</li>
          <li>You may need to renew your suppression request periodically</li>
        </ul>
      </section>

      <section style={{ marginBottom: '2rem' }}>
        <h2 style={{ color: '#0e123b', marginBottom: '1rem' }}>Get Started</h2>
        <p style={{ color: '#666', lineHeight: '1.6', marginBottom: '1rem' }}>
          Ready to add yourself to the suppression list? Start by searching for your information.
        </p>
        <a
          href="/opt-out"
          style={{
            display: 'inline-block',
            padding: '0.75rem 2rem',
            backgroundColor: '#0e123b',
            color: '#fff',
            textDecoration: 'none',
            borderRadius: '4px',
            fontWeight: 'bold'
          }}
        >
          Start Suppression Request
        </a>
      </section>

      <section style={{ marginBottom: '2rem' }}>
        <h2 style={{ color: '#0e123b', marginBottom: '1rem' }}>Questions?</h2>
        <p style={{ color: '#666', lineHeight: '1.6' }}>
          If you have questions about the suppression list or need assistance, please contact us:
        </p>
        <p style={{ color: '#0e123b', fontWeight: 'bold' }}>
          Email: support@idlookup.ai<br />
          Phone: [Your Support Phone Number]
        </p>
      </section>
    </main>
  );
};

export default SuppressionListPage;

