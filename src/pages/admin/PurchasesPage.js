import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import api from '../../api';
import { useAuth } from '../../context/AuthContext';
import styles from './PurchasesPage.module.css';

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

/**
 * Resolve amount from a BC order object.
 * Checks transient.amount.collected → amount → total in order.
 */
function resolveAmount(order) {
  const collected = order?.transient?.amount?.collected;
  if (collected != null) return collected;
  const amt = order?.amount;
  if (amt != null) return typeof amt === 'object' ? amt.collected ?? null : amt;
  const total = order?.total;
  if (total != null) return total;
  return null;
}

function formatAmount(order) {
  const val = resolveAmount(order);
  if (val == null) return '—';
  return `$${Number(val).toFixed(2)}`;
}

function resolveOrderType(order) {
  // Try top-level type, else dig into first commerce payment
  return order?.type || order?.commercePaymentType || order?.commercePayments?.[0]?.type || '—';
}

function resolveStatus(order) {
  if (order?.transient?.canceled) return 'canceled';
  return (order?.status || '').toLowerCase() || 'unknown';
}

// ─── StatusBadge ─────────────────────────────────────────────────────────────

function StatusBadge({ order }) {
  const s = resolveStatus(order);
  let cls = styles.badgeDefault;
  let label = s.charAt(0).toUpperCase() + s.slice(1);

  if (s === 'active') cls = styles.badgeActive;
  else if (s === 'canceled' || s === 'cancelled') { cls = styles.badgeCanceled; label = 'Canceled'; }
  else if (s === 'failed') { cls = styles.badgeFailed; label = 'Failed'; }
  else if (s === 'pending') { cls = styles.badgePending; label = 'Pending'; }

  return <span className={`${styles.badge} ${cls}`}>{label}</span>;
}

// ─── SkeletonRows ─────────────────────────────────────────────────────────────

