import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useCampaign } from '../../context/CampaignContext';
import { useOfferPricing } from '../../hooks/useOfferPricing';
import api from '../../api';
import { createReportForIdentity } from '../../services/reportService';
import { track, buildReferQueryString } from '../../services/trackingService';
import { gtmEvent, gtmPurchase, gtmPaymentStart } from '../../services/gtm';
import { setTransaction as gtmSetTransaction } from '../../services/gtmContext';
import { readThinMatch } from '../../services/thinMatch';

// BC offer key — the actual price charged is enforced by BC's offer config
// (findByShmName). Display values come from `brand.trialPrice` /
// `brand.recurringPrice`; keep BC and brand config in sync when prices change.
const SIGNUP_OFFER_KEY = 'comp.offer.signup.main';
import styles from './PaymentPage.module.css';
import { useBrand } from '../../services/brand';
import CardBrandMarks from '../../components/CardBrandMarks';

// Detect card type from PAN prefix
function detectCardType(pan) {
  const n = (pan || '').replace(/\s/g, '');
  if (/^4/.test(n)) return 'visa';
  if (/^5[1-5]/.test(n) || /^2[2-7]/.test(n)) return 'mastercard';
  if (/^3[47]/.test(n)) return 'amex';
  if (/^6(?:011|5)/.test(n)) return 'discover';
  return null;
}


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

