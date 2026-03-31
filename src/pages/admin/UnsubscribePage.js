import React, { useCallback, useEffect, useMemo, useState } from 'react';
import api from '../../api';
import { useAuth } from '../../context/AuthContext';
import styles from './UnsubscribePage.module.css';

// ─── helpers ─────────────────────────────────────────────────────────────────

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

function resolveId(item) {
  return item._id || item.id || '';
}

function resolveStatus(item) {
  return (item.status || '').toLowerCase();
}

// ─── sub-components ──────────────────────────────────────────────────────────

function StatusBadge({ status }) {
  const s = (status || '').toLowerCase();
  if (s === 'active') {
    return <span className={`${styles.badge} ${styles.badgeActive}`}>Active</span>;
  }
  return <span className={`${styles.badge} ${styles.badgeInactive}`}>Inactive</span>;
}

function SkeletonCard() {
  return (
    <div className={styles.skeletonCard} aria-hidden="true">
      <div className={`${styles.skeletonLine} ${styles.skeletonTitle}`} />
      <div className={`${styles.skeletonLine} ${styles.skeletonShort}`} />
      <div className={`${styles.skeletonLine} ${styles.skeletonShort}`} />
      <div className={`${styles.skeletonLine} ${styles.skeletonMed}`} />
      <div className={`${styles.skeletonLine} ${styles.skeletonBtn}`} />
    </div>
  );
}

function UnsubscribeCard({ item, onRemove, removing }) {
  const id = resolveId(item);
  const status = resolveStatus(item);

  return (
    <div
      className={styles.card}
      style={{ borderLeftColor: status === 'active' ? '#16a34a' : '#9ca3af' }}
    >
      <div className={styles.cardTop}>
        <h3 className={styles.emailTitle} title={item.email}>{item.email || '—'}</h3>
        <StatusBadge status={status} />
      </div>

      {item.phone && (
        <div className={styles.cardField}>
          <span className={styles.fieldLabel}>Phone</span>
          <span className={styles.fieldValue}>{item.phone}</span>
        </div>
      )}

      <div className={styles.cardField}>
        <span className={styles.fieldLabel}>Joined</span>
        <span className={styles.fieldValue}>{formatDate(item.createdAt || item.joinedAt)}</span>
      </div>

      <div className={styles.cardField}>
        <span className={styles.fieldLabel}>Unsubscribed</span>
        <span className={styles.fieldValue}>{formatDate(item.unsubscribedAt || item.leftAt || item.updatedAt)}</span>
      </div>

      {item.brand && (
        <div className={styles.cardField}>
          <span className={styles.fieldLabel}>Brand</span>
          <span className={styles.fieldValue}>{item.brand}</span>
        </div>
      )}

      <button
        className={styles.removeBtn}
        onClick={() => onRemove(item)}
        disabled={removing}
      >
        {removing ? 'Removing…' : 'Remove'}
      </button>
    </div>
  );
}

// ─── main component ───────────────────────────────────────────────────────────

const PAGE_SIZE = 10;
const SKELETON_COUNT = 6;

