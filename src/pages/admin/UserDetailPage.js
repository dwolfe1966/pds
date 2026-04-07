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

// localStorage-backed notes keyed by userId
const NOTES_KEY_PREFIX = 'adminUserNotes_';

function loadNotes(userId) {
  try {
    const raw = localStorage.getItem(NOTES_KEY_PREFIX + userId);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveNotes(userId, notes) {
  try {
    localStorage.setItem(NOTES_KEY_PREFIX + userId, JSON.stringify(notes));
  } catch {
    // storage may be full; fail silently
  }
}

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

const TABS = ['Transactions', 'Notes', 'Actions'];

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
  const [activeTab, setActiveTab]       = useState('Transactions');
  const [suspending, setSuspending]     = useState(false);
  const [copied, setCopied]             = useState(false);
  const [toast, setToast]               = useState(null); // { message, type }

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

  useEffect(() => {
    if (!id) return;
    fetchUser();
    fetchOrders();
    setNotes(loadNotes(id));
  }, [id, fetchUser, fetchOrders]);

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
  const handleSaveNote = () => {
    const text = noteText.trim();
    if (!text) return;
    const updated = [
      { id: Date.now(), text, createdAt: new Date().toISOString() },
      ...notes,
    ];
    setNotes(updated);
    saveNotes(id, updated);
    setNoteText('');
    setShowNoteForm(false);
  };

  const handleDeleteNote = (noteId) => {
    const updated = notes.filter((n) => n.id !== noteId);
    setNotes(updated);
    saveNotes(id, updated);
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
    navigate(`/admin/purchases/${oid}?userId=${id}`);
  };

  const handleViewAllOrders = () => {
    navigate(`/admin/purchases?userId=${id}`);
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
              <span className={styles.metaLabel}>Joined</span>
              <span className={styles.metaValue}>{joinDate}</span>
            </div>
            <div className={styles.metaRow}>
              <span className={styles.metaLabel}>User ID</span>
              <span
                className={styles.userId}
                title="Click to copy"
                onClick={handleCopyId}
              >
                {id}
              </span>
            </div>
            {copied && <p className={styles.copyHint}>Copied!</p>}
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

            {/* ── Tab: Transactions ──────────────────────── */}
            {activeTab === 'Transactions' && (
              <>
                {ordersLoading && (
                  <div className={styles.loadingState}>Loading transactions…</div>
                )}
                {!ordersLoading && ordersError && (
                  <div className={styles.errorState}>{ordersError}</div>
                )}
                {!ordersLoading && !ordersError && orders.length === 0 && (
                  <div className={styles.emptyState}>No transactions found for this user.</div>
                )}
                {!ordersLoading && !ordersError && orders.length > 0 && (
                  <div className={styles.tableWrapper}>
                    <table className={styles.table}>
                      <thead>
                        <tr>
                          <th className={styles.th}>Order ID</th>
                          <th className={styles.th}>Amount</th>
                          <th className={styles.th}>Status</th>
                          <th className={styles.th}>Date</th>
                        </tr>
                      </thead>
                      <tbody>
                        {orders.map((o) => {
                          const oid = getOrderId(o);
                          const oStatus = o.status || '—';
                          const canceled = o.transient?.canceled;
                          return (
                            <tr key={oid} className={styles.tr}>
                              <td className={styles.td}>
                                <Link
                                  to={`/admin/purchases/${oid}?userId=${id}`}
                                  className={styles.orderLink}
                                >
                                  {oid || '—'}
                                </Link>
                              </td>
                              <td className={styles.td}>{getAmount(o)}</td>
                              <td className={styles.td}>
                                <span
                                  className={
                                    oStatus === 'active'
                                      ? styles.badgeActive
                                      : canceled
                                      ? styles.badgeSuspended
                                      : styles.badgeFree
                                  }
                                >
                                  {oStatus}{canceled ? ' (canceled)' : ''}
                                </span>
                              </td>
                              <td className={styles.td}>{formatDate(o.createdAt)}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </>
            )}

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
                        <p className={styles.noteBody}>{n.text}</p>
                        <div className={styles.noteMeta}>
                          <span className={styles.noteTimestamp}>
                            {formatDateTime(n.createdAt)}
                          </span>
                          <button
                            className={styles.deleteNoteBtn}
                            onClick={() => handleDeleteNote(n.id)}
                          >
                            Delete
                          </button>
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