function SkeletonRows({ count = 5 }) {
  const widths = ['60%', '40%', '50%', '35%', '55%'];
  return (
    <>
      {Array.from({ length: count }).map((_, i) => (
        <tr key={i} aria-hidden="true">
          {[widths[i % widths.length], '35%', '45%', '30%', '45%', '50px'].map((w, j) => (
            <td key={j} className={styles.skeletonCell}>
              <div className={styles.skeletonLine} style={{ height: 14, width: w }} />
            </td>
          ))}
        </tr>
      ))}
    </>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

const PurchasesPage = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  // eslint-disable-next-line no-unused-vars
  const { token } = useAuth();

  // URL-provided userId (Mode A)
  const urlUserId = searchParams.get('userId');

  // Mode B: search state
  const [searchInput, setSearchInput] = useState('');
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState('');

  // Resolved userId (from URL or search)
  const [resolvedUserId, setResolvedUserId] = useState(urlUserId || null);

  // Orders data
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(false);
  const [fetchError, setFetchError] = useState('');

  // Filters (client-side)
  const [statusFilter, setStatusFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');

  // Keep resolvedUserId in sync if URL param changes
  useEffect(() => {
    setResolvedUserId(urlUserId || null);
  }, [urlUserId]);

  // Fetch orders whenever resolvedUserId changes
  const fetchOrders = useCallback(async (uid) => {
    if (!uid) return;
    setLoading(true);
    setFetchError('');
    setOrders([]);
    try {
      const res = await api.adminListPurchases({ userId: uid });
      // BC may return { docs: [...] }, { orders: [...] }, or a plain array
      const list = res?.docs || res?.orders || res?.data || (Array.isArray(res) ? res : []);
      setOrders(list);
    } catch (err) {
      setFetchError(err.message || 'Failed to load orders.');
    } finally {
      setLoading(false);
    }
  }, []);

  // Default view: 10 most-recent orders across all users. Matches OrdersPage.
  const fetchGlobalRecent = useCallback(async () => {
    setLoading(true);
    setFetchError('');
    try {
      const res = await api.adminListOrdersGlobal({ limit: 10 });
      const list = res?.data || res?.docs || res?.orders || (Array.isArray(res) ? res : []);
      const sorted = [...list].sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
      setOrders(sorted.slice(0, 10));
    } catch (err) {
      // BC may not support global commerceOrder search without filters — keep list empty.
      setOrders([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (resolvedUserId) {
      fetchOrders(resolvedUserId);
    } else if (!urlUserId) {
      // No URL-provided user and no search yet — show recent global orders by default.
      fetchGlobalRecent();
    }
  }, [resolvedUserId, urlUserId, fetchOrders, fetchGlobalRecent]);

  // Mode B: handle search submit
  const handleSearch = async (e) => {
    e.preventDefault();
    const input = searchInput.trim();
    if (!input) return;

    setSearchError('');
    setSearching(true);

    try {
      let uid = input;

      // If it looks like an email, resolve to a userId first
      if (input.includes('@')) {
        const res = await api.adminListUsers({ email: input });
        const userList = res?.docs || res?.users || res?.data || (Array.isArray(res) ? res : []);
        if (!userList.length) {
          setSearchError(`No user found for email: ${input}`);
          setSearching(false);
          return;
        }
        uid = userList[0]._id || userList[0].id;
      }

      setResolvedUserId(uid);
    } catch (err) {
      setSearchError(err.message || 'Search failed.');
    } finally {
      setSearching(false);
    }
  };

  // Client-side filtered orders
  const filteredOrders = useMemo(() => {
    return orders.filter((o) => {
      const status = resolveStatus(o);
      const type = (resolveOrderType(o) || '').toLowerCase();

      if (statusFilter !== 'all') {
        if (statusFilter === 'canceled' && status !== 'canceled' && status !== 'cancelled') return false;
        if (statusFilter !== 'canceled' && status !== statusFilter) return false;
      }
      if (typeFilter !== 'all' && type !== typeFilter) return false;
      return true;
    });
  }, [orders, statusFilter, typeFilter]);

  // ── Subtitle for Mode A
  const subtitle = resolvedUserId
    ? <>Orders for user <code style={{ fontFamily: 'monospace', fontSize: '0.8125rem' }}>{resolvedUserId}</code></>
    : '10 most-recent orders across all users — or search by email / user ID to scope to one customer.';

  const showTable = loading || fetchError || orders.length > 0;
  const showEmpty = !loading && !fetchError && orders.length === 0;
  const showFilteredEmpty = !loading && !fetchError && orders.length > 0 && filteredOrders.length === 0;

  return (
    <main className={styles.page}>
      {/* ── Header */}
      <div className={styles.pageHeader}>
        <div className={styles.titleBlock}>
          <h1 className={styles.title}>Order Management</h1>
          <p className={styles.subtitle}>{subtitle}</p>
          {urlUserId && (
            <Link to={`/users/${urlUserId}`} className={styles.backLink}>
              &larr; Back to user
            </Link>
          )}
        </div>
      </div>

      {/* ── Mode B: search form (hidden when userId is in URL) */}
      {!urlUserId && (
        <form className={styles.searchForm} onSubmit={handleSearch}>
          <input
            type="text"
            className={styles.searchInput}
            placeholder="Search by email or user ID"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            disabled={searching}
            aria-label="Email or user ID"
          />
          <button
            type="submit"
            className={styles.searchBtn}
            disabled={searching || !searchInput.trim()}
          >
            {searching ? 'Searching…' : 'Search'}
          </button>
        </form>
      )}

      {/* ── Search error */}
      {searchError && <div className={styles.errorBanner}>{searchError}</div>}


      {/* ── Fetch error */}
      {fetchError && <div className={styles.errorBanner}>{fetchError}</div>}

      {/* ── Filter bar — shown once orders are loaded */}
      {(showTable || showEmpty) && (
        <div className={styles.filterBar}>
          <span className={styles.filterLabel}>Filter:</span>
          <select
            className={styles.filterSelect}
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            aria-label="Filter by status"
          >
            <option value="all">All Statuses</option>
            <option value="active">Active</option>
            <option value="canceled">Canceled</option>
            <option value="failed">Failed</option>
            <option value="pending">Pending</option>
          </select>
          <select
            className={styles.filterSelect}
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            aria-label="Filter by type"
          >
            <option value="all">All Types</option>
            <option value="sale">Sale</option>
            <option value="validate">Validate</option>
            <option value="refund">Refund</option>
          </select>
        </div>
      )}

      {/* ── Orders table */}
      {showTable && (
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Order ID</th>
                <th className={styles.amountCol}>Amount</th>
                <th>Status</th>
                <th>Type</th>
                <th>Date</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <SkeletonRows count={5} />
              ) : showFilteredEmpty ? (
                <tr>
                  <td colSpan={6}>
                    <div className={styles.emptyState}>
                      <div className={styles.emptyIcon}>&#x26B2;</div>
                      <p className={styles.emptyTitle}>No matching orders</p>
                      <p className={styles.emptyText}>Try adjusting the filters above.</p>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredOrders.map((order) => {
                  const pid = order._id || order.id;
                  const truncId = pid
                    ? pid.length > 12 ? pid.slice(0, 12) + '\u2026' : pid
                    : '—';
                  return (
                    <tr key={pid}>
                      <td>
                        <span className={styles.orderId} title={pid}>{truncId}</span>
                      </td>
                      <td className={styles.amountCell}>{formatAmount(order)}</td>
                      <td><StatusBadge order={order} /></td>
                      <td>{resolveOrderType(order)}</td>
                      <td>{formatDate(order.createdAt)}</td>
                      <td>
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

      {/* ── Empty state: user found but zero orders */}
      {showEmpty && (
        <div className={styles.emptyState}>
          <div className={styles.emptyIcon}>&#x1F4C4;</div>
          <p className={styles.emptyTitle}>No orders found for this user</p>
          <p className={styles.emptyText}>This account has no order history.</p>
        </div>
      )}
    </main>
  );
};

export default PurchasesPage;
