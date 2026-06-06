import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useSignup, validatePassword } from '../../hooks/useSignup';
import styles from './SearchDetailPreviewPage.module.css';
import { useBrand } from '../../services/brand';
import { useCampaign } from '../../context/CampaignContext';
import OptOutNotice from '../../components/OptOutNotice';

/**
 * Variant C — LOW TEASE (Mystery/Curiosity)
 *
 * Minimal data shown: name, age, location only. Maximum intrigue through
 * negative space, a pulsing "report available" signal, and urgency messaging.
 * The less you show, the more they want to see.
 *
 * Aesthetic: Editorial minimalism meets intelligence-agency dossier.
 * Monospace accents, generous whitespace, single dramatic stat counter.
 *
 * Props: person (object), id (string)
 *
 * IMPORTANT: form inputs are inline JSX — NOT sub-components — to prevent
 * React remounting inputs on every re-render.
 */
const SearchDetailPreviewVariantC = ({ person, id }) => {
  const brand = useBrand();
  const campaign = useCampaign();
  const [signupEmail, setSignupEmail] = useState('');
  const [signupPassword, setSignupPassword] = useState('');
  const { submit: submitSignup, loading, error, setError, success } = useSignup();

  // Animated record counter
  const [displayCount, setDisplayCount] = useState(0);
  const totalRecords = 47 + ((person.fullName || '').length * 3);

  useEffect(() => {
    let frame;
    const duration = 1800;
    const start = performance.now();
    const animate = (now) => {
      const elapsed = now - start;
      const progress = Math.min(elapsed / duration, 1);
      // Ease-out cubic
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplayCount(Math.floor(eased * totalRecords));
      if (progress < 1) frame = requestAnimationFrame(animate);
    };
    frame = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(frame);
  }, [totalRecords]);

  const handleSubmit = (e) => {
    e.preventDefault();
    const pwError = validatePassword(signupPassword);
    if (pwError) { setError(pwError); return; }
    submitSignup({ email: signupEmail, password: signupPassword, optin: true, selectedPersonId: id || null });
  };

  const scrollToSignup = (e) => {
    e.preventDefault();
    document.getElementById('vc-signup')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  // Inject keyframes for pulse animation
  const pulseKeyframes = `
    @keyframes vcPulse {
      0%, 100% { transform: scale(1); opacity: 1; }
      50% { transform: scale(1.5); opacity: 0.4; }
    }
    @keyframes vcFadeUp {
      from { opacity: 0; transform: translateY(16px); }
      to { opacity: 1; transform: translateY(0); }
    }
    @keyframes vcCountGlow {
      0%, 100% { text-shadow: 0 0 20px rgba(13,93,47,0.15); }
      50% { text-shadow: 0 0 40px rgba(13,93,47,0.3); }
    }
  `;

  return (
    <main className={styles.main} data-no-nav="true" style={{ background: '#fafaf9' }}>
      <style>{pulseKeyframes}</style>

      {/* Partner opt-out option (campaign.optOut / shN "optout: yes") */}
      {campaign?.optOut && (
        <div style={{ maxWidth: 600, margin: '0.75rem auto 0', padding: '0 1rem' }}>
          <OptOutNotice />
        </div>
      )}

      {/* Mini header */}
      <div className={styles.miniHeader} style={{ background: '#fafaf9', borderBottom: '1px solid #e8e5e0' }}>
        <Link to="/name/search-result" className={styles.miniHeaderBack}>
          <span style={{ fontSize: '0.8rem', letterSpacing: '0.08em', textTransform: 'uppercase', fontFamily: '"DM Mono", "IBM Plex Mono", monospace' }}>
            Back to Results
          </span>
        </Link>
        <span style={{
          fontSize: '0.78rem', fontWeight: 600, color: '#0d5d2f', letterSpacing: '0.12em',
          textTransform: 'uppercase', fontFamily: '"DM Mono", "IBM Plex Mono", monospace',
        }}>
          {brand.name}.ai
        </span>
      </div>

      {/* Hero: dramatic name reveal */}
      <section style={{
        padding: '3rem 1.5rem 2.5rem', textAlign: 'center',
        animation: 'vcFadeUp 0.6s ease-out both',
      }}>
        {/* Pulsing signal dot */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.6rem', marginBottom: '2rem' }}>
          <div style={{
            width: '10px', height: '10px', borderRadius: '50%', background: '#0d5d2f',
            animation: 'vcPulse 2s ease-in-out infinite',
          }} />
          <span style={{
            fontSize: '0.72rem', fontWeight: 600, color: '#0d5d2f', letterSpacing: '0.18em',
            textTransform: 'uppercase', fontFamily: '"DM Mono", "IBM Plex Mono", monospace',
          }}>
            Report Available
          </span>
        </div>

        <h1 style={{
          fontSize: 'clamp(2rem, 7vw, 3.2rem)', fontWeight: 800, color: '#1a1a18',
          margin: '0 0 0.75rem', letterSpacing: '-0.04em', lineHeight: 1.05,
          fontFamily: '"Playfair Display", "Georgia", serif',
        }}>
          {person.fullName}
        </h1>

        {(person.ageRange || person.location) && (
          <p style={{
            fontSize: '0.95rem', color: '#78756e', margin: '0 0 2.5rem',
            fontFamily: '"DM Mono", "IBM Plex Mono", monospace', letterSpacing: '0.02em',
          }}>
            {person.ageRange ? `Age ${person.ageRange}` : ''}
            {person.ageRange && person.location ? ' \u00B7 ' : ''}
            {person.location || ''}
          </p>
        )}

        {/* Dramatic counter */}
        <div style={{
          padding: '2.5rem 1.5rem',
          background: '#ffffff',
          border: '1px solid #e8e5e0',
          borderRadius: '1rem',
          maxWidth: '320px',
          margin: '0 auto',
          animation: 'vcFadeUp 0.8s ease-out 0.2s both',
        }}>
          <div style={{
            fontSize: 'clamp(3rem, 10vw, 4.5rem)', fontWeight: 800, color: '#0d5d2f',
            lineHeight: 1, marginBottom: '0.5rem',
            fontFamily: '"Playfair Display", "Georgia", serif',
            letterSpacing: '-0.03em',
            animation: 'vcCountGlow 3s ease-in-out infinite',
          }}>
            {displayCount}
          </div>
          <div style={{
            fontSize: '0.7rem', color: '#a09d96', letterSpacing: '0.2em',
            textTransform: 'uppercase', fontWeight: 600,
            fontFamily: '"DM Mono", "IBM Plex Mono", monospace',
          }}>
            Records Found
          </div>
        </div>
      </section>

      {/* Social proof strip */}
      <div style={{
        display: 'flex', justifyContent: 'center', gap: '1.5rem',
        padding: '1rem 1.25rem',
        borderTop: '1px solid #e8e5e0', borderBottom: '1px solid #e8e5e0',
        background: '#ffffff',
        animation: 'vcFadeUp 0.8s ease-out 0.4s both',
      }}>
        {[
          { val: '12B+', label: 'Records' },
          { val: '500M+', label: 'Searches' },
          { val: '50', label: 'States' },
        ].map(({ val, label }) => (
          <div key={label} style={{ textAlign: 'center' }}>
            <div style={{
              fontSize: '1.1rem', fontWeight: 800, color: '#1a1a18',
              fontFamily: '"Playfair Display", "Georgia", serif',
            }}>{val}</div>
            <div style={{
              fontSize: '0.62rem', color: '#a09d96', textTransform: 'uppercase',
              letterSpacing: '0.15em', fontWeight: 600,
              fontFamily: '"DM Mono", "IBM Plex Mono", monospace',
            }}>{label}</div>
          </div>
        ))}
      </div>

      {/* Urgency card */}
      <div style={{
        margin: '1.5rem 1rem', padding: '1.5rem',
        background: '#ffffff', border: '1px solid #e8e5e0', borderRadius: '0.875rem',
        textAlign: 'center',
        animation: 'vcFadeUp 0.8s ease-out 0.6s both',
      }}>
        <div style={{
          fontSize: '0.68rem', color: '#b45309', letterSpacing: '0.15em',
          textTransform: 'uppercase', fontWeight: 700, marginBottom: '0.75rem',
          fontFamily: '"DM Mono", "IBM Plex Mono", monospace',
        }}>
          Time-Sensitive
        </div>
        <p style={{
          fontSize: '1.05rem', color: '#1a1a18', margin: '0 0 0.5rem',
          fontWeight: 600, lineHeight: 1.5,
        }}>
          This report may be removed from public access.
        </p>
        <p style={{ fontSize: '0.85rem', color: '#78756e', margin: '0 0 1.25rem', lineHeight: 1.6 }}>
          Create an account to secure your copy of {person.fullName}&rsquo;s background report.
        </p>
        <button
          type="button"
          onClick={scrollToSignup}
          style={{
            display: 'inline-block', padding: '0.85rem 2.5rem',
            background: '#0d5d2f', color: '#ffffff', border: 'none',
            borderRadius: '0.5rem', fontSize: '0.88rem', fontWeight: 700,
            cursor: 'pointer', letterSpacing: '0.04em',
            transition: 'all 0.2s ease',
            boxShadow: '0 2px 12px rgba(13,93,47,0.2)',
          }}
        >
          Secure This Report
        </button>
      </div>

      {/* What's included — minimal list */}
      <div style={{
        margin: '0 1rem 1.5rem', padding: '1.5rem',
        background: '#ffffff', border: '1px solid #e8e5e0', borderRadius: '0.875rem',
        animation: 'vcFadeUp 0.8s ease-out 0.8s both',
      }}>
        <div style={{
          fontSize: '0.68rem', color: '#a09d96', letterSpacing: '0.18em',
          textTransform: 'uppercase', fontWeight: 700, marginBottom: '1rem',
          fontFamily: '"DM Mono", "IBM Plex Mono", monospace',
        }}>
          Report Contents
        </div>
        {[
          'Contact Information',
          'Address History',
          'Relatives & Associates',
          'Criminal & Court Records',
          'Employment History',
          'Education Records',
          'Social Media Profiles',
          'Property & Assets',
        ].map((item, i) => (
          <div key={i} style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '0.65rem 0',
            borderBottom: i < 7 ? '1px solid #f3f2ef' : 'none',
            fontSize: '0.9rem', color: '#1a1a18',
          }}>
            <span>{item}</span>
            <span style={{
              fontSize: '0.68rem', color: '#b45309', fontWeight: 600,
              background: '#fef3c7', borderRadius: '999px', padding: '0.15rem 0.6rem',
              fontFamily: '"DM Mono", "IBM Plex Mono", monospace',
            }}>
              Locked
            </span>
          </div>
        ))}
      </div>

      {/* Signup form */}
      <div
        id="vc-signup"
        style={{
          margin: '0 1rem 1.5rem', padding: '2rem 1.5rem',
          background: '#0d5d2f', borderRadius: '0.875rem',
          boxShadow: '0 4px 24px rgba(13,93,47,0.25)',
          scrollMarginTop: '4rem',
          animation: 'vcFadeUp 0.8s ease-out 1s both',
        }}
      >
        <div style={{
          fontSize: '0.68rem', color: 'rgba(255,255,255,0.5)', letterSpacing: '0.18em',
          textTransform: 'uppercase', fontWeight: 600, textAlign: 'center', marginBottom: '0.75rem',
          fontFamily: '"DM Mono", "IBM Plex Mono", monospace',
        }}>
          Account Required
        </div>
        <h2 style={{
          fontSize: '1.5rem', fontWeight: 700, color: '#ffffff', margin: '0 0 0.4rem',
          textAlign: 'center', fontFamily: '"Playfair Display", "Georgia", serif',
          letterSpacing: '-0.02em',
        }}>
          Access This Report
        </h2>
        <p style={{
          fontSize: '0.85rem', color: 'rgba(255,255,255,0.7)', textAlign: 'center',
          margin: '0 0 1.5rem', lineHeight: 1.5,
        }}>
          Create your account to view all {displayCount} records.
        </p>

        {success ? (
          <div className={styles.signupSuccessMsg}>
            Account created. Redirecting to your report&hellip;
          </div>
        ) : (
          <form onSubmit={handleSubmit} noValidate>
            <div className={styles.formGroup}>
              <label className={styles.signupFormLabel} htmlFor="vc-email">Email</label>
              <input
                id="vc-email"
                type="email"
                name="email"
                value={signupEmail}
                onChange={e => setSignupEmail(e.target.value)}
                className={styles.signupFormInput}
                placeholder="you@email.com"
                required
                autoComplete="email"
              />
            </div>
            <div className={styles.formGroup}>
              <label className={styles.signupFormLabel} htmlFor="vc-password">Password</label>
              <input
                id="vc-password"
                type="password"
                name="password"
                value={signupPassword}
                onChange={e => setSignupPassword(e.target.value)}
                className={styles.signupFormInput}
                placeholder="Uppercase, lowercase, number & special char"
                required
                minLength={8}
                autoComplete="new-password"
              />
            </div>

            {error && (
              <div className={styles.formError}>
                {error === 'already_exists' ? (
                  <>Account exists. <Link to="/login" className={styles.loginLink}>Sign in</Link></>
                ) : error}
              </div>
            )}

            <button
              type="submit"
              className={styles.signupSubmitBtn}
              disabled={loading}
            >
              {loading ? 'Creating account\u2026' : 'Create Account'}
            </button>
            <p className={styles.loginLinkWrap}>
              Have an account?{' '}
              <Link to="/login" className={styles.loginLink}>Sign in</Link>
            </p>
          </form>
        )}

        <div className={styles.trustRow}>
          <span>256-bit SSL</span>
          <span>No spam</span>
        </div>
      </div>

      {/* Sticky mobile CTA */}
      <div className={styles.stickyMobileCta}>
        <a
          href="#vc-signup"
          className={styles.stickyMobileCtaLink}
          onClick={scrollToSignup}
        >
          Secure This Report &mdash; Create Account
        </a>
      </div>
    </main>
  );
};

export default SearchDetailPreviewVariantC;
