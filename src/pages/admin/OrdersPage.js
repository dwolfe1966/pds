import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import api from '../../api';
import { useAuth } from '../../context/AuthContext';
import styles from './OrdersPage.module.css';

// ─── helpers ──────────────────────────────────────────────────────────────────

function formatDate(value) {
  if (!value) return '—';
  try {
    return new Date(value).toLocaleDateString(undefined, {
      year: 'numeric', month: 'short', day: 'numeric',
    });
  } catch { return '—'; }
}

function resolveAmount(order) {
  const collected = order?.transient?.amount?.collected;
  if (collected != null) return collected;
  const amt = order?.amount;
  if (amt != null) return typeof amt === 'object' ? (amt.collected ?? null) : amt;
  return order?.total ?? null;
}

function formatAmount(order) {
  const val = resolveAmount(order);
  if (val == null) return '—';
  return `$${Number(val).toFixed(2)}`;
}

function resolveType(order) {
  return order?.type || order?.commercePaymentType || order?.commercePayments?.[0]?.type || '—';
}

function resolveStatus(order) {
  if (order?.transient?.canceled) return 'canceled';
  return (order?.status || '').toLowerCase() || 'unknown';
}

function shortId(id) {
  if (!id) return '—';
  return id.length > 14 ? id.slice(0, 14) + '\u2026' : id;
}

// ─── StatusBadge ──────────────────────────────────────────────────────────────

