import React, { useEffect, useState, useCallback } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import api from '../../api';
import styles from './UserDetailPage.module.css';
import RefundEmailModal from './RefundEmailModal';

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

const TABS = ['Orders & Payments', 'Logins', 'Activity', 'Notes & Messages', 'Audit', 'Actions'];

// Map prefix → display action type. Notes we write on CSR actions are prefixed
// with one of these so the audit tab can pluck them out of the general notes
// stream and group them with appropriate iconography.
const AUDIT_PREFIXES = [
  { prefix: 'CSR EDIT:',                  label: 'Profile edit',       color: '#1e40af', bg: '#dbeafe', icon: '✎' },
  { prefix: 'CSR OPT-OUT (email):',       label: 'Email opt-out',      color: '#7c2d12', bg: '#fef3c7', icon: '✉' },
  { prefix: 'CSR OPT-OUT (phone):',       label: 'SMS opt-out',        color: '#7c2d12', bg: '#fef3c7', icon: '📱' },
  { prefix: 'CSR DATA-REMOVAL REQUEST:',  label: 'Data removal',       color: '#991b1b', bg: '#fee2e2', icon: '🗑' },
  { prefix: 'AGENT ORDER:',               label: 'Agent order',        color: '#166534', bg: '#dcfce7', icon: '+' },
  { prefix: 'CSR REFUND',                 label: 'Refund',             color: '#9a3412', bg: '#ffedd5', icon: '↩' },
  { prefix: 'CSR CANCEL:',                label: 'Order canceled',     color: '#991b1b', bg: '#fee2e2', icon: '⊘' },
  { prefix: 'CSR REACTIVATE:',            label: 'Order reactivated',  color: '#166534', bg: '#dcfce7', icon: '↺' },
  { prefix: 'CSR ',                       label: 'CSR action',         color: '#374151', bg: '#f3f4f6', icon: '·' },
];

function classifyAuditNote(text) {
  const body = (text || '').trim();
  for (const def of AUDIT_PREFIXES) {
    if (body.startsWith(def.prefix)) {
      return {
        kind: def.label,
        color: def.color,
        bg: def.bg,
        icon: def.icon,
        details: body.slice(def.prefix.length).trim() || '(no details)',
      };
    }
  }
  return null;
}

