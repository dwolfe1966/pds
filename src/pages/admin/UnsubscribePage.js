import React, { useCallback, useEffect, useMemo, useState } from 'react';
import api from '../../api';
import { useAuth } from '../../context/AuthContext';
import styles from './UnsubscribePage.module.css';

// ─── helpers ─────────────────────────────────────────────────────────────────

function formatDate(value) {
  if (!value) return '—';
  try {
    return new Date(value).toLocaleDateString(undefined, {
      year: 'numeric', month: 'short', day: 'numeric',
    });
  } catch { return '—'; }
}

function resolveId(item) { return item._id || item.id || ''; }

function isUnsubscribed(item) {
  return (item.subStatus || '').toLowerCase() === 'unsubscribed';
}

// ─── sub-components ──────────────────────────────────────────────────────────

function StatusBadge({ item }) {
  return isUnsubscribed(item)
    ? <span className={`${styles.badge} ${styles.badgeInactive}`}>Unsubscribed</span>
    : <span className={`${styles.badge} ${styles.badgeActive}`}>Subscribed</span>;
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

function UnsubscribeCard({ item, onUnsubscribe, removing, error }) {
  const id = resolveId(item);
  const unsub = isUnsubscribed(item);

  return (
    <div className={styles.card} style={{ borderLeftColor: unsub ? '#9ca3af' : '#16a34a' }}>
      <div className={styles.cardTop}>
        <h3 className={styles.emailTitle} title={item.contactAddress}>{item.contactAddress || '—'}</h3>
        <StatusBadge item={item} />
      </div>
      <div className={styles.cardField}>
        <span className={styles.fieldLabel}>Brand</span>
        <span className={styles.fieldValue}>{item.brandId || '—'}</span>
      </div>
      <div className={styles.cardField}>
        <span className={styles.fieldLabel}>Created</span>
        <span className={styles.fieldValue}>{formatDate(item.createdAt)}</span>
      </div>
      <div className={styles.cardField}>
        <span className={styles.fieldLabel}>Updated</span>
        <span className={styles.fieldValue}>{formatDate(item.updatedAt)}</span>
      </div>
      {!unsub && (
        <button className={styles.removeBtn} onClick={() => onUnsubscribe(item)} disabled={removing}>
          {removing ? 'Unsubscribing…' : 'Unsubscribe'}
        </button>
      )}
      {error && <p role="alert" style={{ margin: '0.4rem 0 0', color: '#b91c1c', fontSize: '0.8rem' }}>{error}</p>}
    </div>
  );
}

// ─── main component ───────────────────────────────────────────────────────────

const SKELETON_COUNT = 6;

const UnsubscribePage = () => {
  const { token } = useAuth();

  const [allItems, setAllItems]       = useState([]);
  const [loading, setLoading]         = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError]             = useState('');
  const [noMoreDocs, setNoMoreDocs]   = useState(false);
  const [lastId, setLastId]           = useState(null);
  const [view, setView]               = useState('list'); // 'list' | 'cards'

  const [emailFilter, setEmailFilter]   = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [removingIds, setRemovingIds]   = useState(new Set());
  const [rowErrors, setRowErrors]       = useState({}); // per-row unsubscribe failures (not a page-top banner)

  // ── fetch ──────────────────────────────────────────────────────────────────

  const fetchPage = useCallback(async (cursorId = null) => {
    const params = cursorId ? { lastId: cursorId } : {};
    const res = await api.adminListUnsubscribed(params);
    const rawDocs = res?.data ?? res?.docs ?? (Array.isArray(res) ? res : []);
    // Default view: 10 most-recent items sorted desc by createdAt.
    // On initial load (no cursor) cap at 10 for the default experience.
    const sorted = [...rawDocs].sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
    const docs = cursorId ? sorted : sorted.slice(0, 10);
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
        setAllItems(docs); setLastId(last); setNoMoreDocs(done);
      })
      .catch((err) => { if (!cancelled) setError(err.message || 'Failed to load contacts.'); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [fetchPage]);

  const handleLoadMore = async () => {
    if (loadingMore || noMoreDocs) return;
    setLoadingMore(true);
    try {
      const { docs, last, done } = await fetchPage(lastId);
      setAllItems((prev) => [...prev, ...docs]);
      setLastId(last); setNoMoreDocs(done);
    } catch (err) {
      setError(err.message || 'Failed to load more.');
    } finally { setLoadingMore(false); }
  };

  // ── unsubscribe ────────────────────────────────────────────────────────────

  const handleUnsubscribe = async (item) => {
    const id = resolveId(item);
    if (!window.confirm(`Unsubscribe ${item.contactAddress}?`)) return;
    setRemovingIds((prev) => new Set([...prev, id]));
    setRowErrors((prev) => { const n = { ...prev }; delete n[id]; return n; });
    try {
      await api.adminUnsubscribeContact(id);
      setAllItems((prev) =>
        prev.map((r) => resolveId(r) === id ? { ...r, subStatus: 'unsubscribed' } : r)
      );
    } catch (err) {
      // Per-row error next to the action, not a page-top banner that can scroll off.
      setRowErrors((prev) => ({ ...prev, [id]: err?.message || 'Failed to unsubscribe.' }));
    } finally {
      setRemovingIds((prev) => { const s = new Set(prev); s.delete(id); return s; });
    }
  };

  // ── derived stats ──────────────────────────────────────────────────────────

  const unsubscribedCount = allItems.filter(isUnsubscribed).length;
  const thisMonth = new Date();
  const addedThisMonth = allItems.filter((r) => {
    if (!r.createdAt) return false;
    const d = new Date(r.createdAt);
    return d.getFullYear() === thisMonth.getFullYear() && d.getMonth() === thisMonth.getMonth();
  }).length;

  const filtered = useMemo(() => {
    const eq = emailFilter.trim().toLowerCase();
    return allItems.filter((r) => {
      const unsub = isUnsubscribed(r);
      if (statusFilter === 'subscribed' && unsub) return false;
      if (statusFilter === 'unsubscribed' && !unsub) return false;
      if (eq && !(r.contactAddress || '').toLowerCase().includes(eq)) return false;
      return true;
    });
  }, [allItems, emailFilter, statusFilter]);

  // ── render ─────────────────────────────────────────────────────────────────

  return (
    <main className={styles.page}>
      <div className={styles.pageHeader}>
        <div className={styles.titleBlock}>
          <h1 className={styles.title}>Email Contacts</h1>
          <p className={styles.subtitle}>Manage email subscription status for all managed contacts</p>
        </div>
        <div className={styles.viewToggle}>
          <button className={`${styles.viewBtn} ${view === 'list' ? styles.viewBtnActive : ''}`} onClick={() => setView('list')}>List</button>
          <button className={`${styles.viewBtn} ${view === 'cards' ? styles.viewBtnActive : ''}`} onClick={() => setView('cards')}>Cards</button>
        </div>
      </div>

      <div className={styles.statsBar}>
        <div className={styles.statCard}><div className={styles.statNumber}>{allItems.length}</div><div className={styles.statLabel}>Total Contacts</div></div>
        <div className={styles.statCard}><div className={styles.statNumber}>{addedThisMonth}</div><div className={styles.statLabel}>Added This Month</div></div>
        <div className={styles.statCard}><div className={styles.statNumber}>{unsubscribedCount}</div><div className={styles.statLabel}>Unsubscribed</div></div>
      </div>

      {error && <div className={styles.errorBanner}>{error}</div>}

      <div className={styles.filterBar}>
        <div className={styles.searchWrap}>
          <span className={styles.searchIcon}>
            <svg width="15" height="15" viewBox="0 0 20 20" fill="none">
              <circle cx="9" cy="9" r="6.5" stroke="#9ca3af" strokeWidth="1.8" />
              <path d="M14.5 14.5l3.5 3.5" stroke="#9ca3af" strokeWidth="1.8" strokeLinecap="round" />
            </svg>
          </span>
          <input type="text" className={styles.filterInput} placeholder="Search by email…" value={emailFilter} onChange={(e) => setEmailFilter(e.target.value)} />
        </div>
        <select className={styles.filterSelect} value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
          <option value="all">All Statuses</option>
          <option value="subscribed">Subscribed</option>
          <option value="unsubscribed">Unsubscribed</option>
        </select>
      </div>

      {loading ? (
        view === 'cards' ? (
          <div className={styles.cardList}>
            {Array.from({ length: SKELETON_COUNT }).map((_, i) => <SkeletonCard key={i} />)}
          </div>
        ) : (
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead><tr>
                <th className={styles.th}>Email</th><th className={styles.th}>Status</th>
                <th className={styles.th}>Brand</th><th className={styles.th}>Created</th><th className={styles.th}>Action</th>
              </tr></thead>
              <tbody>{Array.from({ length: SKELETON_COUNT }).map((_, i) => (
                <tr key={i}><td className={styles.td} colSpan={5}><div className={`${styles.skeletonLine} ${styles.skeletonTitle}`} /></td></tr>
              ))}</tbody>
            </table>
          </div>
        )
      ) : allItems.length === 0 ? (
        <div className={styles.emptyState}>
          <div className={styles.emptyIcon}>📭</div>
          <p className={styles.emptyTitle}>No email contacts found</p>
          <p className={styles.emptyText}>Email contacts will appear here as users register.</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className={styles.emptyState}>
          <div className={styles.emptyIcon}>🔍</div>
          <p className={styles.emptyTitle}>No results match your filters</p>
        </div>
      ) : view === 'cards' ? (
        <div className={styles.cardList}>
          {filtered.map((item) => {
            const id = resolveId(item);
            return <UnsubscribeCard key={id || item.contactAddress} item={item} onUnsubscribe={handleUnsubscribe} removing={removingIds.has(id)} error={rowErrors[id]} />;
          })}
        </div>
      ) : (
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead><tr>
              <th className={styles.th}>Email</th>
              <th className={styles.th}>Status</th>
              <th className={styles.th}>Brand</th>
              <th className={styles.th}>Created</th>
              <th className={styles.th}>Action</th>
            </tr></thead>
            <tbody>
              {filtered.map((item) => {
                const id = resolveId(item);
                const unsub = isUnsubscribed(item);
                return (
                  <tr key={id || item.contactAddress} className={styles.tr}>
                    <td className={styles.td}>{item.contactAddress || '—'}</td>
                    <td className={styles.td}><StatusBadge item={item} /></td>
                    <td className={styles.td}>{item.brandId || '—'}</td>
                    <td className={styles.td}>{formatDate(item.createdAt)}</td>
                    <td className={styles.td}>
                      {!unsub && (
                        <button className={styles.tableActionBtn} onClick={() => handleUnsubscribe(item)} disabled={removingIds.has(id)}>
                          {removingIds.has(id) ? 'Unsubscribing…' : 'Unsubscribe'}
                        </button>
                      )}
                      {rowErrors[id] && <span role="alert" style={{ display: 'block', color: '#b91c1c', fontSize: '0.78rem', marginTop: '0.25rem' }}>{rowErrors[id]}</span>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {!loading && allItems.length > 0 && (
        <div className={styles.paginationBar}>
          <span className={styles.countLabel}>
            {filtered.length !== allItems.length
              ? `${filtered.length} of ${allItems.length} loaded`
              : `${allItems.length} contact${allItems.length !== 1 ? 's' : ''} loaded`}
          </span>
          {!noMoreDocs ? (
            <button className={styles.loadMoreBtn} onClick={handleLoadMore} disabled={loadingMore}>
              {loadingMore ? 'Loading…' : 'Load More'}
            </button>
          ) : (
            <span className={styles.allLoadedLabel}>All records loaded</span>
          )}
        </div>
      )}
    </main>
  );
};

export default UnsubscribePage;