function StatusBadge({ status }) {
  const s = (status || '').toLowerCase();
  if (s === 'active') return <span className={`${styles.badge} ${styles.badgeActive}`}>Active</span>;
  if (s === 'canceled' || s === 'cancelled') return <span className={`${styles.badge} ${styles.badgeCanceled}`}>Canceled</span>;
  if (s === 'failed') return <span className={`${styles.badge} ${styles.badgeFailed}`}>Failed</span>;
  if (s === 'pending') return <span className={`${styles.badge} ${styles.badgePending}`}>Pending</span>;
  return <span className={`${styles.badge} ${styles.badgeDefault}`}>{s || 'Unknown'}</span>;
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function SkeletonRows({ count = 6 }) {
  return Array.from({ length: count }).map((_, i) => (
    <tr key={i} aria-hidden="true">
      {[1, 2, 3, 4, 5, 6].map((j) => (
        <td key={j} className={styles.td}>
          <div className={styles.skeletonLine} style={{ width: `${35 + (j * 10) % 40}%` }} />
        </td>
      ))}
    </tr>
  ));
}

// ─── OrdersPage ───────────────────────────────────────────────────────────────

const OrdersPage = () => {
  const [urlParams] = useSearchParams();
  const { token } = useAuth();

  const urlUserId = urlParams.get('userId');

  // Search state
  const [searchInput, setSearchInput] = useState('');
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState('');
  const [resolvedUserId, setResolvedUserId] = useState(urlUserId || null);
  const [resolvedEmail, setResolvedEmail] = useState('');

  // Orders data
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true); // true on mount to show skeleton
  const [fetchError, setFetchError] = useState('');
  const [isGlobalView, setIsGlobalView] = useState(!urlUserId); // true when showing default recent list

  // Pending sidebar filters
  const [pendingOrderId, setPendingOrderId] = useState('');
  const [pendingStatus, setPendingStatus] = useState('all');
  const [pendingType, setPendingType] = useState('all');
  // Applied filters
  const [orderIdFilter, setOrderIdFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');

  useEffect(() => {
    setResolvedUserId(urlUserId || null);
  }, [urlUserId]);

  // Load 10 most recent orders globally on mount
  const fetchGlobalOrders = useCallback(async () => {
    setLoading(true);
    setFetchError('');
    try {
      const res = await api.adminListOrdersGlobal({ limit: 10 });
      const list = res?.data || res?.docs || res?.orders || (Array.isArray(res) ? res : []);
      setOrders(list);
      setIsGlobalView(true);
    } catch {
      // BC may not support global order search — silently show empty default
      setOrders([]);
      setIsGlobalView(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!urlUserId) {
      fetchGlobalOrders();
    }
  }, [urlUserId, fetchGlobalOrders]);

  const fetchOrders = useCallback(async (uid) => {
    if (!uid) return;
    setLoading(true);
    setFetchError('');
    setOrders([]);
    setIsGlobalView(false);
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
      let email = '';
      if (input.includes('@')) {
        const res = await api.adminListUsers({ email: input });
        const list = res?.docs || res?.users || res?.data || (Array.isArray(res) ? res : []);
        if (!list.length) {
          setSearchError(`No user found for email: ${input}`);
          setSearching(false);
          return;
        }
        uid = list[0]._id || list[0].id;
        email = input;
      }
      setResolvedEmail(email || uid);
      setResolvedUserId(uid);
    } catch (err) {
      setSearchError(err.message || 'Search failed.');
    } finally {
      setSearching(false);
    }
  };

  const handleApplyFilters = (e) => {
    e.preventDefault();
    setOrderIdFilter(pendingOrderId);
    setStatusFilter(pendingStatus);
    setTypeFilter(pendingType);
  };

  const handleResetFilters = () => {
    setPendingOrderId(''); setPendingStatus('all'); setPendingType('all');
    setOrderIdFilter(''); setStatusFilter('all'); setTypeFilter('all');
  };

  const filtered = useMemo(() => {
    return orders.filter((o) => {
      const id = (o._id || o.id || '').toLowerCase();
      const status = resolveStatus(o);
      const type = (resolveType(o) || '').toLowerCase();
      if (orderIdFilter && !id.includes(orderIdFilter.toLowerCase())) return false;
      if (statusFilter !== 'all') {
        if (statusFilter === 'canceled' && status !== 'canceled' && status !== 'cancelled') return false;
        if (statusFilter !== 'canceled' && status !== statusFilter) return false;
      }
      if (typeFilter !== 'all' && type !== typeFilter) return false;
      return true;
    });
  }, [orders, orderIdFilter, statusFilter, typeFilter]);

  return (
    <main className={styles.page}>
      <div className={styles.pageHeader}>
        <h1 className={styles.title}>Order Management</h1>
        <p className={styles.subtitle}>
          {resolvedUserId
            ? `${orders.length} orders for ${resolvedEmail || resolvedUserId} · ${filtered.length} shown`
            : isGlobalView && orders.length > 0
            ? `Showing ${orders.length} most recent orders`
            : 'Search by customer email or user ID to filter orders'}
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
          <>
            <Link to={`/users/${resolvedUserId}`} className={styles.profileLink}>
              View Profile
            </Link>
            <button
              type="button"
              className={styles.clearSearchBtn}
              onClick={() => { setResolvedUserId(null); setResolvedEmail(''); setSearchInput(''); fetchGlobalOrders(); }}
            >
              Clear
            </button>
          </>
        )}
      </form>

      {searchError && <div className={styles.errorBanner}>{searchError}</div>}

      {/* Main area: sidebar + table — always shown */}
      {(true) && (
        <div className={styles.wrapper}>
          {/* Sidebar filters */}
          <aside className={styles.sidebar}>
            <h3 className={styles.sidebarTitle}>Filter Orders</h3>
            <form onSubmit={handleApplyFilters}>
              <div className={styles.filterField}>
                <label className={styles.filterLabel}>Order ID</label>
                <input
                  className={styles.filterInput}
                  type="text"
                  placeholder="Partial match…"
                  value={pendingOrderId}
                  onChange={(e) => setPendingOrderId(e.target.value)}
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
                  <option value="active">Active</option>
                  <option value="canceled">Canceled</option>
                  <option value="failed">Failed</option>
                  <option value="pending">Pending</option>
                </select>
              </div>
              <div className={styles.filterField}>
                <label className={styles.filterLabel}>Type</label>
                <select
                  className={styles.filterSelect}
                  value={pendingType}
                  onChange={(e) => setPendingType(e.target.value)}
                >
                  <option value="all">All</option>
                  <option value="sale">Sale</option>
                  <option value="validate">Validate</option>
                  <option value="refund">Refund</option>
                </select>
              </div>
              <div className={styles.sidebarActions}>
                <button type="submit" className={styles.applyBtn}>Filter</button>
                <button type="button" className={styles.resetBtn} onClick={handleResetFilters}>Reset</button>
              </div>
            </form>
          </aside>

          {/* Table area */}
          <section className={styles.tableSection}>
            {fetchError && <div className={styles.errorBanner}>{fetchError}</div>}

            {!loading && !fetchError && orders.length === 0 && (
              <div className={styles.emptyState}>
                <p className={styles.emptyTitle}>
                  {resolvedUserId ? 'No orders found for this customer.' : 'No recent orders available.'}
                </p>
                {isGlobalView && (
                  <p style={{ fontSize: '0.85rem', color: '#aaa' }}>Search by email or user ID above to look up a specific customer.</p>
                )}
              </div>
            )}

            {!loading && orders.length > 0 && filtered.length === 0 && (
              <div className={styles.emptyState}>
                <p className={styles.emptyTitle}>No orders match the current filters.</p>
                <button className={styles.resetBtn} onClick={handleResetFilters}>Clear filters</button>
              </div>
            )}

            {(loading || filtered.length > 0) && (
              <div className={styles.tableWrap}>
                <table className={styles.table}>
                  <thead>
                    <tr>
                      <th className={styles.th}>Order ID</th>
                      <th className={styles.th}>Amount</th>
                      <th className={styles.th}>Status</th>
                      <th className={styles.th}>Type</th>
                      <th className={styles.th}>Date</th>
                      <th className={styles.th}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {loading ? (
                      <SkeletonRows />
                    ) : (
                      filtered.map((order) => {
                        const pid = order._id || order.id;
                        return (
                          <tr key={pid} className={styles.tr}>
                            <td className={styles.td}>
                              <span className={styles.orderId} title={pid}>{shortId(pid)}</span>
                            </td>
                            <td className={styles.td}>{formatAmount(order)}</td>
                            <td className={styles.td}>
                              <StatusBadge status={resolveStatus(order)} />
                            </td>
                            <td className={styles.td}>{resolveType(order)}</td>
                            <td className={styles.td}>{formatDate(order.createdAt)}</td>
                            <td className={styles.td}>
                              <Link
                                to={`/purchases/${pid}?userId=${resolvedUserId}`}
                                className={styles.viewBtn}
                              >
                                View
                              </Link>
                            </td>
                          </tr>
                        );
                      })
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

export default OrdersPage;