const TRACKING_ACTIVITY_TYPES = [
  'USER:nameSearchTeaser',
  'USER:phoneSearchTeaser',
  'USER:nameSearch',
  'USER:phoneSearch',
  'USER:nameSearchTeaserOptOut',
  'USER:phoneSearchTeaserOptOut',
].join('|');

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

  // Refund email modal
  const [showRefundEmail, setShowRefundEmail] = useState(false);

  // Batch refund confirmation: { orderId, eligiblePayments: [...], totalAmount }
  const [batchRefundConfirm, setBatchRefundConfirm] = useState(null);
  const [batchRefundProcessing, setBatchRefundProcessing] = useState(false);

  // Cancel/reactivate processing
  const [cancelProcessing, setCancelProcessing] = useState(null); // orderId being processed

  // Notes state
  const [notes, setNotes]               = useState([]);
  const [showNoteForm, setShowNoteForm] = useState(false);
  const [noteText, setNoteText]         = useState('');

  // User-linked contact tickets (contactMessages with targetUserId === id)
  const [userTickets, setUserTickets] = useState([]);
  const [userTicketsLoading, setUserTicketsLoading] = useState(false);

  // Notes & Messages filter — 'all' | 'internal' | 'csrMail' | 'userReply'
  // Audit-prefixed notes are hidden from internal/all by default since the
  // Audit tab is their canonical home.
  const [notesFilter, setNotesFilter] = useState('all');
  const [showAuditInNotes, setShowAuditInNotes] = useState(false);

  // Tracking: Logins tab
  const [logins, setLogins]             = useState([]);
  const [loginsLoading, setLoginsLoading] = useState(false);
  const [loginsError, setLoginsError]   = useState('');
  const [loginsLastId, setLoginsLastId] = useState(null);
  const [loginsNoMore, setLoginsNoMore] = useState(false);
  const [loginsFetched, setLoginsFetched] = useState(false);

  // Tracking: Activity tab
  const [activities, setActivities]     = useState([]);
  const [activityLoading, setActivityLoading] = useState(false);
  const [activityError, setActivityError] = useState('');
  const [activityLastId, setActivityLastId] = useState(null);
  const [activityNoMore, setActivityNoMore] = useState(false);
  const [activityFetched, setActivityFetched] = useState(false);

  // ── Agent Order modal ──────────────────────────────────────
  const [showAgentOrder, setShowAgentOrder] = useState(false);
  const [agentOrderOffer, setAgentOrderOffer] = useState('comp.offer.agent.retention');
  const [agentOrderReason, setAgentOrderReason] = useState('');
  const [agentOrderProcessing, setAgentOrderProcessing] = useState(false);
  const [agentOrderError, setAgentOrderError] = useState('');
  const [offerCatalog, setOfferCatalog] = useState(null); // null = not loaded yet
  const [offerCatalogLoading, setOfferCatalogLoading] = useState(false);

  // ── Activity sub-tab ───────────────────────────────────────
  // 'all' | 'searches' | 'reports' | 'optout'
  const [activitySubTab, setActivitySubTab] = useState('all');

  // ── Edit user modal ────────────────────────────────────────
  const [showEditUser, setShowEditUser] = useState(false);
  const [editFirstName, setEditFirstName] = useState('');
  const [editLastName, setEditLastName]   = useState('');
  const [editEmail, setEditEmail]         = useState('');
  const [editPhone, setEditPhone]         = useState('');
  const [editSaving, setEditSaving]       = useState(false);
  const [editError, setEditError]         = useState('');

  // ── Opt-out actions ────────────────────────────────────────
  const [optOutBusy, setOptOutBusy] = useState(null); // 'email' | 'phone' | 'data' | null
  const [showDataRemoval, setShowDataRemoval] = useState(false);
  const [dataRemovalReason, setDataRemovalReason] = useState('');

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

  // ── Fetch contact tickets assigned to this user ─────────────
  const fetchUserTickets = useCallback(async () => {
    setUserTicketsLoading(true);
    try {
      const res = await api.adminFindUserContactMessages({ userId: id });
      const docs = res?.data || res?.docs || (Array.isArray(res) ? res : []);
      setUserTickets(docs);
    } catch {
      setUserTickets([]);
    } finally {
      setUserTicketsLoading(false);
    }
  }, [id]);

  // ── Fetch notes & messages (all user contacts: notes, CSR mail, user replies) ──
  const fetchNotes = useCallback(async () => {
    try {
      const res = await api.adminFindUserContacts({ userId: id });
      const docs = res?.docs || res?.data || (Array.isArray(res) ? res : []);
      const mapped = docs.map(d => {
        const t = d.type || '';
        let kind = 'note';
        let direction = 'internal';
        if (t === 'userContactCsrMail') { kind = 'csrMail'; direction = 'outbound'; }
        else if (t === 'userContact') { kind = 'userReply'; direction = 'inbound'; }
        return {
          id: d._id || d.id,
          kind,
          direction,
          type: t,
          subject: d.content?.subject || '',
          text: d.content?.message || '',
          contentType: d.content?.contentType || 'text/plain',
          createdAt: d.createdAt,
          author: d.owner ? `${d.owner.firstName || ''} ${d.owner.lastName || ''}`.trim() : '',
          attachments: d.attachments || [],
        };
      });
      // Sort newest first
      mapped.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
      setNotes(mapped);
    } catch {
      setNotes([]);
    }
  }, [id]);

  // ── Fetch login tracking ──────────────────────────────────
  const fetchLogins = useCallback(async (lastId) => {
    setLoginsLoading(true);
    setLoginsError('');
    try {
      const res = await api.adminFindUserTracking('USER:login', lastId || undefined, id);
      const docs = res?.docs || [];
      // Filter to this user by updaterId (server-side filter may not be supported, so also filter client-side)
      const userLogins = docs.filter(d => d.updaterId === id);
      if (lastId) {
        setLogins(prev => [...prev, ...userLogins]);
      } else {
        setLogins(userLogins);
      }
      const last = docs[docs.length - 1];
      setLoginsLastId(last?._id || null);
      setLoginsNoMore(res?.noMoreDocs === true || docs.length === 0);
    } catch (err) {
      setLoginsError(err?.message || 'Failed to load login history');
    } finally {
      setLoginsLoading(false);
      setLoginsFetched(true);
    }
  }, [id]);

  // ── Fetch activity tracking ─────────────────────────────
  const fetchActivity = useCallback(async (lastId) => {
    setActivityLoading(true);
    setActivityError('');
    try {
      const res = await api.adminFindUserTracking(TRACKING_ACTIVITY_TYPES, lastId || undefined, id);
      const docs = res?.docs || [];
      // Filter to this user by updaterId (server-side filter may not be supported, so also filter client-side)
      const userActivity = docs.filter(d => d.updaterId === id);
      if (lastId) {
        setActivities(prev => [...prev, ...userActivity]);
      } else {
        setActivities(userActivity);
      }
      const last = docs[docs.length - 1];
      setActivityLastId(last?._id || null);
      setActivityNoMore(res?.noMoreDocs === true || docs.length === 0);
    } catch (err) {
      setActivityError(err?.message || 'Failed to load activity');
    } finally {
      setActivityLoading(false);
      setActivityFetched(true);
    }
  }, [id]);

  useEffect(() => {
    if (!id) return;
    fetchUser();
    fetchOrders();
    fetchNotes();
    fetchUserTickets();
  }, [id, fetchUser, fetchOrders, fetchNotes, fetchUserTickets]);

  // Fetch tracking data on tab activation (lazy load)
  useEffect(() => {
    if (activeTab === 'Logins' && !loginsFetched && id) {
      fetchLogins();
    }
    if (activeTab === 'Activity' && !activityFetched && id) {
      fetchActivity();
    }
  }, [activeTab, loginsFetched, activityFetched, id, fetchLogins, fetchActivity]);

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
      // Refresh order so we send the latest revisionIds. Falls back to the
      // form's stored revision IDs if the refetch fails.
      let orderRevisionId = refundForm.orderRevisionId;
      let paymentRevisionId = refundForm.paymentRevisionId;
      try {
        const fresh = await api.adminGetOrderDetail(id, refundForm.orderId);
        if (fresh?.currentRevisionId) orderRevisionId = fresh.currentRevisionId;
        const freshPayment = (fresh?.commercePayments || []).find((p) => p._id === refundForm.paymentId);
        if (freshPayment?.currentRevisionId) paymentRevisionId = freshPayment.currentRevisionId;
      } catch {}

      await api.adminRefundPurchase({
        commercePaymentType: refundForm.type,
        targetCommerceOrderId: refundForm.orderId,
        targetCommerceOrderRevisionId: orderRevisionId,
        targetCommercePaymentId: refundForm.paymentId,
        targetCommercePaymentRevisionId: paymentRevisionId,
        amount,
      });
      // Audit note so the Audit tab picks it up.
      try {
        await api.adminCreateNote({
          userId: id,
          message: `CSR REFUND: ${refundForm.type === 'void' ? 'Void' : 'Refund'} $${amount.toFixed(2)} on order ${(refundForm.orderId || '').slice(-8)} payment ${(refundForm.paymentId || '').slice(-8)}`,
          contentType: 'text/plain',
        });
      } catch {}
      showToast(
        refundForm.type === 'void'
          ? `Void of $${amount.toFixed(2)} processed successfully.`
          : `Refund of $${amount.toFixed(2)} processed successfully.`,
        'success'
      );
      setRefundForm(null);
      fetchOrders(); // Refresh orders to reflect new status
      fetchNotes();  // Refresh notes so Audit tab reflects this immediately
    } catch (err) {
      showToast(`Refund failed: ${err?.message || 'Unknown error'}`, 'error');
    } finally {
      setRefundProcessing(false);
    }
  };

  // Open batch refund confirmation (single order)
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
      multiOrder: false,
    });
  };

  // Open multi-order refund confirmation (all orders)
  const openMultiOrderRefund = () => {
    const allEligible = [];
    for (const order of orders) {
      const oid = getOrderId(order);
      const eligible = getEligiblePayments(order);
      eligible.forEach(p => {
        allEligible.push({
          ...p,
          _orderId: oid,
          _orderRevisionId: order.currentRevisionId,
        });
      });
    }
    if (allEligible.length === 0) {
      showToast('No eligible payments to refund across any orders.', 'info');
      return;
    }
    const totalAmount = allEligible.reduce((sum, p) => {
      const amt = p?.totalPrice?.amount ?? p?.transient?.amount?.collected ?? 0;
      return sum + Number(amt);
    }, 0);
    setBatchRefundConfirm({
      eligiblePayments: allEligible,
      totalAmount,
      multiOrder: true,
    });
  };

  // Process batch refund (single-order or multi-order)
  // Re-fetches each affected order before refunding so we use the
  // current revisionIds — in-memory orders may be stale, and BC rejects
  // refund calls with mismatched revision IDs.
  const handleBatchRefund = async () => {
    if (!batchRefundConfirm) return;
    setBatchRefundProcessing(true);
    const { orderId, eligiblePayments, multiOrder } = batchRefundConfirm;

    // Build a unique set of order IDs we need to refresh.
    const orderIds = multiOrder
      ? Array.from(new Set(eligiblePayments.map((p) => p._orderId).filter(Boolean)))
      : [orderId];

    // Refetch each order — capture fresh order revision + per-payment revisions.
    const freshByOrderId = {};
    for (const oid of orderIds) {
      try {
        const fresh = await api.adminGetOrderDetail(id, oid);
        freshByOrderId[oid] = fresh;
      } catch {
        freshByOrderId[oid] = null;
      }
    }

    let successCount = 0;
    let failCount = 0;
    for (const payment of eligiblePayments) {
      const amt = payment?.totalPrice?.amount ?? payment?.transient?.amount?.collected ?? 0;
      if (Number(amt) <= 0) continue;
      const pOrderId = multiOrder ? payment._orderId : orderId;
      const fresh = freshByOrderId[pOrderId];
      // Prefer fresh revision IDs; fall back to in-memory copies if refetch failed.
      const freshOrderRev = fresh?.currentRevisionId
        || (multiOrder ? payment._orderRevisionId : orders.find((o) => getOrderId(o) === pOrderId)?.currentRevisionId);
      const freshPayment = (fresh?.commercePayments || []).find((p) => p._id === payment._id);
      const freshPaymentRev = freshPayment?.currentRevisionId || payment.currentRevisionId;
      try {
        await api.adminRefundPurchase({
          commercePaymentType: 'refund',
          targetCommerceOrderId: pOrderId,
          targetCommerceOrderRevisionId: freshOrderRev,
          targetCommercePaymentId: payment._id,
          targetCommercePaymentRevisionId: freshPaymentRev,
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
    // Audit note summarizing the batch (single line so it shows cleanly in the timeline).
    if (successCount > 0) {
      try {
        const total = eligiblePayments
          .filter((p) => Number(p?.totalPrice?.amount ?? p?.transient?.amount?.collected ?? 0) > 0)
          .slice(0, successCount)
          .reduce((sum, p) => sum + Number(p?.totalPrice?.amount ?? p?.transient?.amount?.collected ?? 0), 0);
        await api.adminCreateNote({
          userId: id,
          message: `CSR REFUND: Batch refund — ${successCount} payment(s)${failCount ? ` (${failCount} failed)` : ''} totaling $${total.toFixed(2)}${multiOrder ? ` across ${orderIds.length} orders` : ` on order ${(orderId || '').slice(-8)}`}`,
          contentType: 'text/plain',
        });
      } catch {}
    }
    setBatchRefundConfirm(null);
    setBatchRefundProcessing(false);
    fetchOrders();
    fetchNotes();
  };

  // Cancel or reactivate an order
  const handleCancelOrder = async (orderId, shouldCancel) => {
    const action = shouldCancel ? 'cancel' : 'reactivate';
    if (!window.confirm(`Are you sure you want to ${action} this order?`)) return;
    setCancelProcessing(orderId);
    try {
      await api.adminCancelOrder(orderId, shouldCancel);
      // Audit note so the Audit tab reflects cancel/reactivate actions.
      try {
        await api.adminCreateNote({
          userId: id,
          message: `CSR ${shouldCancel ? 'CANCEL' : 'REACTIVATE'}: Order ${(orderId || '').slice(-8)}`,
          contentType: 'text/plain',
        });
      } catch {}
      showToast(
        shouldCancel ? 'Order canceled successfully.' : 'Order reactivated successfully.',
        'success'
      );
      fetchOrders();
      fetchNotes();
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

  // Three offer keys CS uses — pull real names + prices from BC.
  // Fallback copy is shown if the lookup fails so the modal is never empty.
  const AGENT_OFFER_KEYS = [
    { key: 'comp.offer.signup.main',      desc: 'Standard signup',     fallbackName: 'Standard Plan',     fallbackPrice: '$29.99/mo' },
    { key: 'comp.offer.agent.retention',  desc: '50% off downsell',     fallbackName: 'Retention Offer',   fallbackPrice: '$14.99/mo' },
    { key: 'comp.offer.agent.comp',       desc: 'Complimentary',        fallbackName: 'Comp / Free',       fallbackPrice: '$0' },
  ];

  const formatOfferPrice = (offer) => {
    const s0 = offer?.transient?.priceInfo?.s0;
    const s1 = offer?.transient?.priceInfo?.s1;
    if (s0?.amount === 0) return 'Free';
    if (s0?.amount && s1?.amount) {
      return `$${Number(s0.amount).toFixed(2)} → $${Number(s1.amount).toFixed(2)}/mo`;
    }
    if (s0?.amount) return `$${Number(s0.amount).toFixed(2)}`;
    if (s1?.amount) return `$${Number(s1.amount).toFixed(2)}/mo`;
    return null;
  };

  const fetchOfferCatalog = useCallback(async () => {
    setOfferCatalogLoading(true);
    try {
      const fetched = await Promise.all(
        AGENT_OFFER_KEYS.map(async (entry) => {
          try {
            const offer = await api.adminFindOffer({ shmName: entry.key });
            return {
              key: entry.key,
              name: offer?.extName || offer?.name || entry.fallbackName,
              price: formatOfferPrice(offer) || entry.fallbackPrice,
              desc: entry.desc,
              live: Boolean(offer?._id),
            };
          } catch {
            return { key: entry.key, name: entry.fallbackName, price: entry.fallbackPrice, desc: entry.desc, live: false };
          }
        })
      );
      setOfferCatalog(fetched);
    } finally {
      setOfferCatalogLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Lazy-load the catalog the first time the modal opens.
  useEffect(() => {
    if (showAgentOrder && offerCatalog == null && !offerCatalogLoading) {
      fetchOfferCatalog();
    }
  }, [showAgentOrder, offerCatalog, offerCatalogLoading, fetchOfferCatalog]);

  // ── Edit user ──────────────────────────────────────────────
  const openEditUser = () => {
    setEditFirstName(user?.firstName || '');
    setEditLastName(user?.lastName || '');
    setEditEmail(user?.email || '');
    setEditPhone(user?.phone || '');
    setEditError('');
    setShowEditUser(true);
  };

  const handleSaveUserEdit = async (e) => {
    e?.preventDefault?.();
    setEditError('');
    const payload = {};
    if ((editFirstName || '') !== (user?.firstName || '')) payload.firstName = editFirstName.trim();
    if ((editLastName  || '') !== (user?.lastName  || '')) payload.lastName  = editLastName.trim();
    if ((editEmail     || '') !== (user?.email     || '')) payload.email     = editEmail.trim();
    if ((editPhone     || '') !== (user?.phone     || '')) payload.phone     = editPhone.trim();
    if (Object.keys(payload).length === 0) {
      setShowEditUser(false);
      return;
    }
    setEditSaving(true);
    try {
      await api.adminUpdateUser(id, payload);
      // Best-effort audit note so the change is traceable in the user's history.
      try {
        const summary = Object.entries(payload).map(([k, v]) => `${k}: "${user?.[k] || ''}" → "${v}"`).join('; ');
        await api.adminCreateNote({
          userId: id,
          message: `CSR EDIT: ${summary}`,
          contentType: 'text/plain',
        });
      } catch {}
      showToast('User profile updated', 'success');
      setShowEditUser(false);
      await fetchUser();
    } catch (err) {
      setEditError(err?.message || 'Failed to update user.');
    } finally {
      setEditSaving(false);
    }
  };

  // ── Opt-out actions ────────────────────────────────────────
  // Looks up the user's managedContact for the given type+address, then
  // unsubscribes it. Returns a short status string for the toast.
  const optOutManagedContact = async (type, address) => {
    if (!address) return `No ${type} on file — nothing to opt out.`;
    const res = await api.adminFindManagedContact({
      type,
      contactAddress: address,
      brandId: 'idlookup',
    });
    const docs = res?.data ?? res?.docs ?? [];
    const active = docs.find((d) => d.subStatus !== 'unsubscribed') || docs[0];
    if (!active) return `No ${type} subscription on file — nothing to opt out.`;
    if (active.subStatus === 'unsubscribed') return `Already unsubscribed from ${type}.`;
    await api.adminUnsubscribeManagedContact(active._id || active.id);
    return `Unsubscribed ${type} (${address}).`;
  };

  const handleOptOutEmail = async () => {
    if (!user?.email) { showToast('User has no email on file.', 'info'); return; }
    if (!window.confirm(`Unsubscribe ${user.email} from marketing email?`)) return;
    setOptOutBusy('email');
    try {
      const msg = await optOutManagedContact('email', user.email);
      try {
        await api.adminCreateNote({
          userId: id,
          message: `CSR OPT-OUT (email): ${user.email}`,
          contentType: 'text/plain',
        });
      } catch {}
      showToast(msg, 'success');
    } catch (err) {
      showToast(err?.message || 'Email opt-out failed.', 'error');
    } finally {
      setOptOutBusy(null);
    }
  };

  const handleOptOutPhone = async () => {
    if (!user?.phone) { showToast('User has no phone on file.', 'info'); return; }
    if (!window.confirm(`Unsubscribe ${user.phone} from SMS marketing?`)) return;
    setOptOutBusy('phone');
    try {
      const msg = await optOutManagedContact('phone', user.phone);
      try {
        await api.adminCreateNote({
          userId: id,
          message: `CSR OPT-OUT (phone): ${user.phone}`,
          contentType: 'text/plain',
        });
      } catch {}
      showToast(msg, 'success');
    } catch (err) {
      showToast(err?.message || 'Phone opt-out failed.', 'error');
    } finally {
      setOptOutBusy(null);
    }
  };

  // BC has no CSR-side endpoint to file an optOutRequest on behalf of a user.
  // The fallback is a CSR mail to ops + an internal note so the request is
  // tracked and actionable. Real removal happens off-platform via the partner.
  const handleRequestDataRemoval = async (e) => {
    e?.preventDefault?.();
    if (!dataRemovalReason.trim()) return;
    setOptOutBusy('data');
    try {
      const reason = dataRemovalReason.trim();
      // Audit note on the user record
      try {
        await api.adminCreateNote({
          userId: id,
          message: `CSR DATA-REMOVAL REQUEST: ${reason}`,
          contentType: 'text/plain',
        });
      } catch {}
      // Email summary to ops/finance via the same channel as RefundEmailModal.
      try {
        await api.adminCreateCsrMail({
          targetUserId: id,
          subject: `Data removal request — ${user?.email || id}`,
          message: `<p><strong>User:</strong> ${user?.firstName || ''} ${user?.lastName || ''} (${user?.email || ''})</p><p><strong>User ID:</strong> ${id}</p><p><strong>Reason:</strong> ${reason}</p><p>Please process per data-removal SOP.</p>`,
          contentType: 'text/html',
        });
      } catch {}
      showToast('Data-removal request filed.', 'success');
      setDataRemovalReason('');
      setShowDataRemoval(false);
    } catch (err) {
      showToast(err?.message || 'Failed to file removal request.', 'error');
    } finally {
      setOptOutBusy(null);
    }
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
  const shortUserId = fullUserId && fullUserId.length > 8
    ? `${fullUserId.slice(0, 4)}...${fullUserId.slice(-4)}`
    : (fullUserId || '—');
  const allEmails = user?.emails?.length ? user.emails : (user?.email ? [user.email] : []);
  const allPhones = user?.phones?.length ? user.phones : (user?.phone ? [user.phone] : []);
  const lastActive = user?.lastLogin || user?.transient?.lastLogin || null;

  // Extract device & IP from most recent order's commercePayments
  const latestPaymentInfo = (() => {
    if (!orders || orders.length === 0) return { device: null, ip: null };
    for (const order of orders) {
      const cpArray = Array.isArray(order?.commercePayments) ? order.commercePayments : [];
      if (cpArray.length > 0) {
        // Find the most recent payment with device/IP info
        const sorted = [...cpArray].sort((a, b) =>
          (b.paymentTimestamp || b.createdAt || '').localeCompare(a.paymentTimestamp || a.createdAt || '')
        );
        for (const p of sorted) {
          if (p.device || p.ipAddress) {
            return { device: p.device || null, ip: p.ipAddress || null };
          }
        }
      }
    }
    return { device: null, ip: null };
  })();

  // Fallback chain: order payment data > user object fields
  const deviceType = latestPaymentInfo.device || user?.deviceType || user?.transient?.deviceType || user?.deviceInfo || null;
  const ipAddress = latestPaymentInfo.ip || user?.ip || user?.transient?.ip || user?.registrationIp || null;

  // Account age
  const accountAge = (() => {
    if (!user?.createdAt) return null;
    const created = new Date(user.createdAt);
    const now = new Date();
    const diffMs = now - created;
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    if (diffDays < 1) return 'Less than a day';
    if (diffDays === 1) return '1 day';
    if (diffDays < 30) return `${diffDays} days`;
    const diffMonths = Math.floor(diffDays / 30);
    if (diffMonths < 12) return `${diffMonths} month${diffMonths === 1 ? '' : 's'}`;
    const diffYears = Math.floor(diffMonths / 12);
    const remainMonths = diffMonths % 12;
    if (remainMonths === 0) return `${diffYears} year${diffYears === 1 ? '' : 's'}`;
    return `${diffYears} year${diffYears === 1 ? '' : 's'}, ${remainMonths} month${remainMonths === 1 ? '' : 's'}`;
  })();

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
            {accountAge && (
              <div className={styles.metaRow}>
                <span className={styles.metaLabel}>Member for</span>
                <span className={styles.metaValue}>{accountAge}</span>
              </div>
            )}
            <div className={styles.metaRow}>
              <span className={styles.metaLabel}>Last Active</span>
              <span className={styles.metaValue}>{lastActive ? formatDateTime(lastActive) : '—'}</span>
            </div>
            <div className={styles.metaRow}>
              <span className={styles.metaLabel}>Last Known Device</span>
              <span className={styles.metaValue}>{deviceType || '—'}</span>
            </div>
            <div className={styles.metaRow}>
              <span className={styles.metaLabel}>Last Known IP</span>
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
                {/* Multi-order refund button */}
                {!ordersLoading && !ordersError && orders.length > 1 && (() => {
                  const totalEligible = orders.reduce((sum, o) => sum + getEligiblePayments(o).length, 0);
                  return totalEligible > 0 ? (
                    <div className={styles.multiRefundBar}>
                      <span className={styles.multiRefundLabel}>
                        {orders.length} orders — {totalEligible} refundable payment{totalEligible !== 1 ? 's' : ''}
                      </span>
                      <button
                        className={styles.refundAllBtn}
                        onClick={openMultiOrderRefund}
                        disabled={batchRefundProcessing}
                      >
                        Refund All Orders
                      </button>
                    </div>
                  ) : null;
                })()}
                {ordersLoading && (
                  <div className={styles.loadingState}>Loading orders…</div>
                )}
                {!ordersLoading && ordersError && (
                  <div className={styles.errorState}>{ordersError}</div>
                )}
                {!ordersLoading && !ordersError && orders.length === 0 && (
                  <div className={styles.emptyState}>
                    <p style={{ margin: 0 }}>No orders retrieved.</p>
                    <p style={{ margin: '0.5rem 0 0', fontSize: '0.82rem', color: '#6b7280' }}>
                      If you expect this user to have orders: BC's CSR order endpoints
                      (<code>/commerceMgnt/userOrders</code>) are returning 404 on this
                      deployment, and <code>/database/search</code> on the commerceOrder
                      collection returns 0 docs to admin sessions. Check the browser
                      console for <code>[csrFindUserOrders]</code> probe output and
                      escalate to BC if every probe is empty.
                    </p>
                  </div>
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
            {activeTab === 'Logins' && (
              <>
                {loginsLoading && logins.length === 0 && (
                  <div className={styles.loadingState}>Loading login history...</div>
                )}
                {loginsError && (
                  <div className={styles.errorState}>{loginsError}</div>
                )}
                {!loginsLoading && !loginsError && logins.length === 0 && loginsFetched && (
                  <div className={styles.emptyState}>
                    <div className={styles.emptyIcon}>--</div>
                    <p>No login events found for this user.</p>
                  </div>
                )}
                {logins.length > 0 && (
                  <div className={styles.tableWrapper}>
                    <table className={styles.table}>
                      <thead>
                        <tr>
                          <th className={styles.th}>Date / Time</th>
                          <th className={styles.th}>IP Address</th>
                          <th className={styles.th}>Device</th>
                          <th className={styles.th}>User Agent</th>
                          <th className={styles.th}>Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {logins.map((doc, idx) => {
                          const ts = doc?.createdAt;
                          const val = doc?.data?.value || {};
                          const ip = val.ip || '—';
                          const device = val.device || '—';
                          const ua = val.userAgent || '—';
                          const st = doc?.data?.status || '—';
                          return (
                            <tr key={doc._id || idx} className={styles.tr}>
                              <td className={styles.td}>{formatDateTime(ts)}</td>
                              <td className={`${styles.td} ${styles.mono}`}>{ip}</td>
                              <td className={styles.td}>{device}</td>
                              <td className={styles.td} title={ua} style={{ maxWidth: '220px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                {ua.length > 60 ? ua.substring(0, 60) + '...' : ua}
                              </td>
                              <td className={styles.td}>
                                <span className={st === 'fulfilled' ? styles.badgeActive : styles.badgeSuspended}>
                                  {st === 'fulfilled' ? 'success' : st}
                                </span>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
                {!loginsNoMore && loginsFetched && (
                  <button
                    className={styles.addNoteBtn}
                    style={{ marginTop: '12px' }}
                    disabled={loginsLoading}
                    onClick={() => fetchLogins(loginsLastId)}
                  >
                    {loginsLoading ? 'Loading...' : 'Load More'}
                  </button>
                )}
              </>
            )}

            {/* ── Tab: Activity ─────────────────────────────── */}
            {activeTab === 'Activity' && (() => {
              const TYPE_LABELS = {
                'USER:nameSearchTeaser': 'Name Search',
                'USER:phoneSearchTeaser': 'Phone Search',
                'USER:nameSearch': 'Report (Name)',
                'USER:phoneSearch': 'Report (Phone)',
                'USER:nameSearchTeaserOptOut': 'Opt-Out Name Search',
                'USER:phoneSearchTeaserOptOut': 'Opt-Out Phone Search',
              };

              const SEARCH_TYPES = new Set(['USER:nameSearchTeaser', 'USER:phoneSearchTeaser']);
              const REPORT_TYPES = new Set(['USER:nameSearch', 'USER:phoneSearch']);
              const OPTOUT_TYPES = new Set(['USER:nameSearchTeaserOptOut', 'USER:phoneSearchTeaserOptOut']);

              const filterFor = (rawType) => {
                if (activitySubTab === 'searches') return SEARCH_TYPES.has(rawType);
                if (activitySubTab === 'reports')  return REPORT_TYPES.has(rawType);
                if (activitySubTab === 'optout')   return OPTOUT_TYPES.has(rawType);
                return true;
              };

              const filtered = activities.filter((d) => filterFor(d?.data?.type));
              const counts = {
                all: activities.length,
                searches: activities.filter((d) => SEARCH_TYPES.has(d?.data?.type)).length,
                reports:  activities.filter((d) => REPORT_TYPES.has(d?.data?.type)).length,
                optout:   activities.filter((d) => OPTOUT_TYPES.has(d?.data?.type)).length,
              };

              const formatTeaserInput = (input) => {
                if (!input) return '—';
                const parts = [];
                if (input.fName) parts.push(input.fName);
                if (input.lName) parts.push(input.lName);
                if (input.phone) parts.push(input.phone);
                if (input.state) parts.push(input.state.toUpperCase());
                if (input.city) parts.push(input.city);
                return parts.length > 0 ? parts.join(', ') : '—';
              };

              const SubTabBtn = ({ value, label }) => (
                <button
                  type="button"
                  onClick={() => setActivitySubTab(value)}
                  style={{
                    padding: '0.4rem 0.75rem',
                    fontSize: '0.82rem',
                    fontWeight: 600,
                    borderRadius: 6,
                    border: '1px solid',
                    borderColor: activitySubTab === value ? '#0d5d2f' : '#d1d5db',
                    background: activitySubTab === value ? '#dcfce7' : '#fff',
                    color: activitySubTab === value ? '#0d5d2f' : '#374151',
                    cursor: 'pointer',
                    marginRight: '0.4rem',
                  }}
                >
                  {label} <span style={{ marginLeft: 4, opacity: 0.7 }}>({counts[value]})</span>
                </button>
              );

              return (
                <>
                  {activities.length > 0 && (
                    <div style={{ marginBottom: '0.875rem', display: 'flex', flexWrap: 'wrap', gap: '0.25rem' }}>
                      <SubTabBtn value="all"      label="All" />
                      <SubTabBtn value="searches" label="Searches" />
                      <SubTabBtn value="reports"  label="Reports" />
                      <SubTabBtn value="optout"   label="Opt-out searches" />
                    </div>
                  )}

                  {activityLoading && activities.length === 0 && (
                    <div className={styles.loadingState}>Loading activity...</div>
                  )}
                  {activityError && (
                    <div className={styles.errorState}>{activityError}</div>
                  )}
                  {!activityLoading && !activityError && activities.length === 0 && activityFetched && (
                    <div className={styles.emptyState}>
                      <div className={styles.emptyIcon}>--</div>
                      <p>No activity events found for this user.</p>
                    </div>
                  )}
                  {!activityLoading && activities.length > 0 && filtered.length === 0 && (
                    <div className={styles.emptyState}>
                      <p>No {activitySubTab === 'all' ? 'activity' : activitySubTab} events for this user.</p>
                    </div>
                  )}
                  {filtered.length > 0 && (
                    <div className={styles.tableWrapper}>
                      <table className={styles.table}>
                        <thead>
                          <tr>
                            <th className={styles.th}>Date / Time</th>
                            <th className={styles.th}>Action Type</th>
                            <th className={styles.th}>Details</th>
                            <th className={styles.th}>Status</th>
                          </tr>
                        </thead>
                        <tbody>
                          {filtered.map((doc, idx) => {
                            const ts = doc?.createdAt;
                            const rawType = doc?.data?.type || '—';
                            const label = TYPE_LABELS[rawType] || rawType;
                            const input = doc?.data?.teaserInput;
                            const details = formatTeaserInput(input);
                            const st = doc?.data?.status || '—';
                            return (
                              <tr key={doc._id || idx} className={styles.tr}>
                                <td className={styles.td}>{formatDateTime(ts)}</td>
                                <td className={styles.td}>
                                  <span className={styles.activityAction}>{label}</span>
                                </td>
                                <td className={styles.td}>
                                  <span className={styles.activityDetails}>{details}</span>
                                </td>
                                <td className={styles.td}>
                                  <span className={st === 'fulfilled' ? styles.badgeActive : styles.badgeSuspended}>
                                    {st === 'fulfilled' ? 'success' : st}
                                  </span>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                  {!activityNoMore && activityFetched && (
                    <button
                      className={styles.addNoteBtn}
                      style={{ marginTop: '12px' }}
                      disabled={activityLoading}
                      onClick={() => fetchActivity(activityLastId)}
                    >
                      {activityLoading ? 'Loading...' : 'Load More'}
                    </button>
                  )}
                </>
              );
            })()}

            {/* ── Tab: Notes & Messages ──────────────────── */}
            {activeTab === 'Notes & Messages' && (
              <>
                {/* User's contact tickets (contactMessages with targetUserId set).
                    Distinct from the userContact-collection list below — these are
                    the new-shape contact submissions assigned to this user. */}
                <div style={{ marginBottom: '1.25rem' }}>
                  <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                    <h3 className={styles.notesTitle} style={{ margin: 0 }}>
                      Contact tickets
                      {userTickets.length > 0 && (
                        <span style={{ marginLeft: '0.5rem', fontSize: '0.78rem', color: '#6b7280', fontWeight: 500 }}>
                          {userTickets.length} assigned
                        </span>
                      )}
                    </h3>
                    <Link to="/tickets" style={{ fontSize: '0.82rem', color: '#0d5d2f', fontWeight: 600 }}>
                      Open inbox →
                    </Link>
                  </div>

                  {userTicketsLoading && userTickets.length === 0 && (
                    <div className={styles.loadingState}>Loading tickets…</div>
                  )}

                  {!userTicketsLoading && userTickets.length === 0 && (
                    <p style={{ fontSize: '0.85rem', color: '#9ca3af', margin: '0.25rem 0 0' }}>
                      No contact tickets are currently assigned to this user.
                    </p>
                  )}

                  {userTickets.length > 0 && (
                    <ul style={{ listStyle: 'none', padding: 0, margin: 0, border: '1px solid #e5e7eb', borderRadius: 6, overflow: 'hidden' }}>
                      {userTickets.map((t, idx) => {
                        const tid = t._id || t.id;
                        const subject = t?.content?.input?.topic
                          || (t?.content?.category === 'billing' ? 'Billing inquiry'
                          : t?.content?.category === 'general' ? 'General inquiry'
                          : t?.content?.subject || '(No subject)');
                        const senderEmail = t?.content?.input?.email || t?.content?.email || '';
                        const lastReplyAt = t?.latestReply?.createdAt;
                        const lastEvent = lastReplyAt || t?.updatedAt || t?.createdAt;
                        const replied = Boolean(t?.latestReply);
                        return (
                          <li key={tid || idx} style={{
                            display: 'flex', alignItems: 'center', gap: '0.625rem',
                            padding: '0.625rem 0.875rem',
                            borderBottom: idx < userTickets.length - 1 ? '1px solid #e5e7eb' : 'none',
                            background: '#fff',
                          }}>
                            <span style={{
                              fontSize: '0.65rem', fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase',
                              padding: '0.15rem 0.45rem', borderRadius: 12,
                              background: replied ? '#dcfce7' : '#fef3c7',
                              color: replied ? '#166534' : '#92400e',
                              whiteSpace: 'nowrap',
                            }}>{replied ? 'Replied' : 'Awaiting'}</span>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ fontWeight: 600, fontSize: '0.9rem', color: '#111827', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                {subject}
                              </div>
                              <div style={{ fontSize: '0.78rem', color: '#6b7280', marginTop: '0.1rem' }}>
                                {senderEmail && <>{senderEmail} · </>}
                                {formatDateTime(lastEvent)}
                              </div>
                            </div>
                            <Link
                              to={`/tickets?contactMessageId=${encodeURIComponent(tid || '')}`}
                              style={{
                                fontSize: '0.82rem', color: '#1a56db', fontWeight: 600, textDecoration: 'none',
                                padding: '0.25rem 0.5rem',
                              }}
                            >
                              View →
                            </Link>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </div>

                <div className={styles.notesHeader}>
                  <h3 className={styles.notesTitle}>Notes & Messages</h3>
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
                      placeholder="Enter internal note…"
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

                {(() => {
                  const filteredNotes = notes.filter((n) => {
                    // Hide audit-prefixed notes from this tab unless the toggle is on.
                    const isAudit = n.kind === 'note' && Boolean(classifyAuditNote(n.text));
                    if (isAudit && !showAuditInNotes) return false;
                    if (notesFilter === 'all') return true;
                    if (notesFilter === 'internal') return n.kind === 'note';
                    if (notesFilter === 'csrMail') return n.kind === 'csrMail';
                    if (notesFilter === 'userReply') return n.kind === 'userReply';
                    return true;
                  });
                  const counts = {
                    all:       notes.filter((n) => showAuditInNotes || n.kind !== 'note' || !classifyAuditNote(n.text)).length,
                    internal:  notes.filter((n) => n.kind === 'note' && (showAuditInNotes || !classifyAuditNote(n.text))).length,
                    csrMail:   notes.filter((n) => n.kind === 'csrMail').length,
                    userReply: notes.filter((n) => n.kind === 'userReply').length,
                  };
                  const auditHiddenCount = notes.filter((n) => n.kind === 'note' && classifyAuditNote(n.text)).length;
                  const Pill = ({ value, label }) => (
                    <button
                      type="button"
                      onClick={() => setNotesFilter(value)}
                      style={{
                        padding: '0.35rem 0.7rem',
                        fontSize: '0.8rem', fontWeight: 600,
                        borderRadius: 6,
                        border: '1px solid',
                        borderColor: notesFilter === value ? '#0d5d2f' : '#d1d5db',
                        background: notesFilter === value ? '#dcfce7' : '#fff',
                        color: notesFilter === value ? '#0d5d2f' : '#374151',
                        cursor: 'pointer', marginRight: '0.35rem',
                      }}
                    >
                      {label} <span style={{ marginLeft: 4, opacity: 0.7 }}>({counts[value]})</span>
                    </button>
                  );

                  return (
                    <>
                      {notes.length > 0 && (
                        <div style={{
                          display: 'flex', alignItems: 'center', flexWrap: 'wrap',
                          gap: '0.25rem', margin: '0.75rem 0 0.875rem',
                        }}>
                          <Pill value="all"       label="All" />
                          <Pill value="internal"  label="Internal notes" />
                          <Pill value="csrMail"   label="CSR mail" />
                          <Pill value="userReply" label="User replies" />
                          {auditHiddenCount > 0 && (
                            <label style={{
                              fontSize: '0.78rem', color: '#6b7280',
                              display: 'inline-flex', alignItems: 'center', gap: '0.3rem',
                              marginLeft: 'auto',
                            }}>
                              <input
                                type="checkbox"
                                checked={showAuditInNotes}
                                onChange={(e) => setShowAuditInNotes(e.target.checked)}
                              />
                              Show audit entries ({auditHiddenCount})
                            </label>
                          )}
                        </div>
                      )}

                      {notes.length === 0 && !showNoteForm && (
                        <div className={styles.emptyState}>No notes or messages yet.</div>
                      )}

                      {notes.length > 0 && filteredNotes.length === 0 && (
                        <div className={styles.emptyState}>
                          <p>No items match this filter.</p>
                        </div>
                      )}

                      {filteredNotes.length > 0 && (
                        <div className={styles.notesList}>
                          {filteredNotes.map((n) => (
                      <div
                        key={n.id}
                        className={styles.noteItem}
                        style={{
                          borderLeft: `3px solid ${
                            n.kind === 'csrMail' ? '#0d5d2f' :
                            n.kind === 'userReply' ? '#3b82f6' :
                            '#d1d5db'
                          }`,
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.375rem' }}>
                          <span style={{
                            fontSize: '0.7rem',
                            fontWeight: 700,
                            textTransform: 'uppercase',
                            letterSpacing: '0.04em',
                            padding: '0.15rem 0.5rem',
                            borderRadius: '9999px',
                            background: n.kind === 'csrMail' ? '#dcfce7' :
                                        n.kind === 'userReply' ? '#dbeafe' :
                                        '#f3f4f6',
                            color: n.kind === 'csrMail' ? '#166534' :
                                   n.kind === 'userReply' ? '#1e40af' :
                                   '#6b7280',
                          }}>
                            {n.kind === 'csrMail' ? 'CS → User' :
                             n.kind === 'userReply' ? 'User → CS' :
                             'Internal Note'}
                          </span>
                          {n.subject && (
                            <span style={{ fontSize: '0.8125rem', fontWeight: 600, color: '#374151' }}>
                              {n.subject}
                            </span>
                          )}
                        </div>
                        {n.contentType === 'text/html' && n.text.includes('<')
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
                  );
                })()}
              </>
            )}

            {/* ── Tab: Audit ─────────────────────────────── */}
            {activeTab === 'Audit' && (() => {
              const auditEvents = (notes || [])
                .map((n) => {
                  const classified = classifyAuditNote(n.text);
                  if (!classified) return null;
                  return {
                    id: n.id,
                    createdAt: n.createdAt,
                    author: n.author || 'CSR',
                    ...classified,
                  };
                })
                .filter(Boolean)
                .sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));

              return (
                <>
                  <div style={{ marginBottom: '0.5rem' }}>
                    <h3 className={styles.notesTitle} style={{ margin: 0 }}>Audit Log</h3>
                    <p style={{ margin: '0.2rem 0 0', fontSize: '0.85rem', color: '#6b7280' }}>
                      Every CSR-recorded action taken on this account. Internal notes that aren't actions stay in <strong>Notes &amp; Messages</strong>.
                    </p>
                  </div>

                  {auditEvents.length === 0 ? (
                    <div className={styles.emptyState}>
                      <p>No CSR actions recorded yet for this user.</p>
                    </div>
                  ) : (
                    <ul style={{ listStyle: 'none', padding: 0, margin: '0.5rem 0 0' }}>
                      {auditEvents.map((evt, idx) => (
                        <li key={evt.id || idx} style={{
                          display: 'flex', alignItems: 'flex-start', gap: '0.75rem',
                          padding: '0.75rem 0',
                          borderTop: idx === 0 ? '1px solid #e5e7eb' : 'none',
                          borderBottom: '1px solid #e5e7eb',
                        }}>
                          <span style={{
                            width: 32, height: 32, flexShrink: 0,
                            borderRadius: 8,
                            background: evt.bg, color: evt.color,
                            fontWeight: 700, fontSize: '1rem',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                          }}>
                            {evt.icon}
                          </span>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                              <span style={{
                                fontSize: '0.7rem', fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase',
                                padding: '0.15rem 0.5rem', borderRadius: 12,
                                background: evt.bg, color: evt.color,
                              }}>{evt.kind}</span>
                              <span style={{ fontSize: '0.78rem', color: '#6b7280' }}>
                                {formatDateTime(evt.createdAt)}
                                {evt.author && ` · ${evt.author}`}
                              </span>
                            </div>
                            <div style={{
                              marginTop: '0.3rem', fontSize: '0.88rem', color: '#111827',
                              whiteSpace: 'pre-wrap', wordBreak: 'break-word',
                            }}>
                              {evt.details}
                            </div>
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                </>
              );
            })()}

            {/* ── Tab: Actions ───────────────────────────── */}
            {activeTab === 'Actions' && (
              <>
                <h3 className={styles.actionsTitle}>Recommended Actions</h3>
                <div className={styles.actionsList}>
                  <button
                    className={styles.actionBtnGreen}
                    onClick={openEditUser}
                  >
                    <span>✎</span>
                    Edit User Profile
                  </button>

                  <button
                    className={styles.actionBtnGray}
                    onClick={handleOptOutEmail}
                    disabled={optOutBusy === 'email'}
                    title={user?.email ? `Unsubscribe ${user.email}` : 'No email on file'}
                  >
                    <span>✉</span>
                    {optOutBusy === 'email' ? 'Opting out…' : 'Opt out of Email'}
                  </button>

                  <button
                    className={styles.actionBtnGray}
                    onClick={handleOptOutPhone}
                    disabled={optOutBusy === 'phone'}
                    title={user?.phone ? `Unsubscribe ${user.phone}` : 'No phone on file'}
                  >
                    <span>📱</span>
                    {optOutBusy === 'phone' ? 'Opting out…' : 'Opt out of SMS'}
                  </button>

                  <button
                    className={styles.actionBtnRed}
                    onClick={() => { setDataRemovalReason(''); setShowDataRemoval(true); }}
                  >
                    <span>🗑</span>
                    Request Data Removal
                  </button>

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
                    onClick={() => setShowRefundEmail(true)}
                  >
                    <span>✉</span>
                    Request Billing Action
                  </button>

                  <button
                    className={styles.actionBtnGreen}
                    onClick={handleViewAllOrders}
                  >
                    <span>☰</span>
                    View All Orders
                  </button>

                  <button
                    className={styles.actionBtnGreen}
                    onClick={() => {
                      setAgentOrderOffer('comp.offer.agent.retention');
                      setAgentOrderReason('');
                      setAgentOrderError('');
                      setShowAgentOrder(true);
                    }}
                  >
                    <span>+</span>
                    Create Order (Agent)
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
            <h3 className={styles.modalTitle}>
              {batchRefundConfirm.multiOrder ? 'Confirm Multi-Order Refund' : 'Confirm Refund All'}
            </h3>
            <p className={styles.modalText}>
              This will refund <strong>{batchRefundConfirm.eligiblePayments.length}</strong> eligible
              payment{batchRefundConfirm.eligiblePayments.length > 1 ? 's' : ''}
              {batchRefundConfirm.multiOrder && (() => {
                const orderIds = new Set(batchRefundConfirm.eligiblePayments.map(p => p._orderId));
                return <> across <strong>{orderIds.size}</strong> order{orderIds.size > 1 ? 's' : ''}</>;
              })()}
              {' '}for a total of{' '}
              <strong>${batchRefundConfirm.totalAmount.toFixed(2)}</strong>.
            </p>
            <ul className={styles.modalList}>
              {batchRefundConfirm.eligiblePayments.map((p, i) => {
                const amt = p?.totalPrice?.amount ?? p?.transient?.amount?.collected ?? 0;
                const orderLabel = batchRefundConfirm.multiOrder
                  ? `Order ...${(p._orderId || '').slice(-6)} → `
                  : '';
                return (
                  <li key={p._id || i} className={styles.modalListItem}>
                    {orderLabel}Payment ...{(p._id || '').slice(-8)} — ${Number(amt).toFixed(2)}
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
                {batchRefundProcessing ? 'Processing...' : `Confirm Refund${batchRefundConfirm.multiOrder ? ' All Orders' : ' All'}`}
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

      {/* Refund Email Modal */}
      {showRefundEmail && (
        <RefundEmailModal
          userId={id}
          userEmail={user?.email || ''}
          onClose={() => setShowRefundEmail(false)}
        />
      )}

      {/* ── Edit User Modal ──────────────────────────────────── */}
      {showEditUser && (
        <div className={styles.modalOverlay} onClick={() => !editSaving && setShowEditUser(false)}>
          <div className={styles.modalBox} onClick={(e) => e.stopPropagation()}>
            <h3 className={styles.modalTitle}>Edit User Profile</h3>
            <form onSubmit={handleSaveUserEdit}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '0.75rem' }}>
                <label style={{ fontSize: '0.78rem', color: '#374151' }}>
                  First name
                  <input
                    type="text"
                    value={editFirstName}
                    onChange={(e) => setEditFirstName(e.target.value)}
                    style={{ display: 'block', width: '100%', marginTop: '0.25rem', padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: 4 }}
                  />
                </label>
                <label style={{ fontSize: '0.78rem', color: '#374151' }}>
                  Last name
                  <input
                    type="text"
                    value={editLastName}
                    onChange={(e) => setEditLastName(e.target.value)}
                    style={{ display: 'block', width: '100%', marginTop: '0.25rem', padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: 4 }}
                  />
                </label>
              </div>
              <label style={{ fontSize: '0.78rem', color: '#374151', display: 'block', marginBottom: '0.75rem' }}>
                Email
                <input
                  type="email"
                  value={editEmail}
                  onChange={(e) => setEditEmail(e.target.value)}
                  style={{ display: 'block', width: '100%', marginTop: '0.25rem', padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: 4 }}
                />
              </label>
              <label style={{ fontSize: '0.78rem', color: '#374151', display: 'block', marginBottom: '0.75rem' }}>
                Phone
                <input
                  type="tel"
                  value={editPhone}
                  onChange={(e) => setEditPhone(e.target.value)}
                  placeholder="10-digit phone"
                  style={{ display: 'block', width: '100%', marginTop: '0.25rem', padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: 4 }}
                />
              </label>
              {editError && (
                <p style={{ color: '#b91c1c', fontSize: '0.82rem', margin: '0.25rem 0 0.75rem' }}>{editError}</p>
              )}
              <div className={styles.modalActions}>
                <button type="submit" className={styles.refundConfirmBtn} disabled={editSaving}>
                  {editSaving ? 'Saving…' : 'Save changes'}
                </button>
                <button type="button" className={styles.refundCancelBtn} onClick={() => setShowEditUser(false)} disabled={editSaving}>
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Data Removal Modal ───────────────────────────────── */}
      {showDataRemoval && (
        <div className={styles.modalOverlay} onClick={() => optOutBusy !== 'data' && setShowDataRemoval(false)}>
          <div className={styles.modalBox} onClick={(e) => e.stopPropagation()}>
            <h3 className={styles.modalTitle}>Request Data Removal</h3>
            <p className={styles.modalText}>
              Files an internal data-removal request for this user. Records an audit note on the account and emails ops with the details. Real removal happens off-platform per SOP.
            </p>
            <form onSubmit={handleRequestDataRemoval}>
              <label style={{ fontSize: '0.82rem', color: '#374151', display: 'block', marginBottom: '0.5rem' }}>
                Reason / context
              </label>
              <textarea
                value={dataRemovalReason}
                onChange={(e) => setDataRemovalReason(e.target.value)}
                rows={4}
                placeholder="Why is the user requesting removal? Any reference number from the request channel?"
                style={{ display: 'block', width: '100%', padding: '0.5rem', border: '1px solid #d1d5db', borderRadius: 4 }}
              />
              <div className={styles.modalActions}>
                <button
                  type="submit"
                  className={styles.refundConfirmBtn}
                  disabled={optOutBusy === 'data' || !dataRemovalReason.trim()}
                >
                  {optOutBusy === 'data' ? 'Filing…' : 'File request'}
                </button>
                <button
                  type="button"
                  className={styles.refundCancelBtn}
                  onClick={() => setShowDataRemoval(false)}
                  disabled={optOutBusy === 'data'}
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Agent Order Modal ───────────────────────────────── */}
      {showAgentOrder && user && (
        <div className={styles.modalOverlay} onClick={() => !agentOrderProcessing && setShowAgentOrder(false)}>
          <div className={styles.agentOrderModal} onClick={e => e.stopPropagation()}>
            <h3 className={styles.modalTitle}>Create Agent Order</h3>
            <p className={styles.modalText}>
              Create an order on behalf of <strong>{getFullName(user)}</strong> ({user.email}).
              This will be logged as a CSR-initiated transaction.
            </p>

            {/* Offer selection — live BC catalog */}
            <label className={styles.agentOrderLabel}>
              Offer Plan
              {offerCatalogLoading && <span style={{ marginLeft: 8, fontSize: '0.78rem', color: '#6b7280' }}>(loading live prices…)</span>}
            </label>
            <div className={styles.agentOrderOffers}>
              {(offerCatalog || AGENT_OFFER_KEYS.map((e) => ({
                key: e.key, name: e.fallbackName, price: e.fallbackPrice, desc: e.desc, live: false,
              }))).map(offer => (
                <button
                  key={offer.key}
                  type="button"
                  className={`${styles.agentOrderOfferBtn} ${agentOrderOffer === offer.key ? styles.agentOrderOfferBtnActive : ''}`}
                  onClick={() => setAgentOrderOffer(offer.key)}
                  disabled={agentOrderProcessing}
                  title={offer.live ? `Live price from BC (${offer.key})` : `Fallback price — BC lookup failed for ${offer.key}`}
                >
                  <span className={styles.agentOrderOfferName}>
                    {offer.name}
                    {!offer.live && offerCatalog != null && (
                      <span style={{ marginLeft: 6, fontSize: '0.65rem', color: '#92400e' }}>· cached</span>
                    )}
                  </span>
                  <span className={styles.agentOrderOfferPrice}>{offer.price}</span>
                  <span className={styles.agentOrderOfferDesc}>{offer.desc}</span>
                </button>
              ))}
            </div>

            {/* Agent reason */}
            <label className={styles.agentOrderLabel}>
              Agent Reason <span style={{ color: '#ef4444' }}>*</span>
            </label>
            <textarea
              className={styles.agentOrderTextarea}
              rows={3}
              placeholder="Why is this order being created? (e.g., retention during cancellation call, comp for service issue)"
              value={agentOrderReason}
              onChange={e => setAgentOrderReason(e.target.value)}
              disabled={agentOrderProcessing}
            />

            {/* Error display */}
            {agentOrderError && (
              <p className={styles.agentOrderError}>{agentOrderError}</p>
            )}

            {/* Actions */}
            <div className={styles.modalActions}>
              <button
                className={styles.agentOrderCancelBtn}
                onClick={() => setShowAgentOrder(false)}
                disabled={agentOrderProcessing}
              >
                Cancel
              </button>
              <button
                className={styles.agentOrderSubmitBtn}
                disabled={agentOrderProcessing || !agentOrderReason.trim()}
                onClick={async () => {
                  setAgentOrderProcessing(true);
                  setAgentOrderError('');
                  const offerLabels = {
                    'comp.offer.signup.main': 'Basic Plan ($29.99/mo)',
                    'comp.offer.agent.retention': 'Retention Offer ($14.99/mo)',
                    'comp.offer.agent.comp': 'Comp/Free Access ($0)',
                  };
                  try {
                    const saleParams = {
                      userInfo: {
                        email: user.email,
                        firstName: user.firstName || '',
                        lastName: user.lastName || '',
                        optin: true,
                      },
                      billings: [], // No billing — CSR order uses card on file or comp
                      commerceOfferKeys: [{ key: agentOrderOffer, target: 'main', options: {} }],
                      sequenceOption: { thinMatch: false },
                    };
                    await api.adminCreateOrder(saleParams);

                    // Audit note
                    try {
                      await api.adminCreateNote({
                        userId: user._id,
                        message: `AGENT ORDER: ${offerLabels[agentOrderOffer] || agentOrderOffer} — Reason: ${agentOrderReason.trim()} — Agent: CS Agent`,
                        contentType: 'text/plain',
                      });
                    } catch (noteErr) {
                      console.warn('[AgentOrder] Audit note failed:', noteErr?.message);
                    }

                    showToast('Agent order created successfully.', 'success');
                    setShowAgentOrder(false);
                    fetchOrders(); // Refresh orders list
                  } catch (err) {
                    setAgentOrderError(err?.message || 'Failed to create order. Please try again.');
                  } finally {
                    setAgentOrderProcessing(false);
                  }
                }}
              >
                {agentOrderProcessing ? 'Creating...' : 'Create Order'}
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
