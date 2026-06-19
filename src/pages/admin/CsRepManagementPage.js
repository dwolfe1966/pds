import React, { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import api from '../../api';
import styles from './CsRepManagementPage.module.css';

// ─── helpers ────────────────────────────────────────────────────────────────

function formatDate(value) {
  if (!value) return '\u2014';
  try {
    return new Date(value).toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  } catch {
    return '\u2014';
  }
}

function getDisplayName(u) {
  if (u.firstName || u.lastName) {
    return `${u.firstName || ''} ${u.lastName || ''}`.trim();
  }
  return u.email || u._id || u.id || 'Unknown';
}

function resolveStatus(u) {
  return (u.status || u.transient?.status || '').toLowerCase();
}

function formatRoles(roles) {
  if (!Array.isArray(roles) || roles.length === 0) return '\u2014';
  return roles.join(', ');
}

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

// ─── sub-components ─────────────────────────────────────────────────────────

function StatusBadge({ status }) {
  const s = (status || '').toLowerCase();
  if (s === 'active') return <span className={`${styles.badge} ${styles.badgeActive}`}>Active</span>;
  if (s === 'suspended') return <span className={`${styles.badge} ${styles.badgeSuspended}`}>Suspended</span>;
  return <span className={`${styles.badge} ${styles.badgeUnknown}`}>Unknown</span>;
}

function RoleBadge({ role }) {
  if (role === 'admin') return <span className={`${styles.badge} ${styles.badgeAdmin}`}>{role}</span>;
  if (role === 'csr') return <span className={`${styles.badge} ${styles.badgeCsr}`}>{role}</span>;
  return <span className={`${styles.badge} ${styles.badgeUnknown}`}>{role}</span>;
}

/* ─────────────────────────── CS Reps List ──────────────────────────── */
const CsRepsList = ({ onEditRep, refreshKey }) => {
  const [reps, setReps] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState('');
  const [lastId, setLastId] = useState(null);
  const [noMoreDocs, setNoMoreDocs] = useState(false);
  const [emailSearch, setEmailSearch] = useState('');
  const [activeEmail, setActiveEmail] = useState('');
  const [fetchGen, setFetchGen] = useState(0);

  const fetchPage = useCallback(async (cursorId = null) => {
    const params = cursorId ? { lastId: cursorId } : {};
    if (activeEmail) params.email = activeEmail;
    const res = await api.adminListCsReps(params);
    const docs = res?.data ?? [];
    const last = docs[docs.length - 1]?._id ?? docs[docs.length - 1]?.id ?? null;
    return { docs, last, noMoreDocs: res?.noMoreDocs ?? docs.length === 0 };
  }, [activeEmail]);

  // Initial load + reload on refreshKey or filter change
  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      setError('');
      try {
        const { docs, last, noMoreDocs: done } = await fetchPage();
        if (!cancelled) {
          setReps(docs);
          setLastId(last);
          setNoMoreDocs(done);
        }
      } catch (err) {
        if (!cancelled) setError(err.message || 'Failed to load CS reps.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    return () => { cancelled = true; };
  }, [fetchPage, fetchGen, refreshKey]);

  const handleLoadMore = async () => {
    setLoadingMore(true);
    setError('');
    try {
      const { docs, last, noMoreDocs: done } = await fetchPage(lastId);
      setReps((prev) => [...prev, ...docs]);
      setLastId(last);
      setNoMoreDocs(done);
    } catch (err) {
      setError(err.message || 'Failed to load more reps.');
    } finally {
      setLoadingMore(false);
    }
  };

  const handleSearch = () => {
    setActiveEmail(emailSearch.trim());
    setReps([]);
    setLastId(null);
    setNoMoreDocs(false);
    setFetchGen((g) => g + 1);
  };

  const handleClearSearch = () => {
    setEmailSearch('');
    setActiveEmail('');
    setReps([]);
    setLastId(null);
    setNoMoreDocs(false);
    setFetchGen((g) => g + 1);
  };

  const SKELETON_COUNT = 5;

  return (
    <div className={styles.section}>
      <div className={styles.sectionHeader}>
        <h2 className={styles.sectionTitle}>CS Representatives</h2>
        <div className={styles.listControls}>
          <div className={styles.searchWrap}>
            <input
              type="text"
              className={styles.searchInput}
              placeholder="Search by email..."
              value={emailSearch}
              onChange={(e) => setEmailSearch(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              aria-label="Search CS reps by email"
            />
            <button className={styles.searchBtn} onClick={handleSearch} disabled={loading}>
              Search
            </button>
            {activeEmail && (
              <button className={styles.clearBtn} onClick={handleClearSearch}>
                Clear
              </button>
            )}
          </div>
        </div>
      </div>

      {error && <div className={styles.errorMsg}>{error}</div>}

      {loading ? (
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th className={styles.th}>Name</th>
                <th className={styles.th}>Email</th>
                <th className={styles.th}>Role(s)</th>
                <th className={styles.th}>Status</th>
                <th className={styles.th}>Created</th>
                <th className={styles.th}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {Array.from({ length: SKELETON_COUNT }).map((_, i) => (
                <tr key={i}>
                  <td colSpan={6} className={styles.td}>
                    <div className={`${styles.skeletonLine} ${styles.skeletonTitle}`} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : error ? (
        // Don't also show "No CS reps found" when the load actually failed.
        null
      ) : reps.length === 0 ? (
        <div className={styles.emptyState}>
          <p className={styles.emptyTitle}>No CS reps found</p>
          <p className={styles.emptyText}>
            {activeEmail
              ? 'No reps match that email filter. Try a different search or clear the filter.'
              : 'No CS representatives have been created yet.'}
          </p>
        </div>
      ) : (
        <>
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th className={styles.th}>Name</th>
                  <th className={styles.th}>Email</th>
                  <th className={styles.th}>Role(s)</th>
                  <th className={styles.th}>Status</th>
                  <th className={styles.th}>Created</th>
                  <th className={styles.th}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {reps.map((rep) => {
                  const uid = rep._id || rep.id;
                  const name = getDisplayName(rep);
                  const status = resolveStatus(rep);
                  const roles = Array.isArray(rep.roles) ? rep.roles : [];
                  return (
                    <tr key={uid} className={styles.tr}>
                      <td className={styles.td}>{name}</td>
                      <td className={styles.td}>{rep.email || '\u2014'}</td>
                      <td className={styles.td}>
                        <div className={styles.badgeRow}>
                          {roles.length > 0
                            ? roles.map((r) => <RoleBadge key={r} role={r} />)
                            : '\u2014'}
                        </div>
                      </td>
                      <td className={styles.td}><StatusBadge status={status} /></td>
                      <td className={styles.td}>{formatDate(rep.createdAt)}</td>
                      <td className={styles.td}>
                        <button
                          className={styles.editBtn}
                          onClick={() => onEditRep(rep)}
                        >
                          Edit
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* pagination */}
          <div className={styles.paginationBar}>
            <span className={styles.countLabel}>
              {reps.length} rep{reps.length !== 1 ? 's' : ''} loaded
            </span>
            <div>
              {!noMoreDocs ? (
                <button
                  className={styles.loadMoreBtn}
                  onClick={handleLoadMore}
                  disabled={loadingMore}
                >
                  {loadingMore ? 'Loading\u2026' : 'Load more'}
                </button>
              ) : (
                <span className={styles.allLoadedLabel}>All reps loaded</span>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
};

/* ─────────────────────────── Create CS Rep Form ─────────────────── */
const CreateCsRepForm = ({ onSuccess }) => {
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
      if (onSuccess) onSuccess();
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
const UpdateCsRepForm = ({ prefill, onSuccess }) => {
  const [userId, setUserId] = useState('');
  const [form, setForm] = useState({ firstName: '', lastName: '', email: '', password: '' });
  const [submitting, setSubmitting] = useState(false);
  const [msg, setMsg] = useState(null);
  const [attempted, setAttempted] = useState(false);
  const formRef = useRef(null);

  // When prefill changes (user clicked Edit), populate the form
  useEffect(() => {
    if (prefill) {
      setUserId(prefill._id || prefill.id || '');
      setForm({
        firstName: prefill.firstName || '',
        lastName: prefill.lastName || '',
        email: prefill.email || '',
        password: '',
      });
      setMsg(null);
      setAttempted(false);
      // Scroll to the update form
      if (formRef.current) {
        formRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }
  }, [prefill]);

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
      if (onSuccess) onSuccess();
    } catch (err) {
      setMsg({ type: 'error', text: err.message || 'Failed to update CS rep.' });
    } finally {
      setSubmitting(false);
    }
  };

  const set = (field) => (e) => setForm({ ...form, [field]: e.target.value });

  return (
    <form className={styles.form} onSubmit={handleSubmit} ref={formRef}>
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
  const [refreshKey, setRefreshKey] = useState(0);
  const [editPrefill, setEditPrefill] = useState(null);

  const triggerRefresh = () => setRefreshKey((k) => k + 1);

  const handleEditRep = (rep) => {
    setEditPrefill({ ...rep, _ts: Date.now() }); // _ts forces useEffect to re-run even if same rep
    setShowUpdate(true);
  };

  return (
    <main className={styles.page}>
      <div className={styles.pageHeader}>
        <h1 className={styles.title}>CS Representative Management</h1>
        <p className={styles.subtitle}>View, create, and update customer service representative accounts</p>
      </div>

      {/* ── CS Reps List ─────────────────────────────────────────────── */}
      <CsRepsList onEditRep={handleEditRep} refreshKey={refreshKey} />

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
        {showCreate && <CreateCsRepForm onSuccess={triggerRefresh} />}
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
        {showUpdate && <UpdateCsRepForm prefill={editPrefill} onSuccess={triggerRefresh} />}
      </div>
    </main>
  );
};

export default CsRepManagementPage;
