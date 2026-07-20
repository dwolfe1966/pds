import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useCampaign } from '../../context/CampaignContext';
import WsfyPaymentTeaser from '../../components/WsfyPaymentTeaser';
import IdentityPaymentTeaser from '../../components/IdentityPaymentTeaser';
import SignalTeaser from '../../components/SignalTeaser';
import { getFlow } from '../../services/funnelFlow';
import { useOfferPricing } from '../../hooks/useOfferPricing';
import api from '../../api';
import { createReportForIdentity } from '../../services/reportService';
import { saveIdentityFormInfo } from '../../services/memberEnrichment';
import { track, buildReferQueryString } from '../../services/trackingService';
import { PersonAvatar, properCaseName } from '../../components/PersonAvatar';
import { gtmEvent, gtmPurchase, gtmPaymentStart } from '../../services/gtm';
import { setTransaction as gtmSetTransaction } from '../../services/gtmContext';
import { readThinMatch, EMPTY_FLAGS } from '../../services/thinMatch';
import { captureAbandonedCheckout, getCapturedEmail } from '../../services/emailCapture';
import { useFunnelTheme } from '../../hooks/useFunnelTheme';
import ThemedFunnelHeader from '../../components/ThemedFunnelHeader';

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

// "Results May Include" teaser on the person vCard — 3 columns × 2 rows.
const RESULTS_MAY_INCLUDE = [
  'Full Address', 'Family Members', 'Email Address',
  'Marital Status', 'Phone Number', 'Location History',
];

