import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../../api';
import styles from './PaymentsPage.module.css';

// ─── helpers ──────────────────────────────────────────────────────────────────

function formatDate(value) {
  if (!value) return '—';
  try {
    return new Date(value).toLocaleDateString(undefined, {
      year: 'numeric', month: 'short', day: 'numeric',
    });
  } catch { return '—'; }
}

function formatAmount(val) {
  if (val == null || val === '') return '—';
  return `$${Number(val).toFixed(2)}`;
}

function shortId(id) {
  if (!id) return '—';
  return id.length > 14 ? id.slice(0, 14) + '\u2026' : id;
}

function resolveOrderStatus(order) {
  if (order?.transient?.canceled) return 'canceled';
  return (order?.status || '').toLowerCase() || 'unknown';
}

/**
 * Flatten order list → individual payment rows.
 */
function flattenPayments(orders) {
  const rows = [];
  for (const order of orders) {
    const orderId = order._id || order.id;
    const orderStatus = resolveOrderStatus(order);
    const payments = order?.commercePayments || [];

    if (payments.length === 0) {
      const collected = order?.transient?.amount?.collected;
      const amt = collected != null ? collected : (order?.amount?.collected ?? order?.amount ?? order?.total ?? null);
      rows.push({
        payId: orderId,
        amount: amt,
        payStatus: orderStatus === 'active' ? 'fulfilled' : orderStatus,
        sequence: 0,
        date: order?.createdAt,
        orderId,
        orderStatus,
      });
    } else {
      payments.forEach((pmt, idx) => {
        const payId = pmt._id || pmt.id || `${orderId}-pmt-${idx}`;
        const payStatus = (pmt.status || (pmt.fulfilled ? 'fulfilled' : 'unknown')).toLowerCase();
        const amount = pmt?.amount?.collected ?? pmt?.amount ?? pmt?.collected ?? null;
        rows.push({
          payId,
          amount,
          payStatus,
          sequence: pmt.sequence ?? idx,
          date: pmt.createdAt || order.createdAt,
          orderId,
          orderStatus,
        });
      });
    }
  }
  return rows;
}

// ─── Badges ───────────────────────────────────────────────────────────────────

function PayStatusBadge({ status }) {
  const s = (status || '').toLowerCase();
  if (s === 'fulfilled') return <span className={`${styles.badge} ${styles.badgeFulfilled}`}>Fulfilled</span>;
  if (s === 'rejected' || s === 'failed') return <span className={`${styles.badge} ${styles.badgeFailed}`}>Rejected</span>;
  if (s === 'pending') return <span className={`${styles.badge} ${styles.badgePending}`}>Pending</span>;
  return <span className={`${styles.badge} ${styles.badgeDefault}`}>{s || 'Unknown'}</span>;
}

