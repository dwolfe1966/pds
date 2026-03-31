import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
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
        <span className={styles.fieldLabel}>Email</span>
        <span className={styles.emailValue} title={user.email}>{user.email || '—'}</span>
      </div>

      <div className={styles.cardField}>
        <span className={styles.fieldLabel}>Joined</span>
        <span className={styles.fieldValue}>{formatDate(user.createdAt)}</span>
      </div>

      <Link to={`/admin/users/${uid}`} className={styles.viewBtn}>
        View Details
      </Link>
    </div>
  );
}

// ─── main component ───────────────────────────────────────────────────────────

const SKELETON_COUNT = 9;

const UsersPage = () => {
  const [allUsers, setAllUsers]     = useState([]);
  const [loading, setLoading]       = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError]           = useState('');
  const [lastId, setLastId]         = useState(null);
  const [noMoreDocs, setNoMoreDocs] = useState(false);

  // filter state
  const [searchText, setSearchText]   = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  // ── data fetching ──────────────────────────────────────────────────────────

  const fetchPage = useCallback(async (cursorId = null) => {
    const params = cursorId ? { lastId: cursorId } : {};
    const res = await api.adminListUsers(params);
    const docs = res?.data ?? [];
    const last = docs[docs.length - 1]?._id ?? docs[docs.length - 1]?.id ?? null;
    return { docs, last, noMoreDocs: res?.noMoreDocs ?? docs.length === 0 };
  }, []);

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
  }, [fetchPage]);

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
    const q = searchText.trim().toLowerCase();
    return allUsers.filter((u) => {
      // status filter
      if (statusFilter !== 'all') {
        const s = resolveStatus(u);
        if (s !== statusFilter) return false;
      }
      // text filter
      if (q) {
        const name = getDisplayName(u).toLowerCase();
        const email = (u.email || '').toLowerCase();
        if (!name.includes(q) && !email.includes(q)) return false;
      }
      return true;
    });
  }, [allUsers, searchText, statusFilter]);

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
              placeholder="Search by name or email…"
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              aria-label="Search customers"
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
            <option value="suspended">Suspended</option>
          </select>
        </div>
      </div>

      {/* ── error ── */}
      {error && <div className={styles.errorBanner}>{error}</div>}

      {/* ── card grid ── */}
      <div className={styles.grid}>
        {loading
          ? Array.from({ length: SKELETON_COUNT }).map((_, i) => <SkeletonCard key={i} />)
          : filteredUsers.length === 0
            ? (
              <div className={styles.emptyState}>
                <div className={styles.emptyIcon}>👥</div>
                <p className={styles.emptyTitle}>No customers found</p>
                <p className={styles.emptyText}>
                  {allUsers.length === 0
                    ? 'No customers have been loaded yet.'
                    : 'Try adjusting your search or filter.'}
                </p>
              </div>
            )
            : filteredUsers.map((u) => (
              <CustomerCard key={u._id || u.id} user={u} />
            ))}
      </div>

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