const UnsubscribePage = () => {
  const { token } = useAuth();

  const [allItems, setAllItems]         = useState([]);
  const [loading, setLoading]           = useState(true);
  const [loadingMore, setLoadingMore]   = useState(false);
  const [error, setError]               = useState('');
  const [isEmpty, setIsEmpty]           = useState(false);
  const [noMoreDocs, setNoMoreDocs]     = useState(false);
  const [lastId, setLastId]             = useState(null);

  // Filter state
  const [emailFilter, setEmailFilter]   = useState('');
  const [phoneFilter, setPhoneFilter]   = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  // Per-row removing state: Set of ids
  const [removingIds, setRemovingIds]   = useState(new Set());

  // ── fetch helpers ──────────────────────────────────────────────────────────

  const fetchPage = useCallback(async (cursorId = null) => {
    const params = cursorId
      ? { lastId: cursorId, limit: PAGE_SIZE }
      : { limit: PAGE_SIZE };
    const res = await api.get('/admin/unsubscribe', { params, token });
    const docs = res?.data ?? (Array.isArray(res) ? res : []);
    const last = docs.length > 0 ? (docs[docs.length - 1]._id || docs[docs.length - 1].id || null) : null;
    const done = res?.noMoreDocs ?? docs.length < PAGE_SIZE;
    return { docs, last, done };
  }, [token]);

  // Initial load
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError('');

    fetchPage(null)
      .then(({ docs, last, done }) => {
        if (cancelled) return;
        setAllItems(docs);
        setLastId(last);
        setNoMoreDocs(done);
        setIsEmpty(docs.length === 0);
      })
      .catch((err) => {
        if (cancelled) return;
        if (err.isMockUnavailable) {
          setIsEmpty(true);
        } else {
          setError(err.message || 'Failed to load unsubscribed users.');
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => { cancelled = true; };
  }, [fetchPage]);

  // Load more
  const handleLoadMore = async () => {
    if (loadingMore || noMoreDocs) return;
    setLoadingMore(true);
    try {
      const { docs, last, done } = await fetchPage(lastId);
      setAllItems((prev) => [...prev, ...docs]);
      setLastId(last);
      setNoMoreDocs(done);
    } catch (err) {
      if (!err.isMockUnavailable) {
        setError(err.message || 'Failed to load more records.');
      }
    } finally {
      setLoadingMore(false);
    }
  };

  // ── remove action ──────────────────────────────────────────────────────────

  const handleRemove = async (item) => {
    const id = resolveId(item);
    const email = item.email || id;

    if (!window.confirm(`Remove ${email} from the unsubscribe list?`)) return;

    setRemovingIds((prev) => new Set([...prev, id]));

    try {
      await api.delete(`/admin/unsubscribe/${id}`, { token });
      setAllItems((prev) => prev.filter((r) => resolveId(r) !== id));
    } catch (err) {
      setError(err.message || 'Failed to remove record.');
    } finally {
      setRemovingIds((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }
  };

  // ── derived stats ──────────────────────────────────────────────────────────

  const totalCount  = allItems.length;
  const activeCount = allItems.filter((r) => resolveStatus(r) === 'active').length;

  // Month-added count (current calendar month)
  const thisMonth = new Date();
  const addedThisMonth = allItems.filter((r) => {
    const d = r.createdAt || r.joinedAt;
    if (!d) return false;
    const date = new Date(d);
    return (
      date.getFullYear() === thisMonth.getFullYear() &&
      date.getMonth() === thisMonth.getMonth()
    );
  }).length;

  // ── client-side filtering ──────────────────────────────────────────────────

  const filtered = useMemo(() => {
    const eq = emailFilter.trim().toLowerCase();
    const pq = phoneFilter.trim().toLowerCase();
    return allItems.filter((r) => {
      if (statusFilter !== 'all') {
        if (resolveStatus(r) !== statusFilter) return false;
      }
      if (eq && !(r.email || '').toLowerCase().includes(eq)) return false;
      if (pq && !(r.phone || '').toLowerCase().includes(pq)) return false;
      return true;
    });
  }, [allItems, emailFilter, phoneFilter, statusFilter]);

  // ── render ─────────────────────────────────────────────────────────────────

  return (
    <main className={styles.page}>
      {/* Page header */}
      <div className={styles.pageHeader}>
        <div className={styles.titleBlock}>
          <h1 className={styles.title}>Unsubscribed Users</h1>
          <p className={styles.subtitle}>Manage users who have opted out of marketing emails</p>
        </div>
      </div>

      {/* Stats bar */}
      <div className={styles.statsBar}>
        <div className={styles.statCard}>
          <div className={styles.statNumber}>{totalCount}</div>
          <div className={styles.statLabel}>Total Unsubscribed</div>
        </div>
        <div className={styles.statCard}>
          <div className={styles.statNumber}>{addedThisMonth}</div>
          <div className={styles.statLabel}>Added This Month</div>
        </div>
        <div className={styles.statCard}>
          <div className={styles.statNumber}>{activeCount}</div>
          <div className={styles.statLabel}>Active</div>
        </div>
      </div>

      {/* Error banner */}
      {error && <div className={styles.errorBanner}>{error}</div>}

      {/* Filter bar */}
      <div className={styles.filterBar}>
        <div className={styles.searchWrap}>
          <span className={styles.searchIcon}>
            <svg width="15" height="15" viewBox="0 0 20 20" fill="none">
              <circle cx="9" cy="9" r="6.5" stroke="#9ca3af" strokeWidth="1.8" />
              <path d="M14.5 14.5l3.5 3.5" stroke="#9ca3af" strokeWidth="1.8" strokeLinecap="round" />
            </svg>
          </span>
          <input
            type="text"
            className={styles.filterInput}
            placeholder="Search by email…"
            value={emailFilter}
            onChange={(e) => setEmailFilter(e.target.value)}
            aria-label="Filter by email"
          />
        </div>

        <div className={styles.searchWrap}>
          <span className={styles.searchIcon}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.15 12 19.79 19.79 0 0 1 1.07 3.36 2 2 0 0 1 3.05 1h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L7.09 8.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
            </svg>
          </span>
          <input
            type="text"
            className={styles.filterInput}
            placeholder="Search by phone…"
            value={phoneFilter}
            onChange={(e) => setPhoneFilter(e.target.value)}
            aria-label="Filter by phone"
          />
        </div>

        <select
          className={styles.filterSelect}
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          aria-label="Filter by status"
        >
          <option value="all">All Statuses</option>
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
        </select>
      </div>

      {/* Card list */}
      {loading ? (
        <div className={styles.cardList}>
          {Array.from({ length: SKELETON_COUNT }).map((_, i) => (
            <SkeletonCard key={i} />
          ))}
        </div>
      ) : isEmpty ? (
        <div className={styles.emptyState}>
          <div className={styles.emptyIcon}>📭</div>
          <p className={styles.emptyTitle}>No unsubscribed users found</p>
          <p className={styles.emptyText}>
            Users who opt out of marketing emails will appear here.
          </p>
        </div>
      ) : filtered.length === 0 ? (
        <div className={styles.emptyState}>
          <div className={styles.emptyIcon}>🔍</div>
          <p className={styles.emptyTitle}>No results match your filters</p>
          <p className={styles.emptyText}>Try adjusting your search or status filter.</p>
        </div>
      ) : (
        <div className={styles.cardList}>
          {filtered.map((item) => {
            const id = resolveId(item);
            return (
              <UnsubscribeCard
                key={id || item.email}
                item={item}
                onRemove={handleRemove}
                removing={removingIds.has(id)}
              />
            );
          })}
        </div>
      )}

      {/* Pagination bar */}
      {!loading && allItems.length > 0 && (
        <div className={styles.paginationBar}>
          <span className={styles.countLabel}>
            {filtered.length !== allItems.length
              ? `${filtered.length} of ${allItems.length} loaded`
              : `${allItems.length} record${allItems.length !== 1 ? 's' : ''} loaded`}
          </span>
          <div>
            {!noMoreDocs ? (
              <button
                className={styles.loadMoreBtn}
                onClick={handleLoadMore}
                disabled={loadingMore}
              >
                {loadingMore ? 'Loading…' : 'Load More'}
              </button>
            ) : (
              <span className={styles.allLoadedLabel}>All records loaded</span>
            )}
          </div>
        </div>
      )}
    </main>
  );
};

export default UnsubscribePage;
