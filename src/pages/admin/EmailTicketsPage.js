import React, { useState, useMemo, useCallback } from 'react';
import api from '../../api';
import styles from './EmailTicketsPage.module.css';

// ─── helpers ──────────────────────────────────────────────────────────────────

function formatDate(value) {
  if (!value) return '—';
  try {
    return new Date(value).toLocaleString(undefined, {
      month: 'short', day: 'numeric', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });
  } catch { return '—'; }
}

function shortDate(value) {
  if (!value) return '—';
  try {
    return new Date(value).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  } catch { return value; }
}

function resolveId(item) { return item._id || item.id || ''; }

function stripHtml(html) {
  return (html || '').replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').trim();
}

function isCsrMail(type) { return (type || '').toLowerCase() === 'usercontactcsrmail'; }
function isUserContact(type) { return (type || '').toLowerCase() === 'usercontact'; }
function isMailThread(type) { return isCsrMail(type) || isUserContact(type); }

// ─── DirectionBadge ──────────────────────────────────────────────────────────

function DirectionBadge({ type }) {
  if (isCsrMail(type)) {
    return <span className={`${styles.badge} ${styles.badgeOutbound}`}>Outbound</span>;
  }
  if (isUserContact(type)) {
    return <span className={`${styles.badge} ${styles.badgeInbound}`}>Inbound</span>;
  }
  return <span className={`${styles.badge} ${styles.badgeDefault}`}>{type || '—'}</span>;
}

// ─── EmailTicketsPage ─────────────────────────────────────────────────────────

