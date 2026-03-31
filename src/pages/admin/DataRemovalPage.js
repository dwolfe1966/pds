import React, { useEffect, useState, useCallback } from 'react';
import api from '../../api';
import { useAuth } from '../../context/AuthContext';
import styles from './DataRemovalPage.module.css';

/**
 * Admin page to manage data removal / opt-out requests via BC CSR API.
 * BC fields: _id, email, status, createdAt
 */

const PAGE_SIZE = 10;

function StatusBadge({ status }) {
  const s = (status || '').toLowerCase();
  let cls = styles.badgeUnknown;
  let label = status || 'Unknown';

  if (s === 'pending' || s === 'requested') {
    cls = styles.badgePending;
    label = s === 'requested' ? 'Requested' : 'Pending';
  } else if (s === 'approved' || s === 'completed') {
    cls = styles.badgeApproved;
    label = s === 'completed' ? 'Completed' : 'Approved';
  } else if (s === 'rejected') {
    cls = styles.badgeRejected;
    label = 'Rejected';
  }

  return <span className={`${styles.badge} ${cls}`}>{label}</span>;
}

const DataRemovalPage = () => {
  const { token } = useAuth();

  const [allRequests, setAllRequests]   = useState([]);
  const [loading, setLoading]           = useState(true);
  const [loadingMore, setLoadingMore]   = useState(false);
  const [error, setError]               = useState('');
  const [isEmpty, setIsEmpty]           = useState(false);
  const [noMoreDocs, setNoMoreDocs]     = useState(false);
  const [lastId, setLastId]             = useState(null);

  // Filter state
  const [search, setSearch]             = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  // Per-row approve state: { [id]: 'loading' | 'error' }
  const [rowState, setRowState]         = useState({});

  // ── fetch helpers ──────────────────────────────────────────────────

  const fetchPage = useCallback(async (cursorId = null) => {
    const params = cursorId ? { lastId: cursorId, limit: PAGE_SIZE } : { limit: PAGE_SIZE };
    const res = await api.adminListDataRemoval(params);
    const docs  = res?.data ?? (Array.isArray(res) ? res : []);
    const last  = docs.length > 0 ? docs[docs.length - 1]._id || docs[docs.length - 1].id : null;
    const done  = res?.noMoreDocs ?? docs.length < PAGE_SIZE;
    return { docs, last, done };
  }, []);

  // Initial load
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError('');

    fetchPage(null)
      .then(({ docs, last, done }) => {
        if (cancelled) return;
        setAllRequests(docs);
        setLastId(last);
        setNoMoreDocs(done);
        setIsEmpty(docs.length === 0);
      })
      .catch((err) => {
        if (cancelled) return;
        if (err.isMockUnavailable) {
          setIsEmpty(true);
        } else {
          setError(err.message || 'Failed to load data removal requests.');
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
      setAllRequests((prev) => [...prev, ...docs]);
      setLastId(last);
      setNoMoreDocs(done);
    } catch (err) {
      if (!err.isMockUnavailable) {
        setError(err.message || 'Failed to load more requests.');
      }
    } finally {
      setLoadingMore(false);
    }
  };

  // ── approve action ─────────────────────────────────────────────────

  const handleApprove = async (req) => {
    const id    = req._id || req.id;
    const email = req.email || req.userId || id;

    if (!window.confirm(`Approve data removal for ${email}?`)) return;

    setRowState((prev) => ({ ...prev, [id]: 'loading' }));

    try {
      await api.post(`/admin/data-removal/${id}/approve`, { token });
      // Optimistic update — flip status to approved
      setAllRequests((prev) =>
        prev.map((r) => {
          const rid = r._id || r.id;
          return rid === id ? { ...r, status: 'approved' } : r;
        })
      );
      setRowState((prev) => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
    } catch (err) {
      setRowState((prev) => ({ ...prev, [id]: 'error' }));
      // Auto-clear error toast after 4 s
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

  const totalCount   = allRequests.length;
  const pendingCount = allRequests.filter((r) => {
    const s = (r.status || '').toLowerCase();
    return s === 'pending' || s === 'requested';
  }).length;
  const approvedCount = allRequests.filter((r) => {
    const s = (r.status || '').toLowerCase();
    return s === 'approved' || s === 'completed';
  }).length;

  // ── client-side filtering ──────────────────────────────────────────

  const filtered = allRequests.filter((r) => {
    const id    = (r._id || r.id || '').toLowerCase();
    const email = (r.email || r.userId || '').toLowerCase();
    const q     = search.trim().toLowerCase();
    const matchSearch = !q || id.includes(q) || email.includes(q);

    const s = (r.status || '').toLowerCase();
    let matchStatus = true;
    if (statusFilter === 'pending')  matchStatus = s === 'pending' || s === 'requested';
    if (statusFilter === 'approved') matchStatus = s === 'approved' || s === 'completed';
    if (statusFilter === 'rejected') matchStatus = s === 'rejected';

    return matchSearch && matchStatus;
  });

  // ── render ─────────────────────────────────────────────────────────

  return (
    <main className={styles.page}>
      {/* Page header */}
      <div className={styles.pageHeader}>
        <div className={styles.titleBlock}>
          <h1 className={styles.title}>Data Removal Requests</h1>
          <p className={styles.subtitle}>Manage opt-out and data removal requests</p>
        </div>
      </div>

      {/* Stats bar */}
      <div className={styles.statsBar}>
        <div className={styles.statCard}>
          <div className={styles.statNumber}>{totalCount}</div>
          <div className={styles.statLabel}>Total Requests</div>
        </div>
        <div className={styles.statCard}>
          <div className={styles.statNumber}>{pendingCount}</div>
          <div className={styles.statLabel}>Pending</div>
        </div>
        <div className={styles.statCard}>
          <div className={styles.statNumber}>{approvedCount}</div>
          <div className={styles.statLabel}>Approved</div>
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
            placeholder="Search by email or ID…"
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
          <option value="pending">Pending</option>
          <option value="approved">Approved</option>
          <option value="rejected">Rejected</option>
        </select>
      </div>

      {/* Table */}
      {loading ? (
        <div className={styles.loadingWrap}>
          {[...Array(5)].map((_, i) => (
            <div key={i} className={styles.skeletonRow}>
              <div className={`${styles.skeletonCell} ${styles.skeletonLong}`} />
              <div className={`${styles.skeletonCell} ${styles.skeletonMed}`} />
              <div className={`${styles.skeletonCell} ${styles.skeletonShort}`} />
              <div className={`${styles.skeletonCell} ${styles.skeletonShort}`} />
              <div className={`${styles.skeletonCell} ${styles.skeletonXShort}`} />
            </div>
          ))}
        </div>
      ) : isEmpty ? (
        <div className={styles.emptyState}>
          <div className={styles.emptyIcon}>📋</div>
          <p className={styles.emptyTitle}>No data removal requests</p>
          <p className={styles.emptyText}>Requests will appear here once users submit opt-out forms.</p>
        </div>
      ) : (
        <>
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th className={styles.th}>Request ID</th>
                  <th className={styles.th}>Email</th>
                  <th className={styles.th}>Status</th>
                  <th className={styles.th}>Date Requested</th>
                  <th className={styles.th}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={5} className={styles.noResultsCell}>
                      No requests match your filters.
                    </td>
                  </tr>
                ) : (
                  filtered.map((r) => {
                    const id    = r._id || r.id;
                    const email = r.email || r.userId || '—';
                    const date  = r.createdAt
                      ? new Date(r.createdAt).toLocaleDateString()
                      : (r.requestedAt || r.date || '—');
                    const s     = (r.status || '').toLowerCase();
                    const isPending = s === 'pending' || s === 'requested';
                    const rState = rowState[id];

                    return (
                      <tr key={id} className={styles.tr}>
                        <td className={styles.tdMono} title={id}>
                          {id ? id.slice(0, 16) + (id.length > 16 ? '…' : '') : '—'}
                        </td>
                        <td className={styles.td}>{email}</td>
                        <td className={styles.td}>
                          <StatusBadge status={r.status} />
                        </td>
                        <td className={styles.td}>{date}</td>
                        <td className={styles.tdActions}>
                          {isPending ? (
                            <>
                              <button
                                className={styles.approveBtn}
                                onClick={() => handleApprove(r)}
                                disabled={rState === 'loading'}
                              >
                                {rState === 'loading' ? 'Approving…' : 'Approve'}
                              </button>
                              {rState === 'error' && (
                                <span className={styles.inlineError}>Failed</span>
                              )}
                            </>
                          ) : (
                            <span className={styles.statusLabel}>
                              {s === 'rejected' ? 'Rejected' : 'Approved'}
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

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
              <span className={styles.allLoadedLabel}>All requests loaded</span>
            )}
          </div>
        </>
      )}
    </main>
  );
};

export default DataRemovalPage;
