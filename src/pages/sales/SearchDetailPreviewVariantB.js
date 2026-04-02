import React, { useCallback, useRef, useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import api from '../../api';
import { createReportForIdentity } from '../../services/reportService';
import { track } from '../../services/trackingService';
import { validatePassword } from '../../hooks/useSignup';
import styles from './SearchDetailPreviewPage.module.css';

// ── Card utilities ────────────────────────────────────────────────────────────

function detectCardType(pan) {
  const n = (pan || '').replace(/\s/g, '');
  if (/^4/.test(n)) return 'visa';
  if (/^5[1-5]/.test(n) || /^2[2-7]/.test(n)) return 'mastercard';
  if (/^3[47]/.test(n)) return 'amex';
  if (/^6(?:011|5)/.test(n)) return 'discover';
  return null;
}

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

function formatExpiry(value) {
  const digits = value.replace(/\D/g, '').slice(0, 4);
  if (digits.length >= 3) return `${digits.slice(0, 2)}/${digits.slice(2)}`;
  return digits;
}

function parseExpiry(expiry) {
  const match = String(expiry || '').match(/^(\d{1,2})\s*\/\s*(\d{2,4})$/);
  if (!match) return { expMonth: '', expYear: '' };
  let [, month, year] = match;
  if (year.length === 2) year = `20${year}`;
  return { expMonth: month.padStart(2, '0'), expYear: year.slice(-2) };
}

function luhnCheck(pan) {
  const digits = pan.replace(/\s/g, '');
  if (!/^\d+$/.test(digits)) return false;
  let sum = 0, alt = false;
  for (let i = digits.length - 1; i >= 0; i--) {
    let n = parseInt(digits[i], 10);
    if (alt) { n *= 2; if (n > 9) n -= 9; }
    sum += n;
    alt = !alt;
  }
  return sum % 10 === 0;
}

function encodePw(pw) {
  try { return btoa(unescape(encodeURIComponent(pw))); } catch { return btoa(pw); }
}

const PLAN_FEATURES = [
  'Unlimited background report access',
  'Reverse phone & email lookups',
  'Address history & current location',
  'Criminal & court record checks',
  'Relatives & family connections',
  'Cancel anytime — no lock-in',
];

// ── Component ─────────────────────────────────────────────────────────────────

/**
 * Variant B — VCard + combined account creation + payment on one page.
 * Visitor fills email, password, and card details in a single form.
 * On submit: signup → billing.sale → create report → navigate.
 *
 * Props: person (object), id (string)
 *
 * IMPORTANT: form inputs are inside this top-level component's render — not
 * inside a sub-component defined in render — so React never remounts inputs.
 */
const SearchDetailPreviewVariantB = ({ person, id }) => {
  const navigate = useNavigate();
  const { setToken, setUser, setSubscription } = useAuth();

  // Account fields
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  // Card fields
  const [cardNumber, setCardNumber] = useState('');
  const [expiry, setExpiry] = useState('');
  const [cvv, setCvv] = useState('');
  const [billingFirstName, setBillingFirstName] = useState('');
  const [billingLastName, setBillingLastName] = useState('');

  const [cardTouched, setCardTouched] = useState({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const navTimeoutRef = useRef(null);
  useEffect(() => {
    return () => { if (navTimeoutRef.current) clearTimeout(navTimeoutRef.current); };
  }, []);

  const cardType = detectCardType(cardNumber);
  const cardDigits = cardNumber.replace(/\s/g, '');
  const expectedLen = cardType === 'amex' ? 15 : 16;
  const cardValid = cardDigits.length === expectedLen && luhnCheck(cardNumber);
  const expiryValid = /^\d{2}\/\d{2}$/.test(expiry);
  const cvvValid = cardType === 'amex' ? cvv.length === 4 : cvv.length === 3;

  const handleCardChange = useCallback((e) => {
    const { name, value } = e.target;
    if (name === 'cardNumber') {
      const ct = detectCardType(value);
      setCardNumber(formatCardNumber(value, ct));
    } else if (name === 'expiry') {
      setExpiry(formatExpiry(value));
    } else if (name === 'cvv') {
      const maxLen = detectCardType(cardNumber) === 'amex' ? 4 : 3;
      setCvv(value.replace(/\D/g, '').slice(0, maxLen));
    }
  }, [cardNumber]);

  const handleCardBlur = useCallback((e) => {
    setCardTouched(prev => ({ ...prev, [e.target.name]: true }));
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    const pwError = validatePassword(password);
    if (pwError) { setError(pwError); return; }
    if (!billingFirstName.trim()) { setError('Please enter your first name.'); return; }
    if (!billingLastName.trim()) { setError('Please enter your last name.'); return; }
    setLoading(true);
    try {
      // Step 1: Signup
      const signupRes = await api.signup({ email, password, optin: true });
      if (signupRes.accessToken) {
        const userData = signupRes.user || { email, role: 'member', emailVerified: false };
        setToken(signupRes.accessToken);
        setUser(userData);
        localStorage.setItem('accessToken', signupRes.accessToken);
        localStorage.setItem('user', JSON.stringify(userData));
        if (signupRes.refreshToken) localStorage.setItem('refreshToken', signupRes.refreshToken);
      }
      // Store pending password for post-sale changePassword
      sessionStorage.setItem('_pendingPw', encodePw(password));
      sessionStorage.setItem('_signupOptin', '1');
      if (id) sessionStorage.setItem('selectedPersonId', id);

      // Step 2: Billing sale
      const { expMonth, expYear } = parseExpiry(expiry);
      const saleParams = {
        userInfo: {
          email,
          firstName: billingFirstName.trim(),
          lastName: billingLastName.trim(),
          optin: true,
          password,
        },
        billings: [{
          billingType: 'creditCard',
          creditCard: {
            pan: cardNumber.replace(/\s/g, ''),
            expYear: expYear || '30',
            expMonth: expMonth || '12',
            cvv: cvv || '123',
          },
          billingAddress: {
            firstName: billingFirstName.trim(),
            lastName: billingLastName.trim(),
            street1: '123 main',
            zip: '10001',
            bogusFields: {
              firstName: false, lastName: false, street1: true,
              street2: true, city: true, state: true, zip: false, country: true,
            },
          },
        }],
        commerceOfferKeys: [{ key: 'comp.offer.signup.main', target: 'main', options: {} }],
        sequenceOption: {
          thinMatch: false, thinMatchDataProviderDown: false,
          thinMatchTooManyResults: false, thinMatchNoResults: false, thinMatchGeographic: false,
        },
      };

      const saleResult = await api.billingSale(saleParams);
      const rawData = saleResult?.getData?.() ?? saleResult?.params?.response?.data ?? saleResult?.data ?? saleResult ?? {};
      if (rawData?.accessToken) {
        setToken(rawData.accessToken);
        setUser(rawData.user || { email });
        localStorage.setItem('accessToken', rawData.accessToken);
        if (rawData.refreshToken) localStorage.setItem('refreshToken', rawData.refreshToken);
      }

      // Step 3: Set password via changePassword after billing.sale establishes BC session
      const rawPw = sessionStorage.getItem('_pendingPw');
      sessionStorage.removeItem('_pendingPw');
      sessionStorage.removeItem('_signupOptin');
      if (rawPw) {
        try {
          let pw;
          try { pw = decodeURIComponent(escape(atob(rawPw))); } catch { pw = rawPw; }
          const { default: apiWrapper } = await import('../../services/apiWrapper');
          const w = await apiWrapper.getWrapper();
          if (typeof w.api?.user?.changePassword === 'function') {
            await w.api.user.changePassword(pw);
          }
        } catch (pwErr) {
          if (process.env.NODE_ENV === 'development') {
            console.warn('[VariantB] changePassword failed (non-fatal):', pwErr?.message);
          }
        }
      }

      // Step 4: Set subscription so isPaid=true before navigation
      setSubscription?.({ status: 'active', plan: 'comp.offer.signup.main' });

      setSuccess(true);
      track('payment_complete', { plan: 'pro', source: 'variant_b' });
      sessionStorage.removeItem('selectedPersonId');

      // Step 5: Create report and navigate
      if (person?.extId) {
        try {
          const reportResult = await createReportForIdentity(person.extId, person);
          if (reportResult.success && reportResult.commerceContentId) {
            navTimeoutRef.current = setTimeout(() => navigate(`/people/${reportResult.commerceContentId}`), 2000);
            return;
          }
        } catch {
          // Fall through to dashboard
        }
      }
      navTimeoutRef.current = setTimeout(() => navigate('/dashboard'), 2000);
    } catch (err) {
      const isAlreadyExists = err?.code === 'USER_ALREADY_EXISTS';
      const isUnauthorized = err?.status === 401;
      const message = isAlreadyExists
        ? 'An account with this email already exists. Please log in instead.'
        : isUnauthorized
        ? 'Authorization failed. Please try again.'
        : (err?.data?.error?.message || err?.message || 'An error occurred. Please try again.');
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  const initials = (person.fullName || '?')
    .split(/\s+/).slice(0, 2).map(n => n[0]).join('').toUpperCase() || '?';

  // Input style for payment fields (light background)
  const payInput = {
    width: '100%', padding: '0.75rem 0.875rem', fontSize: '0.95rem',
    border: '1px solid #d1d5db', borderRadius: '0.375rem', boxSizing: 'border-box',
    fontFamily: 'inherit', outline: 'none', background: '#fff',
  };

  return (
    <main className={styles.main} data-no-nav="true">
      {/* ── Mini header ── */}
      <div className={styles.miniHeader}>
        <Link to="/name/search-result" className={styles.miniHeaderBack}>← Back to Results</Link>
        <span className={styles.miniHeaderBrand}>🔒 IDLookup.ai</span>
      </div>

      {/* ── VCard ── */}
      <div style={{
        background: '#ffffff', border: '1px solid #e5e7eb', borderRadius: '0.875rem',
        padding: '1.5rem', margin: '1.25rem 1rem 1rem',
        boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1rem' }}>
          <div style={{
            width: '56px', height: '56px', borderRadius: '50%', flexShrink: 0,
            background: 'linear-gradient(135deg, #0d5d2f 0%, #1a7a42 100%)',
            color: '#ffffff', display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '1.25rem', fontWeight: 700,
          }}>
            {initials}
          </div>
          <div>
            <h2 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 700, color: '#111827' }}>
              {person.fullName}
            </h2>
            {(person.ageRange || person.location) && (
              <p style={{ margin: '0.25rem 0 0', fontSize: '0.875rem', color: '#6b7280' }}>
                {person.ageRange ? `Age ${person.ageRange}` : ''}
                {person.ageRange && person.location ? ' · ' : ''}
                {person.location || ''}
              </p>
            )}
          </div>
          <div style={{ marginLeft: 'auto', fontSize: '0.75rem', color: '#6b7280', textAlign: 'right', flexShrink: 0 }}>
            <div style={{ color: '#065f46', fontWeight: 600, fontSize: '0.78rem' }}>✓ In database</div>
            <div>Full report locked</div>
          </div>
        </div>
        <div style={{
          display: 'flex', gap: '0.5rem', flexWrap: 'wrap',
          fontSize: '0.78rem', color: '#374151',
        }}>
          {['📞 Phone numbers', '✉️ Emails', '🏠 Addresses', '👥 Relatives', '⚠️ Records'].map(tag => (
            <span key={tag} style={{
              background: '#f3f4f6', border: '1px solid #e5e7eb',
              borderRadius: '999px', padding: '0.25rem 0.65rem',
            }}>
              🔒 {tag}
            </span>
          ))}
        </div>
      </div>

      {/* ── Combined signup + payment form ── */}
      {success ? (
        <div style={{
          margin: '0 1rem 1rem', padding: '2rem', background: '#f0fdf4',
          border: '1px solid #bbf7d0', borderRadius: '0.875rem', textAlign: 'center',
        }}>
          <div style={{ fontSize: '2.5rem', marginBottom: '0.75rem' }}>✓</div>
          <h2 style={{ margin: '0 0 0.5rem', fontSize: '1.25rem', fontWeight: 700, color: '#065f46' }}>
            Payment Successful!
          </h2>
          <p style={{ margin: 0, color: '#374151', fontSize: '0.95rem' }}>
            Your membership is now active.{' '}
            {person ? `Preparing your report for ${person.fullName}…` : 'Redirecting to your dashboard…'}
          </p>
        </div>
      ) : (
        <div style={{
          background: '#ffffff', border: '1px solid #e5e7eb', borderRadius: '0.875rem',
          padding: '1.5rem', margin: '0 1rem 1rem',
          boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
        }}>
          <h2 style={{ margin: '0 0 0.25rem', fontSize: '1.2rem', fontWeight: 700, color: '#111827' }}>
            Unlock {person.fullName}'s Full Report
          </h2>
          <p style={{ margin: '0 0 1.5rem', fontSize: '0.875rem', color: '#6b7280' }}>
            Create your account and subscribe to get instant access.
          </p>

          <form onSubmit={handleSubmit} noValidate>
            {/* Section 1: Account */}
            <div style={{
              background: '#f8fafc', border: '1px solid #e5e7eb', borderRadius: '0.625rem',
              padding: '1rem 1.125rem', marginBottom: '1rem',
            }}>
              <p style={{ margin: '0 0 0.875rem', fontSize: '0.8rem', fontWeight: 700, color: '#374151', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Step 1 — Create Your Account
              </p>
              <div style={{ marginBottom: '0.75rem' }}>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: '#374151', marginBottom: '0.35rem' }}
                  htmlFor="vb-email">Email address</label>
                <input
                  id="vb-email" type="email" name="email" value={email}
                  onChange={e => setEmail(e.target.value)}
                  style={payInput} placeholder="you@email.com" required autoComplete="email"
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: '#374151', marginBottom: '0.35rem' }}
                  htmlFor="vb-password">Create a password</label>
                <input
                  id="vb-password" type="password" name="password" value={password}
                  onChange={e => setPassword(e.target.value)}
                  style={payInput} placeholder="Min. 8 characters" required minLength={8} autoComplete="new-password"
                />
              </div>
            </div>

            {/* Section 2: Payment */}
            <div style={{
              background: '#f8fafc', border: '1px solid #e5e7eb', borderRadius: '0.625rem',
              padding: '1rem 1.125rem', marginBottom: '1rem',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.875rem' }}>
                <p style={{ margin: 0, fontSize: '0.8rem', fontWeight: 700, color: '#374151', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Step 2 — Payment
                </p>
                <span style={{ fontSize: '0.85rem', fontWeight: 700, color: '#0d5d2f' }}>$29.99/mo</span>
              </div>

              {/* Name row */}
              <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '0.75rem' }}>
                <div style={{ flex: 1 }}>
                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: '#374151', marginBottom: '0.35rem' }}
                    htmlFor="vb-bfirst">First Name *</label>
                  <input
                    id="vb-bfirst" type="text" name="billingFirstName" value={billingFirstName}
                    onChange={e => setBillingFirstName(e.target.value)}
                    style={payInput} placeholder="First" required autoComplete="given-name"
                  />
                </div>
                <div style={{ flex: 1 }}>
                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: '#374151', marginBottom: '0.35rem' }}
                    htmlFor="vb-blast">Last Name *</label>
                  <input
                    id="vb-blast" type="text" name="billingLastName" value={billingLastName}
                    onChange={e => setBillingLastName(e.target.value)}
                    style={payInput} placeholder="Last" required autoComplete="family-name"
                  />
                </div>
              </div>

              {/* Card number */}
              <div style={{ marginBottom: '0.75rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.35rem' }}>
                  <label style={{ fontSize: '0.85rem', fontWeight: 600, color: '#374151' }} htmlFor="vb-card">Card Number</label>
                  {cardType && (
                    <span style={{
                      background: { visa: '#1a1f71', mastercard: '#eb001b', amex: '#2e77bc', discover: '#ff6600' }[cardType],
                      color: '#fff', fontSize: '0.7rem', fontWeight: 700,
                      padding: '0.15rem 0.5rem', borderRadius: '3px',
                    }}>
                      {cardType.toUpperCase()}
                    </span>
                  )}
                </div>
                <input
                  id="vb-card" type="text" name="cardNumber" value={cardNumber}
                  onChange={handleCardChange} onBlur={handleCardBlur}
                  style={{ ...payInput, borderColor: cardTouched.cardNumber ? (cardValid ? '#16a34a' : '#dc2626') : '#d1d5db' }}
                  placeholder="1234 5678 9012 3456" inputMode="numeric" autoComplete="cc-number" required
                />
              </div>

              {/* Expiry + CVV */}
              <div style={{ display: 'flex', gap: '0.75rem' }}>
                <div style={{ flex: 1 }}>
                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: '#374151', marginBottom: '0.35rem' }}
                    htmlFor="vb-expiry">Expiry</label>
                  <input
                    id="vb-expiry" type="text" name="expiry" value={expiry}
                    onChange={handleCardChange} onBlur={handleCardBlur}
                    style={{ ...payInput, borderColor: cardTouched.expiry ? (expiryValid ? '#16a34a' : '#dc2626') : '#d1d5db' }}
                    placeholder="MM/YY" inputMode="numeric" maxLength="5" autoComplete="cc-exp" required
                  />
                </div>
                <div style={{ flex: 1 }}>
                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: '#374151', marginBottom: '0.35rem' }}
                    htmlFor="vb-cvv">CVV</label>
                  <input
                    id="vb-cvv" type="text" name="cvv" value={cvv}
                    onChange={handleCardChange} onBlur={handleCardBlur}
                    style={{ ...payInput, borderColor: cardTouched.cvv ? (cvvValid ? '#16a34a' : '#dc2626') : '#d1d5db' }}
                    placeholder={cardType === 'amex' ? '1234' : '123'}
                    inputMode="numeric" autoComplete="cc-csc" required
                  />
                </div>
              </div>
            </div>

            {/* Plan mini-summary */}
            <div style={{
              background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '0.625rem',
              padding: '0.875rem 1rem', marginBottom: '1rem',
              fontSize: '0.82rem', color: '#166534',
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                <strong>Basic Plan</strong>
                <strong>$29.99/mo</strong>
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem' }}>
                {PLAN_FEATURES.map((f, i) => (
                  <span key={i} style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', minWidth: '45%' }}>
                    <span style={{ color: '#16a34a' }}>✓</span> {f}
                  </span>
                ))}
              </div>
            </div>

            {/* Error */}
            {error && (
              <div style={{
                padding: '0.875rem 1rem', background: '#fef2f2', border: '1px solid #fecaca',
                borderRadius: '0.5rem', marginBottom: '1rem', fontSize: '0.875rem', color: '#991b1b',
              }}>
                <strong>Error:</strong> {error}
                {error.includes('already exists') && (
                  <span> <Link to="/login" style={{ color: '#0d5d2f', fontWeight: 600 }}>Log in</Link></span>
                )}
              </div>
            )}

            {/* Submit */}
            <button
              type="submit"
              disabled={loading}
              style={{
                width: '100%', padding: '1rem 1.5rem',
                background: loading ? '#6b7280' : '#f59e0b',
                color: loading ? '#fff' : '#1c1c1c',
                border: 'none', borderRadius: '0.5rem',
                fontSize: '1rem', fontWeight: 700, cursor: loading ? 'wait' : 'pointer',
                letterSpacing: '0.01em', transition: 'background 0.15s ease',
                boxShadow: '0 2px 8px rgba(245, 158, 11, 0.35)',
              }}
            >
              {loading ? 'Processing…' : `Create Account & Unlock — $29.99/mo`}
            </button>

            <p style={{ textAlign: 'center', fontSize: '0.78rem', color: '#9ca3af', margin: '0.6rem 0 0' }}>
              No lock-in. Cancel anytime from your account settings.
            </p>
            <p style={{ textAlign: 'center', fontSize: '0.75rem', color: '#9ca3af', margin: '0.4rem 0 0' }}>
              Already have an account?{' '}
              <Link to="/login" style={{ color: '#0d5d2f', fontWeight: 600 }}>Sign in</Link>
            </p>
          </form>

          {/* Trust row */}
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            gap: '1rem', marginTop: '1.25rem', flexWrap: 'wrap',
            fontSize: '0.75rem', color: '#9ca3af', fontWeight: 500,
          }}>
            <span>🔒 256-bit SSL</span>
            <span>✓ PCI Compliant</span>
            <span>FCRA-Compliant</span>
          </div>
        </div>
      )}
    </main>
  );
};

export default SearchDetailPreviewVariantB;
