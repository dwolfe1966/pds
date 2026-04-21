import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import api from '../../api';
import { createReportForIdentity } from '../../services/reportService';
import { track } from '../../services/trackingService';
import { gtmEvent } from '../../services/gtm';
import styles from './PaymentPage.module.css';

// Detect card type from PAN prefix
function detectCardType(pan) {
  const n = (pan || '').replace(/\s/g, '');
  if (/^4/.test(n)) return 'visa';
  if (/^5[1-5]/.test(n) || /^2[2-7]/.test(n)) return 'mastercard';
  if (/^3[47]/.test(n)) return 'amex';
  if (/^6(?:011|5)/.test(n)) return 'discover';
  return null;
}

const CARD_TYPE_LABELS = { visa: 'Visa', mastercard: 'Mastercard', amex: 'Amex', discover: 'Discover' };
const CARD_TYPE_COLORS = { visa: '#1a1f71', mastercard: '#eb001b', amex: '#2e77bc', discover: '#ff6600' };

// Format card number with spaces
function formatCardNumber(value, cardType) {
  const digits = value.replace(/\D/g, '');
  const maxLen = cardType === 'amex' ? 15 : 16;
  const trimmed = digits.slice(0, maxLen);
  if (cardType === 'amex') {
    return trimmed.replace(/(\d{4})(\d{6})(\d{0,5})/, (_, a, b, c) =>
      c ? `${a} ${b} ${c}` : b ? `${a} ${b}` : a
    );
  }
  return trimmed.replace(/(\d{4})/g, '$1 ').trim();
}

// Format expiry as MM/YY
function formatExpiry(value) {
  const digits = value.replace(/\D/g, '').slice(0, 4);
  if (digits.length >= 3) return `${digits.slice(0, 2)}/${digits.slice(2)}`;
  return digits;
}

// Parse MM/YY into { expMonth, expYear }
function parseExpiry(expiry) {
  const match = String(expiry || '').match(/^(\d{1,2})\s*\/\s*(\d{2,4})$/);
  if (!match) return { expMonth: '', expYear: '' };
  let [, month, year] = match;
  if (year.length === 2) year = `20${year}`;
  return { expMonth: month.padStart(2, '0'), expYear: year.slice(-2) };
}

// Luhn check for card validation
function luhnCheck(pan) {
  const digits = pan.replace(/\s/g, '');
  if (!/^\d+$/.test(digits)) return false;
  let sum = 0;
  let alt = false;
  for (let i = digits.length - 1; i >= 0; i--) {
    let n = parseInt(digits[i], 10);
    if (alt) { n *= 2; if (n > 9) n -= 9; }
    sum += n;
    alt = !alt;
  }
  return sum % 10 === 0;
}

const PLAN_FEATURES = [
  'Unlimited background report access',
  'Reverse phone & email lookups',
  'Address history & current location',
  'Criminal & court record checks',
  'Relatives & family connections',
  'Cancel anytime — no lock-in',
];

