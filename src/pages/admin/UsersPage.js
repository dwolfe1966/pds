import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams, useNavigate } from 'react-router-dom';
import api from '../../api';
import { isValidEmail } from '../../utils/email';
import styles from './UsersPage.module.css';

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

function getDisplayName(u) {
  if (u.firstName || u.lastName) {
    return `${u.firstName || ''} ${u.lastName || ''}`.trim();
  }
  return u.fullName || u.name || u.email || u._id || u.id || 'Unknown';
}

function resolveStatus(u) {
  return (u.status || u.transient?.status || '').toLowerCase();
}

// NOTE: paid (Pro/Free) status is intentionally NOT shown in the list. It can only be
// known from BC orders (getOrders per user), which the list doesn't load — deriving it
// from account `status` or roles falsely marked every active account "Pro" (Hana's
// report). The accurate account status (Active/Suspended) is shown via StatusBadge; the
// user detail page shows the true Pro/Free from orders.

// ─── sub-components ──────────────────────────────────────────────────────────

function StatusBadge({ status }) {
  const s = (status || '').toLowerCase();
  if (s === 'active') return <span className={`${styles.badge} ${styles.badgeActive}`}>Active</span>;
  if (s === 'suspended' || s === 'blocked') return <span className={`${styles.badge} ${styles.badgeSuspended}`}>Suspended</span>;
  return <span className={`${styles.badge} ${styles.badgeUnknown}`}>Unknown</span>;
}

function SkeletonCard() {
  return (
    <div className={styles.skeletonCard} aria-hidden="true">
      <div className={`${styles.skeletonLine} ${styles.skeletonTitle}`} />
      <div className={`${styles.skeletonLine} ${styles.skeletonShort}`} />
      <div className={`${styles.skeletonLine} ${styles.skeletonXShort}`} />
      <div className={`${styles.skeletonLine} ${styles.skeletonShort}`} />
      <div className={`${styles.skeletonLine} ${styles.skeletonBtn}`} />
    </div>
  );
}

function CustomerCard({ user }) {
  const uid = user._id || user.id;
  const truncId = uid ? `${uid.slice(0, 8)}...` : '—';
  const name = getDisplayName(user);
  const status = resolveStatus(user);

  return (
    <div className={styles.card}>
      <div className={styles.cardTop}>
        <h3 className={styles.customerName}>{name}</h3>
        <div className={styles.badgeRow}>
          <StatusBadge status={status} />
        </div>
      </div>

      <div className={styles.cardField}>
        <span className={styles.fieldLabel}>ID</span>
        <span className={styles.idValue} title={uid}>{truncId}</span>
      </div>

      <div className={styles.cardField}>
        <span className={styles.fieldLabel}>Email</span>
        <span className={styles.emailValue} title={user.email}>{user.email || '—'}</span>
      </div>

      <div className={styles.cardField}>
        <span className={styles.fieldLabel}>Joined</span>
        <span className={styles.fieldValue}>{formatDate(user.createdAt)}</span>
      </div>

      {user.zip && (
        <div className={styles.cardField}>
          <span className={styles.fieldLabel}>Zip</span>
          <span className={styles.fieldValue}>{user.zip}</span>
        </div>
      )}

      {user.last4cc && (
        <div className={styles.cardField}>
          <span className={styles.fieldLabel}>CC</span>
          <span className={styles.fieldValue}>{`····${user.last4cc}`}</span>
        </div>
      )}

      <Link to={`/users/${uid}`} className={styles.cardViewBtn}>
        View Details
      </Link>
    </div>
  );
}

// ─── main component ───────────────────────────────────────────────────────────

const SKELETON_COUNT = 9;

