import React from 'react';
import { Link } from 'react-router-dom';
import '../../styles/contentContainer.css';
import { useBrand } from '../../services/brand';

/**
 * Refund Policy page outlining the active brand's refund policy and procedures.
 */
const RefundPage = () => {
  const brand = useBrand();
  return (
    <main className="pageBackground">
      <div className="contentContainer contentContainerNarrow">
      <h1 style={{ color: '#0d5d2f', marginBottom: '1rem' }}>Refund Policy</h1>
      <p style={{ marginBottom: '2rem', color: '#6b7280', fontStyle: 'italic' }}>
        Last updated: {new Date().toLocaleDateString()}
      </p>

      <section style={{ marginBottom: '2rem' }}>
        <h2 style={{ color: '#0d5d2f', marginBottom: '1rem' }}>Overview</h2>
        <p style={{ color: '#111827', lineHeight: '1.8' }}>
          At {brand.name}, we strive to provide high-quality services and customer satisfaction.
          This Refund Policy outlines the circumstances under which refunds may be issued for our services.
        </p>
      </section>

      <section style={{ marginBottom: '2rem' }}>
        <h2 style={{ color: '#0d5d2f', marginBottom: '1rem' }}>Eligibility for Refunds</h2>
        <p style={{ color: '#6b7280', lineHeight: '1.8', marginBottom: '1rem' }}>
          Refunds may be considered in the following circumstances:
        </p>
        <ul style={{ color: '#6b7280', lineHeight: '1.8', paddingLeft: '1.5rem', marginBottom: '1rem' }}>
          <li><strong>Service Failure:</strong> If our service fails to deliver results due to technical issues on our end</li>
          <li><strong>Duplicate Charges:</strong> If you were charged multiple times for the same transaction</li>
          <li><strong>Unauthorized Transaction:</strong> If a charge was made without your authorization</li>
          <li><strong>Subscription Cancellation:</strong> Cancellation of subscription services within the specified cancellation period</li>
        </ul>
        <p style={{ color: '#6b7280', lineHeight: '1.8' }}>
          <strong>Note:</strong> Refunds are generally not available for completed searches that returned results, 
          as the service has been delivered.
        </p>
      </section>

      <section style={{ marginBottom: '2rem' }}>
        <h2 style={{ color: '#0d5d2f', marginBottom: '1rem' }}>Refund Request Process</h2>
        <div style={{ padding: '1.5rem', backgroundColor: '#f9fafb', borderRadius: '0.375rem', marginBottom: '1rem' }}>
          <h3 style={{ color: '#0d5d2f', marginTop: 0 }}>How to Request a Refund</h3>
          <ol style={{ color: '#6b7280', lineHeight: '1.8', paddingLeft: '1.5rem' }}>
            <li>Submit your request through our <Link to="/contact" style={{ color: '#0d5d2f' }}>contact form</Link></li>
            <li>Provide your order number or transaction ID</li>
            <li>Explain the reason for your refund request</li>
            <li>Include any relevant documentation or screenshots</li>
          </ol>
        </div>
        <p style={{ color: '#6b7280', lineHeight: '1.8' }}>
          We will review your request within 5-7 business days and respond via email with our decision.
        </p>
      </section>

      <section style={{ marginBottom: '2rem' }}>
        <h2 style={{ color: '#0d5d2f', marginBottom: '1rem' }}>Processing Time</h2>
        <p style={{ color: '#6b7280', lineHeight: '1.8' }}>
          Once a refund is approved, it will be processed to your original payment method within 7-10 business days. 
          The time it takes for the refund to appear in your account depends on your payment provider.
        </p>
      </section>

      <section style={{ marginBottom: '2rem' }}>
        <h2 style={{ color: '#0d5d2f', marginBottom: '1rem' }}>Subscription Refunds</h2>
        <p style={{ color: '#6b7280', lineHeight: '1.8', marginBottom: '1rem' }}>
          For subscription services:
        </p>
        <ul style={{ color: '#6b7280', lineHeight: '1.8', paddingLeft: '1.5rem' }}>
          <li>You may cancel your subscription at any time</li>
          <li>Refunds for unused portions of the subscription period may be available if cancelled within 30 days of purchase</li>
          <li>No refunds will be issued for the current billing period after services have been used</li>
        </ul>
      </section>

      <section style={{ marginBottom: '2rem' }}>
        <h2 style={{ color: '#0d5d2f', marginBottom: '1rem' }}>Contact Us</h2>
        <p style={{ color: '#6b7280', lineHeight: '1.8' }}>
          If you have questions about our refund policy or need assistance with a refund request,
          please <Link to="/contact" style={{ color: '#0d5d2f' }}>submit a request through our contact form</Link>.
        </p>
        <p style={{ color: '#6b7280', lineHeight: '1.6' }}>
          Support hours: Monday - Friday, 9:00 AM - 5:00 PM ET.
        </p>
      </section>
      </div>
    </main>
  );
};

export default RefundPage;

