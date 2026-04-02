import React, { useEffect, useState, useCallback, useMemo } from 'react';
import api from '../../api';
import { useAuth } from '../../context/AuthContext';
import styles from './PhoneOptOutPage.module.css';

const PAGE_SIZE = 20;

function formatPhone(raw) {
  const digits = (raw || '').replace(/\D/g, '');
  if (digits.length === 10) return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
  if (digits.length === 11 && digits[0] === '1')
    return `+1 (${digits.slice(1, 4)}) ${digits.slice(4, 7)}-${digits.slice(7)}`;
  return raw || '—';
}

function formatDate(value) {
  if (!value) return '—';
  try { return new Date(value).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' }); }
  catch { return '—'; }
}

function resolveId(e) { return e._id || e.id || ''; }

function isUnsubscribed(e) { return (e.subStatus || '').toLowerCase() === 'unsubscribed'; }

function StatusBadge({ entry }) {
  const unsub = isUnsubscribed(entry);
  return unsub
    ? <span className={`${styles.badge} ${styles.badgeInactive}`}>Opted Out</span>
    : <span className={`${styles.badge} ${styles.badgeActive}`}>Active</span>;
}

const PhoneOptOutPage = () => {
  const { token } = useAuth();

  const [allEntries, setAllEntries]   = useState([]);
  const [loading, setLoading]         = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError]             = useState('');
  const [noMoreDocs, setNoMoreDocs]   = useState(false);
  const [lastId, setLastId]           = useState(null);
  const [view, setView]               = useState('list'); // 'list' | 'cards'

  const [search, setSearch]             = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [rowState, setRowState]         = useState({});

  // ── fetch ──────────────────────────────────────────────────────────

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
        setAllEntries(docs); setLastId(last); setNoMoreDocs(done);
      })
      .catch((err) => { if (!cancelled) setError(err.message || 'Failed to load phone contacts.'); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [fetchPage]);

  const handleLoadMore = async () => {
    if (loadingMore || noMoreDocs) return;
    setLoadingMore(true);
    try {
      const { docs, last, done } = await fetchPage(lastId);
      setAllEntries((prev) => [...prev, ...docs]);
      setLastId(last); setNoMoreDocs(done);
    } catch (err) {
      setError(err.message || 'Failed to load more.');
    } finally { setLoadingMore(false); }
  };

  // ── opt-out action ─────────────────────────────────────────────────

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

  // ── stats + filter ─────────────────────────────────────────────────

  const totalCount  = allEntries.length;
  const optOutCount = allEntries.filter(isUnsubscribed).length;
  const activeCount = totalCount - optOutCount;

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

  // ── render ─────────────────────────────────────────────────────────

  const renderAction = (entry) => {
    const id = resolveId(entry);
    const rs = rowState[id];
    if (isUnsubscribed(entry)) return null;
    return (
      <button
        className={styles.removeBtn}
        onClick={() => handleOptOut(entry)}
        disabled={rs === 'loading'}
      >
        {rs === 'loading' ? 'Opting out…' : 'Opt Out'}
      </button>
    );
  };

  return (
    <main className={styles.page}>
      <div className={styles.pageHeader}>
        <div className={styles.titleBlock}>
          <h1 className={styles.title}>Phone Contacts</h1>
          <p className={styles.subtitle}>Manage phone opt-out status for all managed contacts</p>
        </div>
        <div className={styles.viewToggle}>
          <button className={`${styles.viewBtn} ${view === 'list' ? styles.viewBtnActive : ''}`} onClick={() => setView('list')}>List</button>
          <button className={`${styles.viewBtn} ${view === 'cards' ? styles.viewBtnActive : ''}`} onClick={() => setView('cards')}>Cards</button>
        </div>
      </div>

      <div className={styles.statsBar}>
        <div className={styles.statCard}><div className={styles.statNumber}>{totalCount}</div><div className={styles.statLabel}>Total Contacts</div></div>
        <div className={styles.statCard}><div className={`${styles.statNumber} ${styles.statNumberActive}`}>{activeCount}</div><div className={styles.statLabel}>Active</div></div>
        <div className={styles.statCard}><div className={`${styles.statNumber} ${styles.statNumberInactive}`}>{optOutCount}</div><div className={styles.statLabel}>Opted Out</div></div>
      </div>

      {error && <div className={styles.errorBanner}>{error}</div>}

      <div className={styles.filterRow}>
        <div className={styles.searchWrap}>
          <span className={styles.searchIcon}>
            <svg width="15" height="15" viewBox="0 0 20 20" fill="none">
              <circle cx="9" cy="9" r="6.5" stroke="#9ca3af" strokeWidth="1.8"/>
              <path d="M14.5 14.5l3.5 3.5" stroke="#9ca3af" strokeWidth="1.8" strokeLinecap="round"/>
            </svg>
          </span>
          <input type="text" className={styles.searchInput} placeholder="Search phone number…" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <select className={styles.filterSelect} value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
          <option value="all">All Statuses</option>
          <option value="active">Active</option>
          <option value="optout">Opted Out</option>
        </select>
      </div>

      {loading ? (
        <div className={styles.loadingWrap}>
          {[...Array(5)].map((_, i) => (
            <div key={i} className={styles.skeletonCard}>
              <div className={`${styles.skeletonCell} ${styles.skeletonLong}`} />
              <div className={`${styles.skeletonCell} ${styles.skeletonMed}`} />
              <div className={`${styles.skeletonCell} ${styles.skeletonShort}`} />
            </div>
          ))}
        </div>
      ) : allEntries.length === 0 ? (
        <div className={styles.emptyState}>
          <div className={styles.emptyIcon}>📵</div>
          <p className={styles.emptyTitle}>No phone contacts found</p>
          <p className={styles.emptyText}>Phone contacts will appear here as users register.</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className={styles.noResults}>No entries match your filters.</div>
      ) : view === 'cards' ? (
        <ul className={styles.cardList}>
          {filtered.map((entry) => {
            const id = resolveId(entry);
            const unsub = isUnsubscribed(entry);
            const date = formatDate(entry.createdAt);
            const rs = rowState[id];
            return (
              <li key={id} className={`${styles.phoneCard} ${unsub ? styles.phoneCardInactive : styles.phoneCardActive}`}>
                <div className={styles.cardLeft}>
                  <span className={styles.phoneNumber}>{formatPhone(entry.contactAddress)}</span>
                  <span className={styles.dateAdded}>Added {date}</span>
                </div>
                <div className={styles.cardCenter}><StatusBadge entry={entry} /></div>
                <div className={styles.cardRight}>
                  {rs === 'error' && <span className={styles.inlineError}>Failed</span>}
                  {!unsub && (
                    <button className={styles.removeBtn} onClick={() => handleOptOut(entry)} disabled={rs === 'loading'}>
                      {rs === 'loading' ? 'Opting out…' : 'Opt Out'}
                    </button>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      ) : (
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead><tr>
              <th className={styles.th}>Phone</th>
              <th className={styles.th}>Status</th>
              <th className={styles.th}>Brand</th>
              <th className={styles.th}>Added</th>
              <th className={styles.th}>Action</th>
            </tr></thead>
            <tbody>
              {filtered.map((entry) => {
                const id = resolveId(entry);
                return (
                  <tr key={id} className={styles.tr}>
                    <td className={styles.td}>{formatPhone(entry.contactAddress)}</td>
                    <td className={styles.td}><StatusBadge entry={entry} /></td>
                    <td className={styles.td}>{entry.brandId || '—'}</td>
                    <td className={styles.td}>{formatDate(entry.createdAt)}</td>
                    <td className={styles.td}>{renderAction(entry)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <div className={styles.paginationBar}>
        <span className={styles.countLabel}>Showing {filtered.length} of {totalCount} loaded</span>
        {!noMoreDocs ? (
          <button className={styles.loadMoreBtn} onClick={handleLoadMore} disabled={loadingMore}>
            {loadingMore ? 'Loading…' : 'Load More'}
          </button>
        ) : (
          <span className={styles.allLoadedLabel}>All entries loaded</span>
        )}
      </div>
    </main>
  );
};

export default PhoneOptOutPage;
