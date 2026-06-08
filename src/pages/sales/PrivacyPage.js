import React from 'react';
import { Link } from 'react-router-dom';
import '../../styles/contentContainer.css';
import { useBrand } from '../../services/brand';

/**
 * Privacy Policy — brand-aware. Placeholders resolved at render time from
 * the active brand (name, domain, supportPhone).
 */
const PrivacyPage = () => {
  const brand = useBrand();

  const HEADING = { color: '#0d5d2f', marginBottom: '1rem' };
  const SUBHEAD = { color: '#111827', marginBottom: '0.5rem', marginTop: '1rem' };
  const P = { color: '#111827', lineHeight: '1.8', marginBottom: '1rem' };
  const UL = { color: '#111827', lineHeight: '1.8', paddingLeft: '1.5rem', marginBottom: '1rem' };
  const SECTION = { marginBottom: '2rem' };
  const LINK = { color: '#0d5d2f' };
  const TABLE = { width: '100%', borderCollapse: 'collapse', marginBottom: '1rem', color: '#111827' };
  const TH = { textAlign: 'left', padding: '0.5rem 0.75rem', borderBottom: '2px solid #d1d5db', verticalAlign: 'top' };
  const TD = { padding: '0.5rem 0.75rem', borderBottom: '1px solid #e5e7eb', verticalAlign: 'top', lineHeight: '1.6' };

  return (
    <main className="pageBackground">
      <div className="contentContainer contentContainerNarrow">
        <h1 style={HEADING}>Privacy Policy</h1>
        <p style={{ marginBottom: '2rem', color: '#6b7280', fontStyle: 'italic' }}>
          Last Updated: 6/8/2026
        </p>

        <p style={P}>
          This document outlines how <strong>{brand.name}</strong> ("we," "us," or the "Company") manages
          data on the <strong>{brand.domain}</strong> website and its subdomains. This policy is exclusive
          to this Site and does not apply to external websites linked here, which may maintain different
          privacy standards.
        </p>
        <p style={P}>
          Residents of California, Colorado, Connecticut, Delaware, Iowa, Minnesota, Montana, Nebraska,
          New Hampshire, New Jersey, Oregon, Tennessee, Texas, Utah, Vermont, and Virginia should refer
          to the state-specific sections below for additional legal rights.
        </p>

        <section style={SECTION}>
          <h2 style={HEADING}>Data Categorization and Collection</h2>
          <p style={P}>We gather several types of information to provide our services:</p>

          <h3 style={SUBHEAD}>A. Information You Provide</h3>
          <ul style={UL}>
            <li><strong>Account &amp; Contact Details:</strong> Your name, physical address, and email address.</li>
            <li><strong>Payment Information:</strong> Credit card or bank account numbers used for transactions.</li>
            <li><strong>Profile Attributes:</strong> Demographic details such as age and zip code.</li>
            <li><strong>Communications:</strong> Data from customer support calls, emails, forum posts, and survey responses.</li>
          </ul>

          <h3 style={SUBHEAD}>B. Automated Technical Data</h3>
          <p style={P}>When you navigate the Site, we automatically log:</p>
          <ul style={UL}>
            <li><strong>Network Activity:</strong> IP addresses, timestamps, browser types, language, and your referring URL. Network data collected also includes data collected from cookies, web beacons, and other technologies.</li>
            <li><strong>Device Specs:</strong> Hardware identifiers, including domain servers and types of devices used to access the Site, operating systems, and service provider details.</li>
            <li><strong>Interactions:</strong> Pages viewed, content accessed, and data entered into Site fields.</li>
          </ul>

          <h3 style={SUBHEAD}>C. Information from Third Parties</h3>
          <p style={P}>
            We may receive data about you from external providers, including social media platforms,
            credit bureaus, financial institutions, public sources, private sources, and commercial
            data brokers. This may include identity verification and financial history.
          </p>

          <h3 style={SUBHEAD}>D. Analytical Inferences</h3>
          <p style={P}>
            We may analyze your browsing habits and purchase history to predict your interests or
            future consumer behavior.
          </p>

          <p style={P}>
            <strong>Note on Public Records:</strong> We aggregate data from government databases and
            public websites to generate reports. Under applicable laws, this Publicly Available
            Information is generally not classified as "Personal Information."
          </p>
        </section>

        <section style={SECTION}>
          <h2 style={HEADING}>Uses of Personal Information Collected</h2>
          <p style={P}>
            We utilize the Personal Information we collect to support our business operations,
            fulfill user requests, and improve our platform. Specifically, this data is used for:
          </p>

          <h3 style={SUBHEAD}>Site Operations and Functionality</h3>
          <ul style={UL}>
            <li><strong>Platform Management:</strong> To run, maintain, and upgrade the Site's technical infrastructure.</li>
            <li><strong>User Access:</strong> To facilitate your ability to log in and interact with Site features.</li>
            <li><strong>Essential Tasks:</strong> To perform internal functions necessary for the Site to operate correctly.</li>
            <li><strong>Public Data Integration:</strong> To leverage publicly available records to generate reports and provide our core services to you and other users.</li>
          </ul>

          <h3 style={SUBHEAD}>Transactions and Account Services</h3>
          <ul style={UL}>
            <li><strong>Order Fulfillment:</strong> To process transactions, complete requested services, and deliver related documentation like invoices and purchase receipts.</li>
            <li><strong>Verification and Billing:</strong> To confirm you meet the criteria for specific products and to manage your payment accounts.</li>
            <li><strong>Administrative Communication:</strong> To send system updates, technical notices, security warnings, and support messages.</li>
            <li><strong>Customer Care:</strong> To address your questions, respond to comments, and provide troubleshooting assistance.</li>
          </ul>

          <h3 style={SUBHEAD}>Security and Legal Compliance</h3>
          <ul style={UL}>
            <li><strong>Fraud Prevention:</strong> To detect, investigate, and block fraudulent transactions, illegal activities, or unauthorized attempts to access the Site.</li>
            <li><strong>Enforcement of Rights:</strong> To uphold our contractual obligations and exercise our legal rights as established in any agreements between you and us.</li>
            <li><strong>Legal Adherence:</strong> To satisfy regulatory requirements and operate in accordance with applicable laws.</li>
          </ul>

          <h3 style={SUBHEAD}>Analytics and Technical Development</h3>
          <ul style={UL}>
            <li><strong>Usage Analysis:</strong> To monitor user behavior, track activity trends, and evaluate the performance of our services for both internal improvements and advertising purposes.</li>
            <li><strong>Product Innovation:</strong> To conduct testing, research, and data modeling for the development of new tools and features.</li>
            <li><strong>Advanced Technologies:</strong> To optimize the software utilized on the Site, including the training and refinement of Artificial Intelligence (AI) systems.</li>
          </ul>

          <h3 style={SUBHEAD}>Personalization and Marketing</h3>
          <ul style={UL}>
            <li><strong>Customized Experience:</strong> To tailor content, Site features, and advertisements to align with your specific preferences and interests.</li>
            <li><strong>Data Enrichment:</strong> To link or merge your data with information from third parties to better understand your needs.</li>
            <li><strong>Direct Marketing:</strong> To share news regarding our company, products, and services via email or other necessary contact methods.</li>
            <li><strong>Mobile Messaging:</strong> To deliver text messages you have consented to receive and to send push notifications (which can be disabled via your device or browser settings).</li>
          </ul>
        </section>

        <section style={SECTION}>
          <h2 style={HEADING}>Tracking Technologies (Cookies &amp; Beacons)</h2>
          <p style={P}>
            Our platform utilizes various tracking and localized data technologies — including
            cookies, web beacons, pixels, and storage scripts — to collect specific metrics
            regarding your digital behavior. These small data files are placed on your hardware
            to record the URL of the page you are currently viewing, the site you visited
            previously (referrer), the site you visit next (exit), temporal data (date and time),
            your network IP address, physical location, and your specific device or display
            configurations.
          </p>
          <p style={P}>We employ these technologies for the following operational and commercial objectives:</p>

          <h3 style={SUBHEAD}>Security and Analytics</h3>
          <ul style={UL}>
            <li><strong>Threat Detection:</strong> Identifying potential security breaches and executing fraud prevention protocols.</li>
            <li><strong>Traffic Evaluation:</strong> Quantifying visitor volume and identifying navigation patterns across our Site and the domains of our business partners.</li>
            <li><strong>Behavioral Insight:</strong> Monitoring how you interact with our interface to refine and improve our products and services.</li>
          </ul>

          <h3 style={SUBHEAD}>User Experience and Personalization</h3>
          <ul style={UL}>
            <li><strong>Customization:</strong> Optimizing your session by delivering content, features, and marketing materials that align with your predicted interests.</li>
            <li><strong>Convenience:</strong> Retaining your login credentials locally so you are not required to re-authenticate during every visit.</li>
            <li><strong>Internal Management:</strong> Providing essential administrative support for the Site's core functions.</li>
            <li><strong>Development:</strong> Improving our products and services.</li>
          </ul>

          <h3 style={SUBHEAD}>Research and Third-Party Reporting</h3>
          <ul style={UL}>
            <li><strong>Data Modeling:</strong> Performing individual or consolidated audits, research, and predictive modeling.</li>
            <li><strong>External Reporting:</strong> Providing performance metrics and reports to our advertisers and affiliated partners.</li>
          </ul>

          <h3 style={SUBHEAD}>Third-Party Involvement and Your Controls</h3>
          <p style={P}>
            These tracking mechanisms may be implemented directly by us (<strong>first-party</strong>)
            or by external service providers like <strong>Google Analytics</strong> or <strong>Meta</strong> (<strong>third-party</strong>).
            Because these external entities may have their own privacy frameworks, your prior
            interactions with their tools on other websites may govern how they process your data.
          </p>
          <p style={P}>You have several methods to manage these technologies:</p>
          <ol style={UL}>
            <li><strong>Browser Adjustments:</strong> You can modify your browser settings to restrict or block cookies.</li>
            <li><strong>Manual Deletion:</strong> Local and session storage — which we use for authentication, app settings, and cached data — can be cleared at any time by deleting your browser's history or cache.</li>
            <li><strong>Direct Request:</strong> You may <Link to="/contact" style={LINK}>contact us</Link> to discuss your preferences.</li>
          </ol>
          <p style={P}>
            Please be aware that your legal authority to change tracking or cookie configurations
            may be determined by the specific laws of your home jurisdiction or the location from
            which you access our Site.
          </p>
        </section>

        <section style={SECTION}>
          <h2 style={HEADING}>Information Sharing and Disclosure</h2>
          <p style={P}>
            We distribute Personal Information to third parties and marketing entities to facilitate
            our services. However, your Financial Data is strictly excluded from general disclosures;
            it is accessible only to essential operational partners (such as those handling billing,
            hosting, fulfillment, or data security) who are contractually bound to maintain our
            privacy standards. Additionally, data gathered specifically for SMS/text message
            enrollment is never shared.
          </p>
          <p style={P}>We disclose Personal Information for specific business functions to the following:</p>

          <h3 style={SUBHEAD}>Authorized Business Disclosures</h3>
          <ul style={UL}>
            <li><strong>Corporate Affiliates:</strong> Our parent, sibling, or related companies that provide technical support or customer care.</li>
            <li><strong>Operational Vendors:</strong> Service providers managing infrastructure, data analytics, identity validation, payment processing, and breach detection. This includes communication platforms utilizing AI technologies.</li>
            <li><strong>Marketing &amp; Ad Partners:</strong> Entities that assist in promoting our platform or third-party products; these partners are restricted to receiving only your Traffic Data.</li>
            <li><strong>Designated Third Parties:</strong> Any individual or organization you or your agents have explicitly authorized us to share your data with in relation to our services.</li>
            <li><strong>Contractors &amp; Partners:</strong> Independent entities with a verified business need for information required to fulfill their service obligations to us.</li>
          </ul>

          <h3 style={SUBHEAD}>Legal and Safety Requirements</h3>
          <ul style={UL}>
            <li><strong>Regulatory &amp; Law Enforcement:</strong> Government officials, courts, or law enforcement agencies when we determine disclosure is necessary or required by legal mandates, court orders, or official regulations.</li>
            <li><strong>Audit and Compliance:</strong> State or federal agencies conducting authorized reviews, or as part of a formal response to an agency inquiry or complaint.</li>
            <li><strong>Protective Disclosures:</strong> Third parties engaged to safeguard the legal rights, physical property, or safety of the Company, our users, or the general public.</li>
          </ul>

          <h3 style={SUBHEAD}>Structural Changes and Data Anonymization</h3>
          <ul style={UL}>
            <li><strong>Corporate Transitions:</strong> Should the Company undergo a merger, divestiture, reorganization, or liquidation (including bankruptcy), your information may be transferred to the involved third parties as a business asset in compliance with applicable law.</li>
            <li><strong>De-identified Information:</strong> We may aggregate or anonymize data so it is no longer linked to your identity. This non-personal information is used and shared without restriction for research, marketing, and other business purposes with affiliates and third parties.</li>
          </ul>
        </section>

        <section style={SECTION}>
          <h2 style={HEADING}>Interest-Based Ads</h2>
          <p style={P}>
            We may distribute your Personal Information to external marketing partners and
            third-party entities to facilitate tailored advertisements on platforms not affiliated
            with us.
          </p>
          <ul style={UL}>
            <li><strong>Google Data Protections:</strong> We strictly exclude any information retrieved via Google Workspace APIs or Google OAuth from these advertising practices. Such data is utilized solely to maintain or enhance the technical utility and features of our applications.</li>
            <li>
              <strong>Tracking Mechanics:</strong> Our advertising partners employ digital tools
              such as pixels, cookies, and similar tracking technologies to monitor your online
              behavior. During your sessions on our Site and other web locations, these entities may log:
              <ul style={UL}>
                <li>De-identified or hashed data to protect your direct identity.</li>
                <li>Clickstream patterns, including the specific pages you navigate.</li>
                <li>Technical metadata, such as your browser variety, access dates, and precise timestamps.</li>
                <li>Engagement metrics, specifically the subjects of advertisements you click on or scroll over.</li>
              </ul>
            </li>
            <li><strong>Predictive Personalization:</strong> This data collection allows advertising networks to analyze your activities across multiple websites over time. By identifying these patterns, they can forecast your consumer preferences and display "personalized" ads that are more likely to align with your interests.</li>
          </ul>

          <h3 style={SUBHEAD}>Your Opt-Out Rights and Limitations</h3>
          <p style={P}>
            If you prefer to restrict the delivery of interest-based marketing, you can utilize the
            management tools provided by industry regulatory bodies.
          </p>
          <ol style={UL}>
            <li>
              <strong>Network Advertising Initiative (NAI):</strong> Visit the{' '}
              <a href="http://www.thenai.org" target="_blank" rel="noopener noreferrer" style={LINK}>NAI website</a>{' '}
              for general details or use their{' '}
              <a href="https://thenai.org/opt-out/" target="_blank" rel="noopener noreferrer" style={LINK}>dedicated opt-out portal</a>{' '}
              to signal your preferences to participating members.
            </li>
            <li>
              <strong>Digital Advertising Alliance (DAA):</strong> You may also access the{' '}
              <a href="https://optout.aboutads.info/?c=2&lang=E" target="_blank" rel="noopener noreferrer" style={LINK}>AboutAds choice tool</a>{' '}
              to manage online behavioral tracking for various participating companies.
            </li>
          </ol>
          <p style={P}>
            <strong>Technical Note:</strong> We do not maintain these external opt-out links and
            cannot guarantee the participation of all third-party organizations in these programs.
            Because these settings are saved locally, you must repeat the opt-out process on every
            unique browser and hardware device you use to access our Site.
          </p>
        </section>

        <section style={SECTION}>
          <h2 style={HEADING}>Promotional Outreach &amp; Incentivized Data Processing</h2>

          <h3 style={SUBHEAD}>I. Electronic Marketing Communications</h3>
          <p style={P}>
            To terminate your subscription to marketing correspondence from the Company, our
            affiliated entities, or authorized third-party partners, you may utilize the
            "Unsubscribe" mechanism embedded within each email. Alternatively, you may submit a
            formal request for removal by <Link to="/contact" style={LINK}>contacting us</Link> directly.
          </p>

          <h3 style={SUBHEAD}>II. Jointly Sponsored Contests and Surveys</h3>
          <p style={P}>
            {brand.name} may organize or co-sponsor sweepstakes, surveys, or similar promotional
            offerings. When engaging in these activities, please be aware of the following legal
            framework:
          </p>
          <ul style={UL}>
            <li><strong>Identification of Partners:</strong> We will explicitly identify any co-sponsor at the precise point where you submit your data.</li>
            <li><strong>Third-Party Data Rights:</strong> By participating, you acknowledge that your Personal Information will be shared with said co-sponsors. These entities maintain the right to process your data for their independent business purposes, subject exclusively to their own respective privacy policies.</li>
            <li><strong>Abstention:</strong> Participation is entirely elective; if you do not agree to the transfer of your data to these identified third parties, you must refrain from entering these co-branded programs.</li>
          </ul>

          <h3 style={SUBHEAD}>III. Referral Programs and Financial Incentives</h3>
          <p style={P}>
            We may implement incentivized information collection programs, such as "Refer-A-Friend"
            initiatives or sweepstakes, in exchange for discounts, credits, or promotional items.
          </p>
          <ul style={UL}>
            <li><strong>Representation and Warranty of Authority:</strong> If you provide Personal Information regarding a third party (such as a friend's email address), you expressly represent and warrant that you possess the requisite legal authority and consent to disclose that information to us. If you lack this authorization, you are strictly prohibited from providing such data.</li>
            <li><strong>Economic Valuation of Personal Data:</strong> These voluntary programs assist in our business growth. The financial value attributed to the information you or a referred party provides is determined by the specific nature and frequency of Site interaction that results from the data. The incentive offered — whether in the form of a discount or service credit — serves as a direct reflection of this calculated value to the Company.</li>
            <li><strong>Right of Withdrawal:</strong> You maintain the right to withdraw from any financial incentive program at any time. To revoke your participation, please follow the contact procedures detailed in the "Contact Information" section of this policy.</li>
          </ul>
        </section>

        <section style={SECTION}>
          <h2 style={HEADING}>Testimonial Disclosures</h2>
          <p style={P}>
            We may feature user-provided testimonials and endorsements on our platform. By
            providing a testimonial, you grant us permission to publish it on the Site or in other
            marketing materials, typically identified by your first name and last initial, in
            accordance with our governing Terms of Use and Privacy Policy.
          </p>
        </section>

        <section style={SECTION}>
          <h2 style={HEADING}>Support and Customer Engagement</h2>
          <p style={P}>
            We share relevant data with our internal support staff and specialized vendors who
            provide the infrastructure and tools necessary to manage your account. These systems
            may log and archive your verbal communications and written messages to evaluate your
            interactions with the Site.
          </p>
          <ul style={UL}>
            <li><strong>Advanced Automation:</strong> We may implement sophisticated technologies, including Artificial Intelligence (AI), to enhance and automate our support workflows.</li>
            <li><strong>Purpose of Use:</strong> This data is utilized to resolve grievances, provide technical assistance, refine our service offerings, and fulfill other objectives outlined in this Privacy Policy.</li>
          </ul>
        </section>

        <section style={SECTION}>
          <h2 style={HEADING}>Independent Automated Processing</h2>
          <p style={P}>
            Automated decision-making refers to conclusions reached exclusively through the
            computer-driven processing of your Personal Information.
          </p>
          <ul style={UL}>
            <li><strong>Security Protocols:</strong> We utilize automated software primarily for protective measures, such as identifying fraudulent transactions or ensuring user safety.</li>
            <li><strong>Opt-Out Availability:</strong> Because these processes are critical for platform security, users cannot opt out of this specific technology.</li>
            <li><strong>Protections:</strong> We do not employ automated systems to generate adverse legal consequences or to conduct user profiling.</li>
          </ul>
        </section>

        <section style={SECTION}>
          <h2 style={HEADING}>International Data Logistics</h2>
          <p style={P}>Our Site is exclusively designed for and directed toward individuals within the United States.</p>
          <ul style={UL}>
            <li><strong>Regional Connectivity:</strong> If you access the Site from outside the U.S., your connection is routed directly to U.S.-based servers.</li>
            <li><strong>Cross-Border Flows:</strong> We may transfer your information to third parties in the U.S. or other global regions as required for the operations described in this Policy. These jurisdictions may maintain privacy regulations that differ from your local laws.</li>
            <li><strong>Legal Jurisdiction:</strong> Your data may be subject to discovery or access requests by U.S. judicial bodies, government agencies, or law enforcement under federal law.</li>
            <li><strong>Consent &amp; Safeguards:</strong> We maintain technical and contractual protections to secure your data during transfer. By navigating the Site, you consent to the storage, processing, and transfer of your data within the U.S. and other international territories.</li>
          </ul>
        </section>

        <section style={SECTION}>
          <h2 style={HEADING}>Data Maintenance and Retention Standards</h2>
          <p style={P}>
            We preserve your Personal Information only for the duration required to achieve the
            goals identified in this Policy. We maintain this data as necessary to satisfy legal
            mandates, settle disputes, and uphold our contractual terms. All records are stored on
            our encrypted servers or those managed by our secure storage partners.
          </p>
          <p style={P}>To determine the appropriate retention period, we evaluate the following criteria:</p>
          <ul style={UL}>
            <li><strong>Relationship Duration:</strong> The length of time we provide services to you or maintain an active account.</li>
            <li><strong>Business Utility:</strong> The timeframe required to fulfill the specific operational purposes for which the data was gathered.</li>
            <li><strong>Legal and Regulatory Necessity:</strong> Requirements to retain data for tax, auditing, or legal compliance.</li>
            <li><strong>Risk Management:</strong> The need to defend against potential litigation, prevent illegal activities, secure our digital environment, or protect the safety of the public.</li>
            <li><strong>Privacy Impact:</strong> The potential effect on individual privacy versus the technical complexity of removing data from our integrated infrastructure systems.</li>
          </ul>
        </section>

        <section style={SECTION}>
          <h2 style={HEADING}>Confidentiality and Security of Personal Information</h2>

          <h3 style={SUBHEAD}>Profile Management and Accuracy</h3>
          <p style={P}>
            You retain the authority to modify your account details — including payment methods,
            legal names, and contact information — by accessing the "Account Settings" portal
            after logging in.
          </p>
          <ul style={UL}>
            <li><strong>Assistance:</strong> If you require help or if your credentials (username, password, or credit card) are compromised, <Link to="/contact" style={LINK}>contact us</Link> immediately for an update.</li>
            <li><strong>Response Timeline:</strong> We commit to fulfilling access requests within a 30-day window.</li>
            <li><strong>Account Deactivation:</strong> You may close your account via your membership settings or by <Link to="/contact" style={LINK}>contacting our team</Link>.</li>
            <li><strong>Retention Policy:</strong> Post-deactivation, we may keep archived or cached data as required for regulatory compliance, dispute mitigation, or the enforcement of our legal agreements.</li>
          </ul>

          <h3 style={SUBHEAD}>Public Record Control</h3>
          <p style={P}>
            While we display Publicly Available Information to other users via search queries, you
            have the right to review the data we hold or request its removal from our search
            results through our <Link to="/opt-out" style={LINK}>Opt-Out Page</Link>.
          </p>

          <h3 style={SUBHEAD}>Security Protocols and Liability</h3>
          <p style={P}>
            We implement industry-standard safeguards to prevent the unauthorized alteration, loss,
            or misuse of data.
          </p>
          <p style={P}>
            <strong>Disclaimer:</strong> Despite these efforts, no digital infrastructure is
            entirely impenetrable. To the fullest extent allowed by law, we disclaim liability for
            any unauthorized access or disclosure of your information.
          </p>
        </section>

        <section style={SECTION}>
          <h2 style={HEADING}>External Platforms and Public Forums</h2>
          <p style={P}>
            Our Site provides links to third-party websites that we do not control. We are not
            responsible for their content or privacy standards; please evaluate their policies
            independently.
          </p>
          <ul style={UL}>
            <li><strong>Public Interaction:</strong> Any data you share in our chat rooms, message boards, or report comment sections becomes public. Use extreme caution when revealing personal details in these open spaces.</li>
          </ul>
        </section>

        <section style={SECTION}>
          <h2 style={HEADING}>Policy Modifications</h2>
          <p style={P}>
            We reserve the right to revise this Privacy Policy at any time. Updates will be posted
            on the Site or communicated through other legally required channels. <strong>Changes
            take effect immediately upon posting.</strong> If you do not agree to the new changes,
            please stop using the Site.
          </p>
        </section>

        <section style={SECTION}>
          <h2 style={HEADING}>Protection of Minors</h2>
          <p style={P}>
            Our services are restricted to individuals aged 16 or older (or the relevant legal age
            in your jurisdiction). We do not intentionally gather Personal Information from children.
          </p>
          <ul style={UL}>
            <li><strong>Parental Action:</strong> If you believe a minor has submitted Personal Information to our platform without your approval, <Link to="/contact" style={LINK}>contact us</Link>.</li>
            <li><strong>Deletion:</strong> Should we identify Personal Information from a minor collected in violation of the law, we will terminate the account and purge the records unless legally required to retain them.</li>
          </ul>
        </section>

        <section style={SECTION}>
          <h2 style={HEADING}>Jurisdictional Addendum: Nevada</h2>
          <p style={P}>
            Nevada residents may opt-out of the "sale" of certain personal data to third parties
            who intend to license or resell that data. To exercise this right, visit our{' '}
            <Link to="/opt-out" style={LINK}>Opt-Out Page</Link> or{' '}
            <Link to="/contact" style={LINK}>contact us</Link>.
          </p>
        </section>

        <section style={SECTION}>
          <h2 style={HEADING}>Supplemental Rights for Specific U.S. Residents</h2>
          <p style={P}>
            This section applies to residents of California, Colorado, Connecticut, Delaware, Iowa,
            Minnesota, Montana, Nebraska, New Hampshire, New Jersey, Oregon, Tennessee, Texas, Utah,
            Vermont, and Virginia.
          </p>

          <h3 style={SUBHEAD}>Personal Information We Collect and Share</h3>
          <p style={P}>
            The table below describes the information collected within the last twelve (12) months
            about you, as well as the categories of third parties with whom we have shared this
            information. (Note that the table below also includes our disclosures of Publicly
            Available Information, even though such information is technically not considered
            Personal Information under most US state laws).
          </p>
          <div style={{ overflowX: 'auto', marginBottom: '1rem' }}>
            <table style={TABLE}>
              <thead>
                <tr>
                  <th style={TH}>Category of Personal Information Collected</th>
                  <th style={TH}>Disclosed for a Business Purpose To:</th>
                  <th style={TH}>Sold and/or Shared With:</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td style={TD}><strong>A. Identifiers</strong> — Real name, alias, postal address, unique personal identifier, online identifier, IP address, email address, account name, or similar.</td>
                  <td style={TD}>Service providers (e.g., breach detection), corporate family, advertising partners (online identifiers only), data analytics providers.</td>
                  <td style={TD}>Referral affiliates, advertising partners (online identifiers only), data analytics providers (online identifiers only).</td>
                </tr>
                <tr>
                  <td style={TD}><strong>B. California Customer Records</strong> — Name, address, phone number, education, employment, financial info (credit/debit card numbers). <em>Excludes public government records.</em></td>
                  <td style={TD}>Service providers, corporate family, data analytics providers.</td>
                  <td style={TD}>Data analytics providers.</td>
                </tr>
                <tr>
                  <td style={TD}><strong>C. Protected Classifications</strong> — Age (40+), national origin, citizenship, marital status, sex (including gender identity/expression), veteran or military status.</td>
                  <td style={TD}>Service providers, corporate family, data analytics providers.</td>
                  <td style={TD}>Data analytics providers.</td>
                </tr>
                <tr>
                  <td style={TD}><strong>D. Commercial Information</strong> — Records of personal property, products/services purchased or considered, and other consuming histories or tendencies.</td>
                  <td style={TD}>Service providers, corporate family, data analytics providers, advertising partners.</td>
                  <td style={TD}>Data analytics providers, advertising partners.</td>
                </tr>
                <tr>
                  <td style={TD}><strong>E. Biometric Information</strong></td>
                  <td style={TD}><strong>Not Collected</strong></td>
                  <td style={TD}>N/A</td>
                </tr>
                <tr>
                  <td style={TD}><strong>F. Internet or Electronic Network Activity</strong> — Browsing history, search history, and interactions with websites, applications, or advertisements.</td>
                  <td style={TD}>Service providers, corporate family, data analytics providers, advertising partners.</td>
                  <td style={TD}>Data analytics providers, advertising partners.</td>
                </tr>
                <tr>
                  <td style={TD}><strong>G. Geolocation Data</strong></td>
                  <td style={TD}>Service providers, data analytics providers.</td>
                  <td style={TD}>Data analytics providers, advertising partners.</td>
                </tr>
                <tr>
                  <td style={TD}><strong>H. Sensory Data</strong> — Audio, electronic, visual, or similar information.</td>
                  <td style={TD}>Service providers, data analytics providers.</td>
                  <td style={TD}>Data analytics providers.</td>
                </tr>
                <tr>
                  <td style={TD}><strong>I. Professional or Employment Information</strong> (Current or past job history.)</td>
                  <td style={TD}><strong>Not Collected</strong></td>
                  <td style={TD}>N/A</td>
                </tr>
                <tr>
                  <td style={TD}><strong>J. Non-Public Education Information</strong> — Student records (class lists, ID codes) maintained by an educational institution.</td>
                  <td style={TD}><strong>Not Collected</strong></td>
                  <td style={TD}>N/A</td>
                </tr>
                <tr>
                  <td style={TD}><strong>K. Inferences Drawn from Personal Information</strong> — Profiles reflecting consumer preferences, characteristics, and behaviors.</td>
                  <td style={TD}>Service providers, data analytics providers, advertising partners.</td>
                  <td style={TD}>Data analytics providers (online identifiers only), advertising partners (online identifiers only).</td>
                </tr>
                <tr>
                  <td style={TD}><strong>L. Sensitive Personal Information</strong> — Other than publicly available SPI.</td>
                  <td style={TD}><strong>Not Collected</strong></td>
                  <td style={TD}>N/A</td>
                </tr>
              </tbody>
            </table>
          </div>

          <h3 style={SUBHEAD}>Use of Personal Information</h3>
          <p style={P}>
            We use collected data as outlined in the "Uses of Personal Information Collected"
            section above. We will provide formal notice before collecting new categories of data
            or using existing data for unrelated purposes.
          </p>

          <h3 style={SUBHEAD}>Monetization and Distribution of Personal Data</h3>
          <p style={P}>
            Over the previous twelve (12) months, we may have disclosed user identities and email
            addresses to Referral Affiliates for their independent marketing initiatives. We may
            obtain financial compensation from these affiliates if you utilize their offerings.
            You may revoke permission for this distribution by{' '}
            <Link to="/contact" style={LINK}>contacting us</Link>.{' '}
            <strong>Note for Texas Residents:</strong> We may engage in the sale of your sensitive
            personal data.
          </p>
          <p style={P}>
            Additionally, within the last year, we have collaborated with third-party advertising
            entities that employ cookies, pixels, and related tracking scripts on our platform.
            These tools help serve advertisements tailored to your probable interests. We may
            receive consideration in exchange for this data access.
          </p>

          <h3 style={SUBHEAD}>Managing Your Preferences</h3>
          <p style={P}>
            To halt this data harvesting, you can modify your cookie parameters through our on-site
            interface or via your browser's privacy settings. Direct links for configuration on
            major browsers include:
          </p>
          <ul style={UL}>
            <li>Apple Safari</li>
            <li>Google Chrome</li>
            <li>Microsoft Edge</li>
            <li>Mozilla Firefox</li>
          </ul>
          <p style={P}>
            You may also update your Facebook Advertising Preferences directly through their platform.
          </p>

          <h3 style={SUBHEAD}>Google Analytics: Supplemental Disclosures</h3>
          <p style={P}>
            We employ Google Analytics (GA4) to facilitate advanced advertising metrics, including:
          </p>
          <ul style={UL}>
            <li>Remarketing and Signals</li>
            <li>Display Network Impression Reporting</li>
            <li>Demographics and Interest Analytics</li>
          </ul>
          <p style={P}>
            While many of these features utilize anonymized, aggregate data to ensure privacy
            compliance, Google offers specific exclusion tools. You may:
          </p>
          <ol style={UL}>
            <li>Opt out of Google AdWords Remarketing via their preference center.</li>
            <li>Install the Google Analytics Opt-out Browser Add-on to prevent activity tracking.</li>
          </ol>
          <p style={P}>
            Data transferred to Google Ads or Analytics is governed by their respective Terms of Service.
          </p>

          <h3 style={SUBHEAD}>iOS Application Data</h3>
          <p style={P}>
            Users of our iOS App who initiate refund requests through Apple acknowledge that we may
            provide User Data to Apple to facilitate the review process. Apple stipulates that this
            information is utilized exclusively for refund verification and not for tracking
            purposes. Visit <strong>privacy.apple.com</strong> to manage these requests.
          </p>
        </section>

        <section style={SECTION}>
          <h2 style={HEADING}>Statutory Rights and Consumer Choices</h2>
          <p style={P}>
            In accordance with local regulations, residents of California, Colorado, Connecticut,
            Delaware, Iowa, Minnesota, Montana, Nebraska, New Hampshire, New Jersey, Oregon,
            Tennessee, Texas, Utah, Vermont, or Virginia may exercise the following rights:
          </p>
          <ul style={UL}>
            <li><strong>To Know and Access:</strong> to obtain a copy of the specific pieces of Personal Information we have collected about you. (Note that this right only applies to Personal Information relating to you, and not to any other user.)</li>
            <li><strong>Deletion:</strong> to request that {brand.name} delete your Personal Information. This right may be limited to the extent that we are permitted or required by applicable law to retain information. (Note that if you request deletion of your Personal Information, you may no longer be able to use or access the Site. If you decide to use or access the Site again, we may consider this a new account, and may collect Personal Information associated with that account in accordance with this Privacy Policy.)</li>
            <li><strong>Opt-Out of "Sale" and Certain Sharing Practices:</strong> you have the right to opt-out of certain information sharing practices with third parties who do not act as our service providers. In some states, like California, this information sharing may qualify as a "share" or a "sale," while in other states, like Virginia, this information sharing may qualify as "targeted advertising" (collectively, "personalized advertising"). If you wish to opt-out of personalized advertising, you can opt out of said sharing by <Link to="/opt-out" style={LINK}>clicking here</Link>, or by <Link to="/contact" style={LINK}>contacting us</Link> as set forth below.</li>
            <li><strong>Right to Limit Use of Sensitive Personal Information:</strong> California residents have the right to limit the use of each type of Sensitive Personal Information for each purpose with each type of third-party partner. Please note that we only keep your Sensitive Personal Information for a limited time, and only for the transaction for which it is required. Currently, we do not provide your Sensitive Personal Information to any third parties other than those service providers that are necessary for us to provide our Services to you.</li>
            <li><strong>Correction:</strong> to request the correction of inaccurate Personal Information that we may have on file about you.</li>
            <li><strong>Obtain additional details regarding our information practices:</strong> You may have the right to request disclosures regarding our information practices. (Note that this information is generally available in this Privacy Policy.)</li>
          </ul>
          <p style={P}>
            We provide these rights without discrimination; your service pricing and quality will
            not be penalized for exercising these legal options.
          </p>

          <h3 style={SUBHEAD}>Automated Signals: DNT and GPC</h3>
          <ul style={UL}>
            <li><strong>Do Not Track (DNT):</strong> We currently do not acknowledge or act upon DNT signals sent by web browsers.</li>
            <li><strong>Global Privacy Control (GPC):</strong> If our systems identify a GPC signal from your hardware, we will treat it as a valid "Do Not Sell" request or a directive to limit targeted advertising, depending on the mandates of your jurisdiction.</li>
          </ul>

          <h3 style={SUBHEAD}>Identity Verification and Appeals</h3>
          <p style={P}>
            To protect your privacy, we must verify your identity before fulfilling requests. We
            may ask for your name, email, or phone number to confirm your persona. We may deny
            requests if they conflict with the public interest (e.g., crime prevention) or legal
            privilege. If a request is rejected, residents of the states listed above have the
            right to appeal our decision. The process for that appeal will be sent to you
            separately if your request is denied.
          </p>

          <h3 style={SUBHEAD}>California "Shine the Light"</h3>
          <p style={P}>
            California residents may request a notice detailing the categories of Personal
            Information we share with affiliates for their direct marketing, including relevant
            contact information for those parties.
          </p>
        </section>

        <section style={SECTION}>
          <h2 style={HEADING}>California Transparency Metrics (2025/2026)</h2>
          <p style={P}>
            Under CA SB 362 (The Delete Act), we report the following statistics for the 2025
            calendar year (as of January 1, 2026):
          </p>
          <div style={{ overflowX: 'auto', marginBottom: '1rem' }}>
            <table style={TABLE}>
              <thead>
                <tr>
                  <th style={TH}>Request Category</th>
                  <th style={TH}>Total Requests</th>
                  <th style={TH}>Average Response Time</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td style={TD}><strong>Deletion</strong></td>
                  <td style={TD}><strong>0</strong></td>
                  <td style={TD}><strong>1 Day</strong></td>
                </tr>
                <tr>
                  <td style={TD}><strong>Knowledge of Collection</strong></td>
                  <td style={TD}><strong>0</strong></td>
                  <td style={TD}><strong>1 Day</strong></td>
                </tr>
                <tr>
                  <td style={TD}><strong>Access Requests</strong></td>
                  <td style={TD}><strong>0</strong></td>
                  <td style={TD}><strong>1 Day</strong></td>
                </tr>
                <tr>
                  <td style={TD}><strong>Opt-Out (Sale/Sharing)</strong></td>
                  <td style={TD}><strong>0</strong></td>
                  <td style={TD}><strong>1 Day</strong></td>
                </tr>
                <tr>
                  <td style={TD}><strong>Limit Sensitive PI Use</strong></td>
                  <td style={TD}><strong>0</strong></td>
                  <td style={TD}><strong>1 Day</strong></td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        <section style={SECTION}>
          <h2 style={HEADING}>Publicly Available Information (Public Data)</h2>
          <p style={P}>
            Independent of the Personal Information defined above, we aggregate Publicly Available
            Information from government archives, commercial records, and websites to generate our
            reports.
          </p>
          <ul style={UL}>
            <li><strong>Scope:</strong> This data covers U.S. residents generally and is not combined with the "User Data" or "Traffic Data" we collect directly from you for our internal services.</li>
            <li><strong>Legal Basis:</strong> We provide access to this data under First Amendment protections to help users inform themselves regarding safety (e.g., DUI records for carpools) or personal connections (e.g., finding biological family).</li>
            <li><strong>Voluntary Control:</strong> Although state privacy statutes often exclude public records, we voluntarily allow individuals to suppress their public data from our search results via our <Link to="/opt-out" style={LINK}>Opt-Out Page</Link>.</li>
          </ul>
        </section>

        <section style={SECTION}>
          <h2 style={HEADING}>Special Protections for Covered Persons</h2>
          <p style={P}>
            Certain state statutes permit judges, judicial officers, law enforcement officers,
            elected officials, prosecutors and public defenders, and certain of their family
            members and cohabitants to restrict the display of their information for safety
            reasons. To exercise these rights:
          </p>
          <ol style={UL}>
            <li>Verify your "Covered Person" status under the specific law.</li>
            <li>Provide a screenshot of the record on our Site.</li>
            <li>Submit your birth date, residence, and contact info using our <Link to="/contact" style={LINK}>Contact Us</Link> page.</li>
          </ol>
        </section>

        <section style={SECTION}>
          <h2 style={HEADING}>Washington State Resident Notice</h2>
          <p style={P}>
            Washington residents with a Washington area code can utilize our dedicated services to
            verify if their mobile number is in our database and request its free removal.{' '}
            <Link to="/contact" style={LINK}>Contact</Link> our support agents at{' '}
            <strong>{brand.supportPhone}</strong> to facilitate this.
          </p>
        </section>

        <section style={SECTION} id="contact-information">
          <h2 style={HEADING}>Contact Information</h2>
          <p style={P}>For inquiries regarding these notices or to exercise your rights, please contact:</p>
          <ul style={UL}>
            <li><strong>Phone:</strong> {brand.supportPhone}</li>
            <li><strong>Web Contact Us page:</strong> <Link to="/contact" style={LINK}>{brand.domain}/contact</Link></li>
            <li><strong>Web Home page:</strong> <Link to="/" style={LINK}>{brand.domain}</Link></li>
            <li><strong>Mailing Address:</strong> People Data Systems LLC, 2803 Philadelphia Pike, Suite B #237, Claymont, DE 19703</li>
          </ul>
        </section>
      </div>
    </main>
  );
};

export default PrivacyPage;
