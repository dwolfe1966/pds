import React, { useEffect, useState, useCallback } from 'react';
import api from '../../api';
import { useAuth } from '../../context/AuthContext';
import styles from './PhoneOptOutPage.module.css';

/**
 * Admin page to manage phone opt-out entries.
 * Fields expected from API: _id, phone, status ('active'|'inactive'), createdAt
 */

const PAGE_SIZE = 10;

function formatPhone(raw) {
  const digits = (raw || '').replace(/\D/g, '');
  if (digits.length === 10) return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
  if (digits.length === 11 && digits[0] === '1')
    return `+1 (${digits.slice(1, 4)}) ${digits.slice(4, 7)}-${digits.slice(7)}`;
  return raw || '—';
}

function StatusBadge({ status }) {
  const s = (status || '').toLowerCase();
  if (s === 'active') {
    return <span className={`${styles.badge} ${styles.badgeActive}`}>Active</span>;
  }
  return <span className={`${styles.badge} ${styles.badgeInactive}`}>Inactive</span>;
}

const PhoneOptOutPage = () => {
  const { token } = useAuth();

  const [allEntries, setAllEntries]     = useState([]);
  const [loading, setLoading]           = useState(true);
  const [loadingMore, setLoadingMore]   = useState(false);
  const [error, setError]               = useState('');
  const [isEmpty, setIsEmpty]           = useState(false);
  const [noMoreDocs, setNoMoreDocs]     = useState(false);
  const [lastId, setLastId]             = useState(null);

  // Filter state
  const [search, setSearch]             = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  // Per-row delete state: { [id]: 'loading' | 'error' }
  const [rowState, setRowState]         = useState({});

  // ── fetch helpers ──────────────────────────────────────────────────

  const fetchPage = useCallback(async (cursorId = null) => {
    const params = cursorId
      ? { lastId: cursorId, limit: PAGE_SIZE }
      : { limit: PAGE_SIZE };
    const res  = await api.get('/admin/phone-optout', { params, token });
    const docs = res?.data ?? res?.docs ?? (Array.isArray(res) ? res : []);
    const last = docs.length > 0 ? (docs[docs.length - 1]._id || docs[docs.length - 1].id) : null;
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
        setAllEntries(docs);
        setLastId(last);
        setNoMoreDocs(done);
        setIsEmpty(docs.length === 0);
      })
      .catch((err) => {
        if (cancelled) return;
        if (err.isMockUnavailable) {
          setIsEmpty(true);
        } else {
          setError(err.message || 'Failed to load phone opt-outs.');
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
      setAllEntries((prev) => [...prev, ...docs]);
      setLastId(last);
      setNoMoreDocs(done);
    } catch (err) {
      if (!err.isMockUnavailable) {
        setError(err.message || 'Failed to load more entries.');
      }
    } finally {
      setLoadingMore(false);
    }
  };

  // ── remove action ──────────────────────────────────────────────────

  const handleRemove = async (entry) => {
    const id    = entry._id || entry.id;
    const label = formatPhone(entry.phone);

    if (!window.confirm(`Remove phone opt-out for ${label}?`)) return;

    setRowState((prev) => ({ ...prev, [id]: 'loading' }));

    try {
      await api.delete(`/admin/phone-optout/${id}`, { token });
      setAllEntries((prev) => prev.filter((e) => (e._id || e.id) !== id));
      setRowState((prev) => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
    } catch (err) {
      setRowState((prev) => ({ ...prev, [id]: 'error' }));
      setTimeout(() => {
        setRowState((prev) => {
          const next = { ...prev };
          delete next[id];
          return next;
        });
      }, 4000);
    }
  };

  // ── derived stats ──────────────────────────────────────────────────

  const totalCount    = allEntries.length;
  const activeCount   = allEntries.filter((e) => (e.status || '').toLowerCase() === 'active').length;
  const inactiveCount = allEntries.filter((e) => (e.status || '').toLowerCase() !== 'active').length;

  // ── client-side filtering ──────────────────────────────────────────

  const filtered = allEntries.filter((e) => {
    const q           = search.trim().toLowerCase();
    const phoneRaw    = (e.phone || '').toLowerCase();
    const phoneFormatted = formatPhone(e.phone).toLowerCase();
    const matchSearch = !q || phoneRaw.includes(q) || phoneFormatted.includes(q);

    const s = (e.status || '').toLowerCase();
    let matchStatus = true;
    if (statusFilter === 'active')   matchStatus = s === 'active';
    if (statusFilter === 'inactive') matchStatus = s !== 'active';

    return matchSearch && matchStatus;
  });

  // ── render ─────────────────────────────────────────────────────────

  return (
    <main className={styles.page}>
      {/* Page header */}
      <div className={styles.pageHeader}>
        <div className={styles.titleBlock}>
          <h1 className={styles.title}>Manage Phone Opt-Outs</h1>
          <p className={styles.subtitle}>View and remove phone numbers from the opt-out registry</p>
        </div>
      </div>

      {/* Stats bar */}
      <div className={styles.statsBar}>
        <div className={styles.statCard}>
          <div className={styles.statNumber}>{totalCount}</div>
          <div className={styles.statLabel}>Total Opt-Outs</div>
        </div>
        <div className={styles.statCard}>
          <div className={`${styles.statNumber} ${styles.statNumberActive}`}>{activeCount}</div>
          <div className={styles.statLabel}>Active</div>
        </div>
        <div className={styles.statCard}>
          <div className={`${styles.statNumber} ${styles.statNumberInactive}`}>{inactiveCount}</div>
          <div className={styles.statLabel}>Inactive</div>
        </div>
      </div>

      {/* Error banner */}
      {error && <div className={styles.errorBanner}>{error}</div>}

      {/* Filter row */}
      <div className={styles.filterRow}>
        <div className={styles.searchWrap}>
          <span className={styles.searchIcon}>
            <svg width="15" height="15" viewBox="0 0 20 20" fill="none">
              <circle cx="9" cy="9" r="6.5" stroke="#9ca3af" strokeWidth="1.8"/>
              <path d="M14.5 14.5l3.5 3.5" stroke="#9ca3af" strokeWidth="1.8" strokeLinecap="round"/>
            </svg>
          </span>
          <input
            type="text"
            className={styles.searchInput}
            placeholder="Search phone number…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <select
          className={styles.filterSelect}
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
        >
          <option value="all">All Statuses</option>
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
        </select>
      </div>

      {/* Content */}
      {loading ? (
        <div className={styles.loadingWrap}>
          {[...Array(5)].map((_, i) => (
            <div key={i} className={styles.skeletonCard}>
              <div className={`${styles.skeletonCell} ${styles.skeletonLong}`} />
              <div className={`${styles.skeletonCell} ${styles.skeletonMed}`} />
              <div className={`${styles.skeletonCell} ${styles.skeletonShort}`} />
              <div className={`${styles.skeletonCell} ${styles.skeletonXShort}`} />
            </div>
          ))}
        </div>
      ) : isEmpty ? (
        <div className={styles.emptyState}>
          <div className={styles.emptyIcon}>📵</div>
          <p className={styles.emptyTitle}>No phone opt-outs found</p>
          <p className={styles.emptyText}>Phone opt-out entries will appear here once submitted.</p>
        </div>
      ) : (
        <>
          {/* Card list */}
          <ul className={styles.cardList}>
            {filtered.length === 0 ? (
              <li className={styles.noResults}>No entries match your filters.</li>
            ) : (
              filtered.map((entry) => {
                const id      = entry._id || entry.id;
                const s       = (entry.status || '').toLowerCase();
                const isActive = s === 'active';
                const date    = entry.createdAt
                  ? new Date(entry.createdAt).toLocaleDateString()
                  : (entry.date || '—');
                const rState  = rowState[id];

                return (
                  <li
                    key={id}
                    className={`${styles.phoneCard} ${isActive ? styles.phoneCardActive : styles.phoneCardInactive}`}
                  >
                    <div className={styles.cardLeft}>
                      <span className={styles.phoneNumber}>{formatPhone(entry.phone)}</span>
                      <span className={styles.dateAdded}>Added {date}</span>
                    </div>
                    <div className={styles.cardCenter}>
                      <StatusBadge status={entry.status} />
                    </div>
                    <div className={styles.cardRight}>
                      {rState === 'error' && (
                        <span className={styles.inlineError}>Failed</span>
                      )}
                      <button
                        className={styles.removeBtn}
                        onClick={() => handleRemove(entry)}
                        disabled={rState === 'loading'}
                      >
                        {rState === 'loading' ? 'Removing…' : 'Remove'}
                      </button>
                    </div>
                  </li>
                );
              })
            )}
          </ul>

          {/* Pagination */}
          <div className={styles.paginationBar}>
            <span className={styles.countLabel}>
              Showing {filtered.length} of {totalCount} loaded
            </span>
            {!noMoreDocs ? (
              <button
                className={styles.loadMoreBtn}
                onClick={handleLoadMore}
                disabled={loadingMore}
              >
                {loadingMore ? 'Loading…' : 'Load More'}
              </button>
            ) : (
              <span className={styles.allLoadedLabel}>All entries loaded</span>
            )}
          </div>
        </>
      )}
    </main>
  );
};

export default PhoneOptOutPage;