const EmailTicketsPage = () => {
  // User search
  const [searchInput, setSearchInput] = useState('');
  const [resolvedUser, setResolvedUser] = useState(null);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState('');

  // Contacts
  const [allItems, setAllItems] = useState([]);
  const [loadingItems, setLoadingItems] = useState(false);
  const [noMoreDocs, setNoMoreDocs] = useState(false);
  const [lastId, setLastId] = useState(null);
  const [itemsError, setItemsError] = useState('');

  // Selection & compose
  const [selectedId, setSelectedId] = useState(null);
  const [replySubject, setReplySubject] = useState('');
  const [replyMessage, setReplyMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [composing, setComposing] = useState(false);
  const [composeSubject, setComposeSubject] = useState('');
  const [composeMessage, setComposeMessage] = useState('');

  // UI
  const [filterDir, setFilterDir] = useState('all');
  const [toast, setToast] = useState('');

  const showToast = useCallback((msg) => {
    setToast(msg);
    setTimeout(() => setToast(''), 3000);
  }, []);

  // Filter to mail-type items only
  const mailItems = useMemo(() => {
    const items = allItems.filter((item) => isMailThread(item.type));
    if (filterDir === 'outbound') return items.filter((item) => isCsrMail(item.type));
    if (filterDir === 'inbound') return items.filter((item) => isUserContact(item.type));
    return items;
  }, [allItems, filterDir]);

  const selected = useMemo(() => {
    if (!selectedId) return null;
    return mailItems.find((item) => resolveId(item) === selectedId) || null;
  }, [mailItems, selectedId]);

  // ── user search ────────────────────────────────────────────────────────────

  const handleUserSearch = async (e) => {
    e.preventDefault();
    const q = searchInput.trim();
    if (!q) return;
    setSearching(true);
    setSearchError('');
    setResolvedUser(null);
    setAllItems([]);
    setSelectedId(null);
    try {
      const res = await api.adminListUsers({ email: q });
      const users = res?.data?.docs ?? res?.docs ?? (Array.isArray(res?.data) ? res.data : []);
      if (users.length === 0) { setSearchError(`No user found for "${q}".`); return; }
      const user = users[0];
      setResolvedUser(user);
      await fetchContacts(user._id || user.id, null);
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
        setAllItems((prev) => [...prev, ...docs]);
      } else {
        setAllItems(docs);
      }
      setLastId(last);
      setNoMoreDocs(res?.noMoreDocs ?? docs.length === 0);
    } catch (err) {
      setItemsError(err.message || 'Failed to load contacts.');
    } finally {
      setLoadingItems(false);
    }
  };

  const handleLoadMore = () => {
    if (!resolvedUser || loadingItems || noMoreDocs) return;
    fetchContacts(resolvedUser._id || resolvedUser.id, lastId);
  };

  // ── send CSR mail (reply) ──────────────────────────────────────────────────

  const handleReply = async (e) => {
    e.preventDefault();
    if (!replyMessage.trim() || !resolvedUser) return;
    setSending(true);
    try {
      const subject = replySubject.trim() || (selected?.content?.subject ? `Re: ${selected.content.subject}` : 'Follow-up');
      await api.adminCreateCsrMail({
        targetUserId: resolvedUser._id || resolvedUser.id,
        subject,
        message: replyMessage.trim(),
        contentType: 'text',
      });
      setReplySubject('');
      setReplyMessage('');
      showToast('Reply sent.');
      await fetchContacts(resolvedUser._id || resolvedUser.id, null);
    } catch (err) {
      showToast(err.message || 'Failed to send reply.');
    } finally {
      setSending(false);
    }
  };

  // ── compose new mail ───────────────────────────────────────────────────────

  const handleCompose = async (e) => {
    e.preventDefault();
    if (!composeSubject.trim() || !composeMessage.trim() || !resolvedUser) return;
    setSending(true);
    try {
      await api.adminCreateCsrMail({
        targetUserId: resolvedUser._id || resolvedUser.id,
        subject: composeSubject.trim(),
        message: composeMessage.trim(),
        contentType: 'text',
      });
      setComposeSubject('');
      setComposeMessage('');
      setComposing(false);
      showToast('Email sent.');
      await fetchContacts(resolvedUser._id || resolvedUser.id, null);
    } catch (err) {
      showToast(err.message || 'Failed to send email.');
    } finally {
      setSending(false);
    }
  };

  const handleClear = () => {
    setResolvedUser(null);
    setAllItems([]);
    setSearchInput('');
    setSearchError('');
    setSelectedId(null);
    setComposing(false);
  };

  const userName = resolvedUser
    ? (`${resolvedUser.firstName || ''} ${resolvedUser.lastName || ''}`.trim() || resolvedUser.email || '')
    : '';

  return (
    <main className={styles.page}>
      {toast && <div className={styles.toast}>{toast}</div>}

      <div className={styles.pageHeader}>
        <div>
          <h1 className={styles.title}>Email Tickets</h1>
          <p className={styles.subtitle}>CSR mail threads and customer correspondence.</p>
        </div>
        {resolvedUser && (
          <button className={styles.composeBtn} onClick={() => setComposing(!composing)}>
            + New Email
          </button>
        )}
      </div>

      {/* User search */}
      <form className={styles.searchForm} onSubmit={handleUserSearch}>
        <input
          className={styles.searchInput}
          type="text"
          placeholder="Search by customer email..."
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
        />
        <button className={styles.searchBtn} type="submit" disabled={searching}>
          {searching ? 'Searching...' : 'Find Customer'}
        </button>
        {resolvedUser && (
          <button type="button" className={styles.clearBtn} onClick={handleClear}>Clear</button>
        )}
      </form>

      {searchError && <div className={styles.errorBox}>{searchError}</div>}

      {resolvedUser && (
        <div className={styles.userBanner}>
          <div>
            <strong>{userName}</strong>
            <span className={styles.userEmail}>{resolvedUser.email}</span>
          </div>
          <span className={styles.mailCount}>{mailItems.length} message{mailItems.length !== 1 ? 's' : ''}</span>
        </div>
      )}

      {/* Compose form */}
      {composing && resolvedUser && (
        <form className={styles.composeForm} onSubmit={handleCompose}>
          <h3 className={styles.composeTitle}>New Email to {userName || resolvedUser.email}</h3>
          <input
            className={styles.composeInput}
            type="text"
            placeholder="Subject..."
            value={composeSubject}
            onChange={(e) => setComposeSubject(e.target.value)}
          />
          <textarea
            className={styles.replyTextarea}
            rows={5}
            placeholder="Message body..."
            value={composeMessage}
            onChange={(e) => setComposeMessage(e.target.value)}
          />
          <div className={styles.replyActions}>
            <button type="button" className={styles.cancelBtn} onClick={() => setComposing(false)}>Cancel</button>
            <button type="submit" className={styles.replyBtn} disabled={sending || !composeSubject.trim() || !composeMessage.trim()}>
              {sending ? 'Sending...' : 'Send Email'}
            </button>
          </div>
        </form>
      )}

      {/* Empty state */}
      {!resolvedUser && !searchError && (
        <div className={styles.emptyState}>
          <p className={styles.emptyIcon}>Search for a customer by email to view their mail threads.</p>
        </div>
      )}

      {/* Loading skeleton */}
      {loadingItems && allItems.length === 0 && (
        <div className={styles.loadingState}>Loading mail threads...</div>
      )}

      {itemsError && <div className={styles.errorBox}>{itemsError}</div>}

      {/* No mail found */}
      {resolvedUser && !loadingItems && mailItems.length === 0 && allItems.length > 0 && !itemsError && (
        <div className={styles.emptyState}>
          <p className={styles.emptyIcon}>No mail threads found for this customer. Only admin notes exist.</p>
        </div>
      )}

      {resolvedUser && !loadingItems && allItems.length === 0 && !itemsError && !searching && (
        <div className={styles.emptyState}>
          <p className={styles.emptyIcon}>No contacts found for this customer.</p>
        </div>
      )}

      {/* Two-panel layout */}
      {mailItems.length > 0 && (
        <>
          {/* Direction filter */}
          <div className={styles.filterBar}>
            <select
              className={styles.select}
              value={filterDir}
              onChange={(e) => setFilterDir(e.target.value)}
            >
              <option value="all">All Messages</option>
              <option value="outbound">Outbound (CSR Mail)</option>
              <option value="inbound">Inbound (User Replies)</option>
            </select>
          </div>

          <div className={styles.wrapper}>
            {/* Left: message list */}
            <div className={styles.ticketList}>
              {mailItems.length === 0 && (
                <div className={styles.emptyList}>No messages match your filter.</div>
              )}
              {mailItems.map((item) => {
                const id = resolveId(item);
                const subject = item.content?.subject || '(No subject)';
                const preview = stripHtml(item.content?.message || '');
                const ownerName = item.owner
                  ? `${item.owner.firstName || ''} ${item.owner.lastName || ''}`.trim()
                  : '';
                return (
                  <button
                    key={id}
                    className={`${styles.ticketItem} ${id === selectedId ? styles.ticketItemActive : ''}`}
                    onClick={() => setSelectedId(id)}
                  >
                    <div className={styles.ticketItemTop}>
                      <DirectionBadge type={item.type} />
                      <span className={styles.ticketDate}>{shortDate(item.createdAt)}</span>
                    </div>
                    <div className={styles.ticketSubject}>{subject}</div>
                    <div className={styles.ticketMeta}>
                      {isCsrMail(item.type) ? (ownerName || 'CSR') : (userName || 'Customer')}
                      {preview ? ` — ${preview.length > 60 ? preview.slice(0, 60) + '...' : preview}` : ''}
                    </div>
                  </button>
                );
              })}

              {/* Load more inside the list */}
              {!noMoreDocs && (
                <div className={styles.loadMoreRow}>
                  <button className={styles.loadMoreBtn} onClick={handleLoadMore} disabled={loadingItems}>
                    {loadingItems ? 'Loading...' : 'Load More'}
                  </button>
                </div>
              )}
            </div>

            {/* Right: detail + reply */}
            <div className={styles.ticketDetail}>
              {!selected ? (
                <div className={styles.emptyDetail}>Select a message to view details.</div>
              ) : (
                <>
                  <div className={styles.detailHeader}>
                    <div>
                      <h2 className={styles.detailSubject}>{selected.content?.subject || '(No subject)'}</h2>
                      <p className={styles.detailMeta}>
                        <DirectionBadge type={selected.type} />
                        &nbsp;&nbsp;
                        {isCsrMail(selected.type) ? 'Sent by: ' : 'From: '}
                        <strong>
                          {isCsrMail(selected.type)
                            ? (selected.owner ? `${selected.owner.firstName || ''} ${selected.owner.lastName || ''}`.trim() : 'CSR')
                            : (userName || 'Customer')}
                        </strong>
                        &nbsp;&middot;&nbsp;
                        {formatDate(selected.createdAt)}
                      </p>
                    </div>
                    <div className={styles.statusControls}>
                      {selected.status && (
                        <span className={`${styles.badge} ${styles.badgeStatus}`}>{selected.status}</span>
                      )}
                      {selected.content?.contentType && (
                        <span className={styles.contentType}>{selected.content.contentType}</span>
                      )}
                    </div>
                  </div>

                  {/* Message body */}
                  <div className={styles.thread}>
                    <div className={`${styles.message} ${isCsrMail(selected.type) ? styles.messageAgent : styles.messageCustomer}`}>
                      <div className={styles.msgBody}>
                        {selected.content?.contentType === 'html'
                          ? <div dangerouslySetInnerHTML={{ __html: selected.content.message }} />
                          : <p style={{ margin: 0 }}>{selected.content?.message || '(Empty message)'}</p>
                        }
                      </div>
                    </div>
                  </div>

                  {/* Attachments */}
                  {selected.attachments && selected.attachments.length > 0 && (
                    <div className={styles.attachments}>
                      <p className={styles.attachmentsLabel}>Attachments ({selected.attachments.length}):</p>
                      {selected.attachments.map((att, idx) => (
                        <span key={idx} className={styles.attachmentItem}>
                          {att.name || att.fileName || `Attachment ${idx + 1}`}
                        </span>
                      ))}
                    </div>
                  )}

                  {/* Reply form */}
                  <form className={styles.replyForm} onSubmit={handleReply}>
                    <input
                      className={styles.composeInput}
                      type="text"
                      placeholder={`Re: ${selected.content?.subject || ''}`}
                      value={replySubject}
                      onChange={(e) => setReplySubject(e.target.value)}
                    />
                    <textarea
                      className={styles.replyTextarea}
                      rows={4}
                      value={replyMessage}
                      onChange={(e) => setReplyMessage(e.target.value)}
                      placeholder="Type your reply..."
                      disabled={sending}
                    />
                    <div className={styles.replyActions}>
                      <button type="submit" className={styles.replyBtn} disabled={sending || !replyMessage.trim()}>
                        {sending ? 'Sending...' : 'Send Reply'}
                      </button>
                    </div>
                  </form>
                </>
              )}
            </div>
          </div>
        </>
      )}
    </main>
  );
};

export default EmailTicketsPage;
