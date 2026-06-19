import React, { useEffect, useState, useCallback, useMemo } from 'react';
import api from '../../api';
import { useAuth } from '../../context/AuthContext';
import styles from './DataRemovalPage.module.css';

/**
 * Admin "Opt-Outs" page with two tabs:
 *  1. Data Removal Requests  — opt-out / data-removal requests from BC
 *  2. Phone Opt-Outs         — managed phone contacts from BC
 */

const PAGE_SIZE = 10;

// ── Helpers ────────────────────────────────────────────────────────────

function formatPhone(raw) {
  const digits = (raw || '').replace(/\D/g, '');
  if (digits.length === 10) return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
  if (digits.length === 11 && digits[0] === '1')
    return `+1 (${digits.slice(1, 4)}) ${digits.slice(4, 7)}-${digits.slice(7)}`;
  return raw || '\u2014';
}

function formatDate(value) {
  if (!value) return '\u2014';
  try {
    return new Date(value).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
  } catch {
    return '\u2014';
  }
}

function resolveId(e) { return e._id || e.id || ''; }

function isUnsubscribed(e) { return (e.subStatus || '').toLowerCase() === 'unsubscribed'; }

// ── Badge components ───────────────────────────────────────────────────

function DataRemovalBadge({ status }) {
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

function PhoneBadge({ entry }) {
  const unsub = isUnsubscribed(entry);
  return unsub
    ? <span className={`${styles.badge} ${styles.badgeInactive}`}>Opted Out</span>
    : <span className={`${styles.badge} ${styles.badgeActive}`}>Active</span>;
}

// ── Search icon (shared) ───────────────────────────────────────────────

const SearchIcon = () => (
  <span className={styles.searchIcon}>
    <svg width="15" height="15" viewBox="0 0 20 20" fill="none">
      <circle cx="9" cy="9" r="6.5" stroke="#9ca3af" strokeWidth="1.8"/>
      <path d="M14.5 14.5l3.5 3.5" stroke="#9ca3af" strokeWidth="1.8" strokeLinecap="round"/>
    </svg>
  </span>
);

// ── Skeleton rows ──────────────────────────────────────────────────────

const SkeletonRows = ({ count = 5 }) => (
  <div className={styles.loadingWrap}>
    {[...Array(count)].map((_, i) => (
      <div key={i} className={styles.skeletonRow}>
        <div className={`${styles.skeletonCell} ${styles.skeletonLong}`} />
        <div className={`${styles.skeletonCell} ${styles.skeletonMed}`} />
        <div className={`${styles.skeletonCell} ${styles.skeletonShort}`} />
        <div className={`${styles.skeletonCell} ${styles.skeletonShort}`} />
        <div className={`${styles.skeletonCell} ${styles.skeletonXShort}`} />
      </div>
    ))}
  </div>
);

// ═══════════════════════════════════════════════════════════════════════
// TAB 1: Data Removal Requests
// ═══════════════════════════════════════════════════════════════════════

function DataRemovalTab() {
  const [allRequests, setAllRequests]   = useState([]);
  const [loading, setLoading]           = useState(true);
  const [loadingMore, setLoadingMore]   = useState(false);
  const [error, setError]               = useState('');
  const [isEmpty, setIsEmpty]           = useState(false);
  const [unavailable, setUnavailable]   = useState(false);
  const [noMoreDocs, setNoMoreDocs]     = useState(false);
  const [lastId, setLastId]             = useState(null);
  const [search, setSearch]             = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  const fetchPage = useCallback(async (cursorId = null) => {
    const params = cursorId ? { lastId: cursorId, limit: PAGE_SIZE } : { limit: PAGE_SIZE };
    const res = await api.adminListDataRemoval(params);
    const rawDocs = res?.data ?? (Array.isArray(res) ? res : []);
    const docs = [...rawDocs].sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
    const last  = docs.length > 0 ? docs[docs.length - 1]._id || docs[docs.length - 1].id : null;
    const done  = res?.noMoreDocs ?? docs.length < PAGE_SIZE;
    return { docs, last, done };
  }, []);

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
          // Feature/endpoint not available for this account — NOT the same as
          // "zero requests". Show an explicit notice instead of a fake-empty list.
          setUnavailable(true);
        } else {
          setError(err.message || 'Failed to load data removal requests.');
        }
      })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [fetchPage]);

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

  // Stats
  const totalCount   = allRequests.length;
  const pendingCount = allRequests.filter((r) => {
    const s = (r.status || '').toLowerCase();
    return s === 'pending' || s === 'requested';
  }).length;
  const approvedCount = allRequests.filter((r) => {
    const s = (r.status || '').toLowerCase();
    return s === 'approved' || s === 'completed';
  }).length;

  // Client-side filter
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

  return (
    <>
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

      {error && <div className={styles.errorBanner}>{error}</div>}

      {/* Filter row */}
      <div className={styles.filterRow}>
        <div className={styles.searchWrap}>
          <SearchIcon />
          <input
            type="text"
            className={styles.searchInput}
            placeholder="Search by email or ID\u2026"
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
        <SkeletonRows />
      ) : unavailable ? (
        <div className={styles.emptyState}>
          <div className={styles.emptyIcon}>🔒</div>
          <p className={styles.emptyTitle}>Data-removal list isn’t available yet</p>
          <p className={styles.emptyText}>This list isn’t enabled for this account/role yet — it’s not that there are zero requests.</p>
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
                    const email = r.email || r.userId || '\u2014';
                    const date  = r.createdAt
                      ? new Date(r.createdAt).toLocaleDateString()
                      : (r.requestedAt || r.date || '\u2014');
                    const s     = (r.status || '').toLowerCase();
                    const isPending = s === 'pending' || s === 'requested';

                    return (
                      <tr key={id} className={styles.tr}>
                        <td className={styles.tdMono} title={id}>
                          {id ? id.slice(0, 16) + (id.length > 16 ? '\u2026' : '') : '\u2014'}
                        </td>
                        <td className={styles.td}>{email}</td>
                        <td className={styles.td}>
                          <DataRemovalBadge status={r.status} />
                        </td>
                        <td className={styles.td}>{date}</td>
                        <td className={styles.tdActions}>
                          {isPending ? (
                            <>
                              <button className={styles.approveBtn} disabled title="Approval is managed in the BC admin panel">
                                Approve
                              </button>
                              <span className={styles.managedLabel}>Managed in BC admin panel</span>
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
                {loadingMore ? 'Loading\u2026' : 'Load More'}
              </button>
            ) : (
              <span className={styles.allLoadedLabel}>All requests loaded</span>
            )}
          </div>
        </>
      )}
    </>
  );
}

