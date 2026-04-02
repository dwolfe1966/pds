import React, { useCallback, useState } from 'react';
import api from '../../api';
import { useAuth } from '../../context/AuthContext';
import { Link } from 'react-router-dom';
import styles from './MailActivityPage.module.css';

// ─── helpers ──────────────────────────────────────────────────────────────────

function formatDate(value) {
  if (!value) return '—';
  try {
    return new Date(value).toLocaleDateString(undefined, {
      year: 'numeric', month: 'short', day: 'numeric',
    });
  } catch { return '—'; }
}

function resolveId(item) { return item._id || item.id || ''; }

function stripHtml(html) {
  return (html || '').replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').trim();
}

// ─── TypeBadge ────────────────────────────────────────────────────────────────

function TypeBadge({ type }) {
  const t = (type || '').toLowerCase();
  if (t === 'usercontactcsrmail') return <span className={`${styles.badge} ${styles.badgeMail}`}>CSR Mail</span>;
  if (t === 'usercontact') return <span className={`${styles.badge} ${styles.badgeContact}`}>Contact</span>;
  return <span className={`${styles.badge} ${styles.badgeDefault}`}>{type || '—'}</span>;
}

// ─── ComposeModal ─────────────────────────────────────────────────────────────

function ComposeModal({ targetUserId, onSent, onClose }) {
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');

  const handleSend = async (e) => {
    e.preventDefault();
    if (!subject.trim()) { setError('Subject is required.'); return; }
    if (!message.trim()) { setError('Message is required.'); return; }
    setSending(true);
    setError('');
    try {
      await api.adminCreateCsrMail({ targetUserId, subject: subject.trim(), message: message.trim() });
      onSent();
    } catch (err) {
      setError(err.message || 'Failed to send email.');
    } finally {
      setSending(false);
    }
  };

  return (
    <div className={styles.modalOverlay} onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div className={styles.modalHeader}>
          <h2 className={styles.modalTitle}>Send CSR Mail</h2>
          <button className={styles.modalClose} onClick={onClose}>✕</button>
        </div>
        <form onSubmit={handleSend}>
          <div className={styles.field}>
            <label className={styles.label}>Subject</label>
            <input className={styles.input} value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Email subject…" />
          </div>
          <div className={styles.field}>
            <label className={styles.label}>Message</label>
            <textarea className={styles.textarea} rows={6} value={message} onChange={(e) => setMessage(e.target.value)} placeholder="Email body (HTML supported)…" />
          </div>
          {error && <p className={styles.errorMsg}>{error}</p>}
          <div className={styles.modalActions}>
            <button type="button" className={styles.cancelBtn} onClick={onClose}>Cancel</button>
            <button type="submit" className={styles.sendBtn} disabled={sending}>{sending ? 'Sending…' : 'Send'}</button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── MailCard ─────────────────────────────────────────────────────────────────

function MailCard({ item }) {
  const subject = item.content?.subject || '';
  const msg = stripHtml(item.content?.message || '');

  return (
    <div className={styles.mailCard}>
      <div className={styles.mailHeader}>
        <TypeBadge type={item.type} />
        <span className={styles.mailDate}>{formatDate(item.createdAt)}</span>
      </div>
      {subject && <p className={styles.mailSubject}>{subject}</p>}
      {msg && <p className={styles.mailBody}>{msg.length > 200 ? msg.slice(0, 200) + '…' : msg}</p>}
      <p className={styles.mailMeta}>Status: <strong>{item.status || '—'}</strong></p>
      {item.owner && (
        <p className={styles.mailMeta}>
          By: {item.owner.firstName} {item.owner.lastName}
        </p>
      )}
    </div>
  );
}

// ─── MailActivityPage ─────────────────────────────────────────────────────────

const MailActivityPage = () => {
  const { token } = useAuth();

  // User search
  const [searchInput, setSearchInput] = useState('');
  const [resolvedUser, setResolvedUser] = useState(null);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState('');

  // Contacts (mail + contact items)
  const [items, setItems] = useState([]);
  const [loadingItems, setLoadingItems] = useState(false);
  const [noMoreDocs, setNoMoreDocs] = useState(false);
  const [lastId, setLastId] = useState(null);
  const [itemsError, setItemsError] = useState('');

  // Compose
  const [composing, setComposing] = useState(false);
  const [toast, setToast] = useState('');
  const [view, setView] = useState('list'); // 'list' | 'cards'

  const showToast = useCallback((msg) => {
    setToast(msg);
    setTimeout(() => setToast(''), 3000);
  }, []);

  // ── user search ────────────────────────────────────────────────────────────

  const handleUserSearch = async (e) => {
    e.preventDefault();
    const q = searchInput.trim();
    if (!q) return;
    setSearching(true);
    setSearchError('');
    setResolvedUser(null);
    setItems([]);
    try {
      const res = await api.adminListUsers({ email: q });
      const users = res?.data?.docs ?? res?.docs ?? (Array.isArray(res?.data) ? res.data : []);
      if (users.length === 0) { setSearchError(`No user found for "${q}".`); return; }
      const user = users[0];
      setResolvedUser(user);
      fetchContacts(user._id || user.id, null);
    } catch (err) {
      setSearchError(err.message || 'Failed to find user.');
    } finally {
      setSearching(false);
    }
  };

  // ── load contacts ──────────────────────────────────────────────────────────

  const fetchContacts = async (userId, cursorId) => {
    setLoadingItems(true);
    setItemsError('');
    try {
      const params = { userId, ...(cursorId ? { lastId: cursorId } : {}) };
      const res = await api.adminFindUserContacts(params);
      const docs = res?.data ?? res?.docs ?? [];
      const last = docs.length > 0 ? resolveId(docs[docs.length - 1]) : null;
      if (cursorId) {
        setItems((prev) => [...prev, ...docs]);
      } else {
        setItems(docs);
      }
      setLastId(last);
      setNoMoreDocs(res?.noMoreDocs ?? docs.length === 0);
    } catch (err) {
      setItemsError(err.message || 'Failed to load mail log.');
    } finally {
      setLoadingItems(false);
    }
  };

  const handleLoadMore = () => {
    if (!resolvedUser || loadingItems || noMoreDocs) return;
    fetchContacts(resolvedUser._id || resolvedUser.id, lastId);
  };

  const handleSent = () => {
    setComposing(false);
    showToast('Email sent.');
    // Refetch to show the new mail
    if (resolvedUser) fetchContacts(resolvedUser._id || resolvedUser.id, null);
  };

  const userName = resolvedUser
    ? (`${resolvedUser.firstName || ''} ${resolvedUser.lastName || ''}`.trim() || resolvedUser.email || '')
    : '';

  return (
    <main className={styles.page}>
      {toast && <div className={styles.toast}>{toast}</div>}

      {composing && resolvedUser && (
        <ComposeModal
          targetUserId={resolvedUser._id || resolvedUser.id}
          onSent={handleSent}
          onClose={() => setComposing(false)}
        />
      )}

      <div className={styles.pageHeader}>
        <div>
          <h1 className={styles.title}>Mail Activity</h1>
          <p className={styles.subtitle}>CSR email history per customer.</p>
        </div>
        <div className={styles.headerRight}>
          {resolvedUser && (
            <button className={styles.composeBtn} onClick={() => setComposing(true)}>
              + Send Email
            </button>
          )}
          <div className={styles.viewToggle}>
            <button className={`${styles.viewBtn} ${view === 'list' ? styles.viewBtnActive : ''}`} onClick={() => setView('list')}>List</button>
            <button className={`${styles.viewBtn} ${view === 'cards' ? styles.viewBtnActive : ''}`} onClick={() => setView('cards')}>Cards</button>
          </div>
        </div>
      </div>

      {/* User search */}
      <form className={styles.searchForm} onSubmit={handleUserSearch}>
        <input
          className={styles.searchInput}
          type="text"
          placeholder="Search by customer email…"
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
        />
        <button className={styles.searchBtn} type="submit" disabled={searching}>
          {searching ? 'Searching…' : 'Find Customer'}
        </button>
        {resolvedUser && (
          <button type="button" className={styles.clearBtn} onClick={() => {
            setResolvedUser(null); setItems([]); setSearchInput(''); setSearchError('');
          }}>Clear</button>
        )}
      </form>

      {searchError && <div className={styles.errorBox}>{searchError}</div>}

      {resolvedUser && (
        <div className={styles.userBanner}>
          <div>
            <strong>{userName}</strong>
            <span className={styles.userEmail}>{resolvedUser.email}</span>
          </div>
          <Link to={`/admin/users/${resolvedUser._id || resolvedUser.id}`} className={styles.profileLink}>
            View Profile →
          </Link>
        </div>
      )}

      {!resolvedUser && !searchError && (
        <div className={styles.emptyState}>
          <p className={styles.emptyIcon}>📬</p>
          <p className={styles.emptyTitle}>Search for a customer to view their mail log</p>
        </div>
      )}

      {loadingItems && (
        <div className={styles.grid}>
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className={styles.skeletonCard}>
              <div className={`${styles.skeletonLine} ${styles.skeletonTitle}`} />
              <div className={`${styles.skeletonLine} ${styles.skeletonShort}`} />
              <div className={`${styles.skeletonLine} ${styles.skeletonShort}`} />
            </div>
          ))}
        </div>
      )}

      {itemsError && <div className={styles.errorBox}>{itemsError}</div>}

      {resolvedUser && !loadingItems && items.length === 0 && !itemsError && (
        <div className={styles.emptyState}>
          <p className={styles.emptyTitle}>No mail activity for this customer.</p>
        </div>
      )}

      {!loadingItems && items.length > 0 && (
        view === 'cards' ? (
          <div className={styles.grid}>
            {items.map((item, idx) => <MailCard key={resolveId(item) || idx} item={item} />)}
          </div>
        ) : (
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead><tr>
                <th className={styles.th}>Type</th>
                <th className={styles.th}>Subject / Message</th>
                <th className={styles.th}>Status</th>
                <th className={styles.th}>Date</th>
                <th className={styles.th}>By</th>
              </tr></thead>
              <tbody>
                {items.map((item, idx) => {
                  const subject = item.content?.subject || '';
                  const msg = stripHtml(item.content?.message || '');
                  const preview = subject || (msg.length > 80 ? msg.slice(0, 80) + '…' : msg);
                  const ownerName = item.owner
                    ? `${item.owner.firstName || ''} ${item.owner.lastName || ''}`.trim()
                    : '—';
                  return (
                    <tr key={resolveId(item) || idx} className={styles.tr}>
                      <td className={styles.td}><TypeBadge type={item.type} /></td>
                      <td className={styles.td}>{preview || '—'}</td>
                      <td className={styles.td}>{item.status || '—'}</td>
                      <td className={styles.td}>{formatDate(item.createdAt)}</td>
                      <td className={styles.td}>{ownerName}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )
      )}

      {resolvedUser && !noMoreDocs && items.length > 0 && (
        <div className={styles.loadMoreRow}>
          <button className={styles.loadMoreBtn} onClick={handleLoadMore} disabled={loadingItems}>
            {loadingItems ? 'Loading…' : 'Load More'}
          </button>
        </div>
      )}
    </main>
  );
};

export default MailActivityPage;
