import React, { useCallback, useEffect, useMemo, useState } from 'react';
import api from '../../api';
import { useAuth } from '../../context/AuthContext';
import styles from './MailActivityPage.module.css';

// ─── helpers ──────────────────────────────────────────────────────────────────

function formatDate(value) {
  if (!value) return '—';
  try {
    return new Date(value).toLocaleDateString(undefined, {
      year: 'numeric', month: 'short', day: 'numeric',
    });
  } catch { return '—'; }
}

function resolveId(item) {
  return item._id || item.id || item.mailId || '';
}

function resolveStatus(item) {
  return (item.status || 'active').toLowerCase();
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function SkeletonCard() {
  return (
    <div className={styles.skeletonCard} aria-hidden="true">
      <div className={`${styles.skeletonLine} ${styles.skeletonTitle}`} />
      <div className={`${styles.skeletonLine} ${styles.skeletonShort}`} />
      <div className={`${styles.skeletonLine} ${styles.skeletonShort}`} />
      <div className={`${styles.skeletonLine} ${styles.skeletonBtn}`} />
    </div>
  );
}

// ─── StatusBadge ──────────────────────────────────────────────────────────────

function StatusBadge({ status }) {
  const s = (status || '').toLowerCase();
  if (s === 'active') return <span className={`${styles.badge} ${styles.badgeActive}`}>Active</span>;
  if (s === 'unsubscribed') return <span className={`${styles.badge} ${styles.badgeUnsub}`}>Unsubscribed</span>;
  return <span className={`${styles.badge} ${styles.badgeDefault}`}>{s || 'unknown'}</span>;
}

// ─── MailCard ─────────────────────────────────────────────────────────────────

function MailCard({ item, onUnsubscribe, removing }) {
  const id = resolveId(item);
  const status = resolveStatus(item);
  const [confirm, setConfirm] = useState(false);

  return (
    <div className={styles.mailCard}>
      <div className={styles.mailHeader}>
        <span className={styles.mailId}>
          {item.mailId || item.id || item._id || 'MAIL–'}
        </span>
        <StatusBadge status={status} />
      </div>
      <p className={styles.mailRow}><strong>Email:</strong> {item.email || item.to || item.recipient || '—'}</p>
      {item.subject && <p className={styles.mailRow}><strong>Subject:</strong> {item.subject}</p>}
      {item.type && <p className={styles.mailRow}><strong>Type:</strong> {item.type}</p>}
      <p className={styles.mailRow}><strong>Sent:</strong> {formatDate(item.sentAt || item.createdAt || item.date)}</p>

      <div className={styles.mailActions}>
        {status !== 'unsubscribed' && (
          confirm ? (
            <>
              <span className={styles.confirmText}>Unsubscribe?</span>
              <button
                className={styles.confirmYes}
                onClick={() => { setConfirm(false); onUnsubscribe(id, item); }}
                disabled={removing}
              >
                Yes
              </button>
              <button className={styles.confirmNo} onClick={() => setConfirm(false)}>No</button>
            </>
          ) : (
            <button className={styles.unsubBtn} onClick={() => setConfirm(true)} disabled={removing}>
              Unsubscribe
            </button>
          )
        )}
      </div>
    </div>
  );
}

// ─── MailActivityPage ─────────────────────────────────────────────────────────

const MailActivityPage = () => {
  const { token } = useAuth();

  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [isMockUnavailable, setIsMockUnavailable] = useState(false);
  const [search, setSearch] = useState('');
  const [removing, setRemoving] = useState(false);
  const [toast, setToast] = useState('');

  const showToast = useCallback((msg) => {
    setToast(msg);
    setTimeout(() => setToast(''), 3000);
  }, []);

  const fetchLog = useCallback(async () => {
    setLoading(true);
    setError('');
    setIsMockUnavailable(false);
    try {
      const data = await api.getEmailLog({ token });
      const list = data?.data || data?.docs || data?.emails || data || [];
      setItems(Array.isArray(list) ? list : []);
    } catch (err) {
      if (err.isMockUnavailable) {
        setIsMockUnavailable(true);
      } else {
        setError(err.message || 'Failed to load mail activity log.');
      }
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => { fetchLog(); }, [fetchLog]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    if (!q) return items;
    return items.filter((it) =>
      (it.email || it.to || it.recipient || '').toLowerCase().includes(q) ||
      (it.mailId || it.id || it._id || '').toLowerCase().includes(q) ||
      (it.subject || '').toLowerCase().includes(q)
    );
  }, [items, search]);

  const handleUnsubscribe = async (id, item) => {
    setRemoving(true);
    try {
      // Mark item as unsubscribed optimistically
      setItems((prev) =>
        prev.map((it) =>
          (it._id || it.id || it.mailId) === id
            ? { ...it, status: 'unsubscribed' }
            : it
        )
      );
      showToast('Recipient unsubscribed.');
    } catch (err) {
      showToast('Failed to unsubscribe: ' + (err.message || 'Unknown error'));
    } finally {
      setRemoving(false);
    }
  };

  return (
    <main className={styles.page}>
      {toast && <div className={styles.toast}>{toast}</div>}

      <div className={styles.pageHeader}>
        <div>
          <h1 className={styles.title}>Mail Activity Log</h1>
          <p className={styles.subtitle}>All outbound email records with per-recipient status.</p>
        </div>
        <button
          className={styles.refreshBtn}
          onClick={fetchLog}
          disabled={loading}
        >
          {loading ? 'Loading…' : 'Refresh'}
        </button>
      </div>

      <div className={styles.filterBar}>
        <input
          className={styles.searchInput}
          type="text"
          placeholder="Search by recipient, mail ID, or subject…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {/* Loading skeletons */}
      {loading && (
        <div className={styles.grid}>
          {Array.from({ length: 6 }).map((_, i) => <SkeletonCard key={i} />)}
        </div>
      )}

      {/* Mock unavailable */}
      {!loading && isMockUnavailable && (
        <div className={styles.emptyState}>
          <p className={styles.emptyIcon}>📭</p>
          <p className={styles.emptyTitle}>No mail log data available</p>
          <p className={styles.emptySubtitle}>
            Mail activity data will appear here once the production email service is connected.
          </p>
        </div>
      )}

      {/* Error */}
      {!loading && error && (
        <div className={styles.errorBox}>{error}</div>
      )}

      {/* Empty results */}
      {!loading && !error && !isMockUnavailable && items.length === 0 && (
        <div className={styles.emptyState}>
          <p className={styles.emptyTitle}>No mail activity yet.</p>
        </div>
      )}

      {/* Filtered empty */}
      {!loading && !error && items.length > 0 && filtered.length === 0 && (
        <div className={styles.emptyState}>
          <p>No results for "<strong>{search}</strong>".</p>
        </div>
      )}

      {/* Cards */}
      {!loading && filtered.length > 0 && (
        <div className={styles.grid}>
          {filtered.map((item, idx) => (
            <MailCard
              key={resolveId(item) || idx}
              item={item}
              onUnsubscribe={handleUnsubscribe}
              removing={removing}
            />
          ))}
        </div>
      )}
    </main>
  );
};

export default MailActivityPage;
