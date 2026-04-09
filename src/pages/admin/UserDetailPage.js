import React, { useEffect, useState, useCallback } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import api from '../../api';
import styles from './UserDetailPage.module.css';

// ─── helpers ────────────────────────────────────────────────────────────────

function getInitials(user) {
  if (!user) return '?';
  if (user.firstName) {
    return `${user.firstName[0]}${user.lastName ? user.lastName[0] : ''}`.toUpperCase();
  }
  if (user.fullName) {
    const parts = user.fullName.trim().split(' ');
    return parts.length > 1
      ? `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase()
      : parts[0][0].toUpperCase();
  }
  return user.email ? user.email[0].toUpperCase() : '?';
}

function getFullName(user) {
  if (!user) return '';
  if (user.firstName) return `${user.firstName} ${user.lastName || ''}`.trim();
  return user.fullName || user.name || user.email || '';
}

function getStatus(user) {
  return user?.status || user?.transient?.status || 'active';
}

function getTier(user) {
  const roles = Array.isArray(user?.roles) ? user.roles : [];
  if (roles.includes('pro') || roles.includes('paid')) return 'Pro';
  return 'Free';
}

function formatDate(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString(undefined, {
    year: 'numeric', month: 'short', day: 'numeric',
  });
}

function formatDateTime(iso) {
  if (!iso) return '';
  return new Date(iso).toLocaleString(undefined, {
    month: 'short', day: 'numeric', year: 'numeric',
    hour: 'numeric', minute: '2-digit',
  });
}

function getAmount(order) {
  const collected = order?.transient?.amount?.collected;
  if (collected != null) return `$${collected.toFixed(2)}`;
  const amount = order?.amount ?? order?.total;
  if (amount != null) return `$${Number(amount).toFixed(2)}`;
  return '—';
}

function getOrderId(order) {
  return order?._id || order?.id || '';
}

function extractPayments(orders) {
  if (!orders || orders.length === 0) return [];
  const payments = [];
  orders.forEach((o) => {
    const oid = getOrderId(o);
    const cpArray = Array.isArray(o?.commercePayments) ? o.commercePayments : [];
    if (cpArray.length === 0) {
      // Fallback: treat the order itself as a single payment record
      const collected = o?.transient?.amount?.collected;
      const amount = collected ?? o?.amount ?? o?.total ?? null;
      let status = 'collected';
      if (o?.transient?.amount?.refunded > 0) status = 'refunded';
      else if (o?.transient?.canceled) status = 'canceled';
      else if (o?.status === 'pending') status = 'pending';
      payments.push({
        _id: oid,
        orderId: oid,
        amount: amount != null ? `$${Number(amount).toFixed(2)}` : '—',
        type: 'sale',
        status,
        date: o?.createdAt || null,
        card: '—',
        ip: '—',
        device: '—',
        gatewayTxId: '—',
      });
    } else {
      cpArray.forEach((p) => {
        const amt = p?.totalPrice?.amount ?? p?.transient?.amount ?? null;
        const card = p?.rawRequest?.ccnumber || '—';
        payments.push({
          _id: p._id || p.id || null,
          orderId: oid,
          amount: amt != null ? `$${Number(amt).toFixed(2)}` : '—',
          type: p?.type || 'sale',
          status: p?.status || '—',
          date: p?.paymentTimestamp ? new Date(p.paymentTimestamp).toISOString() : (p?.createdAt || null),
          card,
          ip: p?.ipAddress || '—',
          device: p?.device || '—',
          gatewayTxId: p?.gatewayTransactionId || '—',
        });
      });
    }
  });
  return payments;
}

function getPaymentCountPerOrder(orders) {
  // Returns { orderId: count } for orders that have commercePayments
  const map = {};
  if (!orders) return map;
  orders.forEach((o) => {
    const oid = getOrderId(o);
    const cpArray = Array.isArray(o?.commercePayments) ? o.commercePayments : [];
    map[oid] = cpArray.length;
  });
  return map;
}

function getPaymentStatusClass(status, stylesObj) {
  switch (status) {
    case 'collected':
    case 'fulfilled':
    case 'success':
      return stylesObj.badgeActive;
    case 'refunded':
    case 'canceled':
    case 'void':
    case 'voided':
    case 'failed':
      return stylesObj.badgeSuspended;
    case 'pending':
      return stylesObj.badgePending;
    default: return stylesObj.badgeFree;
  }
}

function getPaymentTypeBadge(type, stylesObj) {
  switch (type) {
    case 'refund': return stylesObj.badgeSuspended;
    case 'void': return stylesObj.badgeSuspended;
    case 'sale': return stylesObj.badgeActive;
    default: return stylesObj.badgeFree;
  }
}

// Notes are now stored via BC API (admin-create-note / admin-user-contacts)

// ─── Toast ──────────────────────────────────────────────────────────────────

function Toast({ message, type, onDone }) {
  useEffect(() => {
    const t = setTimeout(onDone, 3000);
    return () => clearTimeout(t);
  }, [onDone]);

  const cls =
    type === 'success' ? styles.toastSuccess :
    type === 'error'   ? styles.toastError   :
                         styles.toastInfo;
  return <div className={cls}>{message}</div>;
}

// ─── Main component ──────────────────────────────────────────────────────────

const TABS = ['Orders & Payments', 'Logins', 'Activity', 'Notes', 'Actions'];

const UserDetailPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();

  // Data state
  const [user, setUser]       = useState(null);
  const [orders, setOrders]   = useState([]);
  const [userLoading, setUserLoading]   = useState(true);
  const [ordersLoading, setOrdersLoading] = useState(true);
  const [userError, setUserError]       = useState('');
  const [ordersError, setOrdersError]   = useState('');

  // UI state
  const [activeTab, setActiveTab]       = useState('Orders & Payments');
  const [expandedOrders, setExpandedOrders] = useState({});
  const [suspending, setSuspending]     = useState(false);
  const [copied, setCopied]             = useState(false);
  const [toast, setToast]               = useState(null); // { message, type }

  // Payments pagination state: { [orderId]: { payments: [], loading: false, noMore: false } }
  const [extraPayments, setExtraPayments] = useState({});

  // Refund state: which payment's inline refund form is open
  // { paymentId, orderId, amount, type: 'refund'|'void' }
  const [refundForm, setRefundForm] = useState(null);
  const [refundProcessing, setRefundProcessing] = useState(false);

  // Batch refund confirmation: { orderId, eligiblePayments: [...], totalAmount }
  const [batchRefundConfirm, setBatchRefundConfirm] = useState(null);
  const [batchRefundProcessing, setBatchRefundProcessing] = useState(false);

  // Cancel/reactivate processing
  const [cancelProcessing, setCancelProcessing] = useState(null); // orderId being processed

  // Notes state
  const [notes, setNotes]               = useState([]);
  const [showNoteForm, setShowNoteForm] = useState(false);
  const [noteText, setNoteText]         = useState('');

  // ── Fetch user ────────────────────────────────────────────
  const fetchUser = useCallback(async () => {
    setUserLoading(true);
    setUserError('');
    try {
      const res = await api.adminGetUser(id);
      setUser(res);
    } catch (err) {
      if (err?.isMockUnavailable) {
        setUser(null);
        setUserError('mock_unavailable');
      } else {
        setUserError(err?.message || 'Failed to load user');
      }
    } finally {
      setUserLoading(false);
    }
  }, [id]);

  // ── Fetch orders ─────────────────────────────────────────
  const fetchOrders = useCallback(async () => {
    setOrdersLoading(true);
    setOrdersError('');
    try {
      const res = await api.adminListPurchases({ userId: id });
      const items =
        res?.data ??
        res?.orders ??
        (Array.isArray(res) ? res : []);
      setOrders(items);
    } catch (err) {
      if (err?.isMockUnavailable) {
        setOrders([]);
      } else {
        setOrdersError(err?.message || 'Unable to load transactions');
      }
    } finally {
      setOrdersLoading(false);
    }
  }, [id]);

  // ── Fetch notes (BC user contacts filtered to adminNote type) ──
  const fetchNotes = useCallback(async () => {
    try {
      const res = await api.adminFindUserContacts({ userId: id });
      const docs = res?.docs || res?.data || (Array.isArray(res) ? res : []);
      // Filter to admin notes only, map to simple shape
      const adminNotes = docs
        .filter(d => d.type === 'userContactAdminNote')
        .map(d => ({
          id: d._id || d.id,
          text: d.content?.message || '',
          createdAt: d.createdAt,
          author: d.owner ? `${d.owner.firstName || ''} ${d.owner.lastName || ''}`.trim() : '',
        }));
      setNotes(adminNotes);
    } catch {
      // Silently fail — notes are non-critical
      setNotes([]);
    }
  }, [id]);

  useEffect(() => {
    if (!id) return;
    fetchUser();
    fetchOrders();
    fetchNotes();
  }, [id, fetchUser, fetchOrders, fetchNotes]);

  // ── Suspend / Unsuspend ───────────────────────────────────
  const handleSuspend = async () => {
    const isSuspended = getStatus(user) === 'suspended';
    const action = isSuspended ? 'unsuspend' : 'suspend';
    const confirmMsg = isSuspended
      ? `Unsuspend account for ${getFullName(user)}?`
      : `Suspend account for ${getFullName(user)}? They will lose access immediately.`;

    if (!window.confirm(confirmMsg)) return;

    setSuspending(true);
    try {
      if (isSuspended) {
        await api.post(`admin/users/${id}/unsuspend`, {});
      } else {
        await api.adminSuspendUser(id);
      }
      await fetchUser();
      showToast(isSuspended ? 'Account unsuspended.' : 'Account suspended.', 'success');
    } catch (err) {
      showToast(`Error: ${err?.message || 'Action failed'}`, 'error');
    } finally {
      setSuspending(false);
    }
  };

  // ── Copy user ID ─────────────────────────────────────────
  const handleCopyId = () => {
    navigator.clipboard.writeText(id).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  };

  // ── Toast helper ─────────────────────────────────────────
  const showToast = (message, type = 'info') => {
    setToast({ message, type });
  };

  // ── Notes helpers ─────────────────────────────────────────
  const handleSaveNote = async () => {
    const text = noteText.trim();
    if (!text) return;
    try {
      await api.adminCreateNote({ userId: id, message: text, contentType: 'text/plain' });
      setNoteText('');
      setShowNoteForm(false);
      showToast('Note saved', 'success');
      fetchNotes(); // Reload from BC
    } catch (err) {
      showToast(`Failed to save note: ${err?.message || 'Unknown error'}`, 'error');
    }
  };

  const handleDeleteNote = () => {
    // BC API does not support note deletion — notes are permanent audit records
    showToast('Notes cannot be deleted (permanent audit record)', 'info');
  };

  // ── Load More Payments handler ─────────────────────────────
  const handleLoadMorePayments = async (orderId, lastPaymentId) => {
    setExtraPayments((prev) => ({
      ...prev,
      [orderId]: { ...(prev[orderId] || { payments: [] }), loading: true },
    }));
    try {
      const res = await api.adminFindOrderPayments(orderId, lastPaymentId);
      const newPayments = res?.docs || res?.payments || res?.data || (Array.isArray(res) ? res : []);
      const noMore = res?.noMoreDocs === true || newPayments.length === 0;
      setExtraPayments((prev) => {
        const existing = prev[orderId]?.payments || [];
        return {
          ...prev,
          [orderId]: {
            payments: [...existing, ...newPayments],
            loading: false,
            noMore,
          },
        };
      });
    } catch (err) {
      showToast(`Failed to load more payments: ${err?.message || 'Unknown error'}`, 'error');
      setExtraPayments((prev) => ({
        ...prev,
        [orderId]: { ...(prev[orderId] || { payments: [] }), loading: false },
      }));
    }
  };

  // ── Refund helpers ────────────────────────────────────────

  // Check if a payment is eligible for refund
  const isPaymentRefundable = (payment) => {
    return payment?.type === 'sale' && payment?.status === 'fulfilled';
  };

  // Get eligible payments for an order
  const getEligiblePayments = (order) => {
    const cpArray = Array.isArray(order?.commercePayments) ? order.commercePayments : [];
    return cpArray.filter(isPaymentRefundable);
  };

  // Open inline refund form for a single payment
  const openRefundForm = (orderId, payment) => {
    const amt = payment?.totalPrice?.amount ?? payment?.transient?.amount?.collected ?? 0;
    setRefundForm({
      paymentId: payment._id,
      orderId,
      orderRevisionId: orders.find(o => getOrderId(o) === orderId)?.currentRevisionId,
      paymentRevisionId: payment.currentRevisionId,
      amount: amt > 0 ? Number(amt).toFixed(2) : '',
      maxAmount: amt > 0 ? Number(amt) : 0,
      type: 'refund',
    });
  };

  // Process a single refund
  const handleRefundSubmit = async () => {
    if (!refundForm) return;
    const amount = parseFloat(refundForm.amount);
    if (!amount || amount <= 0) {
      showToast('Enter a valid refund amount.', 'error');
      return;
    }
    if (refundForm.maxAmount > 0 && amount > refundForm.maxAmount) {
      showToast(`Amount cannot exceed $${refundForm.maxAmount.toFixed(2)}`, 'error');
      return;
    }
    setRefundProcessing(true);
    try {
      await api.adminRefundPurchase({
        commercePaymentType: refundForm.type,
        targetCommerceOrderId: refundForm.orderId,
        targetCommerceOrderRevisionId: refundForm.orderRevisionId,
        targetCommercePaymentId: refundForm.paymentId,
        targetCommercePaymentRevisionId: refundForm.paymentRevisionId,
        amount,
      });
      showToast(
        refundForm.type === 'void'
          ? `Void of $${amount.toFixed(2)} processed successfully.`
          : `Refund of $${amount.toFixed(2)} processed successfully.`,
        'success'
      );
      setRefundForm(null);
      fetchOrders(); // Refresh orders to reflect new status
    } catch (err) {
      showToast(`Refund failed: ${err?.message || 'Unknown error'}`, 'error');
    } finally {
      setRefundProcessing(false);
    }
  };

  // Open batch refund confirmation
  const openBatchRefund = (order) => {
    const eligible = getEligiblePayments(order);
    if (eligible.length === 0) {
      showToast('No eligible payments to refund on this order.', 'info');
      return;
    }
    const totalAmount = eligible.reduce((sum, p) => {
      const amt = p?.totalPrice?.amount ?? p?.transient?.amount?.collected ?? 0;
      return sum + Number(amt);
    }, 0);
    setBatchRefundConfirm({
      orderId: getOrderId(order),
      orderRevisionId: order.currentRevisionId,
      eligiblePayments: eligible,
      totalAmount,
    });
  };

  // Process batch refund (all eligible payments)
  const handleBatchRefund = async () => {
    if (!batchRefundConfirm) return;
    setBatchRefundProcessing(true);
    const { orderId, orderRevisionId, eligiblePayments } = batchRefundConfirm;
    let successCount = 0;
    let failCount = 0;
    for (const payment of eligiblePayments) {
      const amt = payment?.totalPrice?.amount ?? payment?.transient?.amount?.collected ?? 0;
      if (Number(amt) <= 0) continue;
      try {
        await api.adminRefundPurchase({
          commercePaymentType: 'refund',
          targetCommerceOrderId: orderId,
          targetCommerceOrderRevisionId: orderRevisionId,
          targetCommercePaymentId: payment._id,
          targetCommercePaymentRevisionId: payment.currentRevisionId,
          amount: Number(amt),
        });
        successCount++;
      } catch {
        failCount++;
      }
    }
    if (failCount === 0) {
      showToast(`All ${successCount} payment(s) refunded successfully.`, 'success');
    } else {
      showToast(`${successCount} refunded, ${failCount} failed. Check order details.`, 'error');
    }
    setBatchRefundConfirm(null);
    setBatchRefundProcessing(false);
    fetchOrders();
  };

  // Cancel or reactivate an order
  const handleCancelOrder = async (orderId, shouldCancel) => {
    const action = shouldCancel ? 'cancel' : 'reactivate';
    if (!window.confirm(`Are you sure you want to ${action} this order?`)) return;
    setCancelProcessing(orderId);
    try {
      await api.adminCancelOrder(orderId, shouldCancel);
      showToast(
        shouldCancel ? 'Order canceled successfully.' : 'Order reactivated successfully.',
        'success'
      );
      fetchOrders();
    } catch (err) {
      showToast(`Failed to ${action} order: ${err?.message || 'Unknown error'}`, 'error');
    } finally {
      setCancelProcessing(null);
    }
  };

  // ── Actions tab handlers ──────────────────────────────────
  const handlePasswordReset = () => {
    showToast('Feature coming soon', 'info');
  };

  const handleSuspendFromActions = async () => {
    await handleSuspend();
  };

  const handleIssueRefund = () => {
    if (orders.length === 0) {
      showToast('No orders found for this user', 'info');
      return;
    }
    const latestOrder = orders[0];
    const oid = getOrderId(latestOrder);
    navigate(`/purchases/${oid}?userId=${id}`);
  };

  const handleViewAllOrders = () => {
    navigate(`/purchases?userId=${id}`);
  };

  // ── Loading / error states ────────────────────────────────
  if (userLoading) {
    return (
      <main className={styles.page}>
        <Link to="/users" className={styles.backLink}>← Back to Users</Link>
        <div className={styles.loadingState}>Loading user…</div>
      </main>
    );
  }

  if (userError && userError !== 'mock_unavailable' && !user) {
    return (
      <main className={styles.page}>
        <div className={styles.fullError}>
          <h2>Unable to load user</h2>
          <p>{userError}</p>
          <Link to="/users" className={styles.fullErrorBack}>← Back to Users</Link>
        </div>
      </main>
    );
  }

  // ── Derived display values ────────────────────────────────
  const name      = getFullName(user);
  const initials  = getInitials(user);
  const status    = getStatus(user);
  const tier      = getTier(user);
  const joinDate  = formatDate(user?.createdAt);
  const isSuspended = status === 'suspended';

  // New enriched fields
  const fullUserId = user?._id || user?.id || id;
  const shortUserId = fullUserId ? `#${fullUserId.slice(-8)}` : '—';
  const allEmails = user?.emails?.length ? user.emails : (user?.email ? [user.email] : []);
  const allPhones = user?.phones?.length ? user.phones : (user?.phone ? [user.phone] : []);
  const deviceType = user?.deviceType || user?.transient?.deviceType || user?.deviceInfo || null;
  const ipAddress = user?.ip || user?.transient?.ip || user?.registrationIp || null;
  const lastActive = user?.lastLogin || user?.transient?.lastLogin || null;

  // ── Render ────────────────────────────────────────────────
  return (
    <main className={styles.page}>
      <Link to="/users" className={styles.backLink}>← Back to Users</Link>
      <h1 className={styles.pageTitle}>Customer Profile</h1>

      <div className={styles.layout}>

        {/* ── Left: Profile Card ─────────────────────────── */}
        <aside className={styles.profileCard}>
          <div className={styles.avatar}>{initials}</div>
          <h2 className={styles.profileName}>{name || '—'}</h2>
          <p className={styles.profileEmail}>{user?.email || '—'}</p>

          <div className={styles.badgeRow}>
            <span className={isSuspended ? styles.badgeSuspended : styles.badgeActive}>
              {isSuspended ? 'Suspended' : 'Active'}
            </span>
            <span className={tier === 'Pro' ? styles.badgePro : styles.badgeFree}>
              {tier}
            </span>
          </div>

          <div className={styles.metaTable}>
            <div className={styles.metaRow}>
              <span className={styles.metaLabel}>User ID</span>
              <span className={styles.metaValue}>
                <span className={styles.shortId}>{shortUserId}</span>
                <button
                  className={styles.copyBtn}
                  title="Copy full ID"
                  onClick={handleCopyId}
                >
                  {copied ? 'Copied!' : 'Copy'}
                </button>
              </span>
            </div>
            <div className={styles.metaRow}>
              <span className={styles.metaLabel}>Joined</span>
              <span className={styles.metaValue}>{joinDate}</span>
            </div>
            <div className={styles.metaRow}>
              <span className={styles.metaLabel}>Last Active</span>
              <span className={styles.metaValue}>{lastActive ? formatDateTime(lastActive) : '—'}</span>
            </div>
            <div className={styles.metaRow}>
              <span className={styles.metaLabel}>Device</span>
              <span className={styles.metaValue}>{deviceType || '—'}</span>
            </div>
            <div className={styles.metaRow}>
              <span className={styles.metaLabel}>IP Address</span>
              <span className={`${styles.metaValue} ${styles.mono}`}>{ipAddress || '—'}</span>
            </div>
          </div>

          {/* All Emails */}
          <div className={styles.detailSection}>
            <span className={styles.detailSectionLabel}>Emails</span>
            {allEmails.length > 0 ? (
              <ul className={styles.detailList}>
                {allEmails.map((email, i) => (
                  <li key={i} className={styles.detailListItem}>{email}</li>
                ))}
              </ul>
            ) : (
              <span className={styles.detailEmpty}>—</span>
            )}
          </div>

          {/* All Phones */}
          <div className={styles.detailSection}>
            <span className={styles.detailSectionLabel}>Phones</span>
            {allPhones.length > 0 ? (
              <ul className={styles.detailList}>
                {allPhones.map((phone, i) => (
                  <li key={i} className={styles.detailListItem}>{phone}</li>
                ))}
              </ul>
            ) : (
              <span className={styles.detailEmpty}>—</span>
            )}
          </div>

          <button
            className={`${styles.suspendBtn} ${isSuspended ? styles.unsuspend : styles.suspend}`}
            onClick={handleSuspend}
            disabled={suspending}
          >
            {suspending
              ? (isSuspended ? 'Unsuspending…' : 'Suspending…')
              : (isSuspended ? 'Unsuspend Account' : 'Suspend Account')}
          </button>
        </aside>

        {/* ── Right: Tabs Panel ──────────────────────────── */}
        <div className={styles.rightPanel}>
          <div className={styles.tabBar}>
            {TABS.map((tab) => (
              <button
                key={tab}
                className={`${styles.tabBtn} ${activeTab === tab ? styles.active : ''}`}
                onClick={() => setActiveTab(tab)}
              >
                {tab}
              </button>
            ))}
          </div>

          <div className={styles.tabContent}>

            {/* ── Tab: Orders & Payments ──────────────────── */}
            {activeTab === 'Orders & Payments' && (
              <>
                {ordersLoading && (
                  <div className={styles.loadingState}>Loading orders…</div>
                )}
                {!ordersLoading && ordersError && (
                  <div className={styles.errorState}>{ordersError}</div>
                )}
                {!ordersLoading && !ordersError && orders.length === 0 && (
                  <div className={styles.emptyState}>No orders found for this user.</div>
                )}
                {!ordersLoading && !ordersError && orders.length > 0 && orders.map((o) => {
                  const oid = getOrderId(o);
                  const oStatus = o.status || '—';
                  const canceled = o.transient?.canceled;
                  const isExpanded = expandedOrders[oid];
                  const cpArray = Array.isArray(o?.commercePayments) ? o.commercePayments : [];
                  const extraData = extraPayments[oid];
                  const extraPmts = extraData?.payments || [];
                  const allPmts = [...cpArray, ...extraPmts];
                  const schedule = o.schedule;
                  const eligible = getEligiblePayments(o);
                  const hasEligible = eligible.length > 0;

                  return (
                    <div key={oid} className={styles.orderCard}>
                      {/* Order summary row */}
                      <div
                        className={styles.orderSummary}
                        onClick={() => setExpandedOrders(prev => ({ ...prev, [oid]: !prev[oid] }))}
                        style={{ cursor: 'pointer' }}
                      >
                        <span className={styles.orderExpandIcon}>{isExpanded ? '▾' : '▸'}</span>
                        <div className={styles.orderSummaryMain}>
                          <span className={styles.orderIdShort}>Order ...{oid.slice(-8)}</span>
                          <span className={styles.orderAmount}>{getAmount(o)}</span>
                          <span className={
                            oStatus === 'active' ? styles.badgeActive
                            : canceled ? styles.badgeSuspended
                            : styles.badgeFree
                          }>
                            {oStatus}{canceled ? ' (canceled)' : ''}
                          </span>
                          <span className={styles.orderDate}>{formatDate(o.createdAt)}</span>
                          {schedule && (
                            <span className={styles.orderSchedule}>
                              Next: {schedule.dueTimestamp ? formatDate(new Date(schedule.dueTimestamp).toISOString()) : '—'}
                            </span>
                          )}
                        </div>
                        <div className={styles.orderSummaryActions}>
                          {hasEligible && (
                            <button
                              className={styles.refundAllBtn}
                              onClick={(e) => { e.stopPropagation(); openBatchRefund(o); }}
                              disabled={batchRefundProcessing}
                              title="Refund all eligible payments"
                            >
                              Refund All
                            </button>
                          )}
                          <Link
                            to={`/purchases/${oid}?userId=${id}`}
                            className={styles.orderDetailLink}
                            onClick={(e) => e.stopPropagation()}
                          >
                            Full Detail →
                          </Link>
                        </div>
                      </div>

                      {/* Expanded: payment rows */}
                      {isExpanded && (
                        <div className={styles.orderPayments}>
                          {allPmts.length === 0 && (
                            <div className={styles.emptyState} style={{ padding: '1rem', fontSize: '0.85rem' }}>
                              No payment records for this order.
                            </div>
                          )}
                          {allPmts.length > 0 && (
                            <table className={styles.table}>
                              <thead>
                                <tr>
                                  <th className={styles.th}>Date</th>
                                  <th className={styles.th}>Amount</th>
                                  <th className={styles.th}>Type</th>
                                  <th className={styles.th}>Status</th>
                                  <th className={styles.th}>Card</th>
                                  <th className={styles.th}>Device</th>
                                  <th className={styles.th}>Actions</th>
                                </tr>
                              </thead>
                              <tbody>
                                {allPmts.map((p, idx) => {
                                  const pAmt = p?.totalPrice?.amount ?? p?.transient?.amount?.collected ?? null;
                                  const pDate = p?.paymentTimestamp
                                    ? new Date(p.paymentTimestamp).toISOString()
                                    : (p?.createdAt || null);
                                  const pCard = p?.rawRequest?.ccnumber || '—';
                                  const canRefund = isPaymentRefundable(p);
                                  const isRefundFormOpen = refundForm?.paymentId === p._id && refundForm?.orderId === oid;
                                  return (
                                    <React.Fragment key={p._id || idx}>
                                      <tr className={styles.tr}>
                                        <td className={styles.td}>{formatDateTime(pDate)}</td>
                                        <td className={styles.td}>{pAmt != null ? `$${Number(pAmt).toFixed(2)}` : '—'}</td>
                                        <td className={styles.td}>
                                          <span className={getPaymentTypeBadge(p?.type || 'sale', styles)}>
                                            {p?.type || 'sale'}
                                          </span>
                                        </td>
                                        <td className={styles.td}>
                                          <span className={getPaymentStatusClass(p?.status || '—', styles)}>
                                            {p?.status || '—'}
                                          </span>
                                        </td>
                                        <td className={`${styles.td} ${styles.mono}`}>{pCard}</td>
                                        <td className={styles.td}>{p?.device || '—'}</td>
                                        <td className={styles.td}>
                                          {canRefund && !isRefundFormOpen && (
                                            <button
                                              className={styles.refundBtn}
                                              onClick={() => openRefundForm(oid, p)}
                                              disabled={refundProcessing}
                                            >
                                              Refund
                                            </button>
                                          )}
                                          {isRefundFormOpen && (
                                            <span className={styles.badgePending}>editing...</span>
                                          )}
                                        </td>
                                      </tr>
                                      {/* Inline refund form row */}
                                      {isRefundFormOpen && (
                                        <tr className={styles.refundFormRow}>
                                          <td colSpan="7" className={styles.refundFormCell}>
                                            <div className={styles.refundInlineForm}>
                                              <div className={styles.refundFormField}>
                                                <label className={styles.refundLabel}>Amount ($)</label>
                                                <input
                                                  type="number"
                                                  className={styles.refundInput}
                                                  value={refundForm.amount}
                                                  onChange={(e) => setRefundForm(prev => ({ ...prev, amount: e.target.value }))}
                                                  min="0.01"
                                                  max={refundForm.maxAmount || undefined}
                                                  step="0.01"
                                                  disabled={refundProcessing}
                                                />
                                              </div>
                                              <div className={styles.refundFormField}>
                                                <label className={styles.refundLabel}>Type</label>
                                                <select
                                                  className={styles.refundSelect}
                                                  value={refundForm.type}
                                                  onChange={(e) => setRefundForm(prev => ({ ...prev, type: e.target.value }))}
                                                  disabled={refundProcessing}
                                                >
                                                  <option value="refund">Refund (partial)</option>
                                                  <option value="void">Void (full reversal)</option>
                                                </select>
                                              </div>
                                              <div className={styles.refundFormActions}>
                                                <button
                                                  className={styles.refundConfirmBtn}
                                                  onClick={handleRefundSubmit}
                                                  disabled={refundProcessing}
                                                >
                                                  {refundProcessing ? 'Processing...' : 'Confirm'}
                                                </button>
                                                <button
                                                  className={styles.refundCancelBtn}
                                                  onClick={() => setRefundForm(null)}
                                                  disabled={refundProcessing}
                                                >
                                                  Cancel
                                                </button>
                                              </div>
                                            </div>
                                          </td>
                                        </tr>
                                      )}
                                    </React.Fragment>
                                  );
                                })}
                              </tbody>
                            </table>
                          )}
                          {/* Load more payments for this order */}
                          {cpArray.length > 0 && !(extraData?.noMore) && (() => {
                            const lastPmt = allPmts[allPmts.length - 1];
                            const lastPmtId = lastPmt?._id || lastPmt?.id;
                            if (!lastPmtId) return null;
                            return (
                              <button
                                className={styles.addNoteBtn}
                                style={{ marginTop: '8px' }}
                                disabled={extraData?.loading}
                                onClick={() => handleLoadMorePayments(oid, lastPmtId)}
                              >
                                {extraData?.loading ? 'Loading…' : 'Load More Payments'}
                              </button>
                            );
                          })()}
                          {/* Cancel / Reactivate order button */}
                          <div className={styles.orderFooterActions}>
                            {canceled ? (
                              <button
                                className={styles.reactivateBtn}
                                onClick={() => handleCancelOrder(oid, false)}
                                disabled={cancelProcessing === oid}
                              >
                                {cancelProcessing === oid ? 'Reactivating...' : 'Reactivate Order'}
                              </button>
                            ) : (
                              <button
                                className={styles.cancelOrderBtn}
                                onClick={() => handleCancelOrder(oid, true)}
                                disabled={cancelProcessing === oid}
                              >
                                {cancelProcessing === oid ? 'Canceling...' : 'Cancel Order'}
                              </button>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </>
            )}

            {/* ── Tab: Logins ──────────────────────────────── */}
            {activeTab === 'Logins' && (() => {
              const loginHistory =
                user?.loginHistory ||
                user?.sessions ||
                user?.transient?.loginHistory ||
                user?.transient?.sessions ||
                null;
              const logins = Array.isArray(loginHistory) ? loginHistory : [];
              return (
                <>
                  {logins.length === 0 && (
                    <div className={styles.emptyState}>
                      <div className={styles.emptyIcon}>--</div>
                      <p>Login history not available from the API</p>
                      <p className={styles.emptyHint}>
                        This data may become available when session tracking is enabled in the backend.
                      </p>
                    </div>
                  )}
                  {logins.length > 0 && (
                    <div className={styles.tableWrapper}>
                      <table className={styles.table}>
                        <thead>
                          <tr>
                            <th className={styles.th}>Date / Time</th>
                            <th className={styles.th}>IP Address</th>
                            <th className={styles.th}>Device / Browser</th>
                            <th className={styles.th}>Status</th>
                          </tr>
                        </thead>
                        <tbody>
                          {logins.map((entry, idx) => {
                            const ts = entry?.date || entry?.timestamp || entry?.createdAt || entry?.loginAt;
                            const ip = entry?.ip || entry?.ipAddress || entry?.remoteAddress || '—';
                            const device = entry?.device || entry?.browser || entry?.userAgent || entry?.deviceInfo || '—';
                            const loginStatus = entry?.status || entry?.result || 'success';
                            return (
                              <tr key={idx} className={styles.tr}>
                                <td className={styles.td}>{formatDateTime(ts)}</td>
                                <td className={`${styles.td} ${styles.mono}`}>{ip}</td>
                                <td className={styles.td}>{device}</td>
                                <td className={styles.td}>
                                  <span className={loginStatus === 'failed' ? styles.badgeSuspended : styles.badgeActive}>
                                    {loginStatus}
                                  </span>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </>
              );
            })()}

            {/* ── Tab: Activity ─────────────────────────────── */}
            {activeTab === 'Activity' && (() => {
              const activityData =
                user?.activity ||
                user?.transient?.activity ||
                user?.searchHistory ||
                user?.transient?.searchHistory ||
                null;
              const activities = Array.isArray(activityData) ? activityData : [];
              return (
                <>
                  {activities.length === 0 && (
                    <div className={styles.emptyState}>
                      <div className={styles.emptyIcon}>--</div>
                      <p>Activity data not available from the API</p>
                      <p className={styles.emptyHint}>
                        User activity tracking (searches, report views, downloads) will appear here when available.
                      </p>
                    </div>
                  )}
                  {activities.length > 0 && (
                    <div className={styles.tableWrapper}>
                      <table className={styles.table}>
                        <thead>
                          <tr>
                            <th className={styles.th}>Date / Time</th>
                            <th className={styles.th}>Action</th>
                            <th className={styles.th}>Details</th>
                          </tr>
                        </thead>
                        <tbody>
                          {activities.map((act, idx) => {
                            const ts = act?.date || act?.timestamp || act?.createdAt;
                            const action = act?.type || act?.action || act?.eventType || '—';
                            const details = act?.details || act?.description || act?.query || act?.meta || '—';
                            return (
                              <tr key={idx} className={styles.tr}>
                                <td className={styles.td}>{formatDateTime(ts)}</td>
                                <td className={styles.td}>
                                  <span className={styles.activityAction}>{action}</span>
                                </td>
                                <td className={styles.td}>
                                  <span className={styles.activityDetails}>
                                    {typeof details === 'object' ? JSON.stringify(details) : details}
                                  </span>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </>
              );
            })()}

            {/* ── Tab: Notes ─────────────────────────────── */}
            {activeTab === 'Notes' && (
              <>
                <div className={styles.notesHeader}>
                  <h3 className={styles.notesTitle}>Notes</h3>
                  {!showNoteForm && (
                    <button
                      className={styles.addNoteBtn}
                      onClick={() => setShowNoteForm(true)}
                    >
                      + Add Note
                    </button>
                  )}
                </div>

                {showNoteForm && (
                  <div className={styles.noteForm}>
                    <textarea
                      className={styles.noteTextarea}
                      placeholder="Enter note…"
                      value={noteText}
                      onChange={(e) => setNoteText(e.target.value)}
                      autoFocus
                    />
                    <div className={styles.noteFormActions}>
                      <button
                        className={styles.cancelNoteBtn}
                        onClick={() => { setShowNoteForm(false); setNoteText(''); }}
                      >
                        Cancel
                      </button>
                      <button
                        className={styles.saveNoteBtn}
                        onClick={handleSaveNote}
                        disabled={!noteText.trim()}
                      >
                        Save
                      </button>
                    </div>
                  </div>
                )}

                {notes.length === 0 && !showNoteForm && (
                  <div className={styles.emptyState}>No notes yet.</div>
                )}

                {notes.length > 0 && (
                  <div className={styles.notesList}>
                    {notes.map((n) => (
                      <div key={n.id} className={styles.noteItem}>
                        {n.text.startsWith('<')
                          ? <p className={styles.noteBody} dangerouslySetInnerHTML={{ __html: n.text }} />
                          : <p className={styles.noteBody}>{n.text}</p>
                        }
                        <div className={styles.noteMeta}>
                          <span className={styles.noteTimestamp}>
                            {formatDateTime(n.createdAt)}
                            {n.author && ` — ${n.author}`}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}

            {/* ── Tab: Actions ───────────────────────────── */}
            {activeTab === 'Actions' && (
              <>
                <h3 className={styles.actionsTitle}>Recommended Actions</h3>
                <div className={styles.actionsList}>
                  <button
                    className={styles.actionBtnGray}
                    onClick={handlePasswordReset}
                  >
                    <span>✉</span>
                    Send Password Reset Email
                  </button>

                  <button
                    className={styles.actionBtnRed}
                    onClick={handleSuspendFromActions}
                    disabled={suspending}
                  >
                    <span>{isSuspended ? '✓' : '⊘'}</span>
                    {isSuspended ? 'Unsuspend Account' : 'Suspend Account'}
                  </button>

                  <button
                    className={styles.actionBtnOrange}
                    onClick={handleIssueRefund}
                    disabled={ordersLoading}
                  >
                    <span>↩</span>
                    Issue Refund (Most Recent Order)
                  </button>

                  <button
                    className={styles.actionBtnGreen}
                    onClick={handleViewAllOrders}
                  >
                    <span>☰</span>
                    View All Orders
                  </button>
                </div>
              </>
            )}

          </div>
        </div>
      </div>

      {/* Batch Refund Confirmation Dialog */}
      {batchRefundConfirm && (
        <div className={styles.modalOverlay}>
          <div className={styles.modalBox}>
            <h3 className={styles.modalTitle}>Confirm Refund All</h3>
            <p className={styles.modalText}>
              This will refund <strong>{batchRefundConfirm.eligiblePayments.length}</strong> eligible
              payment{batchRefundConfirm.eligiblePayments.length > 1 ? 's' : ''} for a total of{' '}
              <strong>${batchRefundConfirm.totalAmount.toFixed(2)}</strong>.
            </p>
            <ul className={styles.modalList}>
              {batchRefundConfirm.eligiblePayments.map((p, i) => {
                const amt = p?.totalPrice?.amount ?? p?.transient?.amount?.collected ?? 0;
                return (
                  <li key={p._id || i} className={styles.modalListItem}>
                    Payment ...{(p._id || '').slice(-8)} — ${Number(amt).toFixed(2)}
                  </li>
                );
              })}
            </ul>
            <div className={styles.modalActions}>
              <button
                className={styles.refundConfirmBtn}
                onClick={handleBatchRefund}
                disabled={batchRefundProcessing}
              >
                {batchRefundProcessing ? 'Processing...' : 'Confirm Refund All'}
              </button>
              <button
                className={styles.refundCancelBtn}
                onClick={() => setBatchRefundConfirm(null)}
                disabled={batchRefundProcessing}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toast */}
      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onDone={() => setToast(null)}
        />
      )}
    </main>
  );
};

export default UserDetailPage;