// ═══════════════════════════════════════════════════════════════════════
// TAB 2: Phone Opt-Outs
// ═══════════════════════════════════════════════════════════════════════

function PhoneOptOutTab() {
  const { token } = useAuth();

  const [allEntries, setAllEntries]     = useState([]);
  const [loading, setLoading]           = useState(true);
  const [loadingMore, setLoadingMore]   = useState(false);
  const [error, setError]               = useState('');
  const [noMoreDocs, setNoMoreDocs]     = useState(false);
  const [lastId, setLastId]             = useState(null);
  const [search, setSearch]             = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [rowState, setRowState]         = useState({});

  const fetchPage = useCallback(async (cursorId = null) => {
    const params = cursorId ? { lastId: cursorId } : {};
    const res = await api.adminListPhoneOptOuts(params);
    const docs = res?.data ?? res?.docs ?? (Array.isArray(res) ? res : []);
    const last = docs.length > 0 ? resolveId(docs[docs.length - 1]) : null;
    const done = res?.noMoreDocs ?? docs.length === 0;
    return { docs, last, done };
  }, [token]);

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
      })
      .catch((err) => {
        if (!cancelled) setError(err.message || 'Failed to load phone contacts.');
      })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [fetchPage]);

  const handleLoadMore = async () => {
    if (loadingMore || noMoreDocs) return;
    setLoadingMore(true);
    try {
      const { docs, last, done } = await fetchPage(lastId);
      setAllEntries((prev) => [...prev, ...docs]);
      setLastId(last);
      setNoMoreDocs(done);
    } catch (err) {
      setError(err.message || 'Failed to load more.');
    } finally {
      setLoadingMore(false);
    }
  };

  const handleOptOut = async (entry) => {
    const id = resolveId(entry);
    const label = formatPhone(entry.contactAddress);
    if (!window.confirm(`Opt out ${label}?`)) return;

    setRowState((prev) => ({ ...prev, [id]: 'loading' }));
    try {
      await api.adminUnsubscribePhoneContact(id);
      setAllEntries((prev) =>
        prev.map((e) => resolveId(e) === id ? { ...e, subStatus: 'unsubscribed' } : e)
      );
      setRowState((prev) => { const n = { ...prev }; delete n[id]; return n; });
    } catch (err) {
      setRowState((prev) => ({ ...prev, [id]: 'error' }));
      setTimeout(() => setRowState((prev) => { const n = { ...prev }; delete n[id]; return n; }), 3000);
    }
  };

  // Stats
  const totalCount  = allEntries.length;
  const optOutCount = allEntries.filter(isUnsubscribed).length;
  const activeCount = totalCount - optOutCount;

  // Client-side filter
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return allEntries.filter((e) => {
      const unsub = isUnsubscribed(e);
      if (statusFilter === 'active' && unsub) return false;
      if (statusFilter === 'optout' && !unsub) return false;
      const addr = (e.contactAddress || '').toLowerCase();
      const fmt = formatPhone(e.contactAddress).toLowerCase();
      if (q && !addr.includes(q) && !fmt.includes(q)) return false;
      return true;
    });
  }, [allEntries, search, statusFilter]);

  return (
    <>
      {/* Stats bar */}
      <div className={styles.statsBar}>
        <div className={styles.statCard}>
          <div className={styles.statNumber}>{totalCount}</div>
          <div className={styles.statLabel}>Total Contacts</div>
        </div>
        <div className={styles.statCard}>
          <div className={styles.statNumber}>{activeCount}</div>
          <div className={styles.statLabel}>Active</div>
        </div>
        <div className={styles.statCard}>
          <div className={styles.statNumber}>{optOutCount}</div>
          <div className={styles.statLabel}>Opted Out</div>
        </div>
      </div>

      {error && <div className={styles.errorBanner}>{error}</div>}

      {/* Filter row */}
      <div className={styles.filterRow}>
        <div className={styles.searchWrap}>
          <SearchIcon />
          <input
            type="text"
            className={styles.searchInput}
            placeholder="Search phone number\u2026"
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
          <option value="optout">Opted Out</option>
        </select>
      </div>

      {/* Table */}
      {loading ? (
        <SkeletonRows />
      ) : allEntries.length === 0 ? (
        <div className={styles.emptyState}>
          <div className={styles.emptyIcon}>📵</div>
          <p className={styles.emptyTitle}>No phone contacts found</p>
          <p className={styles.emptyText}>Phone contacts will appear here as users register.</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className={styles.emptyState}>
          <p className={styles.emptyTitle}>No entries match your filters.</p>
        </div>
      ) : (
        <>
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th className={styles.th}>Phone</th>
                  <th className={styles.th}>Status</th>
                  <th className={styles.th}>Brand</th>
                  <th className={styles.th}>Added</th>
                  <th className={styles.th}>Action</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((entry) => {
                  const id = resolveId(entry);
                  const rs = rowState[id];
                  const unsub = isUnsubscribed(entry);
                  return (
                    <tr key={id} className={styles.tr}>
                      <td className={styles.td}>{formatPhone(entry.contactAddress)}</td>
                      <td className={styles.td}><PhoneBadge entry={entry} /></td>
                      <td className={styles.td}>{entry.brandId || '\u2014'}</td>
                      <td className={styles.td}>{formatDate(entry.createdAt)}</td>
                      <td className={styles.td}>
                        {unsub ? null : (
                          <>
                            <button
                              className={styles.optOutBtn}
                              onClick={() => handleOptOut(entry)}
                              disabled={rs === 'loading'}
                            >
                              {rs === 'loading' ? 'Opting out\u2026' : 'Opt Out'}
                            </button>
                            {rs === 'error' && (
                              <span className={styles.inlineError}> Failed</span>
                            )}
                          </>
                        )}
                      </td>
                    </tr>
                  );
                })}
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
                {loadingMore ? 'Loading\u2026' : 'Load More'}
              </button>
            ) : (
              <span className={styles.allLoadedLabel}>All entries loaded</span>
            )}
          </div>
        </>
      )}
    </>
  );
}

