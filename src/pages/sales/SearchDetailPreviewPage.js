import React, { useEffect, useRef, useState } from 'react';
import { useParams, useNavigate, Link, useSearchParams } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { createReportForIdentity, getExistingReportId } from '../../services/reportService';
import { getIdentityContext } from '../../services/searchContext';
import { useSignup } from '../../hooks/useSignup';
import { track } from '../../services/trackingService';
import styles from './SearchDetailPreviewPage.module.css';

/** Service benefit statements for variant 2 */
const BENEFIT_STATEMENTS = [
  'Instant access to full contact information',
  '12B+ public records searched',
  'Address history and current location',
  'Relatives and family connections',
  'Secure, FCRA-compliant reports',
  'One-time purchase or subscription options',
];

function simpleHash(str) {
  let h = 0;
  for (let i = 0; i < (str || '').length; i++) {
    h = (Math.imul(31, h) + str.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
}

function seededCount(id, salt, min, max) {
  const h = simpleHash((id || 'x') + salt);
  return min + (h % (max - min + 1));
}

/**
 * Preview page when a visitor clicks a search result.
 * Three variants: v1 (new high-conversion teaser layout), v2 (+ benefits rectangle), v3 (teaser + CTA only, no inline form).
 *
 * IMPORTANT: SignupFormCard JSX is inlined directly — do NOT extract it into a
 * component defined inside this render function. A component defined inside render
 * gets a new function reference on every state update, causing React to unmount/remount
 * it and lose input focus after every keystroke.
 */
const SearchDetailPreviewPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const queryV = searchParams.get('v');
  const [randomVariant] = useState(() => String(Math.floor(Math.random() * 3) + 1));
  const variant = (queryV === '1' || queryV === '2' || queryV === '3') ? queryV : randomVariant;
  const { token, isPaid } = useAuth();

  const [person, setPerson] = useState(null);
  const [loading, setLoading] = useState(true);
  const [reportCreated, setReportCreated] = useState(false);
  const [reportId, setReportId] = useState(null);

  const [viewerCount] = useState(() => Math.floor(Math.random() * 8) + 3);

  // Embedded signup form state
  const [signupEmail, setSignupEmail] = useState('');
  const [signupPassword, setSignupPassword] = useState('');
  const { submit: submitSignup, loading: signupLoading, error: signupError, setError: setSignupError, success: signupSuccess } = useSignup();

  const signupFormRef = useRef(null);

  useEffect(() => {
    const loadPersonAndCreateReport = async () => {
      const storedPerson = sessionStorage.getItem(`result_${id}`);
      if (storedPerson) {
        try {
          const personData = JSON.parse(storedPerson);
          setPerson(personData);
          track('teaser_view', { personId: id });

          // Only create report if user has an active paid subscription (BC session exists).
          // Attempting this after signup-but-before-payment returns 403 Forbidden from BC.
          if (isPaid && personData.extId) {
            try {
              const existingReportId = getExistingReportId(personData.extId);
              if (existingReportId) {
                setReportId(existingReportId);
                setReportCreated(true);
              } else {
                // eslint-disable-next-line no-unused-vars
                const identityContext = getIdentityContext();
                const result = await createReportForIdentity(personData.extId, personData);
                if (result.success && result.commerceContentId) {
                  setReportId(result.commerceContentId);
                  setReportCreated(true);
                }
              }
            } catch (error) {
              console.error('Failed to create report:', error);
            }
          }
        } catch (err) {
          console.error('Error parsing stored person:', err);
        }
      }
      setLoading(false);
    };

    loadPersonAndCreateReport();
  }, [id, isPaid]); // isPaid (not just token) — BC session only exists after payment

  const handleSignupNav = () => {
    const params = new URLSearchParams({
      selected: id,
      personName: person?.fullName || '',
      personLocation: person?.location || '',
      personAge: person?.ageRange || '',
    });
    navigate(`/name/signup?${params.toString()}`);
  };

  const handleViewFullReport = () => {
    if (reportCreated && reportId && token) {
      navigate(`/people/${reportId}`);
    } else {
      handleSignupNav();
    }
  };

  /**
   * Embedded signup handler — email + password only.
   * Delegates to useSignup hook which handles auth state, sessionStorage (_pendingPw,
   * _signupOptin, selectedPersonId), safe navigation, and timeout cleanup on unmount.
   * Does NOT call billingSignup — billing.sale creates the BC user atomically.
   */
  const handleEmbeddedSignup = (e) => {
    e.preventDefault();
    submitSignup({
      email: signupEmail,
      password: signupPassword,
      optin: true,
      selectedPersonId: id || null,
    });
  };

  const scrollToSignup = (e) => {
    e.preventDefault();
    if (signupFormRef.current) {
      signupFormRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  // ─── Loading & not-found guards ──────────────────────────────────────────────

  if (loading) {
    return (
      <main className={styles.main} data-no-nav="true">
        <div className={styles.loadingWrap}>
          <div className={styles.loadingSpinner} aria-hidden="true" />
          <p>Loading report preview…</p>
        </div>
      </main>
    );
  }

  if (!person) {
    return (
      <main className={styles.main} data-no-nav="true">
        <div className={styles.notFoundWrap}>
          <p>Person not found. Please try searching again.</p>
          <Link to="/name/search-result" className={styles.notFoundLink}>Back to Search</Link>
        </div>
      </main>
    );
  }

  // ─── Logged-in user with report ready ────────────────────────────────────────

  if (reportCreated && token) {
    return (
      <main className={styles.main} data-no-nav="true">
        <div className={styles.miniHeader}>
          <Link to="/name/search-result" className={styles.miniHeaderBack}>← Back to Results</Link>
          <span className={styles.miniHeaderBrand}>🔒 IDLookup.ai</span>
        </div>
        <h1 className={styles.pageTitle}>{person.fullName}</h1>
        <section className={styles.section}>
          <div className={styles.ctaCard}>
            <h3 className={styles.ctaTitle}>Your report is ready</h3>
            <p className={styles.ctaText}>
              View the full report for <strong>{person.fullName}</strong>.
            </p>
            <button type="button" className={styles.btnWhite} onClick={handleViewFullReport}>
              View Full Report
            </button>
          </div>
        </section>
      </main>
    );
  }

  // ─── Visitor: compute per-person seeded counts ───────────────────────────────

  const pid = String(person.id || id || 'x');
  const phoneCount    = seededCount(pid, 'phone',   2, 4);
  const emailCount    = seededCount(pid, 'email',   1, 3);
  const addressCount  = seededCount(pid, 'address', 3, 7);
  const relativeCount = seededCount(pid, 'rel',     3, 8);

  const showBenefits   = variant === '2';
  const showSignupForm = variant === '1' || variant === '2';

  const phonePlaceholders = Array.from({ length: phoneCount }, (_, i) =>
    i === 0 ? '(***) ***-1234' : i === 1 ? '(***) ***-5678' : '(***) ***-9012'
  );
  const emailPlaceholders = Array.from({ length: emailCount }, (_, i) =>
    i === 0 ? 'j***@gmail.com' : 'j***@yahoo.com'
  );
  const addressPlaceholders = Array.from({ length: Math.min(addressCount, 4) }, (_, i) => {
    const streets = ['*** Oak St, Los Angeles, CA', '**** Maple Ave, Phoenix, AZ', '** Pine Rd, Houston, TX', '**** Elm Dr, Chicago, IL'];
    return streets[i] || '*** Main St, ****, **';
  });
  const relativePlaceholders = Array.from({ length: Math.min(relativeCount, 5) }, (_, i) => {
    const names = ['J*** S****', 'M*** S****', 'R*** S****', 'T*** S****', 'A*** S****'];
    return names[i] || '****  ****';
  });

  // ─── Inline signup form JSX — inlined here, NOT a sub-component ──────────────
  // Defining this as a component inside render causes React to remount inputs on
  // every keystroke (new function reference = new component type = unmount+mount).

  const signupFormJsx = (
    <div className={styles.signupFormCard} ref={signupFormRef} id="signup-form">
      <div className={styles.signupFormLockIcon} aria-hidden="true">🔓</div>
      <h2 className={styles.signupFormTitle}>Create Your Free Account to Unlock</h2>
      <p className={styles.signupFormSubtitle}>
        Unlock the full report for <strong>{person.fullName}</strong> instantly.
      </p>

      {signupSuccess ? (
        <div className={styles.signupSuccessMsg}>
          ✅ Account created! Redirecting to your report…
        </div>
      ) : (
        <form onSubmit={handleEmbeddedSignup} noValidate>
          <div className={styles.formGroup}>
            <label className={styles.signupFormLabel} htmlFor="preview-email">Email address</label>
            <input
              id="preview-email"
              type="email"
              name="email"
              value={signupEmail}
              onChange={(e) => setSignupEmail(e.target.value)}
              className={styles.signupFormInput}
              placeholder="you@email.com"
              required
              autoComplete="email"
            />
          </div>
          <div className={styles.formGroup}>
            <label className={styles.signupFormLabel} htmlFor="preview-password">Create a password</label>
            <input
              id="preview-password"
              type="password"
              name="password"
              value={signupPassword}
              onChange={(e) => setSignupPassword(e.target.value)}
              className={styles.signupFormInput}
              placeholder="Min. 8 characters"
              required
              minLength={8}
              autoComplete="new-password"
            />
          </div>
          {signupError && (
            <div className={styles.formError}>
              {signupError === 'already_exists' ? (
                <>An account with this email already exists. <Link to="/login" className={styles.loginLink}>Log in instead</Link></>
              ) : signupError}
            </div>
          )}
          <button
            type="submit"
            className={styles.signupSubmitBtn}
            disabled={signupLoading}
          >
            {signupLoading ? 'Creating account…' : 'Create My Free Account →'}
          </button>
          <p className={styles.noCardNote}>No credit card required</p>
          <p className={styles.loginLinkWrap}>
            Already have an account?{' '}
            <Link to="/login" className={styles.loginLink}>Sign in</Link>
          </p>
        </form>
      )}

      <div className={styles.trustRow}>
        <span>🔒 SSL Encrypted</span>
        <span>✓ FCRA Compliant</span>
        <span>🚫 No spam</span>
      </div>
    </div>
  );

  // ─── Render ───────────────────────────────────────────────────────────────────

  return (
    <main className={styles.main} data-no-nav="true">
      <div className={styles.miniHeader}>
        <Link to="/name/search-result" className={styles.miniHeaderBack}>← Back to Results</Link>
        <span className={styles.miniHeaderBrand}>🔒 IDLookup.ai</span>
      </div>

      {/* ── ABOVE THE FOLD ── */}
      <section className={styles.heroSection}>
        <div className={styles.urgencyBadge}>
          🔥 This report was just viewed by {viewerCount} other people
        </div>

        <h1 className={styles.personName}>{person.fullName}</h1>
        <p className={styles.recentlyViewed}>This profile has been viewed recently</p>
        {(person.ageRange || person.location) && (
          <p className={styles.personMeta}>
            {person.ageRange ? `Age ${person.ageRange}` : ''}
            {person.ageRange && person.location ? ' • ' : ''}
            {person.location || ''}
          </p>
        )}

        <div className={styles.unlockedRow}>
          <span className={styles.unlockedCheck}>✓</span>
          📍 {person.location || 'Location available'}
        </div>

        <div className={styles.progressStrip}>
          <div className={`${styles.progressRow} ${styles.progressUnlocked}`}>
            <span className={styles.progressIcon}>✅</span>
            <span>Name: <strong>{person.fullName}</strong></span>
          </div>
          <div className={`${styles.progressRow} ${styles.progressLocked}`}>
            <span className={styles.progressIcon}>🔒</span>
            <span>Phone Numbers <span className={styles.progressCount}>({phoneCount} found)</span></span>
          </div>
          <div className={`${styles.progressRow} ${styles.progressLocked}`}>
            <span className={styles.progressIcon}>🔒</span>
            <span>Email Addresses <span className={styles.progressCount}>({emailCount} found)</span></span>
          </div>
          <div className={`${styles.progressRow} ${styles.progressLocked}`}>
            <span className={styles.progressIcon}>🔒</span>
            <span>Current &amp; Past Addresses <span className={styles.progressCount}>({addressCount} found)</span></span>
          </div>
          <div className={`${styles.progressRow} ${styles.progressLocked}`}>
            <span className={styles.progressIcon}>🔒</span>
            <span>Criminal &amp; Arrest Records</span>
          </div>
          <div className={`${styles.progressRow} ${styles.progressLocked}`}>
            <span className={styles.progressIcon}>🔒</span>
            <span>Relatives &amp; Associates <span className={styles.progressCount}>({relativeCount} found)</span></span>
          </div>
        </div>
      </section>

      {/* ── LOCKED SECTION 1: Phone Numbers ── */}
      <section className={styles.lockedSection}>
        <div className={styles.lockedSectionHeader}>
          <span className={styles.lockedSectionTitle}>📞 Phone Numbers</span>
          <span className={styles.lockedBadge}>🔒 Locked</span>
        </div>
        <div className={styles.lockedSectionBody}>
          {phonePlaceholders.map((ph, i) => (
            <div key={i} className={styles.blurredRow}>{ph}</div>
          ))}
          <div className={styles.gradientOverlay} aria-hidden="true" />
        </div>
        <div className={styles.lockedSectionFooter}>
          <button
            type="button"
            className={styles.unlockBtn}
            onClick={showSignupForm ? scrollToSignup : handleSignupNav}
          >
            🔓 Unlock Phone Numbers
          </button>
        </div>
      </section>

      {/* ── INLINE SIGNUP FORM — inlined JSX, not a sub-component ── */}
      {showSignupForm && signupFormJsx}

      {/* ── LOCKED SECTION 2: Email Addresses ── */}
      <section className={styles.lockedSection}>
        <div className={styles.lockedSectionHeader}>
          <span className={styles.lockedSectionTitle}>✉️ Email Addresses</span>
          <span className={styles.lockedBadge}>🔒 Locked</span>
        </div>
        <div className={styles.lockedSectionBody}>
          {emailPlaceholders.map((ph, i) => (
            <div key={i} className={styles.blurredRow}>{ph}</div>
          ))}
          <div className={styles.gradientOverlay} aria-hidden="true" />
        </div>
        <div className={styles.lockedSectionFooter}>
          <button type="button" className={styles.unlockBtn} onClick={showSignupForm ? scrollToSignup : handleSignupNav}>
            🔓 Unlock Email Addresses
          </button>
        </div>
      </section>

      {/* ── MID-PAGE CTA ── */}
      <div className={styles.midPageCta}>
        <h3 className={styles.midPageCtaHeadline}>Unlock {person.fullName}&rsquo;s Full Report</h3>
        <p className={styles.midPageCtaSub}>Create your free account to see all records instantly</p>
        <button
          type="button"
          className={styles.midPageCtaBtn}
          onClick={showSignupForm ? scrollToSignup : handleSignupNav}
        >
          Create Free Account &rarr;
        </button>
      </div>

      {/* ── LOCKED SECTION 3: Address History ── */}
      <section className={styles.lockedSection}>
        <div className={styles.lockedSectionHeader}>
          <span className={styles.lockedSectionTitle}>🏠 Address History</span>
          <span className={styles.lockedBadge}>🔒 Locked</span>
        </div>
        <div className={styles.lockedSectionBody}>
          {addressPlaceholders.map((ph, i) => (
            <div key={i} className={styles.blurredRow}>{ph}</div>
          ))}
          <div className={styles.gradientOverlay} aria-hidden="true" />
        </div>
        <div className={styles.lockedSectionFooter}>
          <button type="button" className={styles.unlockBtn} onClick={showSignupForm ? scrollToSignup : handleSignupNav}>
            🔓 Unlock Address History
          </button>
        </div>
      </section>

      {/* ── LOCKED SECTION 4: Criminal Records ── */}
      <section className={styles.lockedSection}>
        <div className={styles.lockedSectionHeader}>
          <span className={styles.lockedSectionTitle}>⚠️ Criminal &amp; Arrest Records</span>
          <span className={styles.lockedBadge}>🔒 Locked</span>
        </div>
        <div className={styles.lockedSectionBody}>
          <div className={styles.blurredRow}>**** County — Misdemeanor — 20**</div>
          <div className={styles.blurredRow}>**** District Court — Case #****</div>
          <div className={styles.gradientOverlay} aria-hidden="true" />
        </div>
        <div className={styles.lockedSectionFooter}>
          <button type="button" className={styles.unlockBtn} onClick={showSignupForm ? scrollToSignup : handleSignupNav}>
            🔓 Unlock Criminal Records
          </button>
        </div>
      </section>

      {/* ── LOCKED SECTION 5: Relatives & Associates ── */}
      <section className={styles.lockedSection}>
        <div className={styles.lockedSectionHeader}>
          <span className={styles.lockedSectionTitle}>👥 Relatives &amp; Associates</span>
          <span className={styles.lockedBadge}>🔒 Locked</span>
        </div>
        <div className={styles.lockedSectionBody}>
          {relativePlaceholders.map((ph, i) => (
            <div key={i} className={styles.blurredRow}>{ph}</div>
          ))}
          <div className={styles.gradientOverlay} aria-hidden="true" />
        </div>
        <div className={styles.lockedSectionFooter}>
          <button type="button" className={styles.unlockBtn} onClick={showSignupForm ? scrollToSignup : handleSignupNav}>
            🔓 Unlock Relatives &amp; Associates
          </button>
        </div>
      </section>

      {/* ── BENEFITS RECTANGLE (v2 only) ── */}
      {showBenefits && (
        <section className={styles.section}>
          <div className={styles.benefitsCard}>
            <h3 className={styles.benefitsTitle}>Why use IDLookup.ai?</h3>
            <ul className={styles.benefitsList}>
              {BENEFIT_STATEMENTS.map((text, i) => (
                <li key={i}>{text}</li>
              ))}
            </ul>
          </div>
        </section>
      )}

      {/* ── CTA ONLY (v3) ── */}
      {variant === '3' && (
        <section className={styles.section}>
          <div className={styles.ctaCard}>
            <h3 className={styles.ctaTitle}>Unlock the Full Report</h3>
            <p className={styles.ctaText}>
              Sign up or log in to view all records for <strong>{person.fullName}</strong>.
            </p>
            <div className={styles.ctaButtons}>
              <button type="button" className={styles.btnWhite} onClick={handleSignupNav}>
                Create Free Account →
              </button>
              <Link to="/login" className={styles.btnOutline}>
                Already have an account? Sign in
              </Link>
            </div>
          </div>
        </section>
      )}

      {/* ── STICKY MOBILE CTA BAR ── */}
      <div className={styles.stickyMobileCta}>
        {showSignupForm ? (
          <a href="#signup-form" className={styles.stickyMobileCtaLink} onClick={scrollToSignup}>
            🔓 Unlock Full Report — Create Free Account →
          </a>
        ) : (
          <button
            type="button"
            className={styles.stickyMobileCtaLink}
            onClick={handleSignupNav}
          >
            🔓 Unlock Full Report — Create Free Account →
          </button>
        )}
      </div>
    </main>
  );
};

export default SearchDetailPreviewPage;
