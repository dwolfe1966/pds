import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import api from '../../api';
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

function isTierPro(u) {
  const status = resolveStatus(u);
  if (status === 'active') return true;
  if (Array.isArray(u.roles) && u.roles.includes('subscriber')) return true;
  return false;
}

// ─── sub-components ──────────────────────────────────────────────────────────

function StatusBadge({ status }) {
  const s = (status || '').toLowerCase();
  if (s === 'active') return <span className={`${styles.badge} ${styles.badgeActive}`}>Active</span>;
  if (s === 'suspended') return <span className={`${styles.badge} ${styles.badgeSuspended}`}>Suspended</span>;
  return <span className={`${styles.badge} ${styles.badgeUnknown}`}>Unknown</span>;
}

function TierBadge({ pro }) {
  return pro
    ? <span className={`${styles.badge} ${styles.badgePro}`}>Pro</span>
    : <span className={`${styles.badge} ${styles.badgeFree}`}>Free</span>;
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
  const pro = isTierPro(user);

  return (
    <div className={styles.card}>
      <div className={styles.cardTop}>
        <h3 className={styles.customerName}>{name}</h3>
        <div className={styles.badgeRow}>
          <StatusBadge status={status} />
          <TierBadge pro={pro} />
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
  const [allUsers, setAllUsers]     = useState([]);
  const [loading, setLoading]       = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError]           = useState('');
  const [lastId, setLastId]         = useState(null);
  const [noMoreDocs, setNoMoreDocs] = useState(false);

  // filter + view state
  const [nameFilter, setNameFilter]   = useState('');
  const [zipCode, setZipCode]         = useState('');
  const [last4cc, setLast4cc]         = useState('');
  const [emailFilter, setEmailFilter] = useState(searchParams.get('q') || '');
  const [phoneFilter, setPhoneFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [view, setView]               = useState('list'); // 'list' | 'cards'
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [fetchGeneration, setFetchGeneration] = useState(0);

  // Handle nav search: ?q= param triggers smart search on mount
  useEffect(() => {
    const q = searchParams.get('q');
    if (!q) return;
    // Auto-detect input type and route to the right filter
    const trimmed = q.trim();
    const isEmail = trimmed.includes('@');
    const isPhone = /^\d{7,}$/.test(trimmed.replace(/[\s\-().+]/g, ''));
    const isZip = /^\d{5}(-\d{4})?$/.test(trimmed);

    // Reset all filters first
    setEmailFilter('');
    setPhoneFilter('');
    setZipCode('');
    setLast4cc('');

    if (isEmail) {
      setEmailFilter(trimmed);
    } else if (isZip) {
      setZipCode(trimmed);
    } else if (isPhone) {
      setPhoneFilter(trimmed.replace(/[\s\-().+]/g, ''));
    } else {
      // Default: try as email (BC does partial match)
      setEmailFilter(trimmed);
    }

    // Build the active filter from detected type
    const filters = {};
    if (isEmail) filters.email = trimmed;
    else if (isZip) filters.zip = trimmed;
    else if (isPhone) filters.phone = trimmed.replace(/[\s\-().+]/g, '');
    else filters.email = trimmed;
    setActiveFilters(filters);

    setAllUsers([]);
    setLastId(null);
    setNoMoreDocs(false);
    setAdvancedOpen(true);
    setFetchGeneration(g => g + 1);
    setSearchParams({}, { replace: true });
  }, [searchParams]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── data fetching ──────────────────────────────────────────────────────────

  // Snapshot of filter values at the time Search was clicked
  const [activeFilters, setActiveFilters] = useState({});

  const fetchPage = useCallback(async (cursorId = null) => {
    const params = cursorId ? { lastId: cursorId } : {};
    // Use activeFilters (set on Search click), not live input state
    if (activeFilters.email) params.email = activeFilters.email;
    if (activeFilters.phone) params.phone = activeFilters.phone;
    if (activeFilters.zip) params.zip = activeFilters.zip;
    if (activeFilters.panLast4) params.panLast4 = activeFilters.panLast4;
    console.log('[UsersPage] fetchPage params:', params);
    const res = await api.adminListUsers(params);
    console.log('[UsersPage] fetchPage response:', { docsCount: (res?.data ?? []).length, noMoreDocs: res?.noMoreDocs });
    const docs = res?.data ?? [];
    const last = docs[docs.length - 1]?._id ?? docs[docs.length - 1]?.id ?? null;
    return { docs, last, noMoreDocs: res?.noMoreDocs ?? docs.length === 0 };
  }, [activeFilters]);

  const handleServerSearch = () => {
    // Snapshot current input values into activeFilters
    const filters = {};
    if (emailFilter.trim()) filters.email = emailFilter.trim();
    if (phoneFilter.trim()) filters.phone = phoneFilter.trim();
    if (zipCode.trim()) filters.zip = zipCode.trim();
    if (last4cc.trim()) filters.panLast4 = last4cc.trim();
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

  const filteredUsers = useMemo(() => {
    const q = nameFilter.trim().toLowerCase();
    return allUsers.filter((u) => {
      // status filter
      if (statusFilter !== 'all') {
        const s = resolveStatus(u);
        if (s !== statusFilter) return false;
      }
      // client-side name filter (firstName, lastName, fullName, name)
      if (q) {
        const first = (u.firstName || '').toLowerCase();
        const last = (u.lastName || '').toLowerCase();
        const full = (u.fullName || '').toLowerCase();
        const name = (u.name || '').toLowerCase();
        const display = getDisplayName(u).toLowerCase();
        if (
          !first.includes(q) &&
          !last.includes(q) &&
          !full.includes(q) &&
          !name.includes(q) &&
          !display.includes(q)
        ) return false;
      }
      return true;
    });
  }, [allUsers, nameFilter, statusFilter]);

  // ── render ─────────────────────────────────────────────────────────────────

  return (
    <main className={styles.page}>
      {/* ── header ── */}
      <div className={styles.pageHeader}>
        <div className={styles.titleBlock}>
          <h1 className={styles.title}>Customer Directory</h1>
          {!loading && (
            <p className={styles.subtitle}>
              {filteredUsers.length !== allUsers.length
                ? `${filteredUsers.length} of ${allUsers.length} customers`
                : `${allUsers.length} customer${allUsers.length !== 1 ? 's' : ''} loaded`}
            </p>
          )}
        </div>

        <div className={styles.controls}>
          {/* Email search — server-side */}
          <div className={styles.searchGroup}>
            <label className={styles.searchLabel}>Email (server)</label>
            <div className={styles.searchRow}>
              <div className={styles.searchWrap}>
                <span className={styles.searchIcon}>
                  <svg width="14" height="14" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="9" cy="9" r="7" />
                    <line x1="15.5" y1="15.5" x2="19" y2="19" />
                  </svg>
                </span>
                <input
                  type="text"
                  className={styles.searchInput}
                  placeholder="Search by email..."
                  value={emailFilter}
                  onChange={(e) => setEmailFilter(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleServerSearch()}
                  aria-label="Search by email (server)"
                />
              </div>
              <button
                className={styles.serverSearchBtn}
                onClick={handleServerSearch}
                disabled={loading}
              >
                Search
              </button>
            </div>
          </div>

          {/* Name filter — client-side */}
          <div className={styles.searchGroup}>
            <label className={styles.searchLabel}>Name (local filter)</label>
            <input
              type="text"
              className={styles.filterInput}
              style={{ width: 200 }}
              placeholder="Filter by name..."
              value={nameFilter}
              onChange={(e) => setNameFilter(e.target.value)}
              aria-label="Filter by name (client-side)"
            />
          </div>

          <button
            type="button"
            className={styles.advancedToggleBtn}
            onClick={() => setAdvancedOpen(o => !o)}
            aria-expanded={advancedOpen}
          >
            Advanced {advancedOpen ? '\u25B2' : '\u25BC'}
          </button>

          <select
            className={styles.filterSelect}
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            aria-label="Filter by status"
          >
            <option value="all">All Statuses</option>
            <option value="active">Active</option>
            <option value="suspended">Suspended</option>
          </select>

          <div className={styles.viewToggle}>
            <button className={`${styles.viewBtn} ${view === 'list' ? styles.viewBtnActive : ''}`} onClick={() => setView('list')}>List</button>
            <button className={`${styles.viewBtn} ${view === 'cards' ? styles.viewBtnActive : ''}`} onClick={() => setView('cards')}>Cards</button>
          </div>
        </div>

        <p className={styles.searchHint}>
          Search by email queries the server. Name filter is applied locally to loaded results.
        </p>
      </div>

      {/* ── advanced search panel ── */}
      {advancedOpen && (
        <div className={styles.advancedPanel}>
          <div className={styles.advancedSection}>
            <span className={styles.advancedSectionLabel}>Server search</span>
            <div className={styles.advancedGrid}>
              <input
                type="text"
                className={styles.filterInput}
                placeholder="Email"
                value={emailFilter}
                onChange={(e) => setEmailFilter(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleServerSearch()}
                aria-label="Search by email (server)"
              />
              <input
                type="text"
                className={styles.filterInput}
                placeholder="Phone"
                value={phoneFilter}
                onChange={(e) => setPhoneFilter(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleServerSearch()}
                aria-label="Search by phone (server)"
              />
              <input
                type="text"
                className={styles.filterInput}
                placeholder="Zip Code"
                value={zipCode}
                onChange={(e) => setZipCode(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleServerSearch()}
                aria-label="Search by zip code (server)"
                maxLength={10}
              />
              <input
                type="text"
                className={styles.filterInput}
                placeholder="Last 4 CC"
                value={last4cc}
                onChange={(e) => {
                  const v = e.target.value.replace(/\D/g, '').slice(0, 4);
                  setLast4cc(v);
                }}
                onKeyDown={(e) => e.key === 'Enter' && handleServerSearch()}
                aria-label="Search by last 4 digits of credit card (server)"
                maxLength={4}
              />
            </div>
            <button
              className={styles.serverSearchBtn}
              onClick={handleServerSearch}
              disabled={loading}
              title="Re-fetch from server with current filters"
            >
              Search
            </button>
          </div>
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
                <th className={styles.th}>Zip</th><th className={styles.th}>CC</th>
                <th className={styles.th}>Joined</th><th className={styles.th}></th>
              </tr></thead>
              <tbody>{Array.from({ length: SKELETON_COUNT }).map((_, i) => (
                <tr key={i}><td colSpan={9} className={styles.td}><div className={`${styles.skeletonLine} ${styles.skeletonTitle}`} /></td></tr>
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
              <th className={styles.th}>Tier</th>
              <th className={styles.th}>Zip</th>
              <th className={styles.th}>CC</th>
              <th className={styles.th}>Joined</th>
              <th className={styles.th}></th>
            </tr></thead>
            <tbody>
              {filteredUsers.map((u) => {
                const uid = u._id || u.id;
                const truncId = uid ? `${uid.slice(0, 8)}...` : '—';
                const name = getDisplayName(u);
                const status = resolveStatus(u);
                const pro = isTierPro(u);
                return (
                  <tr key={uid} className={styles.tr}>
                    <td className={styles.td}>
                      <span className={styles.idValue} title={uid}>{truncId}</span>
                    </td>
                    <td className={styles.td}>{name}</td>
                    <td className={styles.td}>{u.email || '—'}</td>
                    <td className={styles.td}><StatusBadge status={status} /></td>
                    <td className={styles.td}><TierBadge pro={pro} /></td>
                    <td className={styles.td}>{u.zip || '—'}</td>
                    <td className={styles.td}>{u.last4cc ? `····${u.last4cc}` : '—'}</td>
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
