import React, { useState, useMemo } from 'react';
import api from '../../api';
import styles from './CsRepManagementPage.module.css';

/**
 * Validate password meets BC complexity requirements:
 * min 8 chars, uppercase, lowercase, number, special character.
 */
const PASSWORD_RULES = [
  { id: 'length', label: '8+ characters', test: (pw) => pw.length >= 8 },
  { id: 'upper', label: 'Uppercase letter', test: (pw) => /[A-Z]/.test(pw) },
  { id: 'lower', label: 'Lowercase letter', test: (pw) => /[a-z]/.test(pw) },
  { id: 'number', label: 'Number', test: (pw) => /[0-9]/.test(pw) },
  { id: 'special', label: 'Special character', test: (pw) => /[^A-Za-z0-9]/.test(pw) },
];

function validatePassword(pw) {
  if (!pw) return 'Password is required.';
  for (const rule of PASSWORD_RULES) {
    if (!rule.test(pw)) return `Password must contain ${rule.label.toLowerCase()}.`;
  }
  return null;
}

/**
 * PasswordRequirements — inline checklist showing which rules pass/fail.
 */
const PasswordRequirements = ({ password, showFailed }) => (
  <ul className={styles.passwordReqs}>
    {PASSWORD_RULES.map((rule) => {
      const met = password && rule.test(password);
      let cls = styles.passwordReq;
      if (password) cls += ' ' + (met ? styles.passwordReqMet : (showFailed ? styles.passwordReqFailed : ''));
      return (
        <li key={rule.id} className={cls}>
          {met ? '\u2713' : '\u2022'} {rule.label}
        </li>
      );
    })}
  </ul>
);

/* ─────────────────────────── Create CS Rep Form ─────────────────── */
const CreateCsRepForm = () => {
  const [form, setForm] = useState({ firstName: '', lastName: '', email: '', password: '' });
  const [submitting, setSubmitting] = useState(false);
  const [msg, setMsg] = useState(null); // { type: 'success'|'error', text }
  const [attempted, setAttempted] = useState(false);

  const passwordError = useMemo(() => validatePassword(form.password), [form.password]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setAttempted(true);
    setMsg(null);

    if (passwordError) {
      setMsg({ type: 'error', text: passwordError });
      return;
    }

    setSubmitting(true);
    try {
      await api.adminCreateCsRep({ ...form, roles: ['csr'] });
      setMsg({ type: 'success', text: 'CS rep created successfully.' });
      setForm({ firstName: '', lastName: '', email: '', password: '' });
      setAttempted(false);
    } catch (err) {
      setMsg({ type: 'error', text: err.message || 'Failed to create CS rep.' });
    } finally {
      setSubmitting(false);
    }
  };

  const set = (field) => (e) => setForm({ ...form, [field]: e.target.value });

  return (
    <form className={styles.form} onSubmit={handleSubmit}>
      <div className={styles.formRow}>
        <div className={styles.formGroup}>
          <label className={styles.label}>First Name</label>
          <input className={styles.input} placeholder="Jane" value={form.firstName} onChange={set('firstName')} required />
        </div>
        <div className={styles.formGroup}>
          <label className={styles.label}>Last Name</label>
          <input className={styles.input} placeholder="Doe" value={form.lastName} onChange={set('lastName')} required />
        </div>
      </div>
      <div className={styles.formGroup}>
        <label className={styles.label}>Email</label>
        <input className={styles.input} type="email" placeholder="jane@example.com" value={form.email} onChange={set('email')} required />
      </div>
      <div className={styles.formGroup}>
        <label className={styles.label}>Password</label>
        <input
          className={`${styles.input} ${attempted && passwordError ? styles.inputError : ''}`}
          type="password"
          placeholder="Min 8 chars, upper, lower, number, special"
          value={form.password}
          onChange={set('password')}
          required
        />
        <PasswordRequirements password={form.password} showFailed={attempted} />
      </div>
      <button type="submit" className={styles.submitBtn} disabled={submitting}>
        {submitting ? 'Creating...' : 'Create CS Rep'}
      </button>
      {msg && <div className={msg.type === 'success' ? styles.successMsg : styles.errorMsg}>{msg.text}</div>}
    </form>
  );
};

