import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import api from '../../api';
import { createReportForIdentity } from '../../services/reportService';
import styles from './PaymentPage.module.css';

const TRUST_BADGES = [
  { label: 'Secure Payment', icon: '🔒' },
  { label: 'SSL Encrypted', icon: '🔐' },
  { label: 'PCI Compliant', icon: '✓' },
];

/**
 * Payment capture page shown after signup.
 * Collects payment details and subscribes the user to a plan.
 */
const PaymentPage = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { token } = useAuth();
  const [form, setForm] = useState({ cardNumber: '', expiry: '', cvv: '', billingZip: '' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [selectedPerson, setSelectedPerson] = useState(null);
  const [selectedPersonId, setSelectedPersonId] = useState(null);

  // Proxy testing: ?simulate=success | ?simulate=failure (omit = success)
  const simulateParam = searchParams.get('simulate');

  // Get selected person info from sessionStorage
  useEffect(() => {
    const personId = sessionStorage.getItem('selectedPersonId');
    if (personId) {
      setSelectedPersonId(personId);
      const storedResult = sessionStorage.getItem(`result_${personId}`);
      if (storedResult) {
        setSelectedPerson(JSON.parse(storedResult));
      }
    }
  }, []);

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      // Proxy API: pass simulate when present for success/failure testing
      await api.updateSubscription({
        plan: 'basic',
        paymentToken: 'tok_demo',
        ...(simulateParam && { simulate: simulateParam }),
      }, token);
      setSuccess(true);
      
      // After successful payment, create report if we have a selected person
      if (selectedPerson && selectedPerson.extId) {
        try {
          const reportResult = await createReportForIdentity(selectedPerson.extId, selectedPerson);
          if (reportResult.success && reportResult.commerceContentId) {
            // Redirect to report detail page using commerceContentId
            setTimeout(() => {
              navigate(`/people/${reportResult.commerceContentId}`);
            }, 2000);
            return;
          }
        } catch (reportError) {
          console.error('Failed to create report after payment:', reportError);
          // Continue to redirect even if report creation fails
        }
      }
      
      // Redirect to person detail page or dashboard
      if (selectedPersonId) {
        setTimeout(() => {
          navigate(`/people/${selectedPersonId}`);
        }, 2000);
      } else {
        setTimeout(() => {
          navigate('/dashboard');
        }, 2000);
      }
    } catch (err) {
      const isUnauthorized = err?.status === 401;
      const message = isUnauthorized
        ? 'Please sign in or create an account first.'
        : (err?.data?.error?.message || err?.message || 'Payment failed. Please try again.');
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className={styles.main}>
      <h1 className={styles.pageTitle}>Complete Your Purchase</h1>

      {selectedPerson && (
        <div className={styles.reportCta}>
          <h2 className={styles.reportCtaTitle}>
            Unlock Full Report for {selectedPerson.fullName}
          </h2>
          <p className={styles.reportCtaText}>
            Complete your payment to access the complete report including contact information,
            addresses, relatives, and more.
          </p>
        </div>
      )}

      {success ? (
        <div className={styles.successBox}>
          <h2 className={styles.successTitle}>Payment Successful!</h2>
          <p className={styles.successText}>
            Your membership has been activated. Redirecting to your report...
          </p>
        </div>
      ) : (
        <div>
          <div className={styles.planBox}>
            <h3 className={styles.planTitle}>Membership Plan</h3>
            <p className={styles.planText}>
              <strong>Basic Plan:</strong> $29.99/month - Full access to all reports and search features
            </p>
          </div>

          <form onSubmit={handleSubmit}>
            <div className={styles.paymentFormBox}>
              <h3 className={styles.formTitle}>Payment Information</h3>

              <div className={styles.formGroup}>
                <label className={styles.label} htmlFor="payment-cardNumber">Card Number *</label>
                <input
                  id="payment-cardNumber"
                  type="text"
                  name="cardNumber"
                  value={form.cardNumber}
                  onChange={handleChange}
                  required
                  placeholder="1234 5678 9012 3456"
                  maxLength="19"
                  className={styles.input}
                />
              </div>

              <div className={styles.formGroupRow}>
                <div className={styles.formGroup}>
                  <label className={styles.label} htmlFor="payment-expiry">Expiry *</label>
                  <input
                    id="payment-expiry"
                    type="text"
                    name="expiry"
                    value={form.expiry}
                    onChange={handleChange}
                    required
                    placeholder="MM/YY"
                    maxLength="5"
                    className={styles.input}
                  />
                </div>
                <div className={styles.formGroup}>
                  <label className={styles.label} htmlFor="payment-cvv">CVV *</label>
                  <input
                    id="payment-cvv"
                    type="text"
                    name="cvv"
                    value={form.cvv}
                    onChange={handleChange}
                    required
                    placeholder="123"
                    maxLength="4"
                    className={styles.input}
                  />
                </div>
              </div>

              <div className={styles.formGroup}>
                <label className={styles.label} htmlFor="payment-billingZip">Billing ZIP Code *</label>
                <input
                  id="payment-billingZip"
                  type="text"
                  name="billingZip"
                  value={form.billingZip}
                  onChange={handleChange}
                  required
                  placeholder="12345"
                  maxLength="10"
                  className={styles.input}
                />
              </div>
            </div>

            {error && (
              <div className={styles.formError}>
                <p style={{ margin: 0 }}>{error}</p>
                {error.includes('sign in or create an account') && (
                  <p style={{ margin: '0.5rem 0 0', fontSize: '0.9rem' }}>
                    <Link to="/signup">Sign up</Link> or <Link to="/login">Log in</Link>
                  </p>
                )}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className={styles.submitButton}
            >
              {loading ? 'Processing Payment…' : 'Complete Purchase'}
            </button>

            <p className={styles.secureNote}>
              Your payment is secure and encrypted. You can cancel your subscription at any time.
            </p>

            {process.env.NODE_ENV === 'development' && (
              <p className={styles.devHint} role="status" aria-label="Testing options">
                Test flows: <a href="?simulate=success">Success</a> · <a href="?simulate=failure">Decline</a>
              </p>
            )}

            <div className={styles.trustBadges}>
              {TRUST_BADGES.map((badge, i) => (
                <span key={i} className={styles.trustBadge}>
                  <span className={styles.trustBadgeIcon} aria-hidden>{badge.icon}</span>
                  {badge.label}
                </span>
              ))}
            </div>
          </form>
        </div>
      )}
    </main>
  );
};

export default PaymentPage;