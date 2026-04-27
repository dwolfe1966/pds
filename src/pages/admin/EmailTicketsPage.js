import React, { useState, useMemo, useCallback, useEffect } from 'react';
import api from '../../api';
import { useAuth } from '../../context/AuthContext';
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
function isContactMessage(type) { return (type || '').toLowerCase() === 'contact'; }
function isCsrReply(type) { return (type || '').toLowerCase() === 'contactcsrreply'; }
function isUserReply(type) { return (type || '').toLowerCase() === 'contactuserreply'; }
function isMailThread(type) { return isCsrMail(type) || isUserContact(type); }

function contactMessageSubject(item) {
  const input = item?.content?.input || {};
  if (input.topic) return input.topic;
  if (input.category === 'billing') return 'Billing inquiry';
  if (item?.content?.subject) return item.content.subject;
  return '(No subject)';
}

function contactMessagePreview(item) {
  const input = item?.content?.input || {};
  if (input.description) return stripHtml(input.description);
  if (input.message) return stripHtml(input.message);
  if (item?.content?.message) return stripHtml(item.content.message);
  return '';
}

function contactMessageSenderName(item) {
  return item?.content?.input?.name || item?.content?.name || 'Anonymous';
}

function contactMessageSenderEmail(item) {
  return item?.content?.input?.email || item?.content?.email || '';
}

function isMemberLinked(item) {
  return Boolean(item?.content?.targetUserId || item?.targetUserId);
}

// ─── DirectionBadge ──────────────────────────────────────────────────────────

function DirectionBadge({ type }) {
  if (isCsrMail(type) || isCsrReply(type)) {
    return <span className={`${styles.badge} ${styles.badgeOutbound}`}>Outbound</span>;
  }
  if (isUserContact(type) || isContactMessage(type) || isUserReply(type)) {
    return <span className={`${styles.badge} ${styles.badgeInbound}`}>Inbound</span>;
  }
  return <span className={`${styles.badge} ${styles.badgeDefault}`}>{type || '—'}</span>;
}

// ─── EmailTicketsPage ─────────────────────────────────────────────────────────

const EmailTicketsPage = () => {
  const { user: adminUser } = useAuth();
  const adminUserId = adminUser?._id || adminUser?.id || null;

  // Mode: 'inbox' (all contactMessages) or 'user' (per-user search view)
  const [mode, setMode] = useState('inbox');

  // Inbox-mode filters (combined with the existing filterDir)
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all'); // 'all' | 'awaiting' | 'replied'
  const [categoryFilter, setCategoryFilter] = useState('all'); // 'all' | 'billing' | 'general'
  const [myAssignedOnly, setMyAssignedOnly] = useState(false);

  // Tag editor (per-thread)
  const [editingTags, setEditingTags] = useState(false);
  const [tagDraft, setTagDraft] = useState('');
  const [savingTags, setSavingTags] = useState(false);

  // User search (used in 'user' mode)
  const [searchInput, setSearchInput] = useState('');
  const [resolvedUser, setResolvedUser] = useState(null);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState('');

  // Contacts list — semantics depend on mode
  const [allItems, setAllItems] = useState([]);
  const [loadingItems, setLoadingItems] = useState(false);
  const [noMoreDocs, setNoMoreDocs] = useState(false);
  const [lastId, setLastId] = useState(null);
  const [itemsError, setItemsError] = useState('');

  // Thread history for a selected contactMessage (inbox mode)
  const [threadItems, setThreadItems] = useState([]);
  const [loadingThread, setLoadingThread] = useState(false);

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

  // ── inbox load (mount) ─────────────────────────────────────────────────────

  const fetchInbox = useCallback(async (cursorId) => {
    setLoadingItems(true);
    setItemsError('');
    try {
      const params = cursorId ? { lastId: cursorId } : {};
      const res = await api.adminFindContactMessages(params);
      const docs = res?.data ?? res?.docs ?? (Array.isArray(res) ? res : []);
      const last = docs.length > 0 ? resolveId(docs[docs.length - 1]) : null;
      if (cursorId) {
        setAllItems((prev) => [...prev, ...docs]);
      } else {
        // Cap to 10 on the initial page so the default view stays focused.
        setAllItems(docs.slice(0, 10));
      }
      setLastId(last);
      setNoMoreDocs(res?.noMoreDocs ?? docs.length === 0);
    } catch (err) {
      setItemsError(err.message || 'Failed to load inbox.');
    } finally {
      setLoadingItems(false);
    }
  }, []);

  useEffect(() => {
    if (mode === 'inbox') {
      fetchInbox(null);
    }
  }, [mode, fetchInbox]);

  // ── filtered list ─────────────────────────────────────────────────────────

  // Helpers used by inbox filter chain
  const matchesSearch = (item, q) => {
    if (!q) return true;
    const needle = q.toLowerCase();
    const subject = (isContactMessage(item.type) ? contactMessageSubject(item) : item.content?.subject || '').toLowerCase();
    const sender = (isContactMessage(item.type) ? contactMessageSenderName(item) : '').toLowerCase();
    const email = (isContactMessage(item.type) ? contactMessageSenderEmail(item) : '').toLowerCase();
    const preview = (isContactMessage(item.type) ? contactMessagePreview(item) : stripHtml(item.content?.message || '')).toLowerCase();
    const tagBlob = (item.index || []).join(' ').toLowerCase();
    return [subject, sender, email, preview, tagBlob].some((s) => s.includes(needle));
  };

  const hasReply = (item) => Boolean(item?.latestReply || (Array.isArray(item?.referenceIds) && item.referenceIds.length > 0));
  const itemCategory = (item) => item?.content?.category || item?.content?.input?.category || null;
  const isAssignedTo = (item, csrId) => Boolean(csrId) && item?.content?.actorId === csrId;

  const listItems = useMemo(() => {
    if (mode === 'user') {
      const items = allItems.filter((item) => isMailThread(item.type));
      if (filterDir === 'outbound') return items.filter((item) => isCsrMail(item.type));
      if (filterDir === 'inbound') return items.filter((item) => isUserContact(item.type));
      return items;
    }
    // Inbox mode — combine all five filters.
    let items = allItems;
    if (filterDir === 'member')    items = items.filter(isMemberLinked);
    if (filterDir === 'nonmember') items = items.filter((i) => !isMemberLinked(i));
    if (statusFilter === 'awaiting') items = items.filter((i) => !hasReply(i));
    if (statusFilter === 'replied')  items = items.filter(hasReply);
    if (categoryFilter !== 'all')   items = items.filter((i) => itemCategory(i) === categoryFilter);
    if (myAssignedOnly)             items = items.filter((i) => isAssignedTo(i, adminUserId));
    if (searchQuery.trim())         items = items.filter((i) => matchesSearch(i, searchQuery.trim()));
    return items;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allItems, filterDir, mode, statusFilter, categoryFilter, myAssignedOnly, searchQuery, adminUserId]);

  const selected = useMemo(() => {
    if (!selectedId) return null;
    return listItems.find((item) => resolveId(item) === selectedId) || null;
  }, [listItems, selectedId]);

  // ── thread history for a selected contactMessage ──────────────────────────

  useEffect(() => {
    if (mode !== 'inbox' || !selected || !isContactMessage(selected.type)) {
      setThreadItems([]);
      return;
    }
    let cancelled = false;
    (async () => {
      setLoadingThread(true);
      try {
        const res = await api.adminContactHistories({ contactMessageId: resolveId(selected) });
        if (cancelled) return;
        const docs = res?.data ?? res?.docs ?? [];
        setThreadItems(docs.sort((a, b) => new Date(a.createdAt || 0) - new Date(b.createdAt || 0)));
      } catch (err) {
        if (!cancelled) showToast(err.message || 'Failed to load thread history.');
      } finally {
        if (!cancelled) setLoadingThread(false);
      }
    })();
    return () => { cancelled = true; };
  }, [selected, mode, showToast]);

  // ── user search (user mode) ────────────────────────────────────────────────

  const handleUserSearch = async (e) => {
    e.preventDefault();
    const q = searchInput.trim();
    if (!q) return;
    setMode('user');
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
      await fetchUserContacts(user._id || user.id, null);
    } catch (err) {
      setSearchError(err.message || 'Failed to find user.');
    } finally {
      setSearching(false);
    }
  };

  const fetchUserContacts = async (userId, cursorId) => {
    setLoadingItems(true);
    setItemsError('');
    try {
      const params = { userId, ...(cursorId ? { lastId: cursorId } : {}) };
      const res = await api.adminFindUserContacts(params);
      const all = (res?.data ?? res?.docs ?? [])
        .sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
      const docs = cursorId ? all : all.slice(0, 10);
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
    if (loadingItems || noMoreDocs) return;
    if (mode === 'inbox') {
      fetchInbox(lastId);
    } else if (resolvedUser) {
      fetchUserContacts(resolvedUser._id || resolvedUser.id, lastId);
    }
  };

  // ── reply ─────────────────────────────────────────────────────────────────

  const handleReply = async (e) => {
    e.preventDefault();
    if (!replyMessage.trim() || !selected) return;
    setSending(true);
    try {
      const isThreadContactMessage = isContactMessage(selected.type);
      const defaultSubject = isThreadContactMessage
        ? `Re: ${contactMessageSubject(selected)}`
        : (selected?.content?.subject ? `Re: ${selected.content.subject}` : 'Follow-up');
      const subject = replySubject.trim() || defaultSubject;

      if (isThreadContactMessage) {
        await api.adminCreateCsrReply({
          contactMessageId: resolveId(selected),
          subject,
          message: replyMessage.trim(),
          contentType: 'text/html',
        });
      } else if (resolvedUser) {
        await api.adminCreateCsrMail({
          targetUserId: resolvedUser._id || resolvedUser.id,
          subject,
          message: replyMessage.trim(),
          contentType: 'text',
        });
      }

      setReplySubject('');
      setReplyMessage('');
      showToast('Reply sent.');

      if (mode === 'inbox') {
        await fetchInbox(null);
        // refresh thread
        if (isThreadContactMessage) {
          const res = await api.adminContactHistories({ contactMessageId: resolveId(selected) });
          const docs = res?.data ?? res?.docs ?? [];
          setThreadItems(docs.sort((a, b) => new Date(a.createdAt || 0) - new Date(b.createdAt || 0)));
        }
      } else if (resolvedUser) {
        await fetchUserContacts(resolvedUser._id || resolvedUser.id, null);
      }
    } catch (err) {
      showToast(err.message || 'Failed to send reply.');
    } finally {
      setSending(false);
    }
  };

  // ── CSR-initiated compose (user mode only) ────────────────────────────────

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
      await fetchUserContacts(resolvedUser._id || resolvedUser.id, null);
    } catch (err) {
      showToast(err.message || 'Failed to send email.');
    } finally {
      setSending(false);
    }
  };

  const handleClearUser = () => {
    setMode('inbox');
    setResolvedUser(null);
    setAllItems([]);
    setSearchInput('');
    setSearchError('');
    setSelectedId(null);
    setComposing(false);
    setFilterDir('all');
  };

  const handleAssignToMe = async () => {
    if (!selected || !isContactMessage(selected.type)) return;
    try {
      await api.adminSetContactActor({
        contactMessageId: resolveId(selected),
        currentRevisionId: selected.currentRevisionId,
      });
      showToast('Assigned to you.');
      await fetchInbox(null);
    } catch (err) {
      showToast(err.message || 'Failed to assign.');
    }
  };

  const beginEditTags = () => {
    if (!selected) return;
    const existing = Array.isArray(selected.index) ? selected.index : [];
    setTagDraft(existing.join(', '));
    setEditingTags(true);
  };

  const handleSaveTags = async () => {
    if (!selected || !isContactMessage(selected.type)) return;
    setSavingTags(true);
    try {
      const tags = tagDraft
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean);
      await api.adminSetContactTags({
        contactMessageId: resolveId(selected),
        tags,
      });
      showToast('Tags updated.');
      setEditingTags(false);
      await fetchInbox(null);
    } catch (err) {
      showToast(err.message || 'Failed to save tags.');
    } finally {
      setSavingTags(false);
    }
  };

  const userName = resolvedUser
    ? (`${resolvedUser.firstName || ''} ${resolvedUser.lastName || ''}`.trim() || resolvedUser.email || '')
    : '';

  const filterOptions = mode === 'inbox'
    ? [
        { value: 'all', label: 'All Messages' },
        { value: 'member', label: 'Members only' },
        { value: 'nonmember', label: 'Non-members only' },
      ]
    : [
        { value: 'all', label: 'All Messages' },
        { value: 'outbound', label: 'Outbound (CSR Mail)' },
        { value: 'inbound', label: 'Inbound (User Replies)' },
      ];

  return (
    <main className={styles.page}>
      {toast && <div className={styles.toast}>{toast}</div>}

      <div className={styles.pageHeader}>
        <div>
          <h1 className={styles.title}>Email Tickets</h1>
          <p className={styles.subtitle}>
            {mode === 'inbox'
              ? 'All contact messages — members and non-members, newest first.'
              : 'CSR mail threads and customer correspondence.'}
          </p>
        </div>
        {mode === 'user' && resolvedUser && (
          <button className={styles.composeBtn} onClick={() => setComposing(!composing)}>
            + New Email
          </button>
        )}
      </div>

      {/* User search — always visible; submitting switches to user mode */}
      <form className={styles.searchForm} onSubmit={handleUserSearch}>
        <input
          className={styles.searchInput}
          type="text"
          placeholder="Search a customer by email to view their threads..."
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
        />
        <button className={styles.searchBtn} type="submit" disabled={searching}>
          {searching ? 'Searching...' : 'Find Customer'}
        </button>
        {mode === 'user' && (
          <button type="button" className={styles.clearBtn} onClick={handleClearUser}>Back to Inbox</button>
        )}
      </form>

      {searchError && <div className={styles.errorBox}>{searchError}</div>}

      {mode === 'user' && resolvedUser && (
        <div className={styles.userBanner}>
          <div>
            <strong>{userName}</strong>
            <span className={styles.userEmail}>{resolvedUser.email}</span>
          </div>
          <span className={styles.mailCount}>{listItems.length} message{listItems.length !== 1 ? 's' : ''}</span>
        </div>
      )}

      {/* Compose form (user mode) */}
      {composing && mode === 'user' && resolvedUser && (
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

      {/* Loading */}
      {loadingItems && allItems.length === 0 && (
        <div className={styles.loadingState}>Loading messages...</div>
      )}

      {itemsError && <div className={styles.errorBox}>{itemsError}</div>}

      {/* Empty states */}
      {mode === 'user' && resolvedUser && !loadingItems && listItems.length === 0 && allItems.length > 0 && !itemsError && (
        <div className={styles.emptyState}>
          <p className={styles.emptyIcon}>No mail threads found for this customer. Only admin notes exist.</p>
        </div>
      )}
      {mode === 'user' && resolvedUser && !loadingItems && allItems.length === 0 && !itemsError && !searching && (
        <div className={styles.emptyState}>
          <p className={styles.emptyIcon}>No contacts found for this customer.</p>
        </div>
      )}
      {mode === 'inbox' && !loadingItems && allItems.length === 0 && !itemsError && (
        <div className={styles.emptyState}>
          <p className={styles.emptyIcon}>Inbox is empty — no contact messages yet.</p>
        </div>
      )}
      {mode === 'inbox' && !loadingItems && allItems.length > 0 && listItems.length === 0 && (
        <div className={styles.emptyState}>
          <p className={styles.emptyIcon}>No tickets match the current filters.</p>
          <button
            type="button"
            className={styles.clearBtn}
            onClick={() => {
              setSearchQuery('');
              setFilterDir('all');
              setStatusFilter('all');
              setCategoryFilter('all');
              setMyAssignedOnly(false);
            }}
          >
            Clear filters
          </button>
        </div>
      )}

      {/* Inbox toolbar — visible whenever there are messages, even if the active
          filter empties the list, so CSR can clear a too-tight filter without
          losing access. */}
      {mode === 'inbox' && allItems.length > 0 && (
        <div style={{
          display: 'flex', flexWrap: 'wrap', gap: '0.5rem', alignItems: 'center',
          padding: '0.5rem 0', marginBottom: '0.5rem',
        }}>
          <input
            type="search"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search subject, sender, email, body, tags…"
            style={{
              flex: '1 1 220px', minWidth: 200,
              padding: '0.4rem 0.6rem', fontSize: '0.85rem',
              border: '1px solid #d1d5db', borderRadius: 6,
            }}
          />
          <select
            className={styles.select}
            value={filterDir}
            onChange={(e) => setFilterDir(e.target.value)}
            aria-label="Audience filter"
          >
            {filterOptions.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
          <select
            className={styles.select}
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            aria-label="Reply status"
          >
            <option value="all">All statuses</option>
            <option value="awaiting">Awaiting reply</option>
            <option value="replied">Replied</option>
          </select>
          <select
            className={styles.select}
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            aria-label="Category"
          >
            <option value="all">All categories</option>
            <option value="billing">Billing</option>
            <option value="general">General</option>
          </select>
          <label style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.85rem', color: '#374151' }}>
            <input
              type="checkbox"
              checked={myAssignedOnly}
              onChange={(e) => setMyAssignedOnly(e.target.checked)}
              disabled={!adminUserId}
            />
            My tickets
          </label>
          <span style={{ fontSize: '0.78rem', color: '#6b7280', marginLeft: 'auto' }}>
            Showing {listItems.length} of {allItems.length}
          </span>
        </div>
      )}

      {/* Two-panel layout */}
      {listItems.length > 0 && (
        <>
          {mode === 'user' && (
            <div className={styles.filterBar}>
              <select
                className={styles.select}
                value={filterDir}
                onChange={(e) => setFilterDir(e.target.value)}
              >
                {filterOptions.map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>
          )}

          <div className={styles.wrapper}>
            {/* Left: message list */}
            <div className={styles.ticketList}>
              {listItems.length === 0 && (
                <div className={styles.emptyList}>No messages match your filter.</div>
              )}
              {listItems.map((item) => {
                const id = resolveId(item);
                const isCM = isContactMessage(item.type);
                const subject = isCM ? contactMessageSubject(item) : (item.content?.subject || '(No subject)');
                const preview = isCM ? contactMessagePreview(item) : stripHtml(item.content?.message || '');
                const senderLabel = isCM
                  ? `${contactMessageSenderName(item)}${isMemberLinked(item) ? ' · Member' : ' · Non-member'}`
                  : (isCsrMail(item.type)
                      ? (item.owner ? `${item.owner.firstName || ''} ${item.owner.lastName || ''}`.trim() : 'CSR')
                      : (userName || 'Customer'));
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
                      {senderLabel}
                      {preview ? ` — ${preview.length > 60 ? preview.slice(0, 60) + '...' : preview}` : ''}
                    </div>
                  </button>
                );
              })}

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
                      <h2 className={styles.detailSubject}>
                        {isContactMessage(selected.type)
                          ? contactMessageSubject(selected)
                          : (selected.content?.subject || '(No subject)')}
                      </h2>
                      <p className={styles.detailMeta}>
                        <DirectionBadge type={selected.type} />
                        &nbsp;&nbsp;
                        {isContactMessage(selected.type) ? 'From: ' : (isCsrMail(selected.type) ? 'Sent by: ' : 'From: ')}
                        <strong>
                          {isContactMessage(selected.type)
                            ? `${contactMessageSenderName(selected)}${contactMessageSenderEmail(selected) ? ` <${contactMessageSenderEmail(selected)}>` : ''}`
                            : (isCsrMail(selected.type)
                                ? (selected.owner ? `${selected.owner.firstName || ''} ${selected.owner.lastName || ''}`.trim() : 'CSR')
                                : (userName || 'Customer'))}
                        </strong>
                        &nbsp;&middot;&nbsp;
                        {formatDate(selected.createdAt)}
                      </p>
                    </div>
                    <div className={styles.statusControls}>
                      {selected.content?.category && (
                        <span className={`${styles.badge} ${styles.badgeStatus}`}>{selected.content.category}</span>
                      )}
                      {isContactMessage(selected.type) && !selected.content?.actorId && (
                        <button type="button" className={styles.clearBtn} onClick={handleAssignToMe}>
                          Assign to me
                        </button>
                      )}
                      {isContactMessage(selected.type) && selected.content?.actorId === adminUserId && (
                        <span className={`${styles.badge} ${styles.badgeStatus}`} style={{ background: '#dbeafe', color: '#1e40af' }}>
                          Assigned to you
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Tags row — visible for contactMessages only. Edit-in-place
                      via csrSetContactTags; tags appear on the message.index. */}
                  {isContactMessage(selected.type) && (
                    <div style={{
                      display: 'flex', alignItems: 'center', gap: '0.5rem',
                      padding: '0.5rem 0', marginBottom: '0.5rem', flexWrap: 'wrap',
                      borderBottom: '1px solid #e5e7eb',
                    }}>
                      <span style={{ fontSize: '0.78rem', color: '#6b7280', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                        Tags
                      </span>
                      {!editingTags ? (
                        <>
                          {(selected.index || []).length === 0 ? (
                            <span style={{ fontSize: '0.82rem', color: '#9ca3af' }}>(none)</span>
                          ) : (
                            (selected.index || []).map((t) => (
                              <span key={t} style={{
                                fontSize: '0.75rem', fontWeight: 600,
                                background: '#f3f4f6', color: '#374151',
                                padding: '0.15rem 0.5rem', borderRadius: 12,
                              }}>{t}</span>
                            ))
                          )}
                          <button type="button" className={styles.clearBtn} onClick={beginEditTags}>
                            {(selected.index || []).length === 0 ? 'Add tags' : 'Edit'}
                          </button>
                        </>
                      ) : (
                        <>
                          <input
                            type="text"
                            value={tagDraft}
                            onChange={(e) => setTagDraft(e.target.value)}
                            placeholder="comma, separated, tags"
                            style={{
                              flex: '1 1 220px',
                              padding: '0.35rem 0.55rem', fontSize: '0.85rem',
                              border: '1px solid #d1d5db', borderRadius: 4,
                            }}
                            disabled={savingTags}
                          />
                          <button type="button" className={styles.replyBtn} onClick={handleSaveTags} disabled={savingTags}>
                            {savingTags ? 'Saving…' : 'Save tags'}
                          </button>
                          <button type="button" className={styles.cancelBtn} onClick={() => setEditingTags(false)} disabled={savingTags}>
                            Cancel
                          </button>
                        </>
                      )}
                    </div>
                  )}

                  {/* Thread or single message body */}
                  <div className={styles.thread}>
                    {isContactMessage(selected.type) && loadingThread && (
                      <div className={styles.loadingState}>Loading thread...</div>
                    )}
                    {isContactMessage(selected.type) && !loadingThread && threadItems.length > 0 ? (
                      threadItems.map((msg) => {
                        const msgId = resolveId(msg);
                        const agent = isCsrMail(msg.type) || isCsrReply(msg.type);
                        const body = agent
                          ? (msg.content?.message || '')
                          : (msg.content?.input?.description || msg.content?.input?.message || msg.content?.message || JSON.stringify(msg.content?.input || {}, null, 2));
                        const contentType = msg.content?.contentType;
                        return (
                          <div key={msgId} className={`${styles.message} ${agent ? styles.messageAgent : styles.messageCustomer}`}>
                            <div className={styles.msgHeader}>
                              <DirectionBadge type={msg.type} />
                              <span style={{ marginLeft: 8 }}>{formatDate(msg.createdAt)}</span>
                            </div>
                            <div className={styles.msgBody}>
                              {contentType === 'text/html'
                                ? <div dangerouslySetInnerHTML={{ __html: body }} />
                                : <pre style={{ margin: 0, whiteSpace: 'pre-wrap', fontFamily: 'inherit' }}>{body}</pre>}
                            </div>
                          </div>
                        );
                      })
                    ) : !isContactMessage(selected.type) ? (
                      <div className={`${styles.message} ${isCsrMail(selected.type) ? styles.messageAgent : styles.messageCustomer}`}>
                        <div className={styles.msgBody}>
                          {selected.content?.contentType === 'html' || selected.content?.contentType === 'text/html'
                            ? <div dangerouslySetInnerHTML={{ __html: selected.content.message }} />
                            : <p style={{ margin: 0 }}>{selected.content?.message || '(Empty message)'}</p>
                          }
                        </div>
                      </div>
                    ) : null}
                  </div>

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

                  {/* Reply form — works for both contactMessage (inbox) and userContact (user mode) */}
                  {(isContactMessage(selected.type) || (mode === 'user' && resolvedUser)) && (
                    <form className={styles.replyForm} onSubmit={handleReply}>
                      <input
                        className={styles.composeInput}
                        type="text"
                        placeholder={`Re: ${isContactMessage(selected.type) ? contactMessageSubject(selected) : (selected.content?.subject || '')}`}
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
                  )}
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