/* ─────────────────────────── Update CS Rep Form ─────────────────── */
const UpdateCsRepForm = () => {
  const [userId, setUserId] = useState('');
  const [form, setForm] = useState({ firstName: '', lastName: '', email: '', password: '' });
  const [submitting, setSubmitting] = useState(false);
  const [msg, setMsg] = useState(null);
  const [attempted, setAttempted] = useState(false);

  // Password is optional for updates — only validate if provided
  const passwordError = useMemo(() => (form.password ? validatePassword(form.password) : null), [form.password]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setAttempted(true);
    setMsg(null);

    if (!userId.trim()) {
      setMsg({ type: 'error', text: 'User ID is required.' });
      return;
    }

    if (form.password && passwordError) {
      setMsg({ type: 'error', text: passwordError });
      return;
    }

    // Build update body — only include non-empty fields
    const body = {};
    if (form.firstName.trim()) body.firstName = form.firstName.trim();
    if (form.lastName.trim()) body.lastName = form.lastName.trim();
    if (form.email.trim()) body.email = form.email.trim();
    if (form.password) body.password = form.password;

    if (Object.keys(body).length === 0) {
      setMsg({ type: 'error', text: 'Provide at least one field to update.' });
      return;
    }

    setSubmitting(true);
    try {
      await api.adminUpdateCsRep(userId.trim(), body);
      setMsg({ type: 'success', text: `CS rep ${userId.trim()} updated successfully.` });
      setForm({ firstName: '', lastName: '', email: '', password: '' });
      setUserId('');
      setAttempted(false);
    } catch (err) {
      setMsg({ type: 'error', text: err.message || 'Failed to update CS rep.' });
    } finally {
      setSubmitting(false);
    }
  };

  const set = (field) => (e) => setForm({ ...form, [field]: e.target.value });

  return (
    <form className={styles.form} onSubmit={handleSubmit}>
      <div className={styles.formGroup}>
        <label className={styles.label}>User ID</label>
        <input
          className={`${styles.input} ${attempted && !userId.trim() ? styles.inputError : ''}`}
          placeholder="Enter the BC user ID of the CS rep"
          value={userId}
          onChange={(e) => setUserId(e.target.value)}
          required
        />
      </div>
      <hr className={styles.divider} />
      <p style={{ fontSize: '0.8125rem', color: '#6b7280', margin: '0 0 0.75rem' }}>
        Fill in only the fields you want to update. Leave others blank.
      </p>
      <div className={styles.formRow}>
        <div className={styles.formGroup}>
          <label className={styles.label}>First Name</label>
          <input className={styles.input} placeholder="(unchanged)" value={form.firstName} onChange={set('firstName')} />
        </div>
        <div className={styles.formGroup}>
          <label className={styles.label}>Last Name</label>
          <input className={styles.input} placeholder="(unchanged)" value={form.lastName} onChange={set('lastName')} />
        </div>
      </div>
      <div className={styles.formGroup}>
        <label className={styles.label}>Email</label>
        <input className={styles.input} type="email" placeholder="(unchanged)" value={form.email} onChange={set('email')} />
      </div>
      <div className={styles.formGroup}>
        <label className={styles.label}>New Password (optional)</label>
        <input
          className={`${styles.input} ${attempted && passwordError ? styles.inputError : ''}`}
          type="password"
          placeholder="Leave blank to keep current password"
          value={form.password}
          onChange={set('password')}
        />
        {form.password && <PasswordRequirements password={form.password} showFailed={attempted} />}
      </div>
      <button type="submit" className={styles.submitBtn} disabled={submitting}>
        {submitting ? 'Updating...' : 'Update CS Rep'}
      </button>
      {msg && <div className={msg.type === 'success' ? styles.successMsg : styles.errorMsg}>{msg.text}</div>}
    </form>
  );
};

/* ─────────────────────────── Main Page ──────────────────────────── */
const CsRepManagementPage = () => {
  const [showCreate, setShowCreate] = useState(false);
  const [showUpdate, setShowUpdate] = useState(false);

  return (
    <main className={styles.page}>
      <div className={styles.pageHeader}>
        <h1 className={styles.title}>CS Representative Management</h1>
        <p className={styles.subtitle}>Create and update customer service representative accounts</p>
      </div>

      <div className={styles.infoBanner}>
        CS rep list is not available from the API. Use the forms below to create new reps or update existing ones by user ID.
        You can find user IDs in the <strong>Users</strong> page or the ByteCrtrs admin panel.
      </div>

      {/* ── Create CS Rep ──────────────────────────────────────────── */}
      <div className={styles.section}>
        <div className={styles.sectionHeader}>
          <h2 className={styles.sectionTitle}>Create CS Rep</h2>
          <button
            className={`${styles.toggleBtn} ${showCreate ? styles.toggleBtnOutline : styles.toggleBtnPrimary}`}
            onClick={() => setShowCreate((v) => !v)}
          >
            {showCreate ? 'Close' : '+ New CS Rep'}
          </button>
        </div>
        {showCreate && <CreateCsRepForm />}
      </div>

      {/* ── Update CS Rep ──────────────────────────────────────────── */}
      <div className={styles.section}>
        <div className={styles.sectionHeader}>
          <h2 className={styles.sectionTitle}>Update CS Rep</h2>
          <button
            className={`${styles.toggleBtn} ${showUpdate ? styles.toggleBtnOutline : styles.toggleBtnPrimary}`}
            onClick={() => setShowUpdate((v) => !v)}
          >
            {showUpdate ? 'Close' : 'Edit Existing'}
          </button>
        </div>
        {showUpdate && <UpdateCsRepForm />}
      </div>
    </main>
  );
};

export default CsRepManagementPage;
