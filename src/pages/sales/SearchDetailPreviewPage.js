import React, { useEffect, useState } from 'react';
import { useParams, useNavigate, Link, useSearchParams } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { createReportForIdentity, getExistingReportId } from '../../services/reportService';
import { getIdentityContext } from '../../services/searchContext';
import api from '../../api';
import ProfileVCard from '../../components/ProfileVCard';
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

/**
 * Preview page when a visitor clicks a search result.
 * Three variants: v1 (V-card + signup form), v2 (+ benefits rectangle), v3 (V-card + CTA only).
 * If ?v=1|2|3 is set, that variant is used; otherwise a random variant is chosen on each page load.
 */
const SearchDetailPreviewPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const queryV = searchParams.get('v');
  const [randomVariant] = useState(() => String(Math.floor(Math.random() * 3) + 1));
  const variant = (queryV === '1' || queryV === '2' || queryV === '3') ? queryV : randomVariant;
  const { token, setToken, setUser } = useAuth();

  const [person, setPerson] = useState(null);
  const [loading, setLoading] = useState(true);
  const [reportCreated, setReportCreated] = useState(false);
  const [reportId, setReportId] = useState(null);

  // Embedded signup form (v1, v2) – multi-step: 1 = email/password, 2 = name, 3 = zip
  const [signupStep, setSignupStep] = useState(1);
  const [form, setForm] = useState({ fullName: '', zip: '', email: '', password: '' });
  const [signupLoading, setSignupLoading] = useState(false);
  const [signupError, setSignupError] = useState('');

  useEffect(() => {
    const loadPersonAndCreateReport = async () => {
      const storedPerson = sessionStorage.getItem(`result_${id}`);
      if (storedPerson) {
        try {
          const personData = JSON.parse(storedPerson);
          setPerson(personData);

          if (token && personData.extId) {
            try {
              const existingReportId = getExistingReportId(personData.extId);
              if (existingReportId) {
                setReportId(existingReportId);
                setReportCreated(true);
              } else {
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
  }, [id, token]);

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

  const handleEmbeddedSignup = async (e) => {
    e.preventDefault();
    setSignupError('');
    setSignupLoading(true);
    try {
      const response = await api.signup(form);
      if (response.accessToken) {
        setToken(response.accessToken);
        setUser(response.user || {
          email: form.email,
          fullName: form.fullName,
          role: 'member',
          emailVerified: response.user?.emailVerified ?? false,
        });
      }
      if (id) sessionStorage.setItem('selectedPersonId', id);
      setTimeout(() => navigate('/payment'), 1500);
    } catch (err) {
      setSignupError(err.message || 'Signup failed. Please try again.');
    } finally {
      setSignupLoading(false);
    }
  };

  const handleSignupStepNext = (e) => {
    e.preventDefault();
    setSignupError('');
    if (signupStep === 1) {
      if (!form.email?.trim()) {
        setSignupError('Please enter your email.');
        return;
      }
      if (!form.password?.trim()) {
        setSignupError('Please enter a password.');
        return;
      }
      setSignupStep(2);
    } else if (signupStep === 2) {
      if (!form.fullName?.trim()) {
        setSignupError('Please enter your full name.');
        return;
      }
      setSignupStep(3);
    }
  };

  const handleSignupStepBack = () => {
    setSignupError('');
    setSignupStep((s) => Math.max(1, s - 1));
  };

  if (loading) {
    return (
      <main className={styles.main}>
        <div className={styles.loadingWrap}>
          <p>Loading...</p>
        </div>
      </main>
    );
  }

  if (!person) {
    return (
      <main className={styles.main}>
        <div className={styles.notFoundWrap}>
          <p>Person not found. Please try searching again.</p>
          <Link to="/name/search-result" className={styles.notFoundLink}>Back to Search</Link>
        </div>
      </main>
    );
  }

  // Logged-in user with report: show single CTA to view full report
  if (reportCreated && token) {
    return (
      <main className={styles.main}>
        <Link to="/name/search-result" className={styles.backLink}>← Back to Results</Link>
        <h1 className={styles.pageTitle}>{person.fullName}</h1>
        <section className={styles.section}>
          <ProfileVCard person={person} />
        </section>
        <div className={styles.ctaCard}>
          <h3 className={styles.ctaTitle}>Your report is ready</h3>
          <p className={styles.ctaText}>
            View the full report for <strong>{person.fullName}</strong>.
          </p>
          <button type="button" className={styles.btnWhite} onClick={handleViewFullReport}>
            View Full Report
          </button>
        </div>
      </main>
    );
  }

  // Visitor: render by variant
  const showBenefits = variant === '2';
  const showSignupForm = variant === '1' || variant === '2';
  const showCtaOnly = variant === '3';

  return (
    <main className={styles.main}>
      <Link to="/name/search-result" className={styles.backLink}>← Back to Results</Link>
      <h1 className={styles.pageTitle}>{person.fullName}</h1>

      {/* 1) V-card (all variants) */}
      <section className={styles.section}>
        <ProfileVCard person={person} />
      </section>

      {/* 2) Embedded signup form – multi-step (v1, v2) */}
      {showSignupForm && (
        <section className={styles.section}>
          <div className={styles.signupCard}>
            <h3 className={styles.signupTitle}>Unlock full report</h3>
            <p className={styles.signupSubtitle}>
              Create an account to view the complete report for {person.fullName}.
            </p>
            <p className={styles.stepIndicator}>Step {signupStep} of 3</p>
            <form
              onSubmit={signupStep === 3 ? handleEmbeddedSignup : handleSignupStepNext}
            >
              {/* Step 1: email and password */}
              {signupStep === 1 && (
                <>
                  <div className={styles.formGroup}>
                    <label className={styles.formLabel} htmlFor="preview-email">Email *</label>
                    <input
                      id="preview-email"
                      type="email"
                      name="email"
                      value={form.email}
                      onChange={(e) => setForm({ ...form, [e.target.name]: e.target.value })}
                      className={styles.formInput}
                      required
                      autoComplete="email"
                    />
                  </div>
                  <div className={styles.formGroup}>
                    <label className={styles.formLabel} htmlFor="preview-password">Password *</label>
                    <input
                      id="preview-password"
                      type="password"
                      name="password"
                      value={form.password}
                      onChange={(e) => setForm({ ...form, [e.target.name]: e.target.value })}
                      className={styles.formInput}
                      required
                      autoComplete="new-password"
                    />
                  </div>
                </>
              )}
              {/* Step 2: full name (pre-populated from prior step) */}
              {signupStep === 2 && (
                <div className={styles.formGroup}>
                  <label className={styles.formLabel} htmlFor="preview-fullName">Full Name *</label>
                  <input
                    id="preview-fullName"
                    type="text"
                    name="fullName"
                    value={form.fullName}
                    onChange={(e) => setForm({ ...form, [e.target.name]: e.target.value })}
                    className={styles.formInput}
                    required
                    autoComplete="name"
                  />
                </div>
              )}
              {/* Step 3: zip (pre-populated from prior steps) */}
              {signupStep === 3 && (
                <div className={styles.formGroup}>
                  <label className={styles.formLabel} htmlFor="preview-zip">ZIP Code</label>
                  <input
                    id="preview-zip"
                    type="text"
                    name="zip"
                    value={form.zip}
                    onChange={(e) => setForm({ ...form, [e.target.name]: e.target.value })}
                    className={styles.formInput}
                    autoComplete="postal-code"
                  />
                </div>
              )}
              {signupError && <div className={styles.formError}>{signupError}</div>}
              <div className={styles.formActions}>
                {signupStep > 1 ? (
                  <button
                    type="button"
                    className={styles.btnSecondary}
                    onClick={handleSignupStepBack}
                  >
                    Back
                  </button>
                ) : null}
                <button
                  type="submit"
                  className={styles.btnPrimary}
                  disabled={signupLoading}
                >
                  {signupStep === 3
                    ? (signupLoading ? 'Signing up…' : 'Sign Up')
                    : 'Continue'}
                </button>
              </div>
              <p className={styles.loginLinkWrap}>
                Already have an account?{' '}
                <Link to="/login" className={styles.loginLink}>Log in</Link>
              </p>
            </form>
          </div>
        </section>
      )}

      {/* 3) Benefits rectangle (v2 only) – below signup form */}
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

      {/* 4) CTA only, no form (v3) */}
      {showCtaOnly && (
        <section className={styles.section}>
          <div className={styles.ctaCard}>
            <h3 className={styles.ctaTitle}>Unlock full report</h3>
            <p className={styles.ctaText}>
              Sign up or log in to view the complete report for <strong>{person.fullName}</strong>.
            </p>
            <div className={styles.ctaButtons}>
              <button type="button" className={styles.btnWhite} onClick={handleSignupNav}>
                Sign Up to View Full Report
              </button>
              <Link to="/login" className={styles.btnOutline}>
                Already have an account? Log in
              </Link>
            </div>
          </div>
        </section>
      )}
    </main>
  );
};

export default SearchDetailPreviewPage;
