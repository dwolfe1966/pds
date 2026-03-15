import React from 'react';
import '../../styles/contentContainer.css';

/**
 * About page describing the service and company.
 */
const AboutPage = () => {
  return (
    <main className="pageBackground">
      <div className="contentContainer contentContainerNarrow">
      <h1 style={{ color: '#0d5d2f', marginBottom: '1rem' }}>About IDLookup.AI</h1>
      <p style={{ marginBottom: '2rem', color: '#6b7280', lineHeight: '1.8', fontSize: '1.1rem' }}>
        IDLookup.AI aggregates publicly available records and helps you discover information
        about people and understand who is searching for you. Our mission is to bring
        transparency to public data while respecting privacy.
      </p>

      <section style={{ marginBottom: '2rem' }}>
        <h2 style={{ color: '#0d5d2f', marginBottom: '1rem' }}>Our Mission</h2>
        <p style={{ color: '#6b7280', lineHeight: '1.8' }}>
          We believe that public information should be accessible and transparent. IDLookup.AI 
          provides a platform that makes it easy to find people and understand your digital footprint. 
          At the same time, we respect privacy and provide tools for individuals to manage their 
          information in our database.
        </p>
      </section>

      <section style={{ marginBottom: '2rem' }}>
        <h2 style={{ color: '#0d5d2f', marginBottom: '1rem' }}>What We Do</h2>
        <ul style={{ color: '#6b7280', lineHeight: '1.8', paddingLeft: '1.5rem' }}>
          <li>Aggregate public records from multiple sources</li>
          <li>Provide comprehensive people search capabilities</li>
          <li>Enable users to monitor who searches for them</li>
          <li>Offer privacy tools including opt-out and suppression list options</li>
          <li>Maintain compliance with privacy laws including CCPA</li>
        </ul>
      </section>

      <section style={{ marginBottom: '2rem' }}>
        <h2 style={{ color: '#0d5d2f', marginBottom: '1rem' }}>Privacy & Compliance</h2>
        <p style={{ color: '#6b7280', lineHeight: '1.8' }}>
          We take privacy seriously and are committed to compliance with applicable privacy laws, 
          including the California Consumer Privacy Act (CCPA). We provide tools for individuals 
          to opt-out of our database and manage their information. Learn more about our privacy 
          practices in our <a href="/privacy" style={{ color: '#0d5d2f' }}>Privacy Policy</a>.
        </p>
      </section>

      <section style={{ marginBottom: '2rem' }}>
        <h2 style={{ color: '#0d5d2f', marginBottom: '1rem' }}>Contact Us</h2>
        <p style={{ color: '#6b7280', lineHeight: '1.8' }}>
          Have questions about IDLookup.AI? We'd love to hear from you. 
          <a href="/contact" style={{ color: '#0d5d2f', marginLeft: '0.5rem' }}>Contact us</a> for 
          support, partnerships, or general inquiries.
        </p>
      </section>
      </div>
    </main>
  );
};

export default AboutPage;