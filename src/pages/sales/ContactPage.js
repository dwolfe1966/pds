import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import api from '../../api';
import { useAuth } from '../../context/AuthContext';
import styles from './ContactPage.module.css';
import { useBrand } from '../../services/brand';

// BC enforces anti-abuse rules on /contactMessage/create (which email domains may
// create messages + a per-domain daily cap). A tripped rule comes back as a 412 —
// BC's Cloudflare Turnstile challenge — which we intentionally do NOT satisfy
// client-side (it exists to block abuse/disposable domains). Detect it and show a
// graceful, helpful message with the brand support number instead of a raw
// "HTTP 412". For legit customers the rule doesn't fire, so they never see this.
const isBlocked412 = (err) =>
  err?.status === 412 ||
  err?.originalError?.status === 412 ||
  err?.data?.type === 'turnstile.v0' ||
  err?.originalError?.data?.type === 'turnstile.v0' ||
  /\b412\b/.test(err?.message || '') ||
  /turnstile/i.test(err?.message || '');
const contactErrorMessage = (err, supportPhone) =>
  isBlocked412(err)
    ? `We couldn't submit your message right now. Please try again later${supportPhone ? `, or call us at ${supportPhone} (Mon–Fri, 9am–5pm ET)` : ''} — sorry for the trouble.`
    : (err?.message || 'Something went wrong. Please try again.');

// When a member submits a contact form, BC returns the new contactMessage
// doc with _id + hash. Persist those locally so Account → Messages can
// resolve the thread via getContactHistories on next visit — BC has no
// consumer-side enumeration, so we must capture refs at create time.
//
// Single canonical bucket keyed on lowercased email so writes during
// post-signup (where user.id may not yet be populated) match reads after
// the next login (where user.id IS populated). Logged-out submissions
// land in a pending bucket migrated by AuthContext on next login.
const persistContactThreadRef = (user, result, submittedEmail, subject) => {
  if (!result) return;
  // BC's contact.create response wraps the new doc in messageResult
  // ({ messageResult: { _id, hash, ... }, mailResult }). Check that first;
  // fall through to flat / docs[] shapes for resilience.
  const threadId =
    result?.messageResult?._id || result?.messageResult?.id ||
    result?._id || result?.id ||
    result?.docs?.[0]?._id || result?.docs?.[0]?.id;
  const threadHash =
    result?.messageResult?.hash ||
    result?.hash ||
    result?.docs?.[0]?.hash;
  if (!threadId || !threadHash) return;
  const userEmail = (user?.email || '').trim().toLowerCase();
  const formEmail = (submittedEmail || '').trim().toLowerCase();
  const storageKey = userEmail
    ? `accountThreads:${userEmail}`
    : formEmail
      ? `pendingContactThreads:${formEmail}`
      : null;
  if (!storageKey) return;
  try {
    const raw = localStorage.getItem(storageKey);
    const parsed = raw ? JSON.parse(raw) : [];
    const existing = Array.isArray(parsed) ? parsed : [];
    const filtered = existing.filter((r) => r?.contactMessageId !== threadId);
    const next = [
      { contactMessageId: threadId, hash: threadHash, createdAt: new Date().toISOString(), subject: subject || '' },
      ...filtered,
    ].slice(0, 100);
    localStorage.setItem(storageKey, JSON.stringify(next));
  } catch {
    // localStorage may be unavailable; non-fatal — member just won't see this
    // thread in /account → Messages until they click a CSR reply link.
  }
};

/* ------------------------------------------------------------------ */
/* Inline SVG icons                                                    */
/* ------------------------------------------------------------------ */

const PhoneIcon = ({ size = 28 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
  </svg>
);

const EnvelopeIcon = ({ size = 28 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
    <polyline points="22,6 12,13 2,6" />
  </svg>
);

const ChevronDownIcon = ({ size = 20 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <polyline points="6 9 12 15 18 9" />
  </svg>
);

const CloseIcon = ({ size = 20 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <line x1="18" y1="6" x2="6" y2="18" />
    <line x1="6" y1="6" x2="18" y2="18" />
  </svg>
);

const CheckIcon = ({ size = 36 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <polyline points="20 6 9 17 4 12" />
  </svg>
);

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const isValidEmail = (email) => EMAIL_RE.test(String(email || '').trim());

/* ------------------------------------------------------------------ */
/* Modal shell                                                         */
/* ------------------------------------------------------------------ */

const Modal = ({ isOpen, onClose, children, labelledBy }) => {
  useEffect(() => {
    if (!isOpen) return undefined;
    const handleKey = (e) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleKey);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', handleKey);
      document.body.style.overflow = previousOverflow;
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      className={styles.modalOverlay}
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby={labelledBy}
    >
      <div
        className={styles.modal}
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          className={styles.modalClose}
          onClick={onClose}
          aria-label="Close dialog"
        >
          <CloseIcon />
        </button>
        {children}
      </div>
    </div>
  );
};

/* ------------------------------------------------------------------ */
/* Email Customer Care modal                                           */
/* ------------------------------------------------------------------ */

const INITIAL_EMAIL_FORM = {
  reason: '',
  name: '',
  email: '',
  phone: '',
  description: '',
  optIn: 'yes',
};

const EmailCustomerCareModal = ({ isOpen, onClose, user, token }) => {
  const brand = useBrand();
  const [form, setForm] = useState(INITIAL_EMAIL_FORM);
  const [errors, setErrors] = useState({});
  const [submitError, setSubmitError] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [threadUrl, setThreadUrl] = useState('');
  const [copied, setCopied] = useState(false);

  // Reset when modal closes
  useEffect(() => {
    if (!isOpen) {
      // Delay reset so animation isn't disturbed
      const t = setTimeout(() => {
        setForm(INITIAL_EMAIL_FORM);
        setErrors({});
        setSubmitError('');
        setSuccess(false);
        setLoading(false);
        setThreadUrl('');
        setCopied(false);
      }, 200);
      return () => clearTimeout(t);
    }
    return undefined;
  }, [isOpen]);

  // Pre-fill from authenticated user
  useEffect(() => {
    if (isOpen && user) {
      setForm((prev) => ({
        ...prev,
        name: user.name || [user.firstName, user.lastName].filter(Boolean).join(' ') || prev.name,
        email: user.email || prev.email,
      }));
    }
  }, [isOpen, user]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
    if (errors[name]) {
      setErrors((prev) => ({ ...prev, [name]: undefined }));
    }
  };

  const validate = () => {
    const next = {};
    if (!form.reason) next.reason = 'Please select a topic';
    if (!form.name.trim()) next.name = 'Please enter your name';
    if (!form.email.trim()) next.email = 'Please enter your email';
    else if (!isValidEmail(form.email)) next.email = 'Please enter a valid email address';
    if (!form.description.trim()) next.description = 'Please enter a description';
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitError('');
    if (!validate()) return;
    setLoading(true);
    try {
      const body = {
        subject: form.reason,
        reason: form.reason,
        name: form.name,
        email: form.email,
        phone: form.phone,
        message: form.description,
        marketingOptIn: form.optIn === 'yes',
        source: 'email-customer-care',
      };
      if (user) body.userId = user.id || user._id;
      const result = await api.submitContact(body);
      persistContactThreadRef(user, result, form.email, form.reason);
      setSuccess(true);
      if (result?.threadId) {
        setThreadUrl(`${window.location.origin}/contact/thread/${result.threadId}`);
      }
    } catch (err) {
      setSubmitError(contactErrorMessage(err, brand?.supportPhone));
    } finally {
      setLoading(false);
    }
  };

  const handleCopyLink = () => {
    navigator.clipboard.writeText(threadUrl).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }).catch(() => {});
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} labelledBy="email-modal-title">
      {success ? (
        <div className={styles.successState}>
          <div className={styles.successIcon}>
            <CheckIcon />
          </div>
          <h3 className={styles.successTitle}>Thank you!</h3>
          {token ? (
            <>
              <p className={styles.successMessage}>
                Your message has been submitted. View your messages in{' '}
                <Link to="/account?tab=messages">Account Settings</Link>.
              </p>
            </>
          ) : (
            <>
              <p className={styles.successMessage}>
                Your request has been submitted. Use this link to check for responses:
              </p>
              {threadUrl && (
                <div style={{ marginTop: '0.5rem', wordBreak: 'break-all' }}>
                  <a href={threadUrl} style={{ color: '#4a90e2', fontSize: '0.875rem' }}>
                    {threadUrl}
                  </a>
                  <br />
                  <button
                    type="button"
                    className={styles.submitButton}
                    style={{ marginTop: '0.5rem', fontSize: '0.875rem', padding: '0.375rem 1rem' }}
                    onClick={handleCopyLink}
                  >
                    {copied ? 'Copied!' : 'Copy Link'}
                  </button>
                </div>
              )}
            </>
          )}
          <button
            type="button"
            className={styles.submitButton}
            onClick={onClose}
            style={{ marginTop: '1rem' }}
          >
            Close
          </button>
        </div>
      ) : (
        <>
          <h2 id="email-modal-title" className={styles.modalTitle}>Email Customer Care</h2>
          <p className={styles.modalSubtitle}>
            Leave us a detailed message and we will respond within 24 hours.
          </p>

          <form className={styles.form} onSubmit={handleSubmit} noValidate>
            <div className={styles.field}>
              <label htmlFor="email-reason" className={styles.label}>
                Reason for contacting
              </label>
              <select
                id="email-reason"
                name="reason"
                className={styles.select}
                value={form.reason}
                onChange={handleChange}
              >
                <option value="">Select a Topic</option>
                <option value="Privacy">Privacy</option>
                <option value="Remove my information">Remove my information</option>
                <option value="Billing question">Billing question</option>
                <option value="Technical support">Technical support</option>
                <option value="General inquiry">General inquiry</option>
                <option value="Other">Other</option>
              </select>
              {errors.reason && <span className={styles.fieldError}>{errors.reason}</span>}
            </div>

            <div className={styles.field}>
              <label htmlFor="email-name" className={styles.label}>
                Your first and last name
              </label>
              <input
                id="email-name"
                type="text"
                name="name"
                className={styles.input}
                value={form.name}
                onChange={handleChange}
                autoComplete="name"
              />
              {errors.name && <span className={styles.fieldError}>{errors.name}</span>}
            </div>

            <div className={styles.field}>
              <label htmlFor="email-email" className={styles.label}>
                Email
              </label>
              <input
                id="email-email"
                type="email"
                name="email"
                className={styles.input}
                value={form.email}
                onChange={handleChange}
                autoComplete="email"
              />
              {errors.email && <span className={styles.fieldError}>{errors.email}</span>}
            </div>

            <div className={styles.field}>
              <label htmlFor="email-phone" className={styles.label}>
                Phone (optional)
              </label>
              <input
                id="email-phone"
                type="tel"
                name="phone"
                className={styles.input}
                value={form.phone}
                onChange={handleChange}
                autoComplete="tel"
              />
            </div>

            <div className={styles.field}>
              <label htmlFor="email-description" className={styles.label}>
                Detailed description
              </label>
              <textarea
                id="email-description"
                name="description"
                rows="4"
                className={styles.textarea}
                value={form.description}
                onChange={handleChange}
              />
              {errors.description && <span className={styles.fieldError}>{errors.description}</span>}
            </div>

            <div className={styles.field}>
              <span className={styles.radioGroupLabel}>
                Email me about {brand.name}&apos;s special offers and tips for better searches.
              </span>
              <div className={styles.radioGroup}>
                <label className={styles.radioOption}>
                  <input
                    type="radio"
                    name="optIn"
                    value="yes"
                    checked={form.optIn === 'yes'}
                    onChange={handleChange}
                  />
                  Yes
                </label>
                <label className={styles.radioOption}>
                  <input
                    type="radio"
                    name="optIn"
                    value="no"
                    checked={form.optIn === 'no'}
                    onChange={handleChange}
                  />
                  No
                </label>
              </div>
            </div>

            <p className={styles.disclaimer}>
              By clicking Submit, I give {brand.name} permission to contact me. See {brand.name}&apos;s{' '}
              <Link to="/privacy">Privacy Policy</Link> for more information.
            </p>

            {submitError && <div className={styles.errorBanner}>{submitError}</div>}

            <button type="submit" className={styles.submitButton} disabled={loading}>
              {loading ? 'Submitting...' : 'Submit'}
            </button>
          </form>
        </>
      )}
    </Modal>
  );
};

/* ------------------------------------------------------------------ */
/* Billing Question modal                                              */
/* ------------------------------------------------------------------ */

const INITIAL_BILLING_FORM = {
  name: '',
  email: '',
  orderRef: '',
  description: '',
};

const BILLING_DESC_MAX = 250;

const BillingQuestionModal = ({ isOpen, onClose, user, token }) => {
  const brand = useBrand();
  const [form, setForm] = useState(INITIAL_BILLING_FORM);
  const [errors, setErrors] = useState({});
  const [submitError, setSubmitError] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [threadUrl, setThreadUrl] = useState('');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!isOpen) {
      const t = setTimeout(() => {
        setForm(INITIAL_BILLING_FORM);
        setErrors({});
        setSubmitError('');
        setSuccess(false);
        setLoading(false);
        setThreadUrl('');
        setCopied(false);
      }, 200);
      return () => clearTimeout(t);
    }
    return undefined;
  }, [isOpen]);

  // Pre-fill from authenticated user
  useEffect(() => {
    if (isOpen && user) {
      setForm((prev) => ({
        ...prev,
        name: user.name || [user.firstName, user.lastName].filter(Boolean).join(' ') || prev.name,
        email: user.email || prev.email,
      }));
    }
  }, [isOpen, user]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    if (name === 'description' && value.length > BILLING_DESC_MAX) return;
    setForm((prev) => ({ ...prev, [name]: value }));
    if (errors[name]) {
      setErrors((prev) => ({ ...prev, [name]: undefined }));
    }
  };

  const validate = () => {
    const next = {};
    if (!form.name.trim()) next.name = 'Please enter your name';
    if (!form.email.trim()) next.email = 'Please enter your email';
    else if (!isValidEmail(form.email)) next.email = 'Please enter a valid email address';
    if (!form.description.trim()) next.description = 'Please enter a description';
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitError('');
    if (!validate()) return;
    setLoading(true);
    try {
      const body = {
        subject: 'Billing Question',
        reason: 'Billing question',
        name: form.name,
        email: form.email,
        orderReference: form.orderRef,
        message: form.description,
        source: 'billing-question',
      };
      if (user) body.userId = user.id || user._id;
      const result = await api.submitContact(body);
      persistContactThreadRef(user, result, form.email, 'Billing Question');
      setSuccess(true);
      if (result?.threadId) {
        setThreadUrl(`${window.location.origin}/contact/thread/${result.threadId}`);
      }
    } catch (err) {
      setSubmitError(contactErrorMessage(err, brand?.supportPhone));
    } finally {
      setLoading(false);
    }
  };

  const handleCopyLink = () => {
    navigator.clipboard.writeText(threadUrl).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }).catch(() => {});
  };

  const charCount = form.description.length;
  const charWarn = charCount >= 240;

  return (
    <Modal isOpen={isOpen} onClose={onClose} labelledBy="billing-modal-title">
      {success ? (
        <div className={styles.successState}>
          <div className={styles.successIcon}>
            <CheckIcon />
          </div>
          <h3 className={styles.successTitle}>Message received</h3>
          {token ? (
            <>
              <p className={styles.successMessage}>
                Your message has been submitted. View your messages in{' '}
                <Link to="/account?tab=messages">Account Settings</Link>.
              </p>
            </>
          ) : (
            <>
              <p className={styles.successMessage}>
                Our finance team typically responds within 1 business day.
                Use this link to check for responses:
              </p>
              {threadUrl && (
                <div style={{ marginTop: '0.5rem', wordBreak: 'break-all' }}>
                  <a href={threadUrl} style={{ color: '#4a90e2', fontSize: '0.875rem' }}>
                    {threadUrl}
                  </a>
                  <br />
                  <button
                    type="button"
                    className={styles.submitButton}
                    style={{ marginTop: '0.5rem', fontSize: '0.875rem', padding: '0.375rem 1rem' }}
                    onClick={handleCopyLink}
                  >
                    {copied ? 'Copied!' : 'Copy Link'}
                  </button>
                </div>
              )}
            </>
          )}
          <button
            type="button"
            className={styles.submitButton}
            onClick={onClose}
            style={{ marginTop: '1rem' }}
          >
            Close
          </button>
        </div>
      ) : (
        <>
          <h2 id="billing-modal-title" className={styles.modalTitle}>Billing Question</h2>
          <p className={styles.modalSubtitle}>
            Briefly describe your billing issue. Our finance team typically responds within 1 business day.
          </p>

          <form className={styles.form} onSubmit={handleSubmit} noValidate>
            <div className={styles.field}>
              <label htmlFor="billing-name" className={styles.label}>
                Your first and last name
              </label>
              <input
                id="billing-name"
                type="text"
                name="name"
                className={styles.input}
                value={form.name}
                onChange={handleChange}
                autoComplete="name"
              />
              {errors.name && <span className={styles.fieldError}>{errors.name}</span>}
            </div>

            <div className={styles.field}>
              <label htmlFor="billing-email" className={styles.label}>
                Email
              </label>
              <input
                id="billing-email"
                type="email"
                name="email"
                className={styles.input}
                value={form.email}
                onChange={handleChange}
                autoComplete="email"
              />
              {errors.email && <span className={styles.fieldError}>{errors.email}</span>}
            </div>

            <div className={styles.field}>
              <label htmlFor="billing-order" className={styles.label}>
                Order ID or date of charge
              </label>
              <input
                id="billing-order"
                type="text"
                name="orderRef"
                className={styles.input}
                value={form.orderRef}
                onChange={handleChange}
                placeholder="Optional — helps us find your transaction"
              />
            </div>

            <div className={styles.field}>
              <label htmlFor="billing-description" className={styles.label}>
                Description
              </label>
              <textarea
                id="billing-description"
                name="description"
                rows="3"
                maxLength={BILLING_DESC_MAX}
                className={styles.textarea}
                value={form.description}
                onChange={handleChange}
              />
              <span
                className={`${styles.charCounter} ${charWarn ? styles.charCounterWarn : ''}`}
              >
                {charCount} / {BILLING_DESC_MAX} characters
              </span>
              {errors.description && <span className={styles.fieldError}>{errors.description}</span>}
            </div>

            {submitError && <div className={styles.errorBanner}>{submitError}</div>}

            <button type="submit" className={styles.submitButton} disabled={loading}>
              {loading ? 'Submitting...' : 'Submit'}
            </button>
          </form>
        </>
      )}
    </Modal>
  );
};

/* ------------------------------------------------------------------ */
/* Main ContactPage                                                    */
/* ------------------------------------------------------------------ */

const buildFaqItems = (brand) => [
  {
    q: `What is ${brand.name}?`,
    a: `${brand.name} is a people search service that organizes public information about people into simple, comprehensive online profiles accessible to consumers, businesses, and non-profits.`,
  },
  {
    q: 'How do I perform a search?',
    a: `${brand.name} supports five types of searches. Enter a first and last name, phone number, email address, physical address, or username and click 'search.' Our search bar automatically detects the type of search entered, and displays all available results once the search is complete.`,
  },
  {
    q: 'What will show up on my bank or credit card statement?',
    // Merchant descriptors are set by the payment processor and don't vary
    // by brand surface — leave as IDLOOKUP*… until billing reconfigures.
    a: `Charges may appear on your credit card statement as: IDLOOKUP*AI, IDL*SEARCH, or IDLOOKUP.AI followed by a phone number (e.g., ${brand.supportPhone}).`,
  },
];

const ContactPage = () => {
  const navigate = useNavigate();
  const brand = useBrand();
  const { user, token } = useAuth();
  const [emailModalOpen, setEmailModalOpen] = useState(false);
  const [billingModalOpen, setBillingModalOpen] = useState(false);
  const [helpTopic, setHelpTopic] = useState('');
  const faqItems = buildFaqItems(brand);

  const handleHelpChange = useCallback(
    (e) => {
      const value = e.target.value;
      setHelpTopic(value);
      switch (value) {
        case 'privacy':
          navigate('/privacy');
          break;
        case 'opt-out':
          navigate('/opt-out');
          break;
        case 'unsubscribe':
          // No dedicated consumer /unsubscribe route — opt-out flow handles
          // the user-initiated removal request.
          navigate('/opt-out');
          break;
        case 'billing':
          setBillingModalOpen(true);
          // Reset select so user can re-trigger if they close the modal
          setTimeout(() => setHelpTopic(''), 0);
          break;
        default:
          break;
      }
    },
    [navigate]
  );

  const closeEmailModal = useCallback(() => setEmailModalOpen(false), []);
  const closeBillingModal = useCallback(() => setBillingModalOpen(false), []);

  return (
    <main className={styles.page}>
      <div className={styles.container}>
        {/* Hero */}
        <section className={styles.hero}>
          <h1 className={styles.heroTitle}>We&apos;re here to help!</h1>
          <p className={styles.heroSubtitle}>
            Customer Care is available 7 days a week. Have a question for us? Check out our{' '}
            <Link to="/about">Help Center</Link> for quick and easy answers.
          </p>
        </section>

        {/* Two-column grid */}
        <div className={styles.grid}>
          {/* Left column */}
          <div className={styles.leftColumn}>
            {/* How can we help you? */}
            <section className={styles.card} aria-labelledby="help-heading">
              <h2 id="help-heading" className={styles.cardTitle}>How can we help you?</h2>
              <p className={styles.cardSubtitle}>
                Pick a topic and we&apos;ll point you in the right direction.
              </p>
              <div className={styles.helpSelectWrapper}>
                <select
                  className={styles.helpSelect}
                  value={helpTopic}
                  onChange={handleHelpChange}
                  aria-label="How can we help you?"
                >
                  <option value="">Select a topic...</option>
                  <option value="privacy">Privacy</option>
                  <option value="opt-out">Remove my information</option>
                  <option value="unsubscribe">Unsubscribe from email / text</option>
                  <option value="billing">Billing question</option>
                </select>
                <span className={styles.selectArrow}>
                  <ChevronDownIcon />
                </span>
              </div>
            </section>

            {/* Speak With Us — driven by brand.supportPhone */}
            <section className={`${styles.card} ${styles.channelCard}`}>
              <div className={styles.channelIcon}>
                <PhoneIcon />
              </div>
              <div className={styles.channelBody}>
                <span className={styles.channelHours}>9AM - 5PM ET  MON - FRI</span>
                <h2 className={styles.channelTitle}>Speak With Us</h2>
                <p className={styles.channelDescription}>
                  Get assistance by phone from our team of experts.
                </p>
                <a
                  href={`tel:+1${(brand.supportPhone || '').replace(/\D/g, '')}`}
                  className={styles.channelButton}
                >
                  Call {brand.supportPhone}
                </a>
              </div>
            </section>

            {/* Email Us */}
            <section className={`${styles.card} ${styles.channelCard}`}>
              <div className={styles.channelIcon}>
                <EnvelopeIcon />
              </div>
              <div className={styles.channelBody}>
                <span className={styles.channelHours}>ANYTIME</span>
                <h2 className={styles.channelTitle}>Email Us</h2>
                <p className={styles.channelDescription}>
                  Please leave us a detailed message and we will respond shortly.
                </p>
                <button
                  type="button"
                  className={styles.channelButton}
                  onClick={() => setEmailModalOpen(true)}
                >
                  Start an Email
                </button>
              </div>
            </section>

            {/*
              TODO: Chat With Us section is intentionally suppressed until the
              live-chat integration is implemented. Restore a "Chat With Us"
              channelCard block here once the chat widget is wired up.
            */}
          </div>

          {/* Right column - FAQ */}
          <aside className={styles.rightColumn}>
            <div className={styles.faqPanel}>
              <h2 className={styles.faqHeading}>Frequently Asked Questions</h2>
              <div className={styles.faqList}>
                {faqItems.map((item) => (
                  <div key={item.q} className={styles.faqItem}>
                    <h3 className={styles.faqQuestion}>{item.q}</h3>
                    <p className={styles.faqAnswer}>{item.a}</p>
                  </div>
                ))}
              </div>
              <Link to="/about" className={styles.helpCenterLink}>
                View Help Center &rarr;
              </Link>
            </div>
          </aside>
        </div>
      </div>

      {/* Modals */}
      <EmailCustomerCareModal isOpen={emailModalOpen} onClose={closeEmailModal} user={user} token={token} />
      <BillingQuestionModal isOpen={billingModalOpen} onClose={closeBillingModal} user={user} token={token} />
    </main>
  );
};

export default ContactPage;
