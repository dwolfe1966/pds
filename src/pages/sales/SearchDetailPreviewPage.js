import React, { useEffect, useRef, useState } from 'react';
import { useParams, useNavigate, Link, useSearchParams } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useCampaign } from '../../context/CampaignContext';
import { createReportForIdentity, getExistingReportId } from '../../services/reportService';
import { getIdentityContext } from '../../services/searchContext';
import { useSignup } from '../../hooks/useSignup';
import { track } from '../../services/trackingService';
import { gtmTeaserView } from '../../services/gtm';
import { setSearchTarget as gtmSetSearchTarget } from '../../services/gtmContext';
import SearchDetailPreviewVariantA from './SearchDetailPreviewVariantA';
import SearchDetailPreviewVariantB from './SearchDetailPreviewVariantB';
import SearchDetailPreviewVariantC from './SearchDetailPreviewVariantC';
import SearchDetailPreviewVariantD from './SearchDetailPreviewVariantD';
import SearchDetailPreviewVariantE from './SearchDetailPreviewVariantE';
import SearchDetailPreviewVariantG from './SearchDetailPreviewVariantG';
import SearchDetailPreviewVariantH from './SearchDetailPreviewVariantH';
import SearchDetailPreviewVariantI from './SearchDetailPreviewVariantI';
import SearchDetailPreviewVariantJ from './SearchDetailPreviewVariantJ';
import SearchDetailPreviewVariantK from './SearchDetailPreviewVariantK';
import styles from './SearchDetailPreviewPage.module.css';
import { useBrand } from '../../services/brand';

/**
 * Items included in the paid full report. Kept honest: no fake counts, no
 * masked placeholder rows. If BC doesn't return one of these for a given
 * person, the detail report simply renders that section empty — no false
 * expectations set on the preview.
 */
const FULL_REPORT_ITEMS = [
  { icon: '📞', label: 'Phone numbers' },
  { icon: '✉️', label: 'Email addresses' },
  { icon: '🏠', label: 'Address history' },
  { icon: '👥', label: 'Relatives & associates' },
  { icon: '⚠️', label: 'Criminal & court records (where available)' },
  { icon: '📋', label: 'Other public-record details' },
];

// "Jane Doe" → "JD"; "Cher" → "C"; falls back to '?' for missing/empty names.
function getInitials(fullName) {
  const parts = (fullName || '').trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0][0].toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

/**
 * Preview page when a visitor clicks a search result.
 *
 * Default is a deliberately simple layout: name + age/location + honest list
 * of what the full report includes + signup form. No seeded fake data.
 * Marketing-test variants A–E remain available via `?v=a|b|c|d|e`.
 *
 * IMPORTANT: signup form JSX is inlined directly — do NOT extract it into a
 * component defined inside this render function. A component defined inside
 * render gets a new function reference on every state update, causing React
 * to unmount/remount it and lose input focus after every keystroke.
 */
const SearchDetailPreviewPage = () => {
  const brand = useBrand();
  const { id } = useParams();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const queryV = searchParams.get('v');
  const campaign = useCampaign();
  // Default is the v1 layout, with the campaign config able to override per
  // partner. Explicit `?v=a|b|c|d|e` URL wins over both.
  const MARKETING_VARIANTS = ['a', 'b', 'c', 'd', 'e', 'g', 'h', 'i', 'j', 'k'];
  const campaignVariant = (campaign?.detail?.variant || '').toLowerCase();
  const variant = MARKETING_VARIANTS.includes(queryV)
    ? queryV
    : (MARKETING_VARIANTS.includes(campaignVariant) ? campaignVariant : '1');
  const { token, isPaid } = useAuth();

  const [person, setPerson] = useState(null);
  const [loading, setLoading] = useState(true);
  const [reportCreated, setReportCreated] = useState(false);
  const [reportId, setReportId] = useState(null);

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
          // Refresh the GTM target* fields from the loaded person — covers the
          // case where the user reached the teaser via a direct URL (back/share
          // link) and didn't go through a ResultCard click.
          gtmSetSearchTarget({ ...personData, extId: personData.extId || id });
          track('teaser_view', { personId: id });
          gtmTeaserView({ identity_id: id, search_type: personData?.searchType || undefined });

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
          <p className={styles.loadingTitle}>Searching 247 sources…</p>
          <p className={styles.loadingSub}>Pulling public records, address history, and connections.</p>
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
          <span className={styles.miniHeaderBrand}>🔒 {brand.name}.ai</span>
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

  // ─── Dispatch to standalone variant components ───────────────────────────────

  if (variant === 'a') {
    return <SearchDetailPreviewVariantA person={person} id={id} />;
  }

  if (variant === 'b') {
    return <SearchDetailPreviewVariantB person={person} id={id} />;
  }

  if (variant === 'c') {
    return <SearchDetailPreviewVariantC person={person} id={id} />;
  }

  if (variant === 'd') {
    return <SearchDetailPreviewVariantD person={person} id={id} />;
  }

  if (variant === 'e') {
    return <SearchDetailPreviewVariantE person={person} id={id} />;
  }

  if (variant === 'g') {
    return <SearchDetailPreviewVariantG person={person} id={id} />;
  }

  if (variant === 'h') {
    return <SearchDetailPreviewVariantH person={person} id={id} />;
  }

  if (variant === 'i') {
    return <SearchDetailPreviewVariantI person={person} id={id} />;
  }

  if (variant === 'j') {
    return <SearchDetailPreviewVariantJ person={person} id={id} />;
  }

  if (variant === 'k') {
    return <SearchDetailPreviewVariantK person={person} id={id} />;
  }

  // ─── Inline signup form JSX — inlined here, NOT a sub-component ──────────────
  // Defining this as a component inside render causes React to remount inputs on
  // every keystroke (new function reference = new component type = unmount+mount).

  const signupFormJsx = (
    <div className={styles.signupFormCard} ref={signupFormRef} id="signup-form">
      <div className={styles.signupFormLockIcon} aria-hidden="true">🔓</div>
      <h2 className={styles.signupFormTitle}>Create Your Account to Unlock</h2>
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
            {signupLoading ? 'Creating account…' : 'Create My Account →'}
          </button>
          <p className={styles.loginLinkWrap}>
            Already have an account?{' '}
            <Link to="/login" className={styles.loginLink}>Sign in</Link>
          </p>
        </form>
      )}

      <div className={styles.trustRow}>
        <span>🔒 SSL Encrypted</span>
        <span>🚫 No spam</span>
      </div>
    </div>
  );

  // ─── Render ───────────────────────────────────────────────────────────────────

  return (
    <main className={styles.main} data-no-nav="true">
      <div className={styles.miniHeader}>
        <Link to="/name/search-result" className={styles.miniHeaderBack}>← Back to Results</Link>
        <span className={styles.miniHeaderBrand}>🔒 {brand.name}.ai</span>
      </div>

      {/* ── Hero: just the real fields we actually have ── */}
      <section className={styles.heroSection}>
        <div className={styles.personAvatar} aria-hidden="true">{getInitials(person.fullName)}</div>
        <h1 className={styles.personName}>{person.fullName}</h1>
        {(person.ageRange || person.location) && (
          <p className={styles.personMeta}>
            {person.ageRange ? `Age ${person.ageRange}` : ''}
            {person.ageRange && person.location ? ' • ' : ''}
            {person.location || ''}
          </p>
        )}
      </section>

      {/* ── What's included: honest list, no fake counts or masked rows ── */}
      <section
        style={{
          margin: '0.5rem 1rem 1rem',
          padding: '1.25rem',
          background: '#ffffff',
          border: '1px solid #e5e7eb',
          borderRadius: '0.75rem',
        }}
      >
        <h2 style={{
          margin: '0 0 0.5rem',
          color: '#0d5d2f',
          fontSize: '1.05rem',
          fontWeight: 700,
        }}>
          What's in the full report
        </h2>
        <p style={{ margin: '0 0 1rem', color: '#4b5563', fontSize: '0.9rem', lineHeight: 1.5 }}>
          Sign up and subscribe to unlock the full report for <strong>{person.fullName}</strong>.
          We pull from 12B+ public records and only show what we actually find — no filler.
        </p>
        <ul style={{
          listStyle: 'none', padding: 0, margin: 0,
          display: 'grid', gap: '0.5rem',
        }}>
          {FULL_REPORT_ITEMS.map((item) => (
            <li
              key={item.label}
              style={{
                display: 'flex', alignItems: 'center', gap: '0.625rem',
                padding: '0.6rem 0.75rem',
                background: '#f9fafb',
                border: '1px solid #f3f4f6',
                borderRadius: '0.5rem',
                fontSize: '0.9rem',
                color: '#374151',
              }}
            >
              <span aria-hidden="true" style={{ fontSize: '1rem' }}>{item.icon}</span>
              <span>{item.label}</span>
            </li>
          ))}
        </ul>
      </section>

      {/* ── Confidentiality reassurance — placed immediately above the form so
           it's the last thing the visitor reads before committing. ── */}
      <div className={styles.confidentialityBanner}>
        <span className={styles.confidentialityIcon} aria-hidden="true">🔒</span>
        <span>
          <span className={styles.confidentialityHeadline}>Your search is 100% confidential.</span>
          We never notify the person you searched, and we never share your activity.
        </span>
      </div>

      {/* ── Inline signup form ── */}
      {signupFormJsx}

      {/* ── Trust row ── */}
      <div style={{
        display: 'flex', justifyContent: 'center', gap: '1rem', flexWrap: 'wrap',
        margin: '1.5rem 1rem 0', fontSize: '0.8rem', color: '#6b7280',
      }}>
        <span>🔒 SSL Encrypted</span>
        <span>🚫 No spam</span>
        <span>Cancel anytime</span>
      </div>

      {/* ── Sticky mobile CTA scrolls to inline signup ── */}
      <div className={styles.stickyMobileCta}>
        <a href="#signup-form" className={styles.stickyMobileCtaLink} onClick={scrollToSignup}>
          🔓 Unlock Full Report — Create Account →
        </a>
      </div>
    </main>
  );
};

export default SearchDetailPreviewPage;
