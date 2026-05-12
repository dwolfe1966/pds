import React from 'react';
import '../../styles/contentContainer.css';
import { useBrand } from '../../services/brand';

/**
 * Terms of Service — content sourced from
 * docs/content/idlookup_terms_of_service_draft.pdf, scrubbed of counsel
 * notes and bracketed placeholders for public display.
 */
const TermsPage = () => {
  const brand = useBrand();

  const HEADING = { color: '#0d5d2f', marginBottom: '1rem' };
  const P = { color: '#111827', lineHeight: '1.8', marginBottom: '1rem' };
  const UL = { color: '#111827', lineHeight: '1.8', paddingLeft: '1.5rem', marginBottom: '1rem' };
  const SECTION = { marginBottom: '2rem' };

  return (
    <main className="pageBackground">
      <div className="contentContainer contentContainerNarrow">
        <h1 style={HEADING}>Terms of Service</h1>
        <p style={{ marginBottom: '2rem', color: '#6b7280', fontStyle: 'italic' }}>
          Last Updated: 5/12/2026
        </p>

        <p style={P}>
          Welcome to {brand.name}. These Terms of Service govern your access to and use of the {brand.name} website, products, reports, subscription services, communications, and related features, collectively referred to as the "Service." By accessing or using the Service, creating an account, purchasing a subscription, starting a trial, or submitting a search, you agree to these Terms. If you do not agree, you may not use the Service.
        </p>

        <section style={SECTION}>
          <h2 style={HEADING}>1. Who We Are</h2>
          <p style={P}>
            {brand.name} is operated by PeopleDataSystems Inc. {brand.name} provides access to people-search tools, publicly available information, commercially available data, identity-related search results, and related report-detail services.
          </p>
          <p style={P}>
            For support or questions, please contact us at <a href="/contact" style={{ color: '#0d5d2f' }}>/contact</a>.
          </p>
        </section>

        <section style={SECTION}>
          <h2 style={HEADING}>2. Eligibility</h2>
          <p style={P}>
            You must be at least 18 years old and legally able to enter into a binding agreement to use the Service. By using the Service, you represent that you meet these requirements.
          </p>
        </section>

        <section style={SECTION}>
          <h2 style={HEADING}>3. Important Use Restrictions</h2>
          <p style={P}>
            {brand.name} is not a consumer reporting agency and does not provide "consumer reports" as those terms are defined by the Fair Credit Reporting Act.
          </p>
          <p style={P}>
            You may not use {brand.name}, its reports, or any information obtained through the Service to determine any person's eligibility for:
          </p>
          <ul style={UL}>
            <li>credit or loans;</li>
            <li>insurance;</li>
            <li>employment, promotion, reassignment, or retention;</li>
            <li>housing, tenancy, or rental decisions;</li>
            <li>education, scholarships, or admissions;</li>
            <li>licensing or professional credentialing;</li>
            <li>government benefits;</li>
            <li>any other purpose regulated by the Fair Credit Reporting Act or similar laws.</li>
          </ul>
          <p style={P}>
            You also may not use the Service to stalk, harass, threaten, intimidate, exploit, impersonate, defame, shame, dox, or otherwise harm another person.
          </p>
        </section>

        <section style={SECTION}>
          <h2 style={HEADING}>4. Nature of the Information Provided</h2>
          <p style={P}>
            {brand.name} reports may include information obtained from public records, publicly available sources, third-party data providers, commercially available databases, user-provided inputs, and derived or aggregated data.
          </p>
          <p style={P}>
            The information may be incomplete, outdated, inaccurate, duplicative, misattributed, or associated with the wrong person. People may share the same or similar names, addresses, phone numbers, relatives, associates, or identifiers.
          </p>
          <p style={P}>
            {brand.name} does not guarantee that any report is complete, current, accurate, or suitable for any particular purpose. You are responsible for independently verifying information before relying on it.
          </p>
        </section>

        <section style={SECTION}>
          <h2 style={HEADING}>5. Accounts and Security</h2>
          <p style={P}>
            To access certain features, you may need to create an account. You agree to provide accurate information and keep your login credentials secure.
          </p>
          <p style={P}>
            You are responsible for all activity under your account. If you believe your account has been accessed without authorization, contact us promptly through <a href="/contact" style={{ color: '#0d5d2f' }}>/contact</a>.
          </p>
        </section>

        <section style={SECTION}>
          <h2 style={HEADING}>6. Subscriptions, Trials, Billing, and Renewal</h2>
          <p style={P}>
            {brand.name} may offer free accounts, paid subscriptions, promotional trials, limited-time offers, or other paid access plans.
          </p>
          <p style={P}>
            When you purchase a subscription or start a trial that converts to a paid subscription, you authorize {brand.name} and its payment processors to charge your selected payment method for the applicable fees, taxes, and recurring charges disclosed at checkout.
          </p>
          <p style={P}>Unless otherwise stated at checkout:</p>
          <ul style={UL}>
            <li>subscriptions renew automatically until canceled;</li>
            <li>trial offers convert to paid subscriptions at the end of the trial period;</li>
            <li>charges occur on the renewal schedule disclosed during purchase;</li>
            <li>cancellation stops future renewal charges but does not necessarily refund prior charges.</li>
          </ul>
          <p style={P}>
            The exact subscription price, renewal frequency, trial length, and renewal date will be disclosed at checkout and/or in your purchase confirmation.
          </p>
        </section>

        <section style={SECTION}>
          <h2 style={HEADING}>7. Cancellation</h2>
          <p style={P}>
            You may cancel your subscription at any time through the cancellation method provided in your account, through the cancellation link or instructions provided during purchase or confirmation, or by contacting us at <a href="/contact" style={{ color: '#0d5d2f' }}>/contact</a>.
          </p>
          <p style={P}>
            Cancellation will take effect at the end of the then-current billing period unless otherwise stated. After cancellation, you may continue to access paid features until the end of the period already paid for, unless your access is terminated for violation of these Terms.
          </p>
        </section>

        <section style={SECTION}>
          <h2 style={HEADING}>8. Refunds</h2>
          <p style={P}>
            Except where required by law or expressly stated in a specific offer, fees are non-refundable. We may consider refund requests on a case-by-case basis, but providing a refund in one instance does not obligate us to provide refunds in the future.
          </p>
        </section>

        <section style={SECTION}>
          <h2 style={HEADING}>9. Permitted Use</h2>
          <p style={P}>You may use the Service only for lawful, personal, and informational purposes. You agree not to:</p>
          <ul style={UL}>
            <li>use the Service for FCRA-regulated purposes;</li>
            <li>use information to harass, threaten, stalk, exploit, or harm anyone;</li>
            <li>use automated tools, bots, scraping, crawling, or data extraction methods without written permission;</li>
            <li>resell, redistribute, sublicense, or commercially exploit reports or data;</li>
            <li>interfere with the security or operation of the Service;</li>
            <li>attempt to reverse engineer, bypass, or circumvent access controls;</li>
            <li>submit false, misleading, or unauthorized information;</li>
            <li>use the Service in violation of applicable law.</li>
          </ul>
        </section>

        <section style={SECTION}>
          <h2 style={HEADING}>10. Data Removal and Privacy Requests</h2>
          <p style={P}>
            {brand.name} may provide mechanisms for individuals to request access, correction, deletion, opt-out, suppression, or removal of certain information, subject to verification and applicable legal exceptions.
          </p>
          <p style={P}>
            Submitting a request does not guarantee complete removal of information from all sources, third-party databases, public records, search engines, archives, or other websites. Some information may remain available from government records, public sources, third-party providers, or other data brokers.
          </p>
          <p style={P}>
            For privacy requests, use <a href="/contact" style={{ color: '#0d5d2f' }}>/contact</a>.
          </p>
        </section>

        <section style={SECTION}>
          <h2 style={HEADING}>11. Intellectual Property</h2>
          <p style={P}>
            The Service, including its software, design, branding, logos, text, graphics, databases, interfaces, and report presentation, is owned by {brand.name} or its licensors and is protected by intellectual property laws.
          </p>
          <p style={P}>
            You may not copy, reproduce, modify, distribute, sell, lease, publicly display, or create derivative works from the Service except as expressly permitted by these Terms.
          </p>
        </section>

        <section style={SECTION}>
          <h2 style={HEADING}>12. Third-Party Services and Data Providers</h2>
          <p style={P}>
            The Service may include data, links, services, technology, or payment processing provided by third parties. {brand.name} is not responsible for third-party websites, data sources, payment processors, or services that are not controlled by {brand.name}.
          </p>
          <p style={P}>
            Your use of third-party services may be subject to additional terms and privacy policies.
          </p>
        </section>

        <section style={SECTION}>
          <h2 style={HEADING}>13. Communications</h2>
          <p style={P}>
            By creating an account, making a purchase, submitting a search, or contacting us, you agree that {brand.name} may send you transactional, account, service, billing, security, and support communications.
          </p>
          <p style={P}>
            Where permitted by law and your preferences, we may also send marketing or promotional communications. You may opt out of marketing emails using the unsubscribe link or other instructions provided in those communications. Transactional and account-related messages may continue even if you opt out of marketing.
          </p>
        </section>

        <section style={SECTION}>
          <h2 style={HEADING}>14. Service Availability and Changes</h2>
          <p style={P}>
            We may modify, suspend, or discontinue any part of the Service at any time. We may also change features, pricing, report availability, data sources, or account access rules, subject to applicable law and any required notices.
          </p>
          <p style={P}>
            We are not liable for outages, delays, errors, data unavailability, or interruptions.
          </p>
        </section>

        <section style={SECTION}>
          <h2 style={HEADING}>15. Termination</h2>
          <p style={P}>
            We may suspend or terminate your access if we believe you violated these Terms, used the Service unlawfully, created risk for {brand.name} or others, failed to pay required fees, or engaged in misuse.
          </p>
          <p style={P}>
            Upon termination, your right to use the Service ends immediately.
          </p>
        </section>

        <section style={SECTION}>
          <h2 style={HEADING}>16. Disclaimer of Warranties</h2>
          <p style={P}>
            The Service is provided "as is" and "as available." {brand.name} disclaims all warranties, express or implied, including warranties of accuracy, completeness, reliability, merchantability, fitness for a particular purpose, title, and non-infringement.
          </p>
          <p style={P}>
            We do not guarantee that reports will be accurate, complete, current, error-free, uninterrupted, or suitable for your intended use.
          </p>
        </section>

        <section style={SECTION}>
          <h2 style={HEADING}>17. Limitation of Liability</h2>
          <p style={P}>
            To the maximum extent permitted by law, {brand.name} and its owners, officers, employees, contractors, affiliates, licensors, service providers, and data suppliers will not be liable for indirect, incidental, consequential, special, punitive, exemplary, or lost-profit damages arising from or related to your use of the Service.
          </p>
          <p style={P}>
            To the maximum extent permitted by law, {brand.name}'s total liability for any claim related to the Service will not exceed the amount you paid to {brand.name} in the three months before the event giving rise to the claim, or $100, whichever is greater.
          </p>
        </section>

        <section style={SECTION}>
          <h2 style={HEADING}>18. Indemnification</h2>
          <p style={P}>
            You agree to defend, indemnify, and hold harmless {brand.name} and its owners, officers, employees, contractors, affiliates, licensors, service providers, and data suppliers from claims, damages, losses, liabilities, costs, and expenses arising from your use of the Service, violation of these Terms, violation of law, or misuse of information obtained through the Service.
          </p>
        </section>

        <section style={SECTION}>
          <h2 style={HEADING}>19. Dispute Resolution</h2>
          <p style={P}>
            To the extent permitted by law, you and {brand.name} agree to attempt to resolve disputes informally before filing a claim. Contact us first at <a href="/contact" style={{ color: '#0d5d2f' }}>/contact</a>.
          </p>
        </section>

        <section style={SECTION}>
          <h2 style={HEADING}>20. Changes to These Terms</h2>
          <p style={P}>
            We may update these Terms from time to time. The updated version will be posted on the Service with a revised "Last Updated" date. Your continued use of the Service after changes become effective means you accept the updated Terms.
          </p>
        </section>

        <section style={SECTION}>
          <h2 style={HEADING}>21. Contact Us</h2>
          <p style={P}>
            Questions about these Terms may be submitted at <a href="/contact" style={{ color: '#0d5d2f' }}>/contact</a>.
          </p>
        </section>
      </div>
    </main>
  );
};

export default TermsPage;