const PaymentPage = () => {
  const brand = useBrand();
  const theme = useFunnelTheme(); // funnel palette carried from landing; null = green (colors only)
  const campaign = useCampaign();
  // BC's per-shN "optout" flag (comp.client.theme.optout → campaign.optOut) toggles
  // ONLY the consent checkbox + the SUP pricing-disclosure paragraph below the "Terms
  // of Use and Pricing Information" heading (the heading and the FCRA note always show).
  // optout:'yes' (default + compliant) → show it and require the checkbox; an affiliate
  // shN with optout:'no' → campaign.optOut false → hide it and don't gate submit (#34).
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
  // BC order id for the confirmation receipt shown on the success screen.
  const [confirmedOrderId, setConfirmedOrderId] = useState(null);
  // Email-only signup: the auto-generated password to reveal on the confirmation
  // screen (only set when the password was system-generated, never a user's own).
  const [confirmedPassword, setConfirmedPassword] = useState(null);
  // Suppresses the "already paid → redirect to dashboard" guard while a purchase
  // is mid-flight. AuthContext refetches subscription on token change, so the
  // billing.sale-issued token can flip isPaid mid-handler — without this flag,
  // the user is bounced to /dashboard before the success screen renders.
  const [paying, setPaying] = useState(false);

  const simulateParam = searchParams.get('simulate');
  // Self-context upsells (member upgrading around their own identity): WSFY ("who's searching") or
  // identity ("control what's exposed"). In these flows there's no searched person, so no person
  // vCard / report promo — the WSFY/identity teaser is the anchor.
  const upgradeReason = searchParams.get('reason');
  const isSelfContext = upgradeReason === 'wsfy' || upgradeReason === 'identity';
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

  // BC billing.sale hard-rejects names outside this charset/length (both
  // billingAddress and userInfo), answering with raw regex text (bug list 7/2
  // #5 — 'testmc#4' reached BC and the regex spew hit the UI). Enforce the
  // same rule client-side so the user gets a human message before the call.
  const BC_NAME_RE = /^[a-zA-Z0-9 '-]{2,50}$/;

  const validation = {
    cardNumber: cardDigits.length === expectedLen && luhnCheck(form.cardNumber),
    expiry: expiryValid,
    cvv: cardType === 'amex' ? form.cvv.length === 4 : form.cvv.length === 3,
    billingFirstName: form.billingFirstName.trim().length > 0,
    billingLastName: form.billingLastName.trim().length > 0,
    billingFirstNameChars: BC_NAME_RE.test(form.billingFirstName.trim()),
    billingLastNameChars: BC_NAME_RE.test(form.billingLastName.trim()),
    billingZip: /^\d{5}$/.test(form.billingZip.trim()),
  };

  // True once a sale attempt has failed — the next submit is a retry, on which we
  // rotate the BC clientId to dodge the signup velocity block (see below).
  const priorSaleFailedRef = useRef(false);

  // ── Abandoned-checkout trigger ──────────────────────────────────────────────
  // A signed-up user reaches this page with an email already captured (the SUP
  // signup created their account). Fire a `checkout_abandoned` signal when they
  // leave WITHOUT completing — the highest-intent recovery audience there is.
  // NB: this only fires the SIGNAL. The recovery email is sent DOWNSTREAM (a BC
  // abandoned-cart flow or an email platform listening for this event) — email
  // logic does not live in the SPA (architecture decision). No PII is pushed to
  // the dataLayer; BC already holds the user's email from signup.
  const successRef = useRef(false);
  const abandonFiredRef = useRef(false);
  useEffect(() => { successRef.current = success; }, [success]);
  useEffect(() => {
    const fireAbandon = () => {
      if (successRef.current || abandonFiredRef.current) return;
      abandonFiredRef.current = true;
      let hasTarget = false;
      let personId = null;
      let variant;
      let target;
      let recipientName;
      try { personId = sessionStorage.getItem('selectedPersonId'); hasTarget = !!personId; } catch { /* ignore */ }
      try { variant = sessionStorage.getItem('funnel.variant') || undefined; } catch { /* ignore */ }
      // Target person (name/age/location) for the recovery email, from the stashed result.
      try {
        if (personId) {
          const r = JSON.parse(sessionStorage.getItem(`result_${personId}`) || 'null');
          if (r) target = { name: r.fullName || undefined, age: r.ageRange || r.age || undefined, location: r.location || undefined };
        }
      } catch { /* ignore */ }
      // Recipient first name for the personalized subject line, from the signed-in user.
      try {
        const u = JSON.parse(localStorage.getItem('user') || 'null');
        if (u) recipientName = u.firstName || u.firstname || (u.name || '').trim().split(/\s+/)[0] || undefined;
      } catch { /* ignore */ }
      track('checkout_abandoned', { offer_key: SIGNUP_OFFER_KEY, has_target: hasTarget });
      gtmEvent('checkout_abandoned', { funnel_step: 'payment' });
      // Also POST to our growth backend (Vercel) so a recovery email can be sent. The
      // captured email + target/recipient go server-side only, never to the dataLayer.
      captureAbandonedCheckout({
        email: getCapturedEmail() || undefined,
        personId: personId || undefined,
        offer: SIGNUP_OFFER_KEY,
        variant,
        meta: { has_target: hasTarget, target, recipientName },
        ts: new Date().toISOString(),
      });
    };
    window.addEventListener('pagehide', fireAbandon);
    return () => { window.removeEventListener('pagehide', fireAbandon); fireAbandon(); };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!user) return;
    // Capture the submit click (true attempt intent). payment_start is page-view and
    // payment_complete/_error only fire once validation passes + the BC call runs — so
    // without this, every submit blocked by client-side validation is invisible. This +
    // the per-field validation_error below make the card-step drop-off measurable
    // (which field blocks, and clicks-vs-reached-BC).
    track('payment_submit', { offer_key: SIGNUP_OFFER_KEY });
    // Bug #37 (2026-05-29): mark touched on submit-fail so the red border
    // appears on the specific field that's missing/invalid. Banner error
    // still fires for clarity, but the visual cue points at the offender.
    if (!validation.billingFirstName) { track('validation_error', { reason: 'billing_first_name', step: 'payment' }); setError('Please enter your first name.'); setTouched(t => ({ ...t, billingFirstName: true })); return; }
    if (!validation.billingLastName) { track('validation_error', { reason: 'billing_last_name', step: 'payment' }); setError('Please enter your last name.'); setTouched(t => ({ ...t, billingLastName: true })); return; }
    if (!validation.billingFirstNameChars || !validation.billingLastNameChars) { track('validation_error', { reason: 'name_chars', step: 'payment' }); setError("Names must be at least 2 characters and can only contain letters, numbers, spaces, apostrophes (') and hyphens (-)."); setTouched(t => ({ ...t, billingFirstName: true, billingLastName: true })); return; }
    if (!validation.cardNumber) { track('validation_error', { reason: 'card_invalid', step: 'payment' }); setError('Please enter a valid card number.'); setTouched(t => ({ ...t, cardNumber: true })); return; }
    if (!validation.expiry) { track('validation_error', { reason: 'expiry_invalid', step: 'payment' }); setError('Please enter a valid expiration date (MM/YY, not in the past).'); setTouched(t => ({ ...t, expiry: true })); return; }
    if (!validation.cvv) { track('validation_error', { reason: 'cvv_invalid', step: 'payment' }); setError('Please enter a valid CVV.'); setTouched(t => ({ ...t, cvv: true })); return; }
    // Partner bug 17: copy previously said "we use your billing address on file"
    // even though it wasn't collected. ZIP is now explicitly required.
    if (!validation.billingZip) { track('validation_error', { reason: 'zip_invalid', step: 'payment' }); setError('Please enter a valid 5-digit ZIP code.'); setTouched(t => ({ ...t, billingZip: true })); return; }
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
        // Reflect BC's teaser-time thin-match signal ONLY when this purchase unlocks a
        // specific teaser report (selectedPersonId present). A general/promo signup (e.g.
        // the thin-match path, no target report) must send the all-false sequence BC's
        // canonical sale uses — otherwise BC rejects the sale with 406. This also stops a
        // stale sessionStorage thin flag from leaking into a normal purchase.
        sequenceOption: selectedPersonId ? readThinMatch() : { ...EMPTY_FLAGS },
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
        // Retry after a prior failed sale: rotate the BC clientId so BC's signup
        // velocity rules (declineDupSignup / declineTooManySignupAttempts) — which
        // key on the stable clientId in the billingId — don't block a legitimate
        // corrected-card retry. Live-confirmed root cause on davidtest-7-2 (order
        // …9416d7bc: corrected card still blocked by declineTooManySignupAttempts).
        // First attempt keeps the session clientId so normal purchases attribute.
        if (priorSaleFailedRef.current) {
          try {
            const { default: apiWrapper } = await import('../../services/apiWrapper');
            await apiWrapper.rotateClientId();
          } catch { /* non-fatal — proceed with the current clientId */ }
        }
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
      // Only clear the stashed signup secrets once the sale has actually gone
      // through. Clearing them unconditionally made every RETRY after a failed
      // first attempt go out passwordless (line ~298 re-reads _pendingPw → null),
      // so the second submit was malformed even with a corrected card — part of
      // the "correct info still fails" bug. Keep them for the retry; drop them on success.
      if (paymentSuccess) {
        // Email-only flow: reveal the auto-generated password on the confirmation
        // screen (before we wipe it). Only shown when it was system-generated.
        if (pendingPassword && sessionStorage.getItem('_pwAuto') === '1') {
          setConfirmedPassword(pendingPassword);
        }
        sessionStorage.removeItem('_pendingPw');
        sessionStorage.removeItem('_signupOptin');
        sessionStorage.removeItem('_pwAuto');
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
        // 20s and no provisioned order. If billing.sale itself reported an
        // error, the sale almost certainly failed — the changePassword
        // heuristic above marks paymentSuccess even when BC only created the
        // user account and rejected the charge (bug list 7/2 #7, incognito
        // 'submitted but couldn't confirm'). Throw the REAL sale error so the
        // classifier below shows the actual reason (decline/406/fields)
        // instead of an ambiguous confirmation message.
        if (saleError) throw saleError;
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
      setConfirmedOrderId(verifiedOrder?._id || verifiedOrder?.id || resolvedReportId || null);
      setSuccess(true);
      setSubscription?.(verifiedSubscription);
      // Store the cardholder's OWN name so WSFY can match this member against searches even if they
      // never map an identity (owner 2026-07-16 hierarchy: mapped > card > self-provided). This is
      // the member's real name — distinct from the search TARGET (selectedPerson).
      try { saveIdentityFormInfo({ cardName: `${form.billingFirstName.trim()} ${form.billingLastName.trim()}`.trim() }); } catch { /* best-effort */ }
      // Bug #38 (2026-05-29): the success screen is much shorter than the
      // payment form, so without this the user lands on the page footer.
      // Scroll to top so the confirmation is what they see.
      try { window.scrollTo({ top: 0, behavior: 'smooth' }); } catch { /* SSR / non-DOM */ }
      // Reflect the confirmation in the URL (/paymentconfirm) without unmounting this
      // screen — replaceState keeps the success state + conversion intact. The route is
      // registered in App.js so a reload/direct hit resolves (isPaid → dashboard).
      try { window.history.replaceState(null, '', '/paymentconfirm'); } catch { /* SSR / non-DOM */ }

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
      } else if (status === 406 || err?.data?.status === 'rejected' || /status code 406/i.test(rawMsg)) {
        // BC returns HTTP 406 with body {status:'rejected'} for a rejected sale.
        // Live-captured 2026-07-02: this covers BOTH a plain card decline (test
        // card 4111…) AND an ineligible-offer rejection — a prior FAILED attempt
        // still creates the BC user, after which the nonMemberOnly signup offer
        // rejects every retry for that email (root cause of "correct info still
        // fails", bug list 7/2 #6). The body can't tell them apart, so cover both
        // and DON'T tell the user to "wait" — waiting fixes neither.
        errorType = 'payment_rejected';
        message = "We couldn't complete your payment. Please double-check your card number, expiry, and CVV, or try a different card. If you've already started signing up with this email, sign in instead — or call 866-204-1902 and we'll finish setting you up.";
      } else if (/must match|regular expression/i.test(rawMsg)) {
        // BC field-validation echo — never show the raw regex text.
        errorType = 'invalid_fields';
        message = "Some of your details contain characters we can't accept. Names can only use letters, numbers, spaces, apostrophes (') and hyphens (-). Please check the name fields and try again.";
      } else if (status >= 500) {
        errorType = 'server_error';
        message = "We're having trouble processing payments right now. Please try again in a moment.";
      } else {
        // Fallback: only surface rawMsg when it reads like a human sentence —
        // raw axios/BC internals (status-code strings, regexes, field paths)
        // stay out of the UI.
        const looksTechnical = !rawMsg || rawMsg.length > 160 || /status code|must match|regular expression|\/\^|request failed|billings\.|userinfo\./i.test(rawMsg);
        message = looksTechnical
          ? "We couldn't complete your subscription. Please double-check your details and try again, or contact support if this keeps happening."
          : rawMsg;
      }
      // Mark that a sale attempt failed so the NEXT submit rotates the clientId.
      priorSaleFailedRef.current = true;
      track('payment_error', { errorType, errorMessage: err?.message, errorStatus: status });
      gtmEvent('payment_error', { error_type: errorType });
      setError(message);
    } finally {
      setLoading(false);
      setPaying(false);
    }
  };

  // Freshness signal — "latest report" dated 3 days before today (owner 2026-07-03).
  const latestReportDate = new Date(Date.now() - 3 * 86400000)
    .toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

  if (authLoading) return null;

  return (
    <main className={styles.main} style={theme ? { background: theme.pageBg, minHeight: '100vh' } : undefined}>
      {theme ? (
        <div style={{ margin: '-2.5rem -1rem 1.5rem' }}><ThemedFunnelHeader theme={theme} /></div>
      ) : (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', margin: '-2.5rem -1rem 1.5rem', padding: '0.75rem 1rem', fontSize: '0.85rem', background: '#0d5d2f', borderBottom: 'none' }}>
          {/* "Back to Results" only makes sense in a search→report flow; in the WSFY/identity flow
              there are no results to go back to (owner) — link back to where they came from. */}
          {isSelfContext ? (
            <Link to={upgradeReason === 'wsfy' ? '/who-is-searching' : '/my-identity'} style={{ color: 'rgba(255,255,255,0.85)', textDecoration: 'none' }}>← Back</Link>
          ) : (
            <Link to="/name/search-result" style={{ color: 'rgba(255,255,255,0.85)', textDecoration: 'none' }}>← Back to Results</Link>
          )}
          <span style={{ fontWeight: 700, color: '#ffffff' }}>🔒 {brand.name}</span>
        </div>
      )}
      {/* WSFY upsell hero — free member came from "Who's Searching For You". Reframes checkout
          around that payoff (the real count + obfuscated tease) above the standard content. */}
      {upgradeReason === 'wsfy' && !success && <WsfyPaymentTeaser />}
      {upgradeReason === 'identity' && !success && <IdentityPaymentTeaser />}

      {/* Person preview — ALWAYS on top, above the two-column layout, mobile or
          desktop (owner 2026-07-03). The person is the anchor, not the pricing. */}
      {/* Mobile-only: combine the vCard with the $1 trial rectangle into one card (owner) —
          vCard on TOP, then the trial price band, then instant-access footer. Lead with the
          person/value, then the price. The separate personPreview + pricing card are hidden on mobile. */}
      {selectedPerson && !success && !isSelfContext && (
        <div className={styles.mobilePriceVcard}>
          <div className={styles.mobileVcardBody}>
            <PersonAvatar person={selectedPerson} size={48} />
            <div className={styles.personPreviewInfo}>
              <p className={styles.personPreviewName}>{properCaseName(selectedPerson.fullName)}{(selectedPerson.age || selectedPerson.ageRange) ? `, ${selectedPerson.age || selectedPerson.ageRange}` : ''}</p>
              {(() => {
                const locs = (Array.isArray(selectedPerson.locations) && selectedPerson.locations.length) ? selectedPerson.locations : [selectedPerson.location].filter(Boolean);
                if (!locs.length) return null;
                const extra = Math.max(locs.length - 2, 0);
                return <p className={styles.personPreviewMeta}>{locs.slice(0, 2).join(' · ')}{extra > 0 ? ` +${extra} more` : ''}</p>;
              })()}
              <p className={styles.personPreviewLatest}>Latest report: {latestReportDate}</p>
            </div>
          </div>
          <div className={styles.summaryHeader} style={theme ? { background: theme.band } : undefined}>
            <p className={styles.summaryPlanName}>{brand.trialDays}-Day Trial</p>
            <p className={styles.summaryPrice}>{trialPriceStr}<span className={styles.summaryPer}> today</span></p>
          </div>
          <p className={styles.summaryInstant} style={theme ? { background: theme.onDark ? 'rgba(245,158,11,0.12)' : '#e6f3fa', color: theme.accentDark } : undefined}>⚡ Instant access after payment</p>
        </div>
      )}
      {selectedPerson && !success && !isSelfContext && (
        <div className={styles.personPreview}>
          <div className={styles.personPreviewLeft}>
            <PersonAvatar person={selectedPerson} size={48} />
            <div className={styles.personPreviewInfo}>
              <p className={styles.personPreviewName}>
                {properCaseName(selectedPerson.fullName)}{(selectedPerson.age || selectedPerson.ageRange) ? `, ${selectedPerson.age || selectedPerson.ageRange}` : ''}
              </p>
              {(() => {
                const locs = (Array.isArray(selectedPerson.locations) && selectedPerson.locations.length)
                  ? selectedPerson.locations
                  : [selectedPerson.location].filter(Boolean);
                if (!locs.length) return null;
                const extra = Math.max(locs.length - 2, 0);
                return (
                  <p className={styles.personPreviewMeta}>
                    {locs.slice(0, 2).join(' · ')}{extra > 0 ? ` +${extra} more` : ''}
                  </p>
                );
              })()}
              <p className={styles.personPreviewLatest}>Latest report: {latestReportDate}</p>
            </div>
          </div>
        </div>
      )}

      {/* Flow-appropriate record teaser for the target. FLOW-GATED (not just data-gated) so each vertical
          reinforces its own intent at payment: inmate→booking, divorce→marriage/divorce, dating→safety check.
          A person can have booking records regardless of why they were searched, so gating on data presence
          alone leaked incarceration into the divorce/dating funnels (owner 2026-07-19). Each teaser also
          self-gates to nothing when the target has no matching record. */}
      {selectedPerson && !success && !isSelfContext && (() => {
        const flow = getFlow();
        const parts = String(selectedPerson.fullName || '').trim().split(/\s+/).filter(Boolean);
        const loc = Array.isArray(selectedPerson.locations) ? selectedPerson.locations[0] : selectedPerson.location;
        const st = (String(loc || '').match(/,\s*([A-Za-z]{2})\b/) || [])[1] || '';
        if (parts.length < 2) return null;
        const first = parts[0];
        const last = parts[parts.length - 1];
        const pAge = selectedPerson.age || selectedPerson.ageRange;
        const pGender = selectedPerson.gender;
        // Unified engine teaser (specific person at payment → strict). Handles every flow incl. general.
        const teaser = <SignalTeaser subject={{ firstName: first, lastName: last, state: st, age: pAge, gender: pGender }} flow={flow || 'general'} viewerRelation="prospect" stage="pre-signup" strict accent="#0d5d2f" dark="#0a4a25" />;
        return (
          <div style={{ maxWidth: 960, margin: '0 auto 1.25rem' }}>{teaser}</div>
        );
      })()}

      <div className={styles.layout}>

        {/* ── Left: Form ───────────────────────────────────────── */}
        <div className={styles.formCol}>

          {/* General promotional teaser — shown when there's no target report (e.g. a
              thin-match signup). Suppressed in the WSFY flow, where the WSFY teaser is the anchor
              (vCards/report promos only make sense when searching someone else — owner 2026-07-14). */}
          {!selectedPersonId && !success && !isSelfContext && (
            <div style={{
              background: theme ? (theme.onDark ? 'linear-gradient(135deg, #1e293b 0%, #334155 100%)' : 'linear-gradient(135deg, #055a86 0%, #007cc2 100%)') : 'linear-gradient(135deg, #0d5d2f 0%, #16a34a 100%)',
              color: '#fff', borderRadius: '0.75rem', padding: '1.25rem 1.5rem', marginBottom: '1.25rem',
            }}>
              <div style={{ fontSize: '0.72rem', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: theme ? 'rgba(255,255,255,0.85)' : '#bbf7d0' }}>
                {brand.name} Membership
              </div>
              <h2 style={{ margin: '0.25rem 0 0.4rem', fontSize: '1.3rem', fontWeight: 800, color: '#fff' }}>
                Unlock unlimited people searches &amp; full reports
              </h2>
              <p style={{ margin: 0, fontSize: '0.9rem', color: theme ? 'rgba(255,255,255,0.9)' : '#dcfce7', lineHeight: 1.5 }}>
                Contact info, addresses, relatives, and more — search as many people as you want and pull
                up to 5 full reports a day.
              </p>
            </div>
          )}

          {success ? (
            <div className={styles.successBox}>
              <div className={styles.successIcon} style={theme ? { background: theme.band } : undefined}>✓</div>
              <h2 className={styles.successTitle} style={theme ? { color: theme.accentDark } : undefined}>You're in!</h2>
              <p className={styles.successText}>
                Your {brand.name} Basic membership is now active. A receipt is on its way to <strong>{user?.email}</strong>.
              </p>

              {/* Payment confirmation — amount charged today + order id for the customer's records */}
              <div style={{
                margin: '1rem auto 0', maxWidth: 380,
                background: theme ? (theme.onDark ? 'rgba(245,158,11,0.1)' : '#e6f3fa') : '#f0fdf4',
                border: `1px solid ${theme ? (theme.onDark ? 'rgba(245,158,11,0.3)' : '#cfe6f2') : '#bbf7d0'}`, borderRadius: '0.5rem',
                padding: '0.75rem 1rem', fontSize: '0.9rem', color: theme ? theme.accentDark : '#166534', textAlign: 'left',
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem' }}>
                  <span>Amount paid today</span>
                  <strong>{trialPriceStr}</strong>
                </div>
                {confirmedOrderId && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', marginTop: '0.4rem', alignItems: 'baseline' }}>
                    <span>Order ID</span>
                    <strong style={{ fontFamily: 'monospace', fontSize: '0.82rem', wordBreak: 'break-all', textAlign: 'right' }}>{confirmedOrderId}</strong>
                  </div>
                )}
              </div>

              {/* Email-only signup: reveal the auto-generated login details so the
                  customer can sign in again later. They're signed in now (token in
                  localStorage), so this is a save-it-for-later backup. */}
              {confirmedPassword && (
                <div style={{
                  margin: '1rem auto 0', maxWidth: 380, textAlign: 'left',
                  background: '#fffbeb', border: '1px solid #fde68a', borderRadius: '0.5rem', padding: '0.85rem 1rem',
                }}>
                  <p style={{ margin: '0 0 0.6rem', fontWeight: 700, color: '#92400e', fontSize: '0.9rem' }}>🔑 Save your login details</p>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', fontSize: '0.88rem', marginBottom: '0.3rem' }}>
                    <span style={{ color: '#78716c' }}>Email</span>
                    <strong style={{ wordBreak: 'break-all', textAlign: 'right' }}>{user?.email}</strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', fontSize: '0.88rem', alignItems: 'center' }}>
                    <span style={{ color: '#78716c' }}>Password</span>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}>
                      <strong style={{ fontFamily: 'monospace', letterSpacing: '0.03em' }}>{confirmedPassword}</strong>
                      <button type="button" onClick={() => { try { navigator.clipboard?.writeText(confirmedPassword); } catch { /* clipboard unavailable */ } }}
                        style={{ border: '1px solid #fcd34d', background: '#fff', borderRadius: '0.35rem', padding: '0.15rem 0.45rem', fontSize: '0.72rem', fontWeight: 600, color: '#92400e', cursor: 'pointer' }}>
                        Copy
                      </button>
                    </span>
                  </div>
                  <p style={{ margin: '0.6rem 0 0', fontSize: '0.78rem', color: '#78716c' }}>
                    You&apos;re signed in now — keep these to sign in again later. You can change your password anytime in <Link to="/account" style={{ color: '#92400e', fontWeight: 600 }}>Account settings</Link>.
                  </p>
                </div>
              )}

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
                      background: theme ? theme.button : '#0d5d2f', color: '#fff', border: 'none',
                      padding: '0.9rem 1.25rem', borderRadius: '0.5rem',
                      fontSize: '1rem', fontWeight: 600, cursor: 'pointer',
                      boxShadow: theme ? '0 2px 4px rgba(0,0,0,0.2)' : '0 2px 4px rgba(13,93,47,0.2)',
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
                    background: theme && theme.onDark ? 'transparent' : '#fff', color: theme ? theme.accent : '#0d5d2f',
                    border: `2px solid ${theme ? theme.accent : '#0d5d2f'}`,
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
                    color: theme ? theme.accent : '#0d5d2f', fontWeight: 600, cursor: 'pointer',
                    textDecoration: 'underline',
                  }}
                >Account Settings</button>.
              </p>
            </div>
          ) : (
            <>
              <div className={styles.formCard}>
                <h2 className={styles.formCardTitle}>Secure Checkout</h2>

                <form id="payForm" onSubmit={handleSubmit} noValidate>
                  {/* Cardholder name — always visible; used as userInfo.firstName/lastName for BC */}
                  <div className={styles.fieldRow}>
                    <div className={styles.fieldGroup}>
                      <label className={styles.label} htmlFor="pay-bfirst">First Name</label>
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
                      <label className={styles.label} htmlFor="pay-blast">Last Name</label>
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

                  {/* ZIP — a normal field, right below Expiry/CVV. No billing-address
                      dropdown, no street capture (owner 2026-07-03). */}
                  <div className={styles.fieldGroup}>
                    <label className={styles.label} htmlFor="pay-zip">Billing ZIP Code</label>
                    <div className={styles.inputWrap}>
                      <input
                        id="pay-zip"
                        type="text"
                        name="billingZip"
                        value={form.billingZip}
                        onChange={handleChange}
                        onBlur={handleBlur}
                        required
                        placeholder="12345"
                        inputMode="numeric"
                        autoComplete="billing postal-code"
                        maxLength="5"
                        className={`${styles.input} ${touched.billingZip && !validation.billingZip ? styles.inputError : ''} ${touched.billingZip && validation.billingZip ? styles.inputValid : ''}`}
                      />
                      {touched.billingZip && (
                        <span className={styles.fieldIndicator}>{validation.billingZip ? '✓' : '✗'}</span>
                      )}
                    </div>
                    {touched.billingZip && !validation.billingZip && (
                      <p className={styles.fieldErrMsg}>Enter a valid 5-digit ZIP</p>
                    )}
                  </div>

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
                      the terms prior to authorizing the charge. */}
                  <div className={styles.termsBlock}>
                    <p className={styles.termsHeading}>
                      <strong>*Terms of Use and Pricing Information</strong>
                    </p>
                    {/* shN optout flag toggles ONLY the consent checkbox + the SUP
                        pricing disclosure below. The heading above and the FCRA note
                        below always show. Hidden when campaign.optOut === false. */}
                    {requireTermsCheckbox && (
                    <label className={styles.termsLabel}>
                      <input
                        type="checkbox"
                        className={styles.termsCheckbox}
                        checked={agreeTerms}
                        onChange={(e) => setAgreeTerms(e.target.checked)}
                      />
                      <span className={styles.termsBody}>
                        By clicking the button below, you agree to {brand.name}'s{' '}
                        <Link to="/terms" target="_blank" rel="noopener noreferrer">Terms of Use</Link>,{' '}
                        <Link to="/privacy" target="_blank" rel="noopener noreferrer">Privacy Policy</Link> and you authorize {brand.name} to
                        charge your card {trialPriceStr} today for your report.
                        With your report, you get an Unlimited Search trial account for a full{' '}
                        {brand.trialDays} Days. With Unlimited Search, you can
                        search for as many reports as you want, and view and access up to 5 reports
                        per day! If you cancel your trial before {trialEndDate},
                        there will be no further charges. If you like what you see and wish to
                        search more reports on friends, relatives or anybody else in your life,
                        simply do nothing and we will automatically start your Unlimited Search
                        subscription and charge your card just {recurringPriceStr} at
                        the end of the trial period and every 30 Days thereafter until you cancel.
                        You may cancel at any time with our <strong>100% hassle free cancellation. Just call
                        us at {brand.supportPhone}</strong> or{' '}
                        <Link to="/contact" target="_blank" rel="noopener noreferrer">visit our contact form</Link> anytime, 24 hours a day,
                        7 days a week.
                      </span>
                    </label>
                    )}
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

                  {/* CTA */}
                  <button
                    type="submit"
                    disabled={loading || (requireTermsCheckbox && !agreeTerms)}
                    className={styles.submitBtn}
                    style={theme ? { background: theme.button } : undefined}
                  >
                    {loading ? (
                      <span className={styles.submitSpinner}>
                        <span className={styles.spinner} /> Processing…
                      </span>
                    ) : (
                      // Bug #35: compliance-led CTA directly above the SUP/terms
                      // disclosure — the button text states the agreement. When there's no
                      // target report (general/promo signup), it just continues to the dashboard.
                      (selectedPersonId ? 'I Agree, Unlock Report Now' : 'I Agree, Continue')
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
          <>
            {/* (a) Pricing / today's charge — 7-Day Trial $1 + instant + then-$49 */}
            <div className={`${styles.summaryCard} ${styles.gridPricing}`}>
              <div className={styles.summaryHeader} style={theme ? { background: theme.band } : undefined}>
                <p className={styles.summaryPlanName}>{brand.trialDays}-Day Trial</p>
                <p className={styles.summaryPrice}>{trialPriceStr}<span className={styles.summaryPer}> today</span></p>
              </div>
              <p className={styles.summaryInstant} style={theme ? { background: theme.onDark ? 'rgba(245,158,11,0.12)' : '#e6f3fa', color: theme.accentDark } : undefined}>⚡ Instant access after payment</p>
            </div>

            {/* (b) Benefits — header + checklist */}
            <div className={`${styles.summaryCard} ${styles.gridBenefits}`}>
              <p className={styles.benefitsTitle}>Benefits</p>
              <ul className={styles.featureList}>
                {PLAN_FEATURES.map((f, i) => (
                  <li key={i} className={styles.featureItem}>
                    <span className={styles.featureCheck} style={theme ? { color: theme.accent } : undefined}>✓</span>
                    {f}
                  </li>
                ))}
              </ul>
            </div>

            {/* Why people trust us */}
            <div className={`${styles.summaryTrustCard} ${styles.gridTrust}`}>
              <p className={styles.summaryTrustTitle}>Why people trust us</p>
              <p className={styles.summaryTrustItem}>🔒 Your data is never sold or shared</p>
              <p className={styles.summaryTrustItem}>⭐ Trusted by 3M+ members</p>
              <p className={styles.summaryTrustItem}>📞 Live support available</p>
            </div>
          </>
        )}
      </div>
      {/* Mobile-only scroll-locked CTA bar (owner) — submits the payment form. */}
      {!success && (
        <div className={styles.mobileCtaBar}>
          <button
            type="submit"
            form="payForm"
            disabled={loading || (requireTermsCheckbox && !agreeTerms)}
            className={styles.mobileCtaBtn}
          >
            {loading ? 'Processing…' : (selectedPersonId ? 'I Agree, Unlock Report Now' : 'I Agree, Continue')}
          </button>
        </div>
      )}
    </main>
  );
};

export default PaymentPage;
