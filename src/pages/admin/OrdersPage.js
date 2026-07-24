import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams, useNavigate } from 'react-router-dom';
import api from '../../api';
import OrderBillingBadge from './OrderBillingBadge';
import { useAuth } from '../../context/AuthContext';
import { getOrderCollected } from '../../utils/orderFinancials';
import { getOrderCard } from '../../utils/orderCard';
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
  // Trust per-payment status over BC's `transient.amount.collected`, which
  // sums rejected attempts too. See src/utils/orderFinancials.js.
  if (Array.isArray(order?.commercePayments)) return getOrderCollected(order);
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
  // Cancel-at-period-end + other terminal states persist as `subStatus` while BC leaves `order.status`
  // = 'active' — so key off subStatus, or a cancelled/expired/suspended order reads "Active" (the
  // cancelled-shows-active bug; ibarra690@gmail.com 2026-07-24: status active + subStatus canceled).
  const sub = (order?.subStatus || '').toLowerCase();
  if (order?.transient?.canceled || sub === 'canceled' || sub === 'cancelled') return 'canceled';
  if (sub === 'expired') return 'expired';
  if (sub === 'suspended') return 'suspended';
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
      {[1, 2, 3, 4, 5, 6, 7].map((j) => (
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
  const navigate = useNavigate();
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
  const [globalListUnavailable, setGlobalListUnavailable] = useState(false);
  // 'global' | 'fanout' | 'fanout-empty' | null — tells the user whether the
  // list came from BC's real commerceOrder search or our recent-customer
  // fan-out fallback (and whether the fallback also came up empty).
  const [globalSource, setGlobalSource] = useState(null);
  const [globalUserPoolSize, setGlobalUserPoolSize] = useState(null);
  const [globalDiagnostics, setGlobalDiagnostics] = useState(null);
  const [recentCustomers, setRecentCustomers] = useState([]);

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
    setGlobalListUnavailable(false);
    setGlobalSource(null);
    setGlobalUserPoolSize(null);
    setGlobalDiagnostics(null);
    setRecentCustomers([]);
    try {
      const res = await api.adminListOrdersGlobal({ limit: 10 });
      const list = res?.data || res?.docs || res?.orders || (Array.isArray(res) ? res : []);
      const sorted = [...list].sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
      setOrders(sorted.slice(0, 10));
      setIsGlobalView(true);
      setGlobalSource(res?.source || null);
      setGlobalUserPoolSize(res?.userPoolSize || null);
      setGlobalDiagnostics(res?.diagnostics || null);
      setRecentCustomers(Array.isArray(res?.recentUsers) ? res.recentUsers : []);
    } catch (err) {
      // BC may not support global commerceOrder search without a filter param.
      // Surface a clear message so CSR knows the call failed rather than assuming zero orders.
      if (process.env.NODE_ENV === 'development') {
        console.warn('[OrdersPage] global orders fetch failed:', err?.message);
      }
      setOrders([]);
      setIsGlobalView(true);
      setGlobalListUnavailable(true);
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

      {/* Honest source disclosure when the default view came from the
          recent-customer fan-out rather than a real global query. */}
      {isGlobalView && globalSource === 'fanout' && orders.length > 0 && (
        <div style={{
          background: '#fef3c7',
          border: '1px solid #fde68a',
          color: '#92400e',
          borderRadius: '0.5rem',
          padding: '0.5rem 0.875rem',
          fontSize: '0.82rem',
          margin: '0 0 1rem',
        }}>
          <strong>Recent-customer view:</strong> showing the newest orders across the {globalUserPoolSize ?? 50} most-recent customers. Search by email or user ID above to see a specific account's full history.
        </div>
      )}

      {/* "Recent customers" lobby — shown when no orders surface (BC's global
          commerceOrder search and our user fan-out both returned empty). The
          users list itself comes from a known-working endpoint, so CSRs can
          drill into a customer's order history without hitting a dead end. */}
      {isGlobalView && !loading && !resolvedUserId && orders.length === 0 && recentCustomers.length > 0 && (
        <section style={{ marginBottom: '1.25rem' }}>
          <div style={{
            background: '#fef3c7', border: '1px solid #fde68a', color: '#92400e',
            borderRadius: '0.5rem', padding: '0.5rem 0.875rem', fontSize: '0.82rem',
            marginBottom: '0.75rem',
          }}>
            <strong>No recent orders surfaced from BC.</strong> Showing the {recentCustomers.length} most-recent customers below — click any to view their full order history.
            {globalDiagnostics && (
              <details style={{ marginTop: '0.4rem' }}>
                <summary style={{ cursor: 'pointer', fontSize: '0.78rem' }}>diagnostics</summary>
                <pre style={{ margin: '0.4rem 0 0', fontSize: '0.72rem', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
{JSON.stringify(globalDiagnostics, null, 2)}
                </pre>
              </details>
            )}
          </div>
          <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: '0.5rem', overflow: 'hidden' }}>
            {recentCustomers.slice(0, 25).map((u, idx) => {
              const name = `${u.firstName || ''} ${u.lastName || ''}`.trim() || u.email || u._id;
              return (
                <Link
                  key={u._id || idx}
                  to={`/users/${u._id}`}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '0.75rem',
                    padding: '0.55rem 0.875rem',
                    borderBottom: idx < Math.min(recentCustomers.length, 25) - 1 ? '1px solid #e5e7eb' : 'none',
                    color: '#111827', textDecoration: 'none', fontSize: '0.875rem',
                  }}
                >
                  <span style={{
                    width: 28, height: 28, borderRadius: '50%',
                    background: '#dcfce7', color: '#0d5d2f',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: '0.78rem', fontWeight: 700, flexShrink: 0,
                  }}>{(name || '?').charAt(0).toUpperCase()}</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{name}</div>
                    <div style={{ fontSize: '0.78rem', color: '#6b7280' }}>{u.email || '—'}</div>
                  </div>
                  <span style={{ fontSize: '0.78rem', color: '#1a56db', fontWeight: 600 }}>View orders →</span>
                </Link>
              );
            })}
          </div>
        </section>
      )}

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
                  placeholder="Partial match or full ID…"
                  value={pendingOrderId}
                  onChange={(e) => setPendingOrderId(e.target.value)}
                />
                {pendingOrderId.trim().length >= 12 && (
                  <button
                    type="button"
                    onClick={() => navigate(`/admin/purchases/${encodeURIComponent(pendingOrderId.trim())}`)}
                    style={{
                      marginTop: '0.35rem',
                      padding: '0.4rem 0.7rem',
                      fontSize: '0.8125rem',
                      border: '1px solid #1a56db',
                      borderRadius: 4,
                      background: '#1a56db',
                      color: '#fff',
                      cursor: 'pointer',
                      width: '100%',
                    }}
                  >
                    Open order ID →
                  </button>
                )}
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
                  {resolvedUserId
                    ? 'No orders found for this customer.'
                    : globalListUnavailable
                    ? 'Unable to load the global order list.'
                    : 'No recent orders available.'}
                </p>
                {isGlobalView && globalListUnavailable && (
                  <p style={{ fontSize: '0.85rem', color: '#aaa' }}>
                    The global recent-orders lookup is not available — search by email or user ID above to view orders for a specific customer.
                  </p>
                )}
                {isGlobalView && !globalListUnavailable && (
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
                      <th className={styles.th}>Card</th>
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
                        // Global view has no resolvedUserId — fall back to the
                        // order's own payerId/updaterId so the detail page
                        // can pass userId to BC's getUserOrder (it rejects
                        // missing/"null" with `userId must be a mongodb id`).
                        const orderUserId = resolvedUserId || order.payerId || order.updaterId || order.userId || '';
                        return (
                          <tr key={pid} className={styles.tr}>
                            <td className={styles.td}>
                              <span className={styles.orderId} title={pid}>{shortId(pid)}</span>
                            </td>
                            <td className={styles.td}>{formatAmount(order)}</td>
                            <td className={styles.td}>
                              <OrderBillingBadge order={order} />
                            </td>
                            <td className={styles.td}>{resolveType(order)}</td>
                            <td className={styles.td}>
                              {(() => {
                                const c = getOrderCard(order);
                                if (!c) return '—';
                                const meta = [c.expiry && `Exp ${c.expiry}`, [c.type, c.level].filter(Boolean).join(' '), c.bank, c.country].filter(Boolean).join(' · ');
                                return (
                                  <span title={meta}>
                                    <span style={{ fontWeight: 600 }}>{c.brand || 'Card'} ••{c.last4}</span>
                                    {c.bank && <span style={{ display: 'block', fontSize: '0.72rem', color: '#6b7280', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 150 }}>{c.bank}</span>}
                                  </span>
                                );
                              })()}
                            </td>
                            <td className={styles.td}>{formatDate(order.createdAt)}</td>
                            <td className={styles.td}>
                              <Link
                                to={`/purchases/${pid}?userId=${orderUserId}`}
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
