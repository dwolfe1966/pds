import React from 'react';
import '../../styles/contentContainer.css';
import { useBrand } from '../../services/brand';

/**
 * Terms of Service page outlining the terms and conditions for using the
 * active-brand site.
 */
const TermsPage = () => {
  const brand = useBrand();
  return (
    <main className="pageBackground">
      <div className="contentContainer contentContainerNarrow">
      <h1 style={{ color: '#0d5d2f', marginBottom: '1rem' }}>Terms of Service</h1>
      <p style={{ marginBottom: '2rem', color: '#6b7280', fontStyle: 'italic' }}>
        Last updated: {new Date().toLocaleDateString()}
      </p>

      <section style={{ marginBottom: '2rem' }}>
        <h2 style={{ color: '#0d5d2f', marginBottom: '1rem' }}>Agreement to Terms</h2>
        <p style={{ color: '#111827', lineHeight: '1.8' }}>
          By accessing or using {brand.name} ("the Service"), you agree to be bound by these Terms of Service 
          and all applicable laws and regulations. If you do not agree with any of these terms, you are 
          prohibited from using or accessing the Service.
        </p>
      </section>

      <section style={{ marginBottom: '2rem' }}>
        <h2 style={{ color: '#0d5d2f', marginBottom: '1rem' }}>Use License</h2>
        <p style={{ color: '#6b7280', lineHeight: '1.8', marginBottom: '1rem' }}>
          Permission is granted to temporarily access the materials on {brand.name} for personal, 
          non-commercial transitory viewing only. This is the grant of a license, not a transfer of title, 
          and under this license you may not:
        </p>
        <ul style={{ color: '#6b7280', lineHeight: '1.8', paddingLeft: '1.5rem' }}>
          <li>Modify or copy the materials</li>
          <li>Use the materials for any commercial purpose or for any public display</li>
          <li>Attempt to reverse engineer any software contained on the Service</li>
          <li>Remove any copyright or other proprietary notations from the materials</li>
        </ul>
      </section>

      <section style={{ marginBottom: '2rem' }}>
        <h2 style={{ color: '#0d5d2f', marginBottom: '1rem' }}>Account Registration</h2>
        <p style={{ color: '#6b7280', lineHeight: '1.8' }}>
          To access certain features of the Service, you must register for an account. You agree to provide 
          accurate, current, and complete information during registration and to update such information to 
          keep it accurate, current, and complete. You are responsible for maintaining the confidentiality 
          of your account credentials.
        </p>
      </section>

      <section style={{ marginBottom: '2rem' }}>
        <h2 style={{ color: '#0d5d2f', marginBottom: '1rem' }}>Prohibited Uses</h2>
        <p style={{ color: '#6b7280', lineHeight: '1.8', marginBottom: '1rem' }}>
          You agree not to use the Service:
        </p>
        <ul style={{ color: '#6b7280', lineHeight: '1.8', paddingLeft: '1.5rem' }}>
          <li>For any unlawful purpose or to solicit others to perform unlawful acts</li>
          <li>To violate any international, federal, provincial, or state regulations, rules, laws, or local ordinances</li>
          <li>To infringe upon or violate our intellectual property rights or the intellectual property rights of others</li>
          <li>To harass, abuse, insult, harm, defame, slander, disparage, intimidate, or discriminate</li>
          <li>To submit false or misleading information</li>
          <li>To upload or transmit viruses or any other type of malicious code</li>
        </ul>
      </section>

      <section style={{ marginBottom: '2rem' }}>
        <h2 style={{ color: '#0d5d2f', marginBottom: '1rem' }}>Service Availability</h2>
        <p style={{ color: '#6b7280', lineHeight: '1.8' }}>
          We reserve the right to withdraw or amend the Service, and any service or material we provide, 
          in our sole discretion without notice. We will not be liable if, for any reason, all or any part 
          of the Service is unavailable at any time or for any period.
        </p>
      </section>

      <section style={{ marginBottom: '2rem' }}>
        <h2 style={{ color: '#0d5d2f', marginBottom: '1rem' }}>Limitation of Liability</h2>
        <p style={{ color: '#6b7280', lineHeight: '1.8' }}>
          In no event shall {brand.name} or its suppliers be liable for any damages (including, without 
          limitation, damages for loss of data or profit, or due to business interruption) arising out of 
          the use or inability to use the materials on the Service, even if we or an authorized 
          representative has been notified orally or in writing of the possibility of such damage.
        </p>
      </section>

      {/* Refund Policy — folded from standalone /refund page per partner bug 25 */}
      <section id="refund-policy" style={{ marginBottom: '2rem' }}>
        <h2 style={{ color: '#0d5d2f', marginBottom: '1rem' }}>Refund Policy</h2>
        <p style={{ color: '#111827', lineHeight: '1.8' }}>
          We strive to provide high-quality services and customer satisfaction. This section outlines
          the circumstances under which refunds may be issued for our services.
        </p>
        <h3 style={{ color: '#0d5d2f', marginTop: '1.25rem' }}>Eligibility for Refunds</h3>
        <ul style={{ color: '#6b7280', lineHeight: '1.8', paddingLeft: '1.5rem' }}>
          <li><strong>Service Failure:</strong> If our service fails to deliver results due to technical issues on our end</li>
          <li><strong>Duplicate Charges:</strong> If you were charged multiple times for the same transaction</li>
          <li><strong>Unauthorized Transaction:</strong> If a charge was made without your authorization</li>
          <li><strong>Subscription Cancellation:</strong> Cancellation of subscription services within the specified cancellation period</li>
        </ul>
        <p style={{ color: '#6b7280', lineHeight: '1.8' }}>
          <strong>Note:</strong> Refunds are generally not available for completed searches that returned results,
          as the service has been delivered.
        </p>
        <h3 style={{ color: '#0d5d2f', marginTop: '1.25rem' }}>How to Request a Refund</h3>
        <ol style={{ color: '#6b7280', lineHeight: '1.8', paddingLeft: '1.5rem' }}>
          <li>Contact our support team at <strong>{brand.supportEmail}</strong> or through our contact form</li>
          <li>Provide your order number or transaction ID</li>
          <li>Explain the reason for your refund request</li>
          <li>Include any relevant documentation or screenshots</li>
        </ol>
        <p style={{ color: '#6b7280', lineHeight: '1.8' }}>
          We will review your request within 5–7 business days and respond via email. Approved refunds
          are processed to your original payment method within 7–10 business days.
        </p>
      </section>

      <section style={{ marginBottom: '2rem' }}>
        <h2 style={{ color: '#0d5d2f', marginBottom: '1rem' }}>Contact Information</h2>
        <p style={{ color: '#6b7280', lineHeight: '1.8' }}>
          If you have any questions about these Terms of Service, please contact us at:
        </p>
        <p style={{ color: '#0d5d2f', fontWeight: 'bold' }}>
          Email: {brand.legalEmail}<br />
          Address: [Your Company Address]
        </p>
      </section>
      </div>
    </main>
  );
};

export default TermsPage;