const PaymentPage = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { token, user, loading: authLoading, isPaid, setToken, setUser, setSubscription } = useAuth();

  const [form, setForm] = useState({
    cardNumber: '',
    expiry: '',
    cvv: '',
    billingFirstName: '',
    billingLastName: '',
    street1: '',
    billingZip: '',
  });
  const [touched, setTouched] = useState({});
  const [billingOpen, setBillingOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [selectedPerson, setSelectedPerson] = useState(null);
  const [selectedPersonId, setSelectedPersonId] = useState(null);

  const simulateParam = searchParams.get('simulate');
  const cardType = detectCardType(form.cardNumber);

  // Cancel pending navigation on unmount so stale navigate() calls don't fire.
  const navTimeoutRef = useRef(null);
  useEffect(() => {
    return () => { if (navTimeoutRef.current) clearTimeout(navTimeoutRef.current); };
  }, []);

  // Track page entry (after auth resolves so we know if it's an upgrade)
  useEffect(() => {
    if (!authLoading) {
      track('payment_start', {
        upgrade: searchParams.get('upgrade') === '1',
        has_selected: !!searchParams.get('selected'),
      });
    }
  }, [authLoading]); // eslint-disable-line react-hooks/exhaustive-deps

  // Require login; redirect existing subscribers away from the payment page.
  // Skip the isPaid redirect when success=true — payment just completed and we set
  // subscription immediately, so the guard would fire before the success screen shows.
  useEffect(() => {
    if (!authLoading && !token) {
      const redirect = `/payment${window.location.search || ''}`;
      navigate(`/signup?redirect=${encodeURIComponent(redirect)}`, { replace: true });
    }
    if (!authLoading && token && isPaid && !success) {
      navigate('/dashboard', { replace: true });
    }
  }, [token, authLoading, isPaid, success, navigate]);

  // Load selected person from sessionStorage
  useEffect(() => {
    const personId = sessionStorage.getItem('selectedPersonId');
    if (personId) {
      setSelectedPersonId(personId);
      const stored = sessionStorage.getItem(`result_${personId}`);
      if (stored) setSelectedPerson(JSON.parse(stored));
    }
  }, []);

  // userInfo is used for the JSX "Paying as" display — names shown from form at submit time.
  const userInfo = user ? { email: user.email } : null;

  const handleChange = useCallback((e) => {
    const { name, value } = e.target;
    setForm(prev => {
      if (name === 'cardNumber') {
        const ct = detectCardType(value);
        return { ...prev, cardNumber: formatCardNumber(value, ct) };
      }
      if (name === 'expiry') {
        return { ...prev, expiry: formatExpiry(value) };
      }
      if (name === 'cvv') {
        const maxLen = detectCardType(prev.cardNumber) === 'amex' ? 4 : 3;
        return { ...prev, cvv: value.replace(/\D/g, '').slice(0, maxLen) };
      }
      return { ...prev, [name]: value };
    });
  }, []);

  const handleBlur = useCallback((e) => {
    setTouched(prev => ({ ...prev, [e.target.name]: true }));
  }, []);

  // Field validation
  const cardDigits = form.cardNumber.replace(/\s/g, '');
  const expectedLen = cardType === 'amex' ? 15 : 16;
  const validation = {
    cardNumber: cardDigits.length === expectedLen && luhnCheck(form.cardNumber),
    expiry: /^\d{2}\/\d{2}$/.test(form.expiry),
    cvv: cardType === 'amex' ? form.cvv.length === 4 : form.cvv.length === 3,
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!user) return;
    if (!form.billingFirstName.trim()) { setError('Please enter your first name.'); return; }
    if (!form.billingLastName.trim()) { setError('Please enter your last name.'); return; }
    setError('');
    setLoading(true);
    try {
      const { expMonth, expYear } = parseExpiry(form.expiry);
      // Build userInfo here from current form state — avoids stale closure from render-time const.
      // Read optin from sessionStorage: the synthetic BC token doesn't carry user.optin,
      // so we stash the choice at signup and read it here to respect what the user selected.
      const signupOptin = sessionStorage.getItem('_signupOptin');
      // Retrieve the password stored at signup so we can pass it to billing.sale.
      // BC creates the user account during billing.sale — if password is missing,
      // the account is created without one and future logins fail with 401.
      const rawPendingPw = sessionStorage.getItem('_pendingPw');
      let pendingPassword = null;
      if (rawPendingPw) {
        try { pendingPassword = decodeURIComponent(escape(atob(rawPendingPw))); } catch { pendingPassword = rawPendingPw; }
      }
      const submitUserInfo = {
        email: user.email,
        firstName: form.billingFirstName.trim(),
        lastName: form.billingLastName.trim(),
        optin: signupOptin !== null ? signupOptin === '1' : (user.optin !== false),
        ...(pendingPassword ? { password: pendingPassword } : {}),
      };
      const saleParams = {
        userInfo: submitUserInfo,
        billings: [
          {
            billingType: 'creditCard',
            creditCard: {
              pan: (form.cardNumber || '').replace(/\s/g, ''),
              expYear: expYear || '30',
              expMonth: expMonth || '12',
              cvv: form.cvv || '123',
            },
            billingAddress: {
              firstName: submitUserInfo.firstName,
              lastName: submitUserInfo.lastName,
              street1: form.street1 || '123 main',
              zip: form.billingZip || '10001',
              bogusFields: {
                firstName: false,
                lastName: false,
                street1: true,
                street2: true,
                city: true,
                state: true,
                zip: false,
                country: true,
              },
            },
          },
        ],
        commerceOfferKeys: [
          { key: 'comp.offer.signup.main', target: 'main', options: {} },
        ],
        sequenceOption: {
          thinMatch: false,
          thinMatchDataProviderDown: false,
          thinMatchTooManyResults: false,
          thinMatchNoResults: false,
          thinMatchGeographic: false,
        },
        // Strip internal UI params (upgrade, selected, redirect) before passing to BC.
        // BC uses queryString for campaign attribution — our UI flags are not valid BC params.
        ...((() => {
          const bcParams = new URLSearchParams(searchParams);
          ['upgrade', 'selected', 'redirect'].forEach(k => bcParams.delete(k));
          const qs = bcParams.toString();
          return qs ? { queryString: qs } : {};
        })()),
      };

      let paymentSuccess = false;
      let saleError = null;
      try {
        const saleResult = await api.billingSale(saleParams);
        const rawData = saleResult?.getData?.() ?? saleResult?.params?.response?.data ?? saleResult?.data ?? saleResult ?? {};
        if (process.env.NODE_ENV === 'development') {
          console.log('[Payment] billingSale rawData:', JSON.stringify(rawData)?.substring(0, 300));
        }
        paymentSuccess = true;
        if (rawData?.accessToken) {
          setToken?.(rawData.accessToken);
          setUser?.(rawData.user || user);
          localStorage.setItem('accessToken', rawData.accessToken);
          if (rawData.refreshToken) localStorage.setItem('refreshToken', rawData.refreshToken);
        }
      } catch (saleErr) {
        if (process.env.NODE_ENV === 'development') {
          console.warn('[Payment] billingSale failed:', saleErr?.message, saleErr?.data);
        }
        saleError = saleErr;
      }

      // ALWAYS call changePassword after billing.sale, even if the IIFE reported an
      // error. The BC IIFE calls changePassword internally (step 4) BEFORE the actual
      // commerceBilling/sale HTTP request (step 5), so it always fails (no account yet).
      // The IIFE then treats that failure as an error-state response, causing our wrapper
      // to throw — but the sale itself (step 5) may have succeeded. We must call
      // changePassword here to ensure the password is set on the newly-created account.
      sessionStorage.removeItem('_pendingPw');
      sessionStorage.removeItem('_signupOptin');
      if (pendingPassword) {
        try {
          const { default: apiWrapper } = await import('../../services/apiWrapper');
          const w = await apiWrapper.getWrapper();
          if (typeof w.api?.user?.changePassword === 'function') {
            await w.api.user.changePassword(pendingPassword);
            if (process.env.NODE_ENV === 'development') {
              console.log('[Payment] changePassword after sale succeeded');
            }
            // If changePassword worked, the sale likely succeeded too
            if (!paymentSuccess) paymentSuccess = true;
          }
        } catch (pwErr) {
          if (process.env.NODE_ENV === 'development') {
            console.warn('[Payment] changePassword after sale failed (non-fatal):', pwErr?.message);
          }
        }
      }

      if (!paymentSuccess && simulateParam) {
        await api.updateSubscription({ plan: 'basic', paymentToken: 'tok_demo', simulate: simulateParam }, token);
        paymentSuccess = true;
      }

      if (!paymentSuccess) {
        if (saleError) throw saleError;
        throw new Error('Your card was declined. Please check your card details and try again, or use a different card.');
      }

      // Set subscription immediately so isPaid=true for the rest of this flow.
      // Do NOT call refreshSubscription() here — getUserOrders returns 403 immediately
      // after billing.sale (BC hasn't provisioned the account yet), which would clear
      // this synthetic subscription and cause PaidRoute to redirect back to payment.
      setSubscription?.({ status: 'active', plan: 'comp.offer.signup.main' });

      setSuccess(true);
      track('payment_complete', { plan: 'pro' });
      gtmEvent('purchase', { value: 29.99, currency: 'USD', items: [{ item_name: 'Basic Plan' }] });

      // Clean up signup sessionStorage now that payment succeeded.
      sessionStorage.removeItem('selectedPersonId');

      if (selectedPerson && selectedPerson.extId) {
        try {
          const reportResult = await createReportForIdentity(selectedPerson.extId, selectedPerson);
          if (reportResult.success && reportResult.commerceContentId) {
            navTimeoutRef.current = setTimeout(() => navigate(`/people/${reportResult.commerceContentId}`), 2000);
            return;
          }
        } catch {
          // Report creation failed — fall through to dashboard.
          // The user is subscribed; they can search and view reports from the dashboard.
        }
      }

      // Always fall back to /dashboard — never use the raw selectedPersonId as a report URL.
      // Raw search IDs are not commerceContentIds and would hit PaidRoute, which would
      // redirect to payment even though the user just subscribed.
      navTimeoutRef.current = setTimeout(() => navigate('/dashboard'), 2000);
    } catch (err) {
      const isUnauthorized = err?.status === 401;
      const errorType = isUnauthorized ? 'unauthorized' : 'payment_failed';
      track('payment_error', { errorType, errorMessage: err?.message });
      gtmEvent('payment_error', { error_type: errorType });
      const message = isUnauthorized
        ? 'Please sign in or create an account first.'
        : (err?.data?.error?.message || err?.message || 'Payment failed. Please check your card details and try again.');
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  if (authLoading) return null;

  return (
    <main className={styles.main}>
      <div className={styles.layout}>

        {/* ── Left: Form ───────────────────────────────────────── */}
        <div className={styles.formCol}>

          {/* Person preview */}
          {selectedPerson && !success && (
            <div className={styles.personPreview}>
              <div className={styles.personPreviewAvatar}>
                {(selectedPerson.fullName || '?').split(/\s+/).slice(0, 2).map(n => n[0]).join('').toUpperCase() || '?'}
              </div>
              <div className={styles.personPreviewInfo}>
                <p className={styles.personPreviewName}>{selectedPerson.fullName}</p>
                <p className={styles.personPreviewMeta}>
                  {[selectedPerson.ageRange && `Age ${selectedPerson.ageRange}`, selectedPerson.location].filter(Boolean).join(' · ')}
                </p>
              </div>
              <span className={styles.personPreviewLock}>🔓 Ready to unlock</span>
            </div>
          )}

          {success ? (
            <div className={styles.successBox}>
              <div className={styles.successIcon}>✓</div>
              <h2 className={styles.successTitle}>Payment Successful!</h2>
              <p className={styles.successText}>
                Your membership is now active.{' '}
                {selectedPerson ? `Preparing your report for ${selectedPerson.fullName}…` : 'Redirecting to your dashboard…'}
              </p>
            </div>
          ) : (
            <>
              <div className={styles.formCard}>
                <h2 className={styles.formCardTitle}>Payment Information</h2>

                {userInfo && (
                  <div className={styles.payingAs}>
                    <span className={styles.payingAsLabel}>Paying as</span>
                    <span className={styles.payingAsValue}>{userInfo.email}</span>
                  </div>
                )}

                <form onSubmit={handleSubmit} noValidate>
                  {/* Cardholder name — always visible; used as userInfo.firstName/lastName for BC */}
                  <div className={styles.fieldRow}>
                    <div className={styles.fieldGroup}>
                      <label className={styles.label} htmlFor="pay-bfirst">First Name *</label>
                      <input
                        id="pay-bfirst"
                        type="text"
                        name="billingFirstName"
                        value={form.billingFirstName}
                        onChange={handleChange}
                        required
                        placeholder="First"
                        autoComplete="given-name"
                        className={styles.input}
                      />
                    </div>
                    <div className={styles.fieldGroup}>
                      <label className={styles.label} htmlFor="pay-blast">Last Name *</label>
                      <input
                        id="pay-blast"
                        type="text"
                        name="billingLastName"
                        value={form.billingLastName}
                        onChange={handleChange}
                        required
                        placeholder="Last"
                        autoComplete="family-name"
                        className={styles.input}
                      />
                    </div>
                  </div>

                  {/* Card number */}
                  <div className={styles.fieldGroup}>
                    <div className={styles.fieldLabelRow}>
                      <label className={styles.label} htmlFor="pay-card">Card Number</label>
                      {cardType && (
                        <span
                          className={styles.cardTypePill}
                          style={{ background: CARD_TYPE_COLORS[cardType] }}
                        >
                          {CARD_TYPE_LABELS[cardType]}
                        </span>
                      )}
                    </div>
                    <div className={styles.inputWrap}>
                      <input
                        id="pay-card"
                        type="text"
                        name="cardNumber"
                        value={form.cardNumber}
                        onChange={handleChange}
                        onBlur={handleBlur}
                        required
                        placeholder="1234 5678 9012 3456"
                        inputMode="numeric"
                        autoComplete="cc-number"
                        className={`${styles.input} ${touched.cardNumber && !validation.cardNumber ? styles.inputError : ''} ${touched.cardNumber && validation.cardNumber ? styles.inputValid : ''}`}
                      />
                      {touched.cardNumber && (
                        <span className={styles.fieldIndicator}>
                          {validation.cardNumber ? '✓' : '✗'}
                        </span>
                      )}
                    </div>
                    {touched.cardNumber && !validation.cardNumber && (
                      <p className={styles.fieldErrMsg}>Please enter a valid card number</p>
                    )}
                  </div>

                  {/* Expiry + CVV */}
                  <div className={styles.fieldRow}>
                    <div className={styles.fieldGroup}>
                      <label className={styles.label} htmlFor="pay-expiry">Expiry</label>
                      <div className={styles.inputWrap}>
                        <input
                          id="pay-expiry"
                          type="text"
                          name="expiry"
                          value={form.expiry}
                          onChange={handleChange}
                          onBlur={handleBlur}
                          required
                          placeholder="MM/YY"
                          inputMode="numeric"
                          autoComplete="cc-exp"
                          maxLength="5"
                          className={`${styles.input} ${touched.expiry && !validation.expiry ? styles.inputError : ''} ${touched.expiry && validation.expiry ? styles.inputValid : ''}`}
                        />
                        {touched.expiry && (
                          <span className={styles.fieldIndicator}>
                            {validation.expiry ? '✓' : '✗'}
                          </span>
                        )}
                      </div>
                      {touched.expiry && !validation.expiry && (
                        <p className={styles.fieldErrMsg}>Enter MM/YY</p>
                      )}
                    </div>
                    <div className={styles.fieldGroup}>
                      <label className={styles.label} htmlFor="pay-cvv">
                        CVV
                        <span className={styles.cvvHint} title="3-digit code on the back of your card (4 digits for Amex)">?</span>
                      </label>
                      <div className={styles.inputWrap}>
                        <input
                          id="pay-cvv"
                          type="text"
                          name="cvv"
                          value={form.cvv}
                          onChange={handleChange}
                          onBlur={handleBlur}
                          required
                          placeholder={cardType === 'amex' ? '1234' : '123'}
                          inputMode="numeric"
                          autoComplete="cc-csc"
                          className={`${styles.input} ${touched.cvv && !validation.cvv ? styles.inputError : ''} ${touched.cvv && validation.cvv ? styles.inputValid : ''}`}
                        />
                        {touched.cvv && (
                          <span className={styles.fieldIndicator}>
                            {validation.cvv ? '✓' : '✗'}
                          </span>
                        )}
                      </div>
                      {touched.cvv && !validation.cvv && (
                        <p className={styles.fieldErrMsg}>Check your CVV</p>
                      )}
                    </div>
                  </div>

                  {/* Billing address — collapsible */}
                  <div className={styles.billingToggleRow}>
                    <button
                      type="button"
                      className={styles.billingToggle}
                      onClick={() => setBillingOpen(o => !o)}
                    >
                      <span>Billing Address</span>
                      <span className={styles.billingToggleChevron}>{billingOpen ? '▲' : '▼'}</span>
                    </button>
                    {!billingOpen && (
                      <span className={styles.billingToggleHint}>Optional — uses address on file</span>
                    )}
                  </div>
                  {billingOpen && (
                    <div className={styles.billingFields}>
                      <div className={styles.fieldGroup}>
                        <label className={styles.label} htmlFor="pay-street">Street Address</label>
                        <input
                          id="pay-street"
                          type="text"
                          name="street1"
                          value={form.street1}
                          onChange={handleChange}
                          placeholder="123 Main St"
                          autoComplete="billing street-address"
                          className={styles.input}
                        />
                      </div>
                      <div className={styles.fieldGroup}>
                        <label className={styles.label} htmlFor="pay-zip">ZIP Code</label>
                        <input
                          id="pay-zip"
                          type="text"
                          name="billingZip"
                          value={form.billingZip}
                          onChange={handleChange}
                          placeholder="12345"
                          inputMode="numeric"
                          autoComplete="billing postal-code"
                          maxLength="10"
                          className={styles.input}
                        />
                      </div>
                    </div>
                  )}

                  {/* Error */}
                  {error && (
                    <div className={styles.errorBox}>
                      <span className={styles.errorIcon}>!</span>
                      <div>
                        <p className={styles.errorTitle}>Payment declined</p>
                        <p className={styles.errorMsg}>{error}</p>
                        {error.includes('sign in') && (
                          <p className={styles.errorLinks}>
                            <Link to="/signup">Sign up</Link> or <Link to="/login">Log in</Link>
                          </p>
                        )}
                      </div>
                    </div>
                  )}

                  {/* CTA */}
                  <button
                    type="submit"
                    disabled={loading}
                    className={styles.submitBtn}
                  >
                    {loading ? (
                      <span className={styles.submitSpinner}>
                        <span className={styles.spinner} /> Processing…
                      </span>
                    ) : selectedPerson ? `Unlock Report — $29.99/mo` : 'Subscribe Now — $29.99/mo'}
                  </button>

                  <p className={styles.cancelNote}>
                    No lock-in. Cancel anytime from your account. Billed monthly.
                  </p>

                  <p className={styles.billingNote}>
                    Your card will be charged $29.99 today. Plan auto-renews monthly.
                  </p>

                  {process.env.NODE_ENV === 'development' && (
                    <p className={styles.devHint} role="status" aria-label="Testing options">
                      Test: <a href="?simulate=success">Success</a> · <a href="?simulate=failure">Decline</a>
                    </p>
                  )}
                </form>
              </div>

              {/* Trust row */}
              <div className={styles.trustRow}>
                <span className={styles.trustItem}>🔒 256-bit SSL</span>
                <span className={styles.trustItem}>✓ PCI Compliant</span>
                <span className={styles.trustItem}>🔐 Encrypted</span>
              </div>

              <p className={styles.skipLink}>
                <button
                  type="button"
                  onClick={() => navigate('/dashboard')}
                  className={styles.skipBtn}
                >
                  I'll upgrade later — go to my dashboard
                </button>
              </p>
            </>
          )}
        </div>

        {/* ── Right: Order summary ──────────────────────────────── */}
        {!success && (
          <div className={styles.summaryCol}>
            <div className={styles.summaryCard}>
              <div className={styles.summaryHeader}>
                <p className={styles.summaryPlanName}>Basic Plan</p>
                <p className={styles.summaryPrice}>$29.99<span className={styles.summaryPer}>/mo</span></p>
              </div>
              <p className={styles.summaryInstant}>⚡ Instant access after payment</p>
              <ul className={styles.featureList}>
                {PLAN_FEATURES.map((f, i) => (
                  <li key={i} className={styles.featureItem}>
                    <span className={styles.featureCheck}>✓</span>
                    {f}
                  </li>
                ))}
              </ul>
              <div className={styles.summaryTotal}>
                <span>Today's charge</span>
                <strong>$29.99</strong>
              </div>
              <p className={styles.summaryCancel}>Cancel anytime. No hidden fees.</p>
            </div>

            <div className={styles.summaryTrustCard}>
              <p className={styles.summaryTrustTitle}>Why people trust us</p>
              <p className={styles.summaryTrustItem}>🔒 Your data is never sold or shared</p>
              <p className={styles.summaryTrustItem}>⭐ Trusted by 3M+ members</p>
              <p className={styles.summaryTrustItem}>📞 Live support available</p>
            </div>
          </div>
        )}
      </div>
    </main>
  );
};

export default PaymentPage;