// ═══════════════════════════════════════════════════════════════════════
// Main Page Component
// ═══════════════════════════════════════════════════════════════════════

const DataRemovalPage = () => {
  const [activeTab, setActiveTab] = useState('dataRemoval');

  return (
    <main className={styles.page}>
      {/* Page header */}
      <div className={styles.pageHeader}>
        <div className={styles.titleBlock}>
          <h1 className={styles.title}>Opt-Outs</h1>
          <p className={styles.subtitle}>Manage data removal requests and phone opt-outs</p>
        </div>
      </div>

      {/* Tab bar */}
      <div className={styles.tabBar}>
        <button
          className={`${styles.tabBtn} ${activeTab === 'dataRemoval' ? styles.tabBtnActive : ''}`}
          onClick={() => setActiveTab('dataRemoval')}
        >
          Data Removal Requests
        </button>
        <button
          className={`${styles.tabBtn} ${activeTab === 'phoneOptOut' ? styles.tabBtnActive : ''}`}
          onClick={() => setActiveTab('phoneOptOut')}
        >
          Phone Opt-Outs
        </button>
      </div>

      {/* Tab content */}
      {activeTab === 'dataRemoval' ? <DataRemovalTab /> : <PhoneOptOutTab />}
    </main>
  );
};

export default DataRemovalPage;
