import React from 'react';
import { Link } from 'react-router-dom';
import '../../styles/contentContainer.css';
import { useBrand } from '../../services/brand';

/**
 * Terms of Service — brand-aware. Placeholders ([brand], [phone], [price],
 * [domain], [website/contact], [address]) resolved at render time from
 * brand config (name, domain, supportPhone, recurringPrice, trialDays,
 * trialPrice). SMS HELP/STOP route to the same brand.supportPhone
 * 10DLC number provisioned via SlickText.
 */
const TermsPage = () => {
  const brand = useBrand();

  const HEADING = { color: '#0d5d2f', marginBottom: '1rem' };
  const SUBHEAD = { color: '#111827', marginBottom: '0.5rem', marginTop: '1rem' };
  const P = { color: '#111827', lineHeight: '1.8', marginBottom: '1rem' };
  const UL = { color: '#111827', lineHeight: '1.8', paddingLeft: '1.5rem', marginBottom: '1rem' };
  const SECTION = { marginBottom: '2rem' };
  const LINK = { color: '#0d5d2f' };
  const CALLOUT = {
    padding: '1rem 1.25rem',
    background: '#f9fafb',
    border: '1px solid #e5e7eb',
    borderRadius: 6,
    marginBottom: '1rem',
    color: '#111827',
    lineHeight: '1.7',
  };

  const trialPriceStr = `$${(brand.trialPrice ?? 1).toFixed(2)}`;
  const recurringPriceStr = `$${(brand.recurringPrice ?? 49.98).toFixed(2)}`;
  const trialDays = brand.trialDays ?? 7;
  const MAIL_ADDRESS_LINES = [
    'People Data Systems LLC',
    '2803 Philadelphia Pike, Suite B #237',
    'Claymont, DE 19703',
  ];

  return (
    <main className="pageBackground">
      <div className="contentContainer contentContainerNarrow">
        <h1 style={HEADING}>Terms of Service</h1>
        <p style={{ marginBottom: '2rem', color: '#6b7280', fontStyle: 'italic' }}>
          Last Updated: 6/25/2026
        </p>

        <p style={{ ...P, fontWeight: 700, textTransform: 'uppercase' }}>
          SIGNIFICANT NOTIFICATION: RESOLUTION OF DISPUTES CONCERNING THESE PROVISIONS
          AND THE {brand.name} PLATFORM ARE GOVERNED BY COMPULSORY ARBITRATION AND A
          WAIVER OF REPRESENTATIVE ACTION RIGHTS AS SPECIFIED IN THE "OBLIGATORY
          ARBITRATION AND CLASS ACTION WAIVER" PARAGRAPH BELOW.
        </p>

        <p style={P}>
          This Terms of Service (the "Terms") constitutes a formal legal contract between
          you and {brand.name}, including its corporate partners, branches, and
          subsidiaries as updated periodically (collectively, "{brand.name},"
          "Company," "we," "us," and "our"). These provisions govern {brand.name}'s
          web platforms, mobile software, and other interactive digital services that
          display these Terms (collectively, the "Services").
        </p>
        <p style={P}>
          By accessing or engaging with the Services, or by submitting or transferring
          any User Content (as defined below) to the platform, you, your successors, and
          assigns (collectively, "you") acknowledge that you have reviewed, understood,
          and consented to be legally bound by these Terms. If you disagree with these
          provisions, you possess no authorization to use or access the Services.
        </p>
        <p style={P}>
          We reserve the right to alter these Terms at our discretion. Please review
          this page regularly for revisions. All modifications will be updated on the
          Services. If you cannot abide by or do not accept the revised Terms, you must
          cease use of the platform immediately. New Terms become active upon publication
          and apply prospectively, except as specified in the Mandatory Arbitration and
          Class Action Waiver section. Continuing to use the platform after updates
          signifies your legally binding consent to the changes.
        </p>
        <p style={P}>
          Supplementary provisions may apply to specific interactions with the Services.
          Such terms will be shared with you or published near the relevant features;
          they are integrated into these Terms by reference. For instance, the{' '}
          {brand.name} <Link to="/privacy" style={LINK}>Privacy Policy</Link> (detailing
          data collection, usage, and disclosure) is incorporated into and forms an
          integral part of these Terms.
        </p>

        <section style={SECTION}>
          <h2 style={HEADING}>Qualification and Jurisdiction</h2>
          <h3 style={SUBHEAD}>Qualification</h3>
          <p style={P}>
            To utilize the Services, you represent and warrant that you are of legal
            age and possess full legal capacity. If using the Services for a third
            party, you confirm you are their authorized agent and that your use
            signifies that party's acceptance of these provisions. Access is prohibited
            if {brand.name} has previously banned you from the platform.
          </p>
          <h3 style={SUBHEAD}>International Usage</h3>
          <p style={P}>
            {brand.name} operates and provides the Services from the United States. We
            make no claims regarding the suitability of the Services in other
            jurisdictions. Accessing the platform from outside the U.S. is done at your
            own discretion and risk; you are solely responsible for local law
            compliance.
          </p>
        </section>

        <section style={SECTION}>
          <h2 style={HEADING}>Ownership Rights</h2>
          <h3 style={SUBHEAD}>Intellectual Property</h3>
          <p style={P}>
            {brand.name} owns and manages the Services. The materials
            provided — derived from {brand.name}, its partners, and other sources — are
            protected by U.S. copyright law, international treaties, trademarks, and
            other proprietary statutes. The platform is also protected as a collective
            work under U.S. and international law. You agree to honor all copyright
            notices and legal restrictions. You acknowledge that the platform was
            created through significant time and financial investment and constitutes
            valuable intellectual property. You agree to protect these proprietary
            rights during and after the duration of these Terms and will comply with
            written requests from {brand.name} or its Suppliers to protect their
            contractual and common law interests. You must notify {brand.name}{' '}
            immediately of any unauthorized access or infringement claims. All global
            rights regarding trade secrets, patents, trademarks, and know-how remain
            the exclusive property of {brand.name}.
          </p>
          <h3 style={SUBHEAD}>Usage of Marks</h3>
          <p style={P}>
            You are prohibited from using {brand.name}'s trademarks, logos, or service
            marks in a way that suggests unauthorized association or ownership. You
            acknowledge you possess no rights to these marks.
          </p>
        </section>

        <section style={SECTION}>
          <h2 style={HEADING}>User-Provided Content and Input</h2>
          <h3 style={SUBHEAD}>User Content</h3>
          <p style={P}>
            The platform may allow you to submit or "post" materials such as videos,
            photos, reviews, and comments ("User Content"). You agree that the
            individual who originated the content is solely responsible for it, whether
            shared publicly or privately. You warrant that you hold all necessary
            rights to share such material without infringing on third parties.
          </p>
          <h3 style={SUBHEAD}>Content Licensing</h3>
          <p style={P}>
            By posting User Content, you grant us a global, perpetual, irrevocable,
            royalty-free, non-exclusive, and sub-licensable license to reproduce, modify, distribute,
            display, and publish said content in any format or media, current or
            future. This includes the right to use the content for platform promotion.
            Your user name may be linked to your submissions.
          </p>
          <h3 style={SUBHEAD}>Content Warranties</h3>
          <p style={P}>
            You warrant that you own or control all rights to your User Content. You
            agree to indemnify and defend {brand.name} against all claims arising from
            your submissions. We reserve the right to assume exclusive defense of such
            claims at our own cost, and you agree to assist us.
          </p>
          <h3 style={SUBHEAD}>Content Oversight</h3>
          <p style={P}>
            We may, at our discretion, screen User Content but we have no requirement
            to do so. We reserve the right to move, edit, or delete any content for
            any reason. We do not validate or sanction User Content; you assume all
            risks regarding its accuracy or utility. Under the Communications Decency
            Act (47 U.S.C. § 230), {brand.name} is an interactive service provider and
            will not be treated as the publisher or speaker of information provided by
            third parties. You agree to follow the terms of any third-party services
            (e.g., Facebook, X) integrated into the platform.
          </p>
          <h3 style={SUBHEAD}>User Input</h3>
          <p style={P}>
            Any data or ideas sent via email or other channels are non-confidential.
            We hold no obligation to protect this information and are free to use,
            distribute, or reproduce it for any purpose without restriction.
          </p>
        </section>

        <section style={SECTION}>
          <h2 style={HEADING}>Licensing and Restricted Activities</h2>
          <h3 style={SUBHEAD}>Your License</h3>
          <p style={P}>
            Subject to your adherence to these Terms, we provide a limited,
            non-exclusive, non-transferable, and revocable right to access the Services
            for your personal, non-commercial use.
          </p>
          <h3 style={SUBHEAD}>Forbidden Uses</h3>
          <p style={P}>
            Engaging in illegal acts or any use not explicitly authorized here is
            strictly prohibited. You agree not to:
          </p>
          <ul style={UL}>
            <li>Post content that is abusive, harassing, threatening, or obscene;</li>
            <li>Post material that disparages others based on race, gender, religion, disability, or sexual orientation;</li>
            <li>Post User Content that is unlawful, harmful, tortious, defamatory, libelous, or invasive of another's privacy;</li>
            <li>Use the platform for commercial benchmarking or to aggregate data for competing products;</li>
            <li>Duplicate, download (excluding page caching required for private use, or as otherwise explicitly allowed by these Terms), alter, circulate, post, transfer, exhibit, perform, recreate, air, copy, issue, reissue, upload, authorize, deconstruct, develop derivative works from, or offer for purchase any material or other data found on or retrieved through the Services, via any method except as permitted in these Terms or with the prior written authorization of {brand.name};</li>
            <li>Scrape, index, or copy platform information using automated tools (robots, spiders, crawlers) without manual browser access or an approved API;</li>
            <li>Circumvent robot exclusion headers or security measures;</li>
            <li>Post instructions for or advocate for criminal activities;</li>
            <li>Upload malicious code, viruses, or software designed to interrupt services, hardware or telecommunications;</li>
            <li>Post material that impedes or otherwise prohibits communication or disrupts user discussion;</li>
            <li>Post, utilize or otherwise make available any other party's intellectual property unless you have the right to do so, or remove or alter any copyright, trademark or other proprietary notice contained on the Services;</li>
            <li>Falsely represent your identity or institutional affiliation;</li>
            <li>Solicit sensitive data (passwords, credit card info) from other users;</li>
            <li>Post advertisements, spam, or engage in unauthorized commercial solicitations;</li>
            <li>Violate the law or encourage conduct that would constitute a criminal offense or give rise to civil liability;</li>
            <li>Frame, inline link, or similarly display the Services or any portion of the Services;</li>
            <li>Violate these Terms or any guidelines or policies posted by {brand.name};</li>
            <li>Facilitate violations of these Terms or the Privacy Policy; and/or</li>
            <li>Interfere with the usage or enjoyment of the Services by other parties.</li>
          </ul>
          <p style={P}>
            We maintain absolute discretion to remove content, block access, or
            terminate accounts for violations.
          </p>
        </section>

        <section style={SECTION}>
          <h2 style={HEADING}>Regulatory Adherence</h2>
          <p style={P}>
            You consent to {brand.name} accessing and disclosing your account data or
            User Content if required by law or in a good-faith belief that such action
            is necessary to: (1) comply with legal mandates; (2) enforce these Terms;
            (3) respond to infringement claims; or (4) protect the safety and rights
            of {brand.name}, its users, or the public.
          </p>
        </section>

        <section style={SECTION}>
          <h2 style={HEADING}>External Links</h2>
          <p style={P}>
            We may provide links to third-party websites for your convenience. We do
            not control these sites and assume no responsibility for their content,
            accuracy, or quality. Links do not constitute an endorsement of the third
            party.
          </p>
        </section>

        <section style={SECTION}>
          <h2 style={HEADING}>Mobile Platform Provisions</h2>
          <p style={P}>
            Text-based services are governed by these Terms. <strong>Note: Standard
            Message &amp; Data Rates Apply.</strong>
          </p>
          <ul style={UL}>
            <li><strong>Contact:</strong> Reach us using our <Link to="/contact" style={LINK}>Contact Us</Link> page.</li>
            <li><strong>Help:</strong> Text HELP to {brand.supportPhone} or call {brand.supportPhone}.</li>
            <li><strong>Opt-Out:</strong> Text STOP to {brand.supportPhone} to end SMS services.</li>
            <li><strong>Frequency:</strong> Alerts are delivered at a rate of roughly 1 message per day. Carriers are not liable for undelivered or delayed messages.</li>
          </ul>
        </section>

        <section style={SECTION}>
          <h2 style={HEADING}>Guarantees and Disclosures</h2>
          <p style={P}>YOU EXPRESSLY ACKNOWLEDGE AND CONSENT THAT:</p>
          <ul style={UL}>
            <li>ALL PRODUCT WARRANTIES ARE PROVIDED SOLELY BY THE THIRD-PARTY MANUFACTURERS.</li>
            <li>THE SERVICES ARE PROVIDED "AS IS" AND "AS AVAILABLE" WITH NO REPRESENTATIONS OR WARRANTIES OF ANY KIND. {brand.name.toUpperCase()} DISCLAIMS ALL WARRANTIES, WHETHER EXPRESS, IMPLIED, OR STATUTORY, INCLUDING MERCHANTABILITY, ACCURACY, TITLE, FITNESS FOR A PARTICULAR PURPOSE, AND NON-INFRINGEMENT.</li>
            <li>WE ARE NOT RESPONSIBLE FOR THE DELETION, MIS-DELIVERY, OR STORAGE FAILURE OF ANY USER DATA OR SETTINGS.</li>
            <li>ANY MATERIAL DOWNLOADED IS DONE AT YOUR OWN RISK; YOU ARE RESPONSIBLE FOR ANY RESULTING HARDWARE DAMAGE OR DATA LOSS.</li>
            <li>NO ADVICE OR INFORMATION, WHETHER ORAL OR WRITTEN, OBTAINED BY YOU FROM {brand.name.toUpperCase()} OR THROUGH OR FROM THE SERVICES SHALL CREATE ANY WARRANTY.</li>
            <li>THE SERVICES DO NOT OFFER LEGAL OR MEDICAL ADVICE. CONSULT RELEVANT PROFESSIONALS FOR SUCH NEEDS.</li>
            <li>WE MAKE NO PROMISES THAT OUR PRODUCTS OR SERVICES WILL MEET YOUR REQUIREMENTS, OR THAT THEY WILL ACHIEVE ANY PARTICULAR RESULTS, INCLUDING EMPLOYMENT OPPORTUNITIES.</li>
            <li>WE WILL NOT BE RESPONSIBLE FOR ANY THIRD-PARTY CONTENT ON SERVICES, ANY LINKS TO THIRD-PARTY WEBSITES OR ANY THIRD-PARTY WEBSITES. WE DO NOT VET USERS WHO CLAIM TO BE EXPERTS ON THE PLATFORM.</li>
            <li>PACKAGING, LABELS AND INSTRUCTIONS MAY CONTAIN MANUFACTURER DISCLAIMERS AND LIMITATIONS OF LIABILITY THAT APPLY TO THE PRODUCTS YOU PURCHASE. {brand.name.toUpperCase()} MAKES ALL DISCLAIMERS IN THIS PARAGRAPH ON BEHALF OF ITSELF AND ITS LICENSORS AND SUPPLIERS.</li>
          </ul>
        </section>

        <section style={SECTION}>
          <h2 style={HEADING}>Limitation of Liability</h2>
          <p style={P}>
            {brand.name.toUpperCase()} AND ITS REPRESENTATIVES, INCLUDING ITS RESPECTIVE
            OFFICERS, DIRECTORS, EMPLOYEES, MEMBERS, SHAREHOLDERS (AND ALL SUCCESSORS
            AND ASSIGNS OF ANY OF THE FOREGOING) SHALL NOT BE LIABLE FOR ANY INDIRECT,
            CONSEQUENTIAL, OR PUNITIVE DAMAGES ARISING FROM THE USE OR INABILITY TO USE
            THE SERVICES. OUR TOTAL AGGREGATE LIABILITY SHALL NOT EXCEED THE AMOUNT
            PAID FOR THE RELEVANT SERVICE OR $100. WE ARE NOT
            RESPONSIBLE FOR THE ILLEGAL OR OFFENSIVE CONDUCT OF THIRD PARTIES.
          </p>
          <p style={P}>
            {brand.name.toUpperCase()} DOES NOT WARRANT, ENDORSE, GUARANTEE OR ASSUME
            RESPONSIBILITY FOR ANY PRODUCT OR SERVICE ADVERTISED OR OFFERED BY A THIRD
            PARTY THROUGH THE SERVICES OR ANY WEBSITE FEATURED OR LINKED TO THROUGH THE
            SERVICE, AND WE WILL NOT BE A PARTY TO OR IN ANY WAY BE RESPONSIBLE FOR
            MONITORING ANY TRANSACTION BETWEEN YOU AND THIRD-PARTY PROVIDERS OF
            PRODUCTS OR SERVICES. {brand.name.toUpperCase()} WILL NOT BE LIABLE FOR THE
            OFFENSIVE OR ILLEGAL CONDUCT OF ANY THIRD PARTY. YOU VOLUNTARILY ASSUME THE
            RISK OF HARM OR DAMAGE FROM THE FOREGOING. THE FOREGOING LIMITATIONS WILL
            APPLY EVEN IF A REMEDY FAILS OF ITS ESSENTIAL PURPOSE AND TO THE FULLEST
            EXTENT PERMITTED BY LAW.
          </p>
          <p style={P}>
            <strong>California Notice:</strong> Residents of California waive
            California Civil Code §1542, releasing claims — including those related to
            criminal acts — that are currently unknown or unsuspected.
          </p>
        </section>

        <section style={SECTION}>
          <h2 style={HEADING}>Indemnification</h2>
          <p style={P}>
            You agree to defend and hold {brand.name}, including its respective
            officers, directors, employees, members, shareholders, or representatives
            (and all successors and assigns of any of the foregoing), harmless against
            any third-party claims or legal fees arising from your use of the
            Services, your violation of these Terms or the Privacy Policy, your
            violation of any applicable law, your submission, posting, or transmission
            of User Content onto the Services, and/or your infringement of any rights
            of another party. We reserve the right to assume the exclusive defense and
            control of such disputes, and you will cooperate with us in asserting any
            available defenses.
          </p>
        </section>

        <section style={SECTION}>
          <h2 style={HEADING}>Advertisers</h2>
          <p style={P}>
            Transactions or interactions with advertisers found on the Services are
            strictly between you and said advertiser. {brand.name} is not liable for
            any losses resulting from such dealings.
          </p>
        </section>

        <section style={SECTION}>
          <h2 style={HEADING}>Third-Party Services and Affiliates</h2>
          <p style={P}>
            The Services may contain affiliate marketing links. We may earn a
            commission if you make a purchase through these links. We are not liable
            for the availability, content, or data-handling practices of external
            resources or sites. Your interactions with them are governed by their own
            specific policies.
          </p>
        </section>

        <section style={SECTION}>
          <h2 style={HEADING}>Service Changes and Account Termination</h2>
          <h3 style={SUBHEAD}>Modification</h3>
          <p style={P}>
            We reserve the right to modify or end the Services at any time without
            notice. You agree that we shall not be liable to you or any third party
            for any modification, suspension or discontinuance of the Services.
          </p>
          <h3 style={SUBHEAD}>Termination</h3>
          <p style={P}>
            We may revoke your access for any reason, including: (a) Terms violations;
            (b) law enforcement requests; (c) discontinuance or material modification
            of the Services (or any part thereof); (d) security issues; (e) account
            inactivity; (f) activities related to protecting the rights, property or
            safety of {brand.name}, its agents and affiliates, its users and the
            public; or (g) registration information that is false, inaccurate,
            out-of-date, or incomplete. Upon termination, your rights to the Services
            end immediately, though legal provisions (like Arbitration) remain in
            effect. Termination of your account may also include, at our sole
            discretion, the deletion of your account and/or User Content.
          </p>
        </section>

        <section style={SECTION}>
          <h2 style={HEADING}>Obligatory Arbitration and Class Action Waiver</h2>
          <p style={P}>
            EXCEPT WHERE STATUTORILY FORBIDDEN, ALL DISPUTES BETWEEN YOU AND THE
            COMPANY (INCLUDING ITS AGENTS AND AFFILIATES) RELATING TO THE SERVICES,
            MATERIALS, OR OUR RELATIONSHIP SHALL BE RESOLVED THROUGH BINDING
            ARBITRATION.
          </p>
          <p style={P}>The following procedures will apply:</p>
          <p style={P}>
            Should a party choose to pursue binding arbitration, they must deliver
            written notice to the opposing party via registered or certified mail.
            This notice must detail, with reasonable particularity, the nature and
            foundation of the claim, as well as the total claim amount. Within thirty
            (30) days of receiving this notice, the notified party must submit a
            written reply that outlines its stance regarding the claim with reasonable
            particularity. If the parties cannot settle the dispute through good faith
            negotiations conducted during the thirty (30)-day timeframe following the
            written reply, either party may commence binding arbitration in accordance
            with the terms and conditions established herein.
          </p>
          <ul style={UL}>
            <li><strong>Individual Capacity:</strong> Claims must be brought individually, not as a plaintiff or class member in any representative proceeding.</li>
            <li><strong>Jury Waiver:</strong> Both parties waive the right to a trial by jury.</li>
            <li><strong>Procedures:</strong> Arbitration will be managed by the American Arbitration Association (AAA) under its Commercial and Consumer rules. It will occur in Claymont, DE, but claims under $2,500 may be handled by phone.</li>
            <li><strong>Governing Law:</strong> This agreement is governed by the Federal Arbitration Act (FAA). Judgments may be entered in Delaware state or federal courts.</li>
            <li><strong>Non-Severability:</strong> If the Class Action Waiver is found unenforceable, the entire arbitration agreement becomes void.</li>
          </ul>
        </section>

        <section style={SECTION}>
          <h2 style={HEADING}>Fair Credit Reporting Act (FCRA) Compliance</h2>
          <p style={{ ...P, fontWeight: 700 }}>
            {brand.name.toUpperCase()} IS NOT A CREDIT REPORTING AGENCY ("CRA") UNDER
            THE FCRA (15 U.S.C. § 1681 ET SEQ.).
          </p>
          <p style={P}>
            You are strictly prohibited from using our data to evaluate a person's
            suitability for:
          </p>
          <ul style={UL}>
            <li>Employment or household staff hiring;</li>
            <li>Credit, loans, or insurance;</li>
            <li>Education or scholarships;</li>
            <li>Housing or rentals;</li>
            <li>Benefits, privileges or services provided by any business establishment.</li>
          </ul>
          <p style={P}>
            You agree not to take any "adverse action" (as defined by the FCRA) based
            on our information. You warrant that you have sufficient knowledge of the
            FCRA to comply with these restrictions.
          </p>
        </section>

        <section style={SECTION}>
          <h2 style={HEADING}>Website Orders</h2>
          <p style={P}>
            All transactions are subject to Company acceptance. After your order has
            been placed, we will provide you with an email confirming our acceptance
            of your order. We may cancel or refuse orders for any reason, including
            payment errors or suspected fraud. If you do not receive confirmation that
            your order has been placed, please contact our Customer Service Department
            at <strong>{brand.supportPhone}</strong>. Some reasons we may cancel an
            order include, but are not limited to, the following:
          </p>
          <ul style={UL}>
            <li><strong>Billing Errors:</strong> Incorrect credit card data, insufficient funds, or prepaid card usage may result in order rejection.</li>
            <li><strong>Fraud:</strong> We reserve the right to cancel orders linked to previous fraudulent activity or credit card disputes.</li>
          </ul>
          <p style={P}>
            The Company reserves the right to accept an Order if the billing or
            payment information is incorrect, invalid or ineligible as described
            above.
          </p>
        </section>

        <section style={SECTION}>
          <h2 style={HEADING}>Subscription Plans and Billing</h2>
          <h3 style={SUBHEAD}>Standard Plans</h3>
          <ul style={UL}>
            <li>
              <strong>Trial:</strong> A {trialDays}-day trial for {trialPriceStr}. If
              not cancelled, you are billed {recurringPriceStr} monthly until
              termination. If your payment for a full term is declined due to
              insufficient funds, the Company reserves the right to bill in
              installments based on the monthly rates associated with the Membership
              Plan you selected. If you fail to make any scheduled payment for a
              Membership Plan, the Company may, in its sole discretion, terminate your
              membership in the Membership Plan.
              <br /><br />
              You acknowledge and agree that the Company will not obtain additional
              authorization from you for each recurring fee. You also agree that the
              Company will not be liable for overdraft charges or fees which you might
              incur as a result of your Membership Plan.
            </li>
          </ul>
          <h3 style={SUBHEAD}>Non-Standard Plans</h3>
          <p style={P}>
            Promotional rates will be billed at the frequency and price disclosed
            during enrollment.
          </p>
          <h3 style={SUBHEAD}>Authorization</h3>
          <p style={P}>
            By subscribing, you authorize recurring charges to your payment method
            without further notice. You acknowledge this involves a <strong>negative
            option</strong> and you are responsible for future payments unless you
            cancel.
          </p>
          <p style={P}>
            For the most up-to-date pricing and Membership Plan descriptions, please
            go to <strong>{brand.domain}</strong>. We reserve the right to modify the
            prices charged for the Membership Plans, or to add or remove any
            Membership Plans, from the Website at any time without prior notice to
            you. Content on the Site, as well as various services, whether offered
            by {brand.name}, third-party Service Providers or others, may require
            additional fees. Price quotes provided to you prior to any price
            modification shall be honored.
          </p>
        </section>

        <section style={SECTION}>
          <h2 style={HEADING}>Cancellation</h2>
          <p style={P}>
            You may end your membership at any time by calling{' '}
            <strong>{brand.supportPhone}</strong> or via our{' '}
            <Link to="/contact" style={LINK}>Contact Us</Link> page. Any cancellation
            request will result in the cancellation of any upcoming billings
            associated with your Membership Plan. We suggest you make a record of
            your cancellation confirmation number for future reference. If you do not
            receive a cancellation confirmation number, then your account was not
            canceled. All service fees are non-refundable.
          </p>
        </section>

        <section style={SECTION}>
          <h2 style={HEADING}>Payment Logistics</h2>
          <ul style={UL}>
            <li><strong>Taxes:</strong> Orders are subject to state taxes based on residency.</li>
            <li><strong>Discounts and Promotions:</strong> Any applicable discounts or promotional prices will be noted at the time of purchase on the checkout page for your order.</li>
            <li><strong>Billing Errors:</strong> Notify us from our <Link to="/contact" style={LINK}>Contact Us</Link> page immediately if you suspect an error.</li>
            <li><strong>Reversals and Chargebacks:</strong> We treat chargebacks and reversals as potential service theft and may file complaints with federal or local authorities. We monitor IP addresses and activity for this purpose.</li>
            <li><strong>Currency:</strong> All fees are in USD.</li>
          </ul>
        </section>

        <section style={SECTION}>
          <h2 style={HEADING}>Removing Your Information</h2>
          <p style={P}>
            You may request data removal via our{' '}
            <Link to="/opt-out" style={LINK}>Opt-Out Page</Link>.
          </p>
        </section>

        <section style={SECTION}>
          <h2 style={HEADING}>Performance and Disclaimers</h2>
          <p style={P}>
            We use commercially reasonable efforts to provide information "AS IS."
            Data is sourced from third parties and may be inaccurate or incomplete.
            Criminal records may include expunged or sealed data if not yet updated in
            our sources. You understand that you may be restricted from accessing
            certain information and services which may be otherwise available. We
            reserve the right to add materials and features to, and to discontinue
            offering any of the materials and features that are currently a part of
            its Background Information Services. The representations and product
            disclaimers described are inapplicable where prohibited by law, including
            New Jersey.
          </p>
        </section>

        <section style={SECTION}>
          <h2 style={HEADING}>DMCA Compliance</h2>
          <p style={P}>
            We respond to copyright infringement notices according to the Digital
            Millennium Copyright Act. Responses may include removing or disabling
            access to material claimed to be the subject of infringing activity and/or
            terminating subscribers. If we remove or disable access in response to such
            a notice, we will make a good-faith attempt to contact the owner or
            administrator of the affected site or content so that they may make a
            counter notification pursuant to sections 512(g)(2) and (3) of that Act.
            It is our policy to document all notices of alleged infringement on which
            we act. Please send all written communications relating to copyright
            issues to:
          </p>
          <div style={CALLOUT}>
            <div>{brand.name} ATTN: DMCA Complaints</div>
            {MAIL_ADDRESS_LINES.map((line) => (
              <div key={line}>{line}</div>
            ))}
          </div>

          <h3 style={SUBHEAD}>Notification Requirements</h3>
          <p style={P}>
            Your notification must contain substantially all of the following
            components:
          </p>
          <ul style={UL}>
            <li>A physical or electronic signature of an individual authorized to act on behalf of the proprietor of an exclusive right that is allegedly violated.</li>
            <li>Detailed identification specifying the location of the copyrighted work that you believe has been infringed (for example, "The copyrighted work at issue is the text that appears on https://www.website.com/page.html") or other information sufficient to identify the copyrighted creation being infringed. If multiple copyrighted works at a single online platform are encompassed by a single notice, a representative list of those works at that web address.</li>
            <li>Identification of the specific material that is claimed to be infringing or to be the focus of infringing activity, which is to be purged or access to which is to be deactivated, alongside data reasonably sufficient to allow us to find the material.</li>
            <li>Information reasonably sufficient to allow us to contact the complaining party, such as a mailing address, telephone number, and, if available, an electronic mail address where the reporting party may be reached.</li>
            <li>The following statement: "I have a good faith belief that use of the material in the manner complained of is not authorized by the copyright owner, its agent, or the law."</li>
            <li>The following statement: "I swear, under penalty of perjury, that the information in the notification is accurate, and that I am the copyright owner or am authorized to act on behalf of the owner of an exclusive right that is allegedly infringed."</li>
          </ul>

          <h3 style={SUBHEAD}>Counter Notification</h3>
          <p style={P}>
            The administrator of an impacted site or the provider of disputed content
            may submit a counter notification pursuant to sections 512(g)(2) and (3)
            of the Digital Millennium Copyright Act. Upon our receipt of a valid
            counter notification, we may restore the material in question.
          </p>
          <p style={P}>
            To lodge a counter notification with us, you must submit a written
            document (via fax or regular mail — not by email, unless through a prior
            agreement) that provides the details specified below. Please note that you
            will be held liable for damages (including legal costs and attorneys'
            fees) if you materially misrepresent that a product or activity does not
            infringe the copyrights of others. Consequently, if you are uncertain
            whether specific material infringes third-party copyrights, we recommend
            that you first consult an attorney.
          </p>
          <p style={P}>
            To accelerate our ability to process your counter notification, please
            utilize the following format (including section numbers). Your
            communication must contain substantially the following items:
          </p>
          <ul style={UL}>
            <li>A physical or digital signature of the subscriber.</li>
            <li>Clear identification of the material that was removed or to which access was restricted, alongside the location where the material was displayed before it was deleted or disabled.</li>
            <li>A statement under penalty of perjury that you possess a good faith belief that the material was purged or disabled due to a mistake or misidentification of the material.</li>
            <li>Your legal name, physical address, and telephone number.</li>
            <li>The following exact statement: <em>"I consent to the jurisdiction of the Federal District Court for the judicial district in which your address is located, (or New Castle County, Delaware if your address is outside of the United States), and that I will accept service of process from the person who provided notification under subsection (c)(1)(C) or an agent of such person."</em></li>
            <li>The following exact statement: <em>"I swear, under penalty of perjury, that I have a good faith belief that the affected material was removed or disabled as a result of a mistake or misidentification of the material to be removed or disabled."</em></li>
          </ul>

          <h3 style={SUBHEAD}>Account Termination</h3>
          <p style={P}>
            We will, under appropriate conditions, terminate the accounts of repeat
            infringers. If you suspect that an account holder or subscriber is a
            repeat infringer, please follow the steps outlined above to contact our
            designated DMCA agent and supply information sufficient for us to verify
            that the account holder or subscriber fits this description.
          </p>
        </section>

        <section style={SECTION}>
          <h2 style={HEADING}>Electronic Signature</h2>
          <p style={P}>
            Agreeing to this contract digitally constitutes a binding electronic
            signature under the U.S. E-Sign Act. You consent to receive all notices
            and transaction records electronically.
          </p>
        </section>

        <section style={SECTION}>
          <h2 style={HEADING}>General Provisions</h2>
          <ul style={UL}>
            <li><strong>Governing Law:</strong> Interpreted under Delaware law.</li>
            <li><strong>Force Majeure:</strong> We are not liable for delays caused by events beyond our control.</li>
            <li><strong>Assignment:</strong> You may not delegate your rights; {brand.name} may assign its rights without restriction.</li>
            <li><strong>Entire Agreement:</strong> These Terms constitute the total agreement between the parties, superseding all prior versions. If you are using the Services for or on behalf of the U.S. government, your license rights do not exceed those granted to non-government consumers.</li>
            <li><strong>Notices:</strong> We may deliver notice to you by e-mail, posting a notice on the Services or any other method we choose and such notice will be effective on dispatch. If you give notice to us, it will be effective when received and you must use the mailing address listed in the Contact Information section below.</li>
          </ul>
        </section>

        <section style={SECTION} id="contact-information">
          <h2 style={HEADING}>Contact Information</h2>
          <p style={P}>
            For inquiries regarding these notices or to exercise your rights, please
            contact:
          </p>
          <ul style={UL}>
            <li><strong>Web Contact Us page:</strong> <Link to="/contact" style={LINK}>{brand.domain}/contact</Link></li>
            <li><strong>Phone:</strong> {brand.supportPhone}</li>
            <li>
              <strong>Mailing Address:</strong>
              <div style={{ marginTop: '0.25rem' }}>
                {MAIL_ADDRESS_LINES.map((line) => (
                  <div key={line}>{line}</div>
                ))}
              </div>
            </li>
          </ul>
        </section>
      </div>
    </main>
  );
};

export default TermsPage;
