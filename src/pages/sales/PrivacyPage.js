import React from 'react';
import '../../styles/contentContainer.css';
import { useBrand } from '../../services/brand';

/**
 * Privacy Policy — content sourced from
 * docs/content/idlookup_privacy_policy_draft.pdf, scrubbed of counsel notes
 * and bracketed placeholders for public display.
 */
const PrivacyPage = () => {
  const brand = useBrand();

  const HEADING = { color: '#0d5d2f', marginBottom: '1rem' };
  const SUBHEAD = { color: '#111827', marginBottom: '0.5rem', marginTop: '1rem' };
  const P = { color: '#111827', lineHeight: '1.8', marginBottom: '1rem' };
  const UL = { color: '#111827', lineHeight: '1.8', paddingLeft: '1.5rem', marginBottom: '1rem' };
  const SECTION = { marginBottom: '2rem' };

  return (
    <main className="pageBackground">
      <div className="contentContainer contentContainerNarrow">
        <h1 style={HEADING}>Privacy Policy</h1>
        <p style={{ marginBottom: '2rem', color: '#6b7280', fontStyle: 'italic' }}>
          Last Updated: 5/12/2026
        </p>

        <p style={P}>
          This Privacy Policy explains how PeopleDataSystems Inc, doing business as {brand.name}, collects, uses, discloses, sells, shares, retains, and protects personal information in connection with the {brand.name} website, products, reports, subscription services, account features, communications, and related services. By using {brand.name}, you acknowledge this Privacy Policy.
        </p>

        <section style={SECTION}>
          <h2 style={HEADING}>1. Scope of This Privacy Policy</h2>
          <p style={P}>This Privacy Policy applies to information we collect through {brand.name}, including:</p>
          <ul style={UL}>
            <li>information you provide directly;</li>
            <li>information collected automatically when you use the Service;</li>
            <li>information obtained from public records, public sources, commercial data providers, marketing partners, data suppliers, and other third-party sources;</li>
            <li>information included in people-search reports;</li>
            <li>information related to accounts, subscriptions, trials, payments, customer support, and privacy requests.</li>
          </ul>
          <p style={P}>This Policy does not apply to third-party websites or services that we do not control.</p>
        </section>

        <section style={SECTION}>
          <h2 style={HEADING}>2. Information We Collect</h2>
          <h3 style={SUBHEAD}>A. Information You Provide</h3>
          <p style={P}>This may include:</p>
          <ul style={UL}>
            <li>name;</li>
            <li>email address;</li>
            <li>phone number;</li>
            <li>mailing address;</li>
            <li>account login details;</li>
            <li>search inputs;</li>
            <li>support messages;</li>
            <li>identity verification information submitted for privacy requests;</li>
            <li>payment-related information, processed by our payment providers;</li>
            <li>subscription, trial, billing, cancellation, and account status information.</li>
          </ul>

          <h3 style={SUBHEAD}>B. Information Collected Automatically</h3>
          <p style={P}>When you use the Service, we and our service providers may collect:</p>
          <ul style={UL}>
            <li>IP address;</li>
            <li>device identifiers;</li>
            <li>browser type;</li>
            <li>operating system;</li>
            <li>referring URLs;</li>
            <li>pages viewed;</li>
            <li>search activity;</li>
            <li>session activity;</li>
            <li>timestamps;</li>
            <li>approximate location derived from IP address;</li>
            <li>cookie and tracking technology data;</li>
            <li>analytics and performance data.</li>
          </ul>

          <h3 style={SUBHEAD}>C. Information From Public, Commercial, and Third-Party Sources</h3>
          <p style={P}>Because {brand.name} is a people-search and public-records service, we may collect or receive information from:</p>
          <ul style={UL}>
            <li>public records;</li>
            <li>government records and databases;</li>
            <li>publicly available websites;</li>
            <li>commercial data providers;</li>
            <li>data licensors;</li>
            <li>marketing partners;</li>
            <li>identity, contact, demographic, and public-records databases;</li>
            <li>other legally available sources.</li>
          </ul>
          <p style={P}>This information may include:</p>
          <ul style={UL}>
            <li>names and aliases;</li>
            <li>age or date-of-birth indicators;</li>
            <li>addresses and address history;</li>
            <li>phone numbers;</li>
            <li>email addresses;</li>
            <li>relatives, associates, or household links;</li>
            <li>public records;</li>
            <li>property records;</li>
            <li>criminal, court, or legal-record indicators where available and legally permitted;</li>
            <li>social or web presence indicators;</li>
            <li>demographic or inferred information;</li>
            <li>other information available from public or commercial sources.</li>
          </ul>
        </section>

        <section style={SECTION}>
          <h2 style={HEADING}>3. How We Use Information</h2>
          <p style={P}>We may use personal information to:</p>
          <ul style={UL}>
            <li>provide people-search results and report-detail access;</li>
            <li>create, maintain, and secure accounts;</li>
            <li>process subscriptions, trials, payments, renewals, cancellations, and refunds;</li>
            <li>provide customer support;</li>
            <li>verify and respond to privacy, opt-out, access, deletion, correction, and suppression requests;</li>
            <li>improve search quality and report matching;</li>
            <li>operate, test, improve, and personalize the Service;</li>
            <li>detect fraud, abuse, unauthorized access, scraping, misuse, or security incidents;</li>
            <li>send transactional, account, billing, legal, and service communications;</li>
            <li>send marketing communications where permitted;</li>
            <li>measure advertising and marketing performance;</li>
            <li>comply with applicable laws, regulations, legal processes, and enforcement obligations;</li>
            <li>protect our rights, users, systems, and business.</li>
          </ul>
        </section>

        <section style={SECTION}>
          <h2 style={HEADING}>4. How We Disclose Information</h2>
          <p style={P}>We may disclose personal information to:</p>
          <ul style={UL}>
            <li>service providers and contractors;</li>
            <li>payment processors;</li>
            <li>hosting, analytics, security, email, customer support, and infrastructure vendors;</li>
            <li>data suppliers and licensors;</li>
            <li>fraud-prevention, compliance, and verification providers;</li>
            <li>professional advisors, including lawyers, accountants, auditors, and consultants;</li>
            <li>government agencies, regulators, courts, or law enforcement where required or permitted by law;</li>
            <li>parties involved in a merger, acquisition, financing, restructuring, sale of assets, bankruptcy, or similar transaction;</li>
            <li>other parties with your consent or at your direction.</li>
          </ul>
        </section>

        <section style={SECTION}>
          <h2 style={HEADING}>5. Sale or Sharing of Personal Information</h2>
          <p style={P}>
            Depending on how {brand.name} operates, some disclosures of personal information may be considered a "sale" or "sharing" under certain privacy laws, including California law.
          </p>
          <p style={P}>
            {brand.name} may make personal information available through people-search reports, data products, advertising technologies, analytics tools, or third-party data relationships in ways that may be considered a sale or sharing under applicable law.
          </p>
          <p style={P}>
            Eligible consumers may submit a <a href="/contact" style={{ color: '#0d5d2f' }}>Do Not Sell or Share My Personal Information</a> request through our contact form.
          </p>
        </section>

        <section style={SECTION}>
          <h2 style={HEADING}>6. Cookies and Tracking Technologies</h2>
          <p style={P}>We may use cookies, pixels, tags, SDKs, local storage, analytics tools, advertising technologies, and similar technologies to:</p>
          <ul style={UL}>
            <li>operate the Service;</li>
            <li>keep users logged in;</li>
            <li>remember preferences;</li>
            <li>analyze traffic and usage;</li>
            <li>improve performance;</li>
            <li>detect abuse and fraud;</li>
            <li>measure marketing campaigns;</li>
            <li>deliver or evaluate advertising.</li>
          </ul>
          <p style={P}>
            You may be able to control cookies through your browser settings. Some features may not function properly if cookies are disabled. Where required by law, we will provide additional controls for cookie consent, opt-out, or preference management.
          </p>
        </section>

        <section style={SECTION}>
          <h2 style={HEADING}>7. Data Broker and Public Records Notice</h2>
          <p style={P}>
            {brand.name} may collect and make available personal information obtained from public records, publicly available sources, and commercial data providers.
          </p>
          <p style={P}>
            If {brand.name} qualifies as a data broker under applicable law, we will comply with applicable data-broker registration, disclosure, deletion, opt-out, and reporting obligations.
          </p>
          <p style={P}>
            California's data-broker program requires qualifying businesses to register annually with CalPrivacy, and California's Delete Act requires certain data brokers to process deletion requests through the state's deletion mechanism beginning August 1, 2026.
          </p>
        </section>

        <section style={SECTION}>
          <h2 style={HEADING}>8. Privacy Rights</h2>
          <p style={P}>Depending on where you live, you may have rights regarding your personal information, including the right to:</p>
          <ul style={UL}>
            <li>know or access the personal information we collect, use, disclose, sell, or share;</li>
            <li>request deletion of personal information;</li>
            <li>request correction of inaccurate personal information;</li>
            <li>opt out of sale or sharing;</li>
            <li>limit use or disclosure of sensitive personal information, where applicable;</li>
            <li>receive information about categories of personal information collected and disclosed;</li>
            <li>appeal a denied privacy request, where required;</li>
            <li>not be discriminated against for exercising privacy rights.</li>
          </ul>
          <p style={P}>
            To exercise rights, contact us at <a href="/contact" style={{ color: '#0d5d2f' }}>/contact</a>.
          </p>
        </section>

        <section style={SECTION}>
          <h2 style={HEADING}>9. Verification of Requests</h2>
          <p style={P}>
            To protect privacy and prevent unauthorized access, we may need to verify your identity before processing certain requests. Verification may require you to provide information sufficient for us to confirm that you are the person who is the subject of the request or that you are authorized to act on that person's behalf.
          </p>
          <p style={P}>
            We may deny requests if we cannot verify identity, if an exception applies, or if the request is fraudulent, excessive, unlawful, or technically infeasible.
          </p>
        </section>

        <section style={SECTION}>
          <h2 style={HEADING}>10. Authorized Agents</h2>
          <p style={P}>
            Where required by law, you may use an authorized agent to submit a privacy request. We may require proof that the agent is authorized to act on your behalf and may also require you to verify your identity directly with us.
          </p>
        </section>

        <section style={SECTION}>
          <h2 style={HEADING}>11. Removal, Suppression, and Deletion Requests</h2>
          <p style={P}>
            You may request that {brand.name} remove, suppress, delete, or restrict certain personal information from appearing in {brand.name} search results or reports, subject to applicable law and verification requirements.
          </p>
          <p style={P}>Removal from {brand.name} does not necessarily remove information from:</p>
          <ul style={UL}>
            <li>public records;</li>
            <li>government databases;</li>
            <li>search engines;</li>
            <li>archived pages;</li>
            <li>third-party websites;</li>
            <li>other data brokers;</li>
            <li>original data sources;</li>
            <li>third-party data providers.</li>
          </ul>
          <p style={P}>
            We may retain certain information as needed to process opt-out or suppression requests, prevent re-publication, comply with law, resolve disputes, detect fraud, enforce agreements, or maintain business records.
          </p>
        </section>

        <section style={SECTION}>
          <h2 style={HEADING}>12. Sensitive Personal Information</h2>
          <p style={P}>
            Some information available through public records or third-party sources may be considered sensitive under certain laws.
          </p>
          <p style={P}>
            We do not intentionally use sensitive personal information for purposes other than providing the Service, complying with law, verifying requests, preventing fraud or abuse, maintaining security, or other legally permitted purposes.
          </p>
          <p style={P}>
            Where required by applicable law, you may submit a <a href="/contact" style={{ color: '#0d5d2f' }}>Limit the Use of My Sensitive Personal Information</a> request through our contact form.
          </p>
        </section>

        <section style={SECTION}>
          <h2 style={HEADING}>13. Children's Privacy</h2>
          <p style={P}>
            The Service is intended for adults and is not directed to children under 18. We do not knowingly collect account-registration information from children under 13.
          </p>
          <p style={P}>
            If you believe a child has provided personal information directly to us, contact us at <a href="/contact" style={{ color: '#0d5d2f' }}>/contact</a>.
          </p>
        </section>

        <section style={SECTION}>
          <h2 style={HEADING}>14. Data Retention</h2>
          <p style={P}>
            We retain personal information for as long as reasonably necessary to provide the Service, operate our business, comply with legal obligations, resolve disputes, enforce agreements, maintain security, prevent fraud or abuse, honor suppression requests, and fulfill the purposes described in this Policy.
          </p>
          <p style={P}>
            Retention periods may vary depending on the type of information, source, legal requirements, account status, and business purpose.
          </p>
        </section>

        <section style={SECTION}>
          <h2 style={HEADING}>15. Security</h2>
          <p style={P}>
            We use reasonable administrative, technical, and physical safeguards designed to protect personal information. No system, website, database, or transmission method is completely secure. We cannot guarantee absolute security.
          </p>
        </section>

        <section style={SECTION}>
          <h2 style={HEADING}>16. Payment Information</h2>
          <p style={P}>
            Payment information is processed by our payment processors. {brand.name} does not necessarily store full payment-card numbers. Payment processing is subject to the privacy and security practices of the applicable payment provider.
          </p>
        </section>

        <section style={SECTION}>
          <h2 style={HEADING}>17. Marketing Communications</h2>
          <p style={P}>
            We may send marketing emails or other communications where permitted by law. You may opt out of marketing emails by using the unsubscribe link or following the instructions in the message.
          </p>
          <p style={P}>
            Even if you opt out of marketing, we may still send transactional, account, billing, legal, security, or service-related messages.
          </p>
        </section>

        <section style={SECTION}>
          <h2 style={HEADING}>18. State-Specific Notices</h2>
          <p style={P}>
            Residents of certain states may have additional privacy rights. These may include rights to access, delete, correct, opt out of targeted advertising, opt out of sale, opt out of certain profiling, and appeal denied requests.
          </p>
          <p style={P}>
            We will process state privacy requests in accordance with applicable law. To submit a request, contact us at <a href="/contact" style={{ color: '#0d5d2f' }}>/contact</a>.
          </p>
        </section>

        <section style={SECTION}>
          <h2 style={HEADING}>19. International Users</h2>
          <p style={P}>
            {brand.name} is intended for users located in the United States. If you access the Service from outside the United States, you understand that your information may be processed in the United States or other jurisdictions where privacy laws may differ from those in your location.
          </p>
        </section>

        <section style={SECTION}>
          <h2 style={HEADING}>20. Changes to This Privacy Policy</h2>
          <p style={P}>
            We may update this Privacy Policy from time to time. The updated version will be posted on the Service with a revised "Last Updated" date. If required by law, we will provide additional notice or obtain consent for material changes.
          </p>
        </section>

        <section style={SECTION}>
          <h2 style={HEADING}>21. Contact Us</h2>
          <p style={P}>
            For privacy questions, requests, or concerns, contact us at <a href="/contact" style={{ color: '#0d5d2f' }}>/contact</a>.
          </p>
        </section>
      </div>
    </main>
  );
};

export default PrivacyPage;
