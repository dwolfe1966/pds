import React from 'react';
import '../../styles/contentContainer.css';

/**
 * CPCC (California Privacy Compliance) page explaining California privacy rights
 * and how IDLookup.AI complies with California privacy laws.
 */
const CPCCPage = () => {
  return (
    <main className="pageBackground">
      <div className="contentContainer contentContainerNarrow">
      <h1 style={{ color: '#0e123b', marginBottom: '1rem' }}>California Privacy Rights (CPCC)</h1>
      <p style={{ marginBottom: '2rem', color: '#666', fontStyle: 'italic' }}>
        This page explains your privacy rights under the California Consumer Privacy Act (CCPA) and 
        how IDLookup.AI complies with California privacy laws.
      </p>

      <section style={{ marginBottom: '2rem' }}>
        <h2 style={{ color: '#0e123b', marginBottom: '1rem' }}>Your California Privacy Rights</h2>
        <p style={{ color: '#333', lineHeight: '1.8', marginBottom: '1rem' }}>
          If you are a California resident, you have specific rights regarding your personal information 
          under the California Consumer Privacy Act (CCPA). These rights include:
        </p>
        <ul style={{ color: '#666', lineHeight: '1.8', paddingLeft: '1.5rem' }}>
          <li><strong>Right to Know:</strong> You have the right to request information about the categories 
            and specific pieces of personal information we collect, use, disclose, and sell.</li>
          <li><strong>Right to Delete:</strong> You have the right to request deletion of your personal 
            information that we have collected, subject to certain exceptions.</li>
          <li><strong>Right to Opt-Out:</strong> You have the right to opt-out of the sale of your personal 
            information to third parties.</li>
          <li><strong>Right to Non-Discrimination:</strong> We will not discriminate against you for exercising 
            your privacy rights.</li>
        </ul>
      </section>

      <section style={{ marginBottom: '2rem' }}>
        <h2 style={{ color: '#0e123b', marginBottom: '1rem' }}>Information We Collect</h2>
        <p style={{ color: '#666', lineHeight: '1.8', marginBottom: '1rem' }}>
          In the past 12 months, we have collected the following categories of personal information:
        </p>
        <ul style={{ color: '#666', lineHeight: '1.8', paddingLeft: '1.5rem' }}>
          <li>Identifiers (name, email, phone number, IP address)</li>
          <li>Commercial information (purchase history, transaction records)</li>
          <li>Internet activity (browsing history, search queries)</li>
          <li>Geolocation data</li>
        </ul>
      </section>

      <section style={{ marginBottom: '2rem' }}>
        <h2 style={{ color: '#0e123b', marginBottom: '1rem' }}>How to Exercise Your Rights</h2>
        <div style={{ padding: '1.5rem', backgroundColor: '#f5f5f5', borderRadius: '4px', marginBottom: '1rem' }}>
          <h3 style={{ color: '#0e123b', marginTop: 0 }}>Request to Know</h3>
          <p style={{ color: '#666', lineHeight: '1.6' }}>
            To request information about the personal information we have collected about you, please contact 
            us using the information below. We will verify your identity before providing the information.
          </p>
        </div>
        <div style={{ padding: '1.5rem', backgroundColor: '#f5f5f5', borderRadius: '4px', marginBottom: '1rem' }}>
          <h3 style={{ color: '#0e123b', marginTop: 0 }}>Request to Delete</h3>
          <p style={{ color: '#666', lineHeight: '1.6' }}>
            To request deletion of your personal information, you can submit a request through our opt-out 
            process or contact us directly. We will verify your identity and process your request in 
            accordance with applicable law.
          </p>
        </div>
        <div style={{ padding: '1.5rem', backgroundColor: '#f5f5f5', borderRadius: '4px' }}>
          <h3 style={{ color: '#0e123b', marginTop: 0 }}>Request to Opt-Out</h3>
          <p style={{ color: '#666', lineHeight: '1.6' }}>
            To opt-out of the sale of your personal information, you can use our opt-out form or contact 
            us directly. We do not sell personal information of users who have opted out.
          </p>
        </div>
      </section>

      <section style={{ marginBottom: '2rem' }}>
        <h2 style={{ color: '#0e123b', marginBottom: '1rem' }}>Verification Process</h2>
        <p style={{ color: '#666', lineHeight: '1.8' }}>
          To protect your privacy, we will verify your identity before processing any privacy request. 
          This may require you to provide additional information to confirm your identity. We will respond 
          to your request within 45 days, or notify you if we need additional time.
        </p>
      </section>

      <section style={{ marginBottom: '2rem' }}>
        <h2 style={{ color: '#0e123b', marginBottom: '1rem' }}>Authorized Agents</h2>
        <p style={{ color: '#666', lineHeight: '1.8' }}>
          You may designate an authorized agent to make privacy requests on your behalf. The authorized 
          agent must provide proof of authorization, and we may still require verification of your identity.
        </p>
      </section>

      <section style={{ marginBottom: '2rem' }}>
        <h2 style={{ color: '#0e123b', marginBottom: '1rem' }}>Contact Us</h2>
        <p style={{ color: '#666', lineHeight: '1.6', marginBottom: '1rem' }}>
          To exercise your California privacy rights or if you have questions about this notice, please contact us:
        </p>
        <p style={{ color: '#0e123b', fontWeight: 'bold' }}>
          Email: privacy@idlookup.ai<br />
          Phone: [Your Support Phone Number]<br />
          Address: [Your Company Address]
        </p>
        <p style={{ color: '#666', lineHeight: '1.6', marginTop: '1rem' }}>
          You can also submit requests through our <a href="/opt-out" style={{ color: '#0e123b' }}>opt-out page</a>.
        </p>
      </section>
      </div>
    </main>
  );
};

export default CPCCPage;