function OrderStatusBadge({ status }) {
  const s = (status || '').toLowerCase();
  if (s === 'active') return <span className={`${styles.badge} ${styles.badgeActive}`}>Active</span>;
  if (s === 'canceled' || s === 'cancelled') return <span className={`${styles.badge} ${styles.badgeCanceled}`}>Canceled</span>;
  if (s === 'failed') return <span className={`${styles.badge} ${styles.badgeFailed}`}>Failed</span>;
  return <span className={`${styles.badge} ${styles.badgeDefault}`}>{s || 'Unknown'}</span>;
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function SkeletonRows({ count = 6 }) {
  return Array.from({ length: count }).map((_, i) => (
    <tr key={i} aria-hidden="true">
      {[1, 2, 3, 4, 5, 6].map((j) => (
        <td key={j} className={styles.td}>
          <div className={styles.skeletonLine} style={{ width: `${35 + (j * 12) % 45}%` }} />
        </td>
      ))}
    </tr>
  ));
}

// ─── PaymentsPage ─────────────────────────────────────────────────────────────

const PaymentsPage = () => {
  // Search state
  const [searchInput, setSearchInput] = useState('');
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState('');
  const [resolvedUserId, setResolvedUserId] = useState(null);
  const [resolvedLabel, setResolvedLabel] = useState('');

  // Orders / payments data
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(false);
  const [fetchError, setFetchError] = useState('');

  // Pending sidebar filters
  const [pendingId, setPendingId] = useState('');
  const [pendingStatus, setPendingStatus] = useState('all');
  // Applied filters
  const [idFilter, setIdFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  const fetchOrders = useCallback(async (uid) => {
    if (!uid) return;
    setLoading(true);
    setFetchError('');
    setOrders([]);
    try {
      const res = await api.adminListPurchases({ userId: uid });
      const list = res?.data || res?.orders || res?.docs || (Array.isArray(res) ? res : []);
      setOrders(list);
    } catch (err) {
      setFetchError(err.message || 'Failed to load orders.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (resolvedUserId) fetchOrders(resolvedUserId);
  }, [resolvedUserId, fetchOrders]);

  const handleSearch = async (e) => {
    e.preventDefault();
    const input = searchInput.trim();
    if (!input) return;
    setSearchError('');
    setSearching(true);
    try {
      let uid = input;
      if (input.includes('@')) {
        const res = await api.adminListUsers({ email: input });
        const list = res?.docs || res?.users || res?.data || (Array.isArray(res) ? res : []);
        if (!list.length) {
          setSearchError(`No user found for email: ${input}`);
          setSearching(false);
          return;
        }
        uid = list[0]._id || list[0].id;
      }
      setResolvedLabel(input);
      setResolvedUserId(uid);
    } catch (err) {
      setSearchError(err.message || 'Search failed.');
    } finally {
      setSearching(false);
    }
  };

  const allPayments = useMemo(() => flattenPayments(orders), [orders]);

  const filtered = useMemo(() => {
    return allPayments.filter((row) => {
      if (idFilter && !row.payId.toLowerCase().includes(idFilter.toLowerCase())) return false;
      if (statusFilter !== 'all' && row.payStatus !== statusFilter) return false;
      return true;
    });
  }, [allPayments, idFilter, statusFilter]);

  const handleApply = (e) => {
    e.preventDefault();
    setIdFilter(pendingId);
    setStatusFilter(pendingStatus);
  };

  const handleReset = () => {
    setPendingId(''); setPendingStatus('all');
    setIdFilter(''); setStatusFilter('all');
  };

  const hasResults = resolvedUserId && !loading && !fetchError;

  return (
    <main className={styles.page}>
      <div className={styles.pageHeader}>
        <h1 className={styles.title}>Payment Records</h1>
        <p className={styles.subtitle}>
          {resolvedUserId
            ? `${allPayments.length} payment records for ${resolvedLabel} · ${filtered.length} shown`
            : 'Search by customer email or user ID to view payment records'}
        </p>
      </div>

      {/* Search form */}
      <form className={styles.searchForm} onSubmit={handleSearch}>
        <input
          className={styles.searchInput}
          type="text"
          placeholder="Customer email or user ID…"
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          disabled={searching}
        />
        <button
          type="submit"
          className={styles.searchBtn}
          disabled={searching || !searchInput.trim()}
        >
          {searching ? 'Searching…' : 'Search'}
        </button>
        {resolvedUserId && (
          <Link to={`/admin/users/${resolvedUserId}`} className={styles.profileLink}>
            View Profile
          </Link>
        )}
      </form>

      {searchError && <div className={styles.errorBanner}>{searchError}</div>}

      {!resolvedUserId && !searchError && (
        <div className={styles.prompt}>
          Enter a customer email or user ID above to load their payment records.
        </div>
      )}

      {resolvedUserId && (
        <div className={styles.wrapper}>
          {/* Sidebar */}
          <aside className={styles.sidebar}>
            <h3 className={styles.sidebarTitle}>Filter Payments</h3>
            <form onSubmit={handleApply}>
              <div className={styles.filterField}>
                <label className={styles.filterLabel}>ID</label>
                <input
                  className={styles.filterInput}
                  type="text"
                  placeholder="Partial ID…"
                  value={pendingId}
                  onChange={(e) => setPendingId(e.target.value)}
                />
              </div>
              <div className={styles.filterField}>
                <label className={styles.filterLabel}>Status</label>
                <select
                  className={styles.filterSelect}
                  value={pendingStatus}
                  onChange={(e) => setPendingStatus(e.target.value)}
                >
                  <option value="all">All</option>
                  <option value="fulfilled">Fulfilled</option>
                  <option value="rejected">Rejected</option>
                  <option value="pending">Pending</option>
                </select>
              </div>
              <div className={styles.sidebarActions}>
                <button type="submit" className={styles.applyBtn}>Apply</button>
                <button type="button" className={styles.resetBtn} onClick={handleReset}>Reset</button>
              </div>
            </form>
          </aside>

          {/* Table */}
          <section className={styles.tableSection}>
            {fetchError && <div className={styles.errorBanner}>{fetchError}</div>}

            {hasResults && allPayments.length === 0 && (
              <div className={styles.emptyState}>
                <p className={styles.emptyTitle}>No payment records found for this customer.</p>
              </div>
            )}

            {hasResults && allPayments.length > 0 && filtered.length === 0 && (
              <div className={styles.emptyState}>
                <p className={styles.emptyTitle}>No payments match the current filters.</p>
                <button className={styles.resetBtn} onClick={handleReset}>Clear filters</button>
              </div>
            )}

            {(loading || filtered.length > 0) && (
              <div className={styles.tableWrap}>
                <table className={styles.table}>
                  <thead>
                    <tr>
                      <th className={styles.th}>ID</th>
                      <th className={styles.th}>Amount</th>
                      <th className={styles.th}>Status</th>
                      <th className={styles.th}>Sequence</th>
                      <th className={styles.th}>Date</th>
                      <th className={styles.th}>Order Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {loading ? (
                      <SkeletonRows />
                    ) : (
                      filtered.map((row, idx) => (
                        <tr key={row.payId + idx} className={styles.tr}>
                          <td className={styles.td}>
                            <span className={styles.payId} title={row.payId}>{shortId(row.payId)}</span>
                          </td>
                          <td className={styles.td}>{formatAmount(row.amount)}</td>
                          <td className={styles.td}><PayStatusBadge status={row.payStatus} /></td>
                          <td className={styles.td}>{row.sequence}</td>
                          <td className={styles.td}>{formatDate(row.date)}</td>
                          <td className={styles.td}><OrderStatusBadge status={row.orderStatus} /></td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </div>
      )}
    </main>
  );
};

export default PaymentsPage;
