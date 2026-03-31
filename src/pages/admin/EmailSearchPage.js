import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../../api';
import styles from './EmailSearchPage.module.css';

// ─── helpers ──────────────────────────────────────────────────────────────────

function formatDate(value) {
  if (!value) return '—';
  try {
    return new Date(value).toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  } catch {
    return '—';
  }
}

function getDisplayName(u) {
  if (u.firstName || u.lastName) {
    return `${u.firstName || ''} ${u.lastName || ''}`.trim();
  }
  return u.fullName || u.name || u.email || u._id || u.id || 'Unknown';
}

function resolveStatus(u) {
  return (u.status || u.transient?.status || '').toLowerCase();
}

function isTierPro(u) {
  const status = resolveStatus(u);
  if (status === 'active') return true;
  if (Array.isArray(u.roles) && u.roles.includes('subscriber')) return true;
  return false;
}

function isValidEmail(val) {
  return val.includes('@') && val.includes('.');
}

// ─── sub-components ───────────────────────────────────────────────────────────

function StatusBadge({ status }) {
  const s = (status || '').toLowerCase();
  if (s === 'active')
    return <span className={`${styles.badge} ${styles.badgeActive}`}>Active</span>;
  if (s === 'suspended')
    return <span className={`${styles.badge} ${styles.badgeSuspended}`}>Suspended</span>;
  return <span className={`${styles.badge} ${styles.badgeUnknown}`}>Unknown</span>;
}

function TierBadge({ pro }) {
  return pro
    ? <span className={`${styles.badge} ${styles.badgePro}`}>Pro</span>
    : <span className={`${styles.badge} ${styles.badgeFree}`}>Free</span>;
}

function ResultCard({ user }) {
  const uid = user._id || user.id;
  const name = getDisplayName(user);
  const status = resolveStatus(user);
  const pro = isTierPro(user);

  return (
    <div className={styles.resultCard}>
      <div className={styles.cardTop}>
        <h2 className={styles.userName}>{name}</h2>
        <div className={styles.badgeRow}>
          <StatusBadge status={status} />
          <TierBadge pro={pro} />
        </div>
      </div>

      <div className={styles.fieldGrid}>
        <div className={styles.field}>
          <span className={styles.fieldLabel}>Email</span>
          <span className={styles.fieldValue}>{user.email || '—'}</span>
        </div>

        <div className={styles.field}>
          <span className={styles.fieldLabel}>Joined</span>
          <span className={styles.fieldValue}>{formatDate(user.createdAt)}</span>
        </div>

        <div className={styles.field}>
          <span className={styles.fieldLabel}>User ID</span>
          <span className={`${styles.fieldValue} ${styles.userId}`}>{uid || '—'}</span>
        </div>
      </div>

      <Link to={`/admin/users/${uid}`} className={styles.viewProfileBtn}>
        View Full Profile →
      </Link>
    </div>
  );
}

// ─── main component ───────────────────────────────────────────────────────────

const EmailSearchPage = () => {
  const [inputValue, setInputValue]   = useState('');
  const [loading, setLoading]         = useState(false);
  const [error, setError]             = useState('');
  const [searched, setSearched]       = useState(false);
  const [result, setResult]           = useState(null);

  const handleChange = (e) => {
    setInputValue(e.target.value);
    // Clear results when the field is emptied
    if (!e.target.value.trim()) {
      setSearched(false);
      setResult(null);
      setError('');
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    const email = inputValue.trim();
    if (!isValidEmail(email)) {
      setError('Please enter a valid email address.');
      return;
    }

    setLoading(true);
    setError('');
    setSearched(false);
    setResult(null);

    try {
      const res = await api.adminListUsers({ email });
      // BC returns { data: [...], noMoreDocs: bool } — take first match
      const docs = res?.data ?? [];
      setResult(docs.length > 0 ? docs[0] : null);
      setSearched(true);
    } catch (err) {
      setError(err.message || 'Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className={styles.page}>
      {/* ── header ── */}
      <div className={styles.pageHeader}>
        <h1 className={styles.title}>Email Search</h1>
        <p className={styles.subtitle}>Look up a member account by email address.</p>
      </div>

      {/* ── search form ── */}
      <form className={styles.searchRow} onSubmit={handleSubmit} noValidate>
        <input
          type="email"
          className={styles.emailInput}
          placeholder="Enter email address…"
          value={inputValue}
          onChange={handleChange}
          aria-label="Email address"
          autoComplete="off"
          autoFocus
        />
        <button
          type="submit"
          className={styles.searchBtn}
          disabled={loading || !inputValue.trim()}
        >
          {loading ? 'Searching…' : 'Search'}
        </button>
      </form>

      {/* ── error banner ── */}
      {error && <div className={styles.errorBanner}>{error}</div>}

      {/* ── results ── */}
      {loading && (
        <div className={styles.spinnerWrap} aria-label="Loading">
          <div className={styles.spinner} />
        </div>
      )}

      {!loading && searched && (
        result
          ? <ResultCard user={result} />
          : (
            <div className={styles.emptyState}>
              <div className={styles.emptyIcon}>
                <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#d1d5db" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="11" cy="11" r="8" />
                  <line x1="21" y1="21" x2="16.65" y2="16.65" />
                  <line x1="8" y1="11" x2="14" y2="11" />
                </svg>
              </div>
              <p className={styles.emptyTitle}>No account found</p>
              <p className={styles.emptyText}>No account found for that email address.</p>
            </div>
          )
      )}
    </main>
  );
};

export default EmailSearchPage;