const UsersPage = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  // Name search is best-effort: BC ignores a server-side name filter, so we page
  // the recent customer list and match client-side. This holds the scan summary.
  const [nameSearchInfo, setNameSearchInfo] = useState(null);
  const [allUsers, setAllUsers]     = useState([]);
  const [loading, setLoading]       = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError]           = useState('');
  const [lastId, setLastId]         = useState(null);
  const [noMoreDocs, setNoMoreDocs] = useState(false);

  // search + filter + view state
  const [searchQuery, setSearchQuery]   = useState(searchParams.get('q') || '');
  const [statusFilter, setStatusFilter] = useState('all'); // filters results, not a search
  const [view, setView]                 = useState('list'); // 'list' | 'cards'
  const [fetchGeneration, setFetchGeneration] = useState(0);

  // Nav-bar search (?q=) and the on-page search box BOTH funnel through
  // runSmartSearch — one place, one behavior.
  useEffect(() => {
    const q = searchParams.get('q');
    if (!q) return;
    setSearchParams({}, { replace: true });
    setSearchQuery(q.trim());
    runSmartSearch(q);
  }, [searchParams]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── data fetching ──────────────────────────────────────────────────────────

  // Snapshot of filter values at the time Search was clicked
  const [activeFilters, setActiveFilters] = useState({});

    const MAX_NAME_PAGES = 25; // ~250 most-recent customers (BC pages users 10 at a time)

  const fetchPage = useCallback(async (cursorId = null) => {
    // Name search: BC ignores a server-side name filter (verified 2026-06-05), so
    // page the recent customer list and match client-side. Best-effort + bounded;
    // one-shot (no "load more"). BC ask filed to add a real name filter.
    if (activeFilters.name) {
      const needle = activeFilters.name.toLowerCase();
      const matches = [];
      let cursor = null, pages = 0, scanned = 0, done = false;
      while (pages < MAX_NAME_PAGES) {
        const res = await api.adminListUsers(cursor ? { lastId: cursor } : {});
        const docs = res?.data ?? [];
        scanned += docs.length;
        for (const u of docs) {
          const hay = `${u.firstName || ''} ${u.lastName || ''} ${u.name || ''} ${u.email || ''}`.toLowerCase();
          if (hay.includes(needle)) matches.push(u);
        }
        pages += 1;
        cursor = docs[docs.length - 1]?._id ?? docs[docs.length - 1]?.id ?? null;
        if (res?.noMoreDocs || !cursor || docs.length === 0) { done = true; break; }
      }
      setNameSearchInfo({ name: activeFilters.name, scanned, matched: matches.length, capped: !done });
      return { docs: matches, last: null, noMoreDocs: true };
    }

    const params = cursorId ? { lastId: cursorId } : {};
    // Use activeFilters (set on Search click), not live input state
    if (activeFilters.email) params.email = activeFilters.email;
    if (activeFilters.phone) params.phone = activeFilters.phone;
    if (activeFilters.zip) params.zip = activeFilters.zip;
    if (activeFilters.panLast4) params.panLast4 = activeFilters.panLast4;
    const res = await api.adminListUsers(params);
    const docs = res?.data ?? [];
    const last = docs[docs.length - 1]?._id ?? docs[docs.length - 1]?.id ?? null;
    return { docs, last, noMoreDocs: res?.noMoreDocs ?? docs.length === 0 };
  }, [activeFilters]);

  // Exit "Search Results" mode and reload the browse directory.
  const clearSearch = () => {
    setSearchQuery('');
    setActiveFilters({});
    setNameSearchInfo(null);
    setError('');
    setAllUsers([]);
    setLastId(null);
    setNoMoreDocs(false);
    setFetchGeneration(g => g + 1);
  };

  // Resolve an order id to its owning customer and open that customer's detail.
  // BC's user.find honors `query.orderId` server-side as of 2026-06-08 (verified
  // live via scripts/verify-bc-csr-params.js). 0 matches → explicit not-found, never
  // a blind navigate (an order id is not a user id).
  const resolveOrderId = async (orderId) => {
    setNameSearchInfo(null);
    setError('');
    setLoading(true);
    try {
      const res = await api.adminListUsers({ orderId });
      const owner = (res?.data ?? [])[0];
      const ownerId = owner?._id || owner?.id;
      if (ownerId) {
        navigate(`/users/${ownerId}`);
      } else {
        setError(`No customer found for order id ${orderId}.`);
        setLoading(false);
      }
    } catch (err) {
      setError(err.message || 'Order lookup failed.');
      setLoading(false);
    }
  };

  // ONE smart search — auto-detects the input type and runs the BC query that
  // actually matches it (so results match the criteria):
  //   "order:<24-hex>" → order id (resolve owning customer) · 24-hex → customer ID
  //   (open detail) · "@" → email · 5 digits → ZIP · 4 digits → last-4 of card ·
  //   7+ digits → phone · anything else → name scan.
  const runSmartSearch = (rawQuery) => {
    const trimmed = (rawQuery || '').trim();
    if (!trimmed) { clearSearch(); return; }
    const orderMatch = trimmed.match(/^order:\s*([a-f0-9]{24})$/i);
    if (orderMatch) { resolveOrderId(orderMatch[1]); return; }
    if (/^[a-f0-9]{24}$/i.test(trimmed)) { navigate(`/users/${trimmed}`); return; }
    setNameSearchInfo(null);
    setError('');
    const digits = trimmed.replace(/[\s\-().+]/g, '');
    const filters = {};
    // A COMPLETE email → exact server-side filter (fast, precise). A PARTIAL email
    // fragment (has '@' but isn't valid, or no '@') → the client-side text scan, which
    // now matches the email substring too — so "test21" or "test21@" find them (item vii).
    if (isValidEmail(trimmed)) filters.email = trimmed;
    else if (/^\d{5}(-\d{4})?$/.test(trimmed)) filters.zip = trimmed;
    else if (/^\d{4}$/.test(trimmed)) filters.panLast4 = trimmed;
    else if (/^\d{7,}$/.test(digits)) filters.phone = digits;
    else filters.name = trimmed;
    setActiveFilters(filters);
    setAllUsers([]);
    setLastId(null);
    setNoMoreDocs(false);
    setFetchGeneration(g => g + 1);
  };

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      setError('');
      try {
        const { docs, last, noMoreDocs: done } = await fetchPage();
        if (!cancelled) {
          setAllUsers(docs);
          setLastId(last);
          setNoMoreDocs(done);
        }
      } catch (err) {
        if (!cancelled) setError(err.message || 'Failed to load users.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    return () => { cancelled = true; };
  }, [fetchPage, fetchGeneration]);

  const handleLoadMore = async () => {
    setLoadingMore(true);
    setError('');
    try {
      const { docs, last, noMoreDocs: done } = await fetchPage(lastId);
      setAllUsers(prev => [...prev, ...docs]);
      setLastId(last);
      setNoMoreDocs(done);
    } catch (err) {
      setError(err.message || 'Failed to load more users.');
    } finally {
      setLoadingMore(false);
    }
  };

  // ── client-side filtering ──────────────────────────────────────────────────

  // Only the Status control filters the loaded results client-side; searching is
  // done server-side (or via the name scan) in runSmartSearch.
  const filteredUsers = useMemo(() => {
    return allUsers.filter((u) => {
      if (statusFilter !== 'all' && resolveStatus(u) !== statusFilter) return false;
      return true;
    });
  }, [allUsers, statusFilter]);

  // A search is "active" when a server filter or a name scan is in effect — the
  // header then switches to a dedicated "Search Results" mode (only matches).
  const searchCriteria = (() => {
    const f = activeFilters;
    if (f.email) return <>email “<strong>{f.email}</strong>”</>;
    if (f.name) return <>name “<strong>{f.name}</strong>”</>;
    if (f.zip) return <>ZIP <strong>{f.zip}</strong></>;
    if (f.phone) return <>phone <strong>{f.phone}</strong></>;
    if (f.panLast4) return <>card <strong>····{f.panLast4}</strong></>;
    return null;
  })();
  const hasActiveSearch = searchCriteria !== null;

  // ── render ─────────────────────────────────────────────────────────────────

  return (
    <main className={styles.page}>
      {/* ── header ── */}
      <div className={styles.pageHeader}>
        <div className={styles.titleBlock}>
          {hasActiveSearch ? (
            <>
              <h1 className={styles.title}>Search Results</h1>
              {!loading && (
                <p className={styles.subtitle}>
                  <strong>{filteredUsers.length}</strong> match{filteredUsers.length === 1 ? '' : 'es'} for {searchCriteria}
                  {' · '}
                  <button
                    type="button"
                    onClick={clearSearch}
                    style={{ background: 'none', border: 'none', padding: 0, color: '#1a56db', cursor: 'pointer', font: 'inherit', textDecoration: 'underline' }}
                  >
                    Clear search
                  </button>
                </p>
              )}
            </>
          ) : (
            <>
              <h1 className={styles.title}>Customer Directory</h1>
              {!loading && (
                <p className={styles.subtitle}>
                  {filteredUsers.length !== allUsers.length
                    ? `${filteredUsers.length} of ${allUsers.length} customers`
                    : `${allUsers.length} customer${allUsers.length !== 1 ? 's' : ''} loaded`}
                  {' · browsing recent customers — search above to find a specific one'}
                </p>
              )}
            </>
          )}
        </div>

        <div className={styles.controls}>
          {/* ── ONE search box — auto-detects the input type ── */}
          <form
            className={styles.searchGroup}
            style={{ flex: 1, minWidth: 280 }}
            onSubmit={(e) => { e.preventDefault(); runSmartSearch(searchQuery); }}
          >
            <div className={styles.searchRow}>
              <div className={styles.searchWrap} style={{ flex: 1 }}>
                <span className={styles.searchIcon}>
                  <svg width="14" height="14" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="9" cy="9" r="7" />
                    <line x1="15.5" y1="15.5" x2="19" y2="19" />
                  </svg>
                </span>
                <input
                  type="text"
                  className={styles.searchInput}
                  placeholder="Search by email, name, ZIP, phone, last 4 of card, customer ID, or order:<id>…"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  aria-label="Search customers"
                />
              </div>
              <button type="submit" className={styles.serverSearchBtn} disabled={loading}>
                Search
              </button>
              {hasActiveSearch && (
                <button
                  type="button"
                  className={styles.serverSearchBtn}
                  onClick={clearSearch}
                  style={{ background: '#fff', color: '#374151', border: '1px solid #d1d5db' }}
                >
                  Clear
                </button>
              )}
            </div>
          </form>

          {/* Status is a FILTER on the results, not a search. */}
          <select
            className={styles.filterSelect}
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            aria-label="Filter results by status"
          >
            <option value="all">All statuses</option>
            <option value="active">Active</option>
            <option value="blocked">Suspended</option>
          </select>

          <div className={styles.viewToggle}>
            <button className={`${styles.viewBtn} ${view === 'list' ? styles.viewBtnActive : ''}`} onClick={() => setView('list')}>List</button>
            <button className={`${styles.viewBtn} ${view === 'cards' ? styles.viewBtnActive : ''}`} onClick={() => setView('cards')}>Cards</button>
          </div>
        </div>

        <p className={styles.searchHint}>
          One box, auto-detected: <strong>email</strong> / <strong>ZIP</strong> /
          <strong> phone</strong> / <strong>last 4 of card</strong> / <strong>customer ID</strong> /
          <strong> order:&lt;id&gt;</strong> query the server; a <strong>name</strong> scans the
          most-recent customers. \u201CStatus\u201D filters the results.
        </p>
      </div>

      {nameSearchInfo && (
        <div className={styles.searchHint} style={{ background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 6, padding: '0.5rem 0.75rem', margin: '0 0 0.75rem' }}>
          Name search for “<strong>{nameSearchInfo.name}</strong>”: {nameSearchInfo.matched} match{nameSearchInfo.matched === 1 ? '' : 'es'} in the {nameSearchInfo.scanned} most-recent customers
          {nameSearchInfo.capped ? ' (scan capped — refine by email/phone/ZIP/card or customer ID for older accounts).' : ' (all customers scanned).'}
        </div>
      )}


      {/* ── error ── */}
      {error && <div className={styles.errorBanner}>{error}</div>}

      {/* ── content ── */}
      {loading ? (
        view === 'cards' ? (
          <div className={styles.grid}>
            {Array.from({ length: SKELETON_COUNT }).map((_, i) => <SkeletonCard key={i} />)}
          </div>
        ) : (
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead><tr>
                <th className={styles.th}>ID</th><th className={styles.th}>Name</th><th className={styles.th}>Email</th>
                <th className={styles.th}>Status</th><th className={styles.th}>Tier</th>
                <th className={styles.th}>Joined</th><th className={styles.th}></th>
              </tr></thead>
              <tbody>{Array.from({ length: SKELETON_COUNT }).map((_, i) => (
                <tr key={i}><td colSpan={7} className={styles.td}><div className={`${styles.skeletonLine} ${styles.skeletonTitle}`} /></td></tr>
              ))}</tbody>
            </table>
          </div>
        )
      ) : filteredUsers.length === 0 ? (
        <div className={styles.emptyState}>
          <div className={styles.emptyIcon}>👥</div>
          <p className={styles.emptyTitle}>No customers found</p>
          <p className={styles.emptyText}>
            {allUsers.length === 0 ? 'No customers have been loaded yet.' : 'Try adjusting your search or filter.'}
          </p>
        </div>
      ) : view === 'cards' ? (
        <div className={styles.grid}>
          {filteredUsers.map((u) => <CustomerCard key={u._id || u.id} user={u} />)}
        </div>
      ) : (
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead><tr>
              <th className={styles.th}>ID</th>
              <th className={styles.th}>Name</th>
              <th className={styles.th}>Email</th>
              <th className={styles.th}>Status</th>
              <th className={styles.th}>Joined</th>
              <th className={styles.th}></th>
            </tr></thead>
            <tbody>
              {filteredUsers.map((u) => {
                const uid = u._id || u.id;
                const truncId = uid ? `${uid.slice(0, 8)}...` : '—';
                const name = getDisplayName(u);
                const status = resolveStatus(u);
                return (
                  <tr key={uid} className={styles.tr}>
                    <td className={styles.td}>
                      <span className={styles.idValue} title={uid}>{truncId}</span>
                    </td>
                    <td className={styles.td}>{name}</td>
                    <td className={styles.td}>{u.email || '—'}</td>
                    <td className={styles.td}><StatusBadge status={status} /></td>
                    <td className={styles.td}>{formatDate(u.createdAt)}</td>
                    <td className={styles.td}>
                      <Link to={`/users/${uid}`} className={styles.tableViewBtn}>Details</Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* ── pagination bar ── */}
      {!loading && allUsers.length > 0 && (
        <div className={styles.paginationBar}>
          <span className={styles.countLabel}>
            {allUsers.length} customer{allUsers.length !== 1 ? 's' : ''} loaded
          </span>
          <div>
            {!noMoreDocs ? (
              <button
                className={styles.loadMoreBtn}
                onClick={handleLoadMore}
                disabled={loadingMore}
              >
                {loadingMore ? 'Loading…' : 'Load more'}
              </button>
            ) : (
              <span className={styles.allLoadedLabel}>All customers loaded</span>
            )}
          </div>
        </div>
      )}
    </main>
  );
};

export default UsersPage;
