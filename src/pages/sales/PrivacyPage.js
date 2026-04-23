import React from 'react';
import '../../styles/contentContainer.css';

/**
 * Privacy Policy page outlining how IDLookup.AI handles user data and privacy.
 */
const PrivacyPage = () => {
  return (
    <main className="pageBackground">
      <div className="contentContainer contentContainerNarrow">
      <h1 style={{ color: '#0d5d2f', marginBottom: '1rem' }}>Privacy Policy</h1>
      <p style={{ marginBottom: '2rem', color: '#6b7280', fontStyle: 'italic' }}>
        Last updated: {new Date().toLocaleDateString()}
      </p>

      <section style={{ marginBottom: '2rem' }}>
        <h2 style={{ color: '#0d5d2f', marginBottom: '1rem' }}>Introduction</h2>
        <p style={{ color: '#111827', lineHeight: '1.8' }}>
          IDLookup.AI ("we," "our," or "us") is committed to protecting your privacy. This Privacy Policy 
          explains how we collect, use, disclose, and safeguard your information when you use our website 
          and services.
        </p>
      </section>

      <section style={{ marginBottom: '2rem' }}>
        <h2 style={{ color: '#0d5d2f', marginBottom: '1rem' }}>Information We Collect</h2>
        <h3 style={{ color: '#111827', marginBottom: '0.5rem' }}>Personal Information</h3>
        <p style={{ color: '#6b7280', lineHeight: '1.8', marginBottom: '1rem' }}>
          We may collect personal information that you voluntarily provide to us when you:
        </p>
        <ul style={{ color: '#6b7280', lineHeight: '1.8', paddingLeft: '1.5rem', marginBottom: '1rem' }}>
          <li>Register for an account</li>
          <li>Use our search services</li>
          <li>Contact us for support</li>
          <li>Subscribe to our newsletter</li>
        </ul>
        <p style={{ color: '#6b7280', lineHeight: '1.8' }}>
          This information may include your name, email address, phone number, and billing information.
        </p>
      </section>

      <section style={{ marginBottom: '2rem' }}>
        <h2 style={{ color: '#0d5d2f', marginBottom: '1rem' }}>How We Use Your Information</h2>
        <p style={{ color: '#6b7280', lineHeight: '1.8', marginBottom: '1rem' }}>
          We use the information we collect to:
        </p>
        <ul style={{ color: '#6b7280', lineHeight: '1.8', paddingLeft: '1.5rem' }}>
          <li>Provide, maintain, and improve our services</li>
          <li>Process transactions and send related information</li>
          <li>Send you technical notices and support messages</li>
          <li>Respond to your comments and questions</li>
          <li>Monitor and analyze trends and usage</li>
        </ul>
      </section>

      <section style={{ marginBottom: '2rem' }}>
        <h2 style={{ color: '#0d5d2f', marginBottom: '1rem' }}>Data Security</h2>
        <p style={{ color: '#6b7280', lineHeight: '1.8' }}>
          We implement appropriate technical and organizational security measures to protect your personal 
          information. However, no method of transmission over the Internet or electronic storage is 100% 
          secure, and we cannot guarantee absolute security.
        </p>
      </section>

      <section style={{ marginBottom: '2rem' }}>
        <h2 style={{ color: '#0d5d2f', marginBottom: '1rem' }}>Your Rights</h2>
        <p style={{ color: '#6b7280', lineHeight: '1.8', marginBottom: '1rem' }}>
          Depending on your location, you may have certain rights regarding your personal information, including:
        </p>
        <ul style={{ color: '#6b7280', lineHeight: '1.8', paddingLeft: '1.5rem' }}>
          <li>The right to access your personal information</li>
          <li>The right to correct inaccurate information</li>
          <li>The right to delete your information</li>
          <li>The right to opt-out of certain data processing</li>
          <li>The right to data portability</li>
        </ul>
      </section>

      {/* California Privacy — folded from standalone /cpcc page per partner bug 25 */}
      <section id="california-privacy" style={{ marginBottom: '2rem' }}>
        <h2 style={{ color: '#0d5d2f', marginBottom: '1rem' }}>California Privacy Rights</h2>
        <p style={{ color: '#111827', lineHeight: '1.8' }}>
          If you are a California resident, the California Consumer Privacy Act (CCPA) and related
          state laws give you additional rights over your personal information.
        </p>
        <h3 style={{ color: '#0d5d2f', marginTop: '1.25rem' }}>Your Rights Under the CCPA</h3>
        <ul style={{ color: '#6b7280', lineHeight: '1.8', paddingLeft: '1.5rem' }}>
          <li><strong>Right to Know:</strong> Request details about the personal information we collect, use, disclose, or sell.</li>
          <li><strong>Right to Delete:</strong> Request deletion of personal information we've collected from you, subject to certain exceptions.</li>
          <li><strong>Right to Opt-Out:</strong> Direct us not to sell or share your personal information.</li>
          <li><strong>Right to Non-Discrimination:</strong> We will not discriminate against you for exercising any of your CCPA rights.</li>
          <li><strong>Right to Correct:</strong> Request that we correct inaccurate personal information we maintain about you.</li>
        </ul>
        <h3 style={{ color: '#0d5d2f', marginTop: '1.25rem' }}>How to Exercise Your Rights</h3>
        <p style={{ color: '#6b7280', lineHeight: '1.8' }}>
          To exercise any of these rights, contact us at <strong>privacy@idlookup.ai</strong> or use
          our Opt Out page. You may also designate an authorized agent. We will verify your identity
          before fulfilling any request and respond within 45 days.
        </p>
        <p style={{ color: '#6b7280', lineHeight: '1.8' }}>
          We do not knowingly sell the personal information of minors under 16.
        </p>
      </section>

      <section style={{ marginBottom: '2rem' }}>
        <h2 style={{ color: '#0d5d2f', marginBottom: '1rem' }}>Contact Us</h2>
        <p style={{ color: '#6b7280', lineHeight: '1.8' }}>
          If you have questions about this Privacy Policy or wish to exercise your rights, please contact us at:
        </p>
        <p style={{ color: '#0d5d2f', fontWeight: 'bold' }}>
          Email: privacy@idlookup.ai<br />
          Address: [Your Company Address]
        </p>
      </section>
      </div>
    </main>
  );
};

export default PrivacyPage;