// Format expiry as MM/YY.
// Bug #31 (2026-05-29): smart-prefix. If the first digit typed is 2-9,
// auto-prefix "0" — only months 01-09 start with 0 and 10-12 start with 1,
// so any 2-9 lead is unambiguously a single-digit month. Lets the user
// type 9-2-6 to get "09/26" without backspace. Also handles pastes like
// "926" → "09/26".
function formatExpiry(value) {
  let digits = value.replace(/\D/g, '');
  if (digits.length >= 1 && /[2-9]/.test(digits[0])) {
    digits = `0${digits}`;
  }
  digits = digits.slice(0, 4);
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
  const brand = useBrand();
  const campaign = useCampaign();
  // SUP consent / pricing-disclosure block visibility is driven by BC's per-shN
  // "optout" flag (comp.client.theme.optout → campaign.optOut). optout:'yes' (default
  // + compliant) → show the block and require the checkbox; an affiliate shN with
  // optout:'no' → campaign.optOut false → hide it and don't gate submit on it (#34).
  const requireTermsCheckbox = campaign?.optOut !== false;
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { token, user, loading: authLoading, isPaid, setToken, setUser, setSubscription } = useAuth();

  // Trial end date — computed at render time, expressed in the visitor's
  // local format. Format e.g. "May 22, 2026". Used in the Terms of Use and
  // Pricing disclosure so the cardholder sees an explicit cancel-by date.
  const trialEndDate = new Date(Date.now() + brand.trialDays * 24 * 60 * 60 * 1000)
    .toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  // BC-driven per-partner pricing: when the campaign carries a partner offer
  // (campaign.offer.shmName), display that offer's real BC price. Otherwise the
  // default offer keeps the brand marketing display (TRX-approved override).
  const offerPricing = useOfferPricing(campaign?.offer?.shmName);
  const effectiveTrialPrice = offerPricing?.trialPrice ?? brand.trialPrice;
  const effectiveRecurringPrice = offerPricing?.recurringPrice ?? brand.recurringPrice;
  const trialPriceStr = `$${effectiveTrialPrice.toFixed(2)}`;
  const recurringPriceStr = `$${effectiveRecurringPrice.toFixed(2)}`;

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
  // Billing address is expanded by default (partner bug 17 — the "uses address
  // on file" hint was misleading since we never collected one). ZIP is required;
  // Street is still optional.
  const [billingOpen, setBillingOpen] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [selectedPerson, setSelectedPerson] = useState(null);
  const [selectedPersonId, setSelectedPersonId] = useState(null);
  // Pre-checked affirmative consent for Visa subscription-disclosure compliance.
  // Required-on-render (not just on submit) so the disclosure is always visible
  // and the consent state is captured. Joe (payments) noted it's a risk-mitigation
  // win even though Visa only mandates the checkbox for trial/negative-option flows.
  const [agreeTerms, setAgreeTerms] = useState(true);
  // Populated on the happy path so the confirmation screen can link straight to
  // the report the user was trying to reach before the paywall (partner bug 22).
  const [confirmedReportId, setConfirmedReportId] = useState(null);
  const [reportProvisioning, setReportProvisioning] = useState(false);
  // Suppresses the "already paid → redirect to dashboard" guard while a purchase
  // is mid-flight. AuthContext refetches subscription on token change, so the
  // billing.sale-issued token can flip isPaid mid-handler — without this flag,
  // the user is bounced to /dashboard before the success screen renders.
  const [paying, setPaying] = useState(false);

  const simulateParam = searchParams.get('simulate');
  const cardType = detectCardType(form.cardNumber);

  // Track page entry (after auth resolves so we know if it's an upgrade)
  useEffect(() => {
    if (!authLoading) {
      track('payment_start', {
        upgrade: searchParams.get('upgrade') === '1',
        has_selected: !!searchParams.get('selected'),
        offer_key: SIGNUP_OFFER_KEY,
      });
      gtmPaymentStart({ offer_key: SIGNUP_OFFER_KEY, plan: 'signup' });
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
    if (!authLoading && token && isPaid && !success && !paying) {
      navigate('/dashboard', { replace: true });
    }
  }, [token, authLoading, isPaid, success, paying, navigate]);

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
      if (name === 'billingZip') {
        // Bug #54: cap at 5 digits, strip anything else so paste/IME garbage
        // can't sneak in. ZIP+4 isn't needed by TRX or BC validators.
        return { ...prev, billingZip: value.replace(/\D/g, '').slice(0, 5) };
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

  // Partner bug 17: the old check only tested MM/YY shape, so 11/01 (in the past)
  // passed. Now we additionally verify MM is 01–12 and the YY/YY+MM combined
  // date is not earlier than the current month.
  const expiryValid = (() => {
    const match = /^(\d{2})\/(\d{2})$/.exec(form.expiry);
    if (!match) return false;
    const mm = parseInt(match[1], 10);
    const yy = parseInt(match[2], 10);
    if (mm < 1 || mm > 12) return false;
    const fullYear = 2000 + yy;
    const now = new Date();
    const exp = new Date(fullYear, mm, 0); // last day of exp month
    exp.setHours(23, 59, 59, 999);
    return exp >= now;
  })();

  const validation = {
    cardNumber: cardDigits.length === expectedLen && luhnCheck(form.cardNumber),
    expiry: expiryValid,
    cvv: cardType === 'amex' ? form.cvv.length === 4 : form.cvv.length === 3,
    billingFirstName: form.billingFirstName.trim().length > 0,
    billingLastName: form.billingLastName.trim().length > 0,
    billingZip: /^\d{5}$/.test(form.billingZip.trim()),
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!user) return;
    // Bug #37 (2026-05-29): mark touched on submit-fail so the red border
    // appears on the specific field that's missing/invalid. Banner error
    // still fires for clarity, but the visual cue points at the offender.
    if (!validation.billingFirstName) { setError('Please enter your first name.'); setTouched(t => ({ ...t, billingFirstName: true })); return; }
    if (!validation.billingLastName) { setError('Please enter your last name.'); setTouched(t => ({ ...t, billingLastName: true })); return; }
    if (!validation.cardNumber) { setError('Please enter a valid card number.'); setTouched(t => ({ ...t, cardNumber: true })); return; }
    if (!validation.expiry) { setError('Please enter a valid expiration date (MM/YY, not in the past).'); setTouched(t => ({ ...t, expiry: true })); return; }
    if (!validation.cvv) { setError('Please enter a valid CVV.'); setTouched(t => ({ ...t, cvv: true })); return; }
    // Partner bug 17: copy previously said "we use your billing address on file"
    // even though it wasn't collected. ZIP is now explicitly required.
    if (!validation.billingZip) { setError('Please enter a valid 5-digit ZIP code.'); setTouched(t => ({ ...t, billingZip: true })); setBillingOpen(true); return; }
    setError('');
    setLoading(true);
    setPaying(true);
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
              // Pass the real street as non-bogus when the user filled it in
              // (enables AVS street matching). Only fall back to a placeholder —
              // and mark street1 bogus — when left blank. zip is always real.
              street1: form.street1.trim() || '123 main',
              zip: form.billingZip,
              bogusFields: {
                firstName: false,
                lastName: false,
                street1: form.street1.trim().length === 0,
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
          // Campaign-driven offer shmName when configured; otherwise BC's
          // default signup offer. Set per partner+page via campaignRegistry.
          { key: campaign?.offer?.shmName || 'comp.offer.signup.main', target: 'main', options: {} },
        ],
        // Reflect BC's teaser-time thin-match signal on the billing order so
        // the order history records the true match state. Flags default to
        // `false` when no teaser search preceded this purchase.
        sequenceOption: readThinMatch(),
        // BC uses queryString for campaign attribution → commerceorders.refer.
        // The acquisition refer_* params arrive on the LANDING url, are captured
        // into referralParams, and the url is stripped — so they are NOT on the
        // /payment url. Seed from that first-touch capture (authoritative), then
        // layer any non-internal params still on the live url without overriding.
        ...((() => {
          const bcParams = new URLSearchParams(buildReferQueryString() || '');
          const live = new URLSearchParams(searchParams);
          ['upgrade', 'selected', 'redirect'].forEach(k => live.delete(k));
          live.forEach((v, k) => { if (!bcParams.has(k)) bcParams.set(k, v); });
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
        throw new Error("We couldn't complete your subscription. Please try again, or contact support if this keeps happening.");
      }

      // BC `getUserOrders` is the single source of truth for subscription state.
      // Poll it until BC has provisioned the order from the sale, up to 20s.
      // Backoff grows from 800ms to ~2.5s. 403/empty responses during BC's
      // provisioning window are expected — we keep polling.
      let verifiedOrder = null;
      const verifyDeadline = Date.now() + 20000;
      let pollDelay = 800;
      while (Date.now() < verifyDeadline) {
        try {
          const orders = await api.getUserOrders();
          if (Array.isArray(orders)) {
            verifiedOrder = orders.find(o =>
              o.status === 'active' && !o.transient?.canceled && o.subStatus !== 'canceled'
            );
            if (verifiedOrder) break;
          }
        } catch {
          // 403 / network blip during provisioning — keep polling.
        }
        await new Promise(r => setTimeout(r, pollDelay));
        pollDelay = Math.min(Math.round(pollDelay * 1.4), 2500);
      }
      if (!verifiedOrder) {
        throw new Error("Your payment was submitted but we couldn't confirm your subscription yet. Please refresh in a moment, or contact support if this persists.");
      }

      const verifiedSubscription = {
        status: 'active',
        plan: verifiedOrder.commerceOffers?.[0] || 'subscriber',
        dueDate: verifiedOrder.dueTimestamp ? new Date(verifiedOrder.dueTimestamp).toISOString() : null,
        orderId: verifiedOrder._id || verifiedOrder.id,
        cancelable: verifiedOrder.transient?.cancelable ?? false,
      };

      // Create the report BEFORE flipping success — so the confirmation screen
      // renders with the report link in place from first paint.
      let resolvedReportId = null;
      let reportFailed = false;
      if (selectedPerson && selectedPerson.extId) {
        try {
          const reportResult = await createReportForIdentity(selectedPerson.extId, selectedPerson);
          if (reportResult.success && reportResult.commerceContentId) {
            resolvedReportId = reportResult.commerceContentId;
          } else {
            reportFailed = true;
          }
        } catch {
          reportFailed = true;
        }
      }
      if (reportFailed && selectedPerson) {
        try {
          sessionStorage.setItem('pendingReport', JSON.stringify({
            extId: selectedPerson.extId,
            fullName: selectedPerson.fullName,
            location: selectedPerson.location,
            createdAt: Date.now(),
          }));
        } catch { /* storage may be unavailable — non-fatal */ }
      } else if (resolvedReportId) {
        sessionStorage.removeItem('pendingReport');
      }
      sessionStorage.removeItem('selectedPersonId');

      // Commit final state in one synchronous block so React batches them into a
      // single render — prevents the redirect effect from firing between
      // setSubscription (isPaid → true) and setSuccess (suppresses the redirect).
      if (resolvedReportId) setConfirmedReportId(resolvedReportId);
      else if (reportFailed) setReportProvisioning(true);
      setSuccess(true);
      setSubscription?.(verifiedSubscription);
      // Bug #38 (2026-05-29): the success screen is much shorter than the
      // payment form, so without this the user lands on the page footer.
      // Scroll to top so the confirmation is what they see.
      try { window.scrollTo({ top: 0, behavior: 'smooth' }); } catch { /* SSR / non-DOM */ }

      // orderId + amount make this partner-attributed conversion (data.refer is
      // auto-attached by track) joinable to the order with revenue in BC's
      // tracking store. (The order itself now also carries commerceorders.refer
      // via the sale queryString above — this remains the broader signal.)
      track('payment_complete', {
        plan: 'pro',
        offer_key: SIGNUP_OFFER_KEY,
        orderId: verifiedOrder?._id || verifiedOrder?.id || resolvedReportId,
        amount: effectiveTrialPrice,
      });
      gtmSetTransaction({
        orderId: verifiedOrder?._id || verifiedOrder?.id || resolvedReportId,
        amount: effectiveTrialPrice,
        currency: 'USD',
      });
      gtmPurchase({
        value: effectiveTrialPrice,
        currency: 'USD',
        offer_key: SIGNUP_OFFER_KEY,
        item_name: `${brand.name} Signup (S0 — 7-day access)`,
      });
      // BC compliance tracking — record subscription agreement timestamp on BC side.
      api.createTracking({
        type: 'agreement',
        event: 'payment_tos',
        date: new Date().toISOString(),
        plan: 'comp.offer.signup.main',
      });
      // NOTE: no auto-redirect from the confirmation screen. Partner bug 22 —
      // the user should see the confirmation, read it, and choose to view their
      // report or head to the dashboard on their own.
    } catch (err) {
      // Classify on HTTP status first (reliable), then fall back to BC message
      // patterns. Goal: never show "card declined" for what is actually a
      // session/account-state error (bug #55).
      const status = err?.status;
      const rawMsg = err?.data?.error?.message || err?.data?.message || err?.message || '';
      let errorType = 'payment_failed';
      let message;
      if (status === 401 || status === 403 || /session|expired|unauth/i.test(rawMsg)) {
        errorType = 'unauthorized';
        message = 'Your session has expired. Please sign in and try again.';
      } else if (status === 409 || /already exists|already registered|duplicate|in use|exists/i.test(rawMsg)) {
        errorType = 'account_exists';
        message = 'An account with this email already exists. Please sign in instead.';
      } else if (status === 402 || /declin|insufficient|cvv|expired card|invalid card|card number/i.test(rawMsg)) {
        errorType = 'card_declined';
        message = 'Your card was declined. Please check your card details and try again, or use a different card.';
      } else if (status >= 500) {
        errorType = 'server_error';
        message = "We're having trouble processing payments right now. Please try again in a moment.";
      } else {
        message = rawMsg || "We couldn't complete your subscription. Please try again, or contact support if this keeps happening.";
      }
      track('payment_error', { errorType, errorMessage: err?.message, errorStatus: status });
      gtmEvent('payment_error', { error_type: errorType });
      setError(message);
    } finally {
      setLoading(false);
      setPaying(false);
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
              <h2 className={styles.successTitle}>You're in!</h2>
              <p className={styles.successText}>
                Your {brand.name} Basic membership is now active. A receipt is on its way to <strong>{user?.email}</strong>.
              </p>

              {/* Primary CTA varies by whether report creation succeeded.
                  confirmedReportId → direct jump to the report they wanted.
                  reportProvisioning → report is being prepared; DashboardHome
                  auto-retries on arrival.
                  else → generic "Go to dashboard". */}
              <div style={{ marginTop: '1.5rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                {confirmedReportId && selectedPerson ? (
                  <button
                    type="button"
                    onClick={() => navigate(`/people/${confirmedReportId}`)}
                    style={{
                      background: '#0d5d2f', color: '#fff', border: 'none',
                      padding: '0.9rem 1.25rem', borderRadius: '0.5rem',
                      fontSize: '1rem', fontWeight: 600, cursor: 'pointer',
                      boxShadow: '0 2px 4px rgba(13,93,47,0.2)',
                    }}
                  >
                    View {selectedPerson.fullName}'s report →
                  </button>
                ) : reportProvisioning && selectedPerson ? (
                  <div
                    role="note"
                    style={{
                      background: '#fffbeb', border: '1px solid #fde68a',
                      color: '#92400e', borderRadius: '0.5rem',
                      padding: '0.75rem 1rem', fontSize: '0.9rem',
                    }}
                  >
                    We're finishing up <strong>{selectedPerson.fullName}</strong>'s report.
                    It'll appear on your dashboard in a moment — we'll try again automatically.
                  </div>
                ) : null}

                <button
                  type="button"
                  onClick={() => navigate('/dashboard')}
                  style={{
                    background: '#fff', color: '#0d5d2f',
                    border: '2px solid #0d5d2f',
                    padding: '0.9rem 1.25rem', borderRadius: '0.5rem',
                    fontSize: '1rem', fontWeight: 600, cursor: 'pointer',
                  }}
                >
                  Go to my dashboard
                </button>
              </div>

              <p style={{
                marginTop: '1.5rem', fontSize: '0.85rem', color: '#6b7280',
                lineHeight: 1.6,
              }}>
                Manage your plan or cancel anytime from{' '}
                <button
                  type="button"
                  onClick={() => navigate('/account')}
                  style={{
                    background: 'none', border: 'none', padding: 0,
                    color: '#0d5d2f', fontWeight: 600, cursor: 'pointer',
                    textDecoration: 'underline',
                  }}
                >Account Settings</button>.
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
                        className={`${styles.input} ${touched.billingFirstName && !validation.billingFirstName ? styles.inputError : ''}`}
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
                        className={`${styles.input} ${touched.billingLastName && !validation.billingLastName ? styles.inputError : ''}`}
                      />
                    </div>
                  </div>

                  {/* Card number */}
                  <div className={styles.fieldGroup}>
                    <div className={styles.fieldLabelRow}>
                      <label className={styles.label} htmlFor="pay-card">Card Number</label>
                      <CardBrandMarks detected={cardType} className={styles.cardBrandMarks} />
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
                        <p className={styles.fieldErrMsg}>
                          {form.expiry && /^\d{2}\/\d{2}$/.test(form.expiry)
                            ? 'This date is in the past'
                            : 'Enter MM/YY'}
                        </p>
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

                  {/* Billing address — open by default; ZIP required */}
                  <div className={styles.billingToggleRow}>
                    <button
                      type="button"
                      className={styles.billingToggle}
                      onClick={() => setBillingOpen(o => !o)}
                    >
                      <span>Billing Address</span>
                      <span className={styles.billingToggleChevron}>{billingOpen ? '▲' : '▼'}</span>
                    </button>
                  </div>
                  {billingOpen && (
                    <div className={styles.billingFields}>
                      <div className={styles.fieldGroup}>
                        <label className={styles.label} htmlFor="pay-street">Street Address (optional)</label>
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
                        <label className={styles.label} htmlFor="pay-zip">ZIP Code *</label>
                        <input
                          id="pay-zip"
                          type="text"
                          name="billingZip"
                          value={form.billingZip}
                          onChange={handleChange}
                          required
                          placeholder="12345"
                          inputMode="numeric"
                          autoComplete="billing postal-code"
                          maxLength="5"
                          className={`${styles.input} ${!validation.billingZip ? styles.inputError : ''}`}
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

                  {/* Visa subscription-disclosure block — pricing, renewal, cancel.
                      Must appear BEFORE the submit button so the cardholder reads
                      the terms prior to authorizing the charge. Hidden when BC's shN
                      optout flag is 'no' (campaign.optOut === false). */}
                  {requireTermsCheckbox && (
                  <div className={styles.termsBlock}>
                    <p className={styles.termsHeading}>
                      <strong>*Terms of Use and Pricing Information</strong>
                    </p>
                    <label className={styles.termsLabel}>
                      {requireTermsCheckbox && (
                        <input
                          type="checkbox"
                          className={styles.termsCheckbox}
                          checked={agreeTerms}
                          onChange={(e) => setAgreeTerms(e.target.checked)}
                        />
                      )}
                      <span className={styles.termsBody}>
                        By clicking the button below, you agree to {brand.name}'s{' '}
                        <Link to="/terms" target="_blank" rel="noopener noreferrer">Terms of Use</Link>,{' '}
                        <Link to="/privacy" target="_blank" rel="noopener noreferrer">Privacy Policy</Link> and you authorize {brand.name} to
                        charge your card <strong>{trialPriceStr} today</strong> for your report.
                        With your report, you get an Unlimited Search trial account for a full{' '}
                        <strong>{brand.trialDays} Days</strong>. With Unlimited Search, you can
                        search for as many reports as you want, and view and access up to 5 reports
                        per day! If you cancel your trial before <strong>{trialEndDate}</strong>,
                        there will be no further charges. If you like what you see and wish to
                        search more reports on friends, relatives or anybody else in your life,
                        simply do nothing and we will automatically start your Unlimited Search
                        subscription and charge your card just <strong>{recurringPriceStr}</strong> at
                        the end of the trial period and every 30 Days thereafter until you cancel.
                        You may cancel at any time with our 100% hassle free cancellation. Just call
                        us at <strong>{brand.supportPhone}</strong> or{' '}
                        <Link to="/contact" target="_blank" rel="noopener noreferrer">visit our contact form</Link> anytime, 24 hours a day,
                        7 days a week.
                      </span>
                    </label>
                    <p className={styles.termsBody} style={{ marginTop: '0.75rem' }}>
                      You also understand and agree that {brand.name} is not a "consumer reporting
                      agency", as defined in the Fair Credit Reporting Act (15 U.S.C. § 1681, et seq.)
                      ("FCRA") and does not provide "consumer reports", as defined in FCRA. You
                      understand and represent that you are not purchasing and will not use{' '}
                      {brand.name}'s products or services for any purpose in connection with
                      determining a person's eligibility for credit, insurance, employment or for
                      any other eligibility determination subject to FCRA.
                    </p>
                  </div>
                  )}

                  {/* CTA */}
                  <button
                    type="submit"
                    disabled={loading || (requireTermsCheckbox && !agreeTerms)}
                    className={styles.submitBtn}
                  >
                    {loading ? (
                      <span className={styles.submitSpinner}>
                        <span className={styles.spinner} /> Processing…
                      </span>
                    ) : (
                      // Bug #35: compliance-led CTA directly above the SUP/terms
                      // disclosure — the button text states the agreement.
                      'I Agree, View Report Now'
                    )}
                  </button>

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

              {/* Only meaningful for an authenticated upgrader (e.g. clicked
                  "Upgrade to Pro" from AccountPage/DashboardHome). Hide for
                  unauthenticated signup funnel — bug #36: the link confused
                  users since /dashboard would just bounce them back. */}
              {token && (
                <p className={styles.skipLink}>
                  <button
                    type="button"
                    onClick={() => navigate('/dashboard')}
                    className={styles.skipBtn}
                  >
                    I'll upgrade later — go to my dashboard
                  </button>
                </p>
              )}
            </>
          )}
        </div>

        {/* ── Right: Order summary ──────────────────────────────── */}
        {!success && (
          <div className={styles.summaryCol}>
            <div className={styles.summaryCard}>
              <div className={styles.summaryHeader}>
                <p className={styles.summaryPlanName}>{brand.trialDays}-Day Trial</p>
                <p className={styles.summaryPrice}>{trialPriceStr}<span className={styles.summaryPer}> today</span></p>
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
                <strong>{trialPriceStr}</strong>
              </div>
              <p className={styles.summaryCancel}>
                Then {recurringPriceStr}/month after your {brand.trialDays}-day trial. Cancel anytime — no hidden fees.
              </p>
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
