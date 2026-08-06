import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import api from '../../api';
import { useAuth } from '../../context/AuthContext';
import { useTicketSenderUsers, useTicketCallerUsers, ticketCallerPhone } from '../../hooks/useTicketSenderUsers';
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

// Caller ID (ANI) for voicemail/live-call contactMessages. Kwan (BC, 2026-07-03)
// confirmed the caller phone IS in the API response; BC hasn't named the exact
// field, so we read the likely telephony paths in priority order. Returns '' if
// none present (renders nothing, as before). Tighten to the confirmed path once
// bc-iife-investigator captures a live voicemail payload.
function contactMessageCallerPhone(item) {
  const c = item?.content || {};
  const d = c?.data || item?.data || {};
  const cands = [
    // Confirmed against BC's own live-call sample (Api v3.csv): raw ANI in
    // data.calleridnum (Asterisk CALLERID(num)), parsed dup in content.input.phone.
    d.calleridnum, c?.input?.phone,
    // Defensive fallbacks for the brandId:'unknown' voicemail shape (ASK E — not
    // yet confirmed; those rendered blank on prod).
    d.phone, d.ani, d.callerId, d.from, d.number, d?.trackingIds?.phone,
  ];
  const raw = cands.find((v) => v != null && String(v).trim() !== '');
  return raw ? String(raw).trim() : '';
}

// A voicemail/live-call message (telephony backend). Used to decide whether to
// surface caller ID and to label the sender.
function isVoiceMessage(item) {
  const d = item?.content?.data || item?.data || {};
  if (d.liveCallId != null) return true;
  const subj = (item?.content?.subject || '').toLowerCase();
  return /voice ?mail|live ?call/.test(subj);
}

// Format a raw phone (digits) as (NNN) NNN-NNNN when it's a US 10-digit number.
function formatPhone(raw) {
  const d = String(raw || '').replace(/\D/g, '');
  const n = d.length === 11 && d[0] === '1' ? d.slice(1) : d;
  return n.length === 10 ? `(${n.slice(0, 3)}) ${n.slice(3, 6)}-${n.slice(6)}` : String(raw || '');
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
  const [searchParams] = useSearchParams();

  // Mode: 'inbox' (all contactMessages) or 'user' (per-user search view)
  const [mode, setMode] = useState('inbox');

  // Inbox-mode filters (combined with the existing filterDir)
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all'); // 'all' | 'awaiting' | 'replied'
  const [categoryFilter, setCategoryFilter] = useState('all'); // 'all' | 'billing' | 'general'
  // Resolution filter — defaults to 'open' so resolved threads drop out of the
  // queue. BC has no native status field on contactMessage; we use a reserved
  // 'resolved' tag (csrSetContactTags) as the marker.
  const [resolutionFilter, setResolutionFilter] = useState('open'); // 'open' | 'resolved' | 'all'
  const [resolving, setResolving] = useState(false);
  const [myAssignedOnly, setMyAssignedOnly] = useState(false);

  // Tag editor (per-thread)
  const [editingTags, setEditingTags] = useState(false);
  const [tagDraft, setTagDraft] = useState('');
  const [savingTags, setSavingTags] = useState(false);

  // Bulk-select (inbox mode only)
  const [selectedIds, setSelectedIds] = useState(() => new Set());
  const [bulkBusy, setBulkBusy] = useState(false);

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
  const [threadError, setThreadError] = useState('');
  const [threadReload, setThreadReload] = useState(0);
  // Set when a SECONDARY message source (the role-gated userContact collection) is
  // denied/fails while the primary (contactMessages) loads — so the UI shows a degraded
  // banner instead of a misleading "no messages" empty state.
  const [sourceWarning, setSourceWarning] = useState('');

  // Selection & compose. Initial value honors a `?contactMessageId=…` URL
  // param so deep-links (e.g. from UserDetailPage's Notes tab) open the
  // intended ticket. Effect runs once on mount; thereafter user selection
  // owns the state.
  const [selectedId, setSelectedId] = useState(() => searchParams.get('contactMessageId') || null);
  useEffect(() => {
    if (searchParams.get('contactMessageId')) setMode('inbox');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
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
      // Unified inbox: contactMessage docs (PRIMARY) + userContact docs (SECONDARY,
      // currently role-gated at BC). Fetch independently (allSettled) so: a failed
      // PRIMARY fetch surfaces a real error, while a denied SECONDARY fetch degrades
      // to a banner instead of faking an empty inbox.
      setSourceWarning('');
      const [cmR, ucR] = await Promise.allSettled([
        api.adminFindContactMessages(params),
        api.adminFindAllUserContacts({}),
      ]);
      if (cmR.status === 'rejected') throw (cmR.reason || new Error('Failed to load messages.'));
      const cmRes = cmR.value;
      if (ucR.status === 'rejected') {
        setSourceWarning('CSR-mail threads couldn’t be loaded (access denied) — showing contact tickets only.');
      }
      const ucRes = ucR.status === 'fulfilled' ? ucR.value : { data: [] };
      const cmDocs = cmRes?.data ?? cmRes?.docs ?? (Array.isArray(cmRes) ? cmRes : []);
      const ucDocsRaw = ucRes?.data ?? ucRes?.docs ?? (Array.isArray(ucRes) ? ucRes : []);
      // Inbox view: only inbound member messages (userContact) and outbound
      // CSR mail (userContactCsrMail). Internal admin notes are hidden — they
      // belong on the user-detail page, not in the support queue.
      const ucDocs = ucDocsRaw.filter((d) => {
        const t = (d?.type || '').toLowerCase();
        return t === 'usercontact' || t === 'usercontactcsrmail';
      });

      const merged = [...cmDocs, ...ucDocs].sort(
        (a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0)
      );

      const last = cmDocs.length > 0 ? resolveId(cmDocs[cmDocs.length - 1]) : null;
      if (cursorId) {
        setAllItems((prev) => [...prev, ...merged]);
      } else {
        // Cap to a focused first-page view.
        setAllItems(merged.slice(0, 20));
      }
      setLastId(last);
      // Stop paginating once contactMessages are exhausted; userContact docs
      // on the first page are always present.
      setNoMoreDocs(cmRes?.noMoreDocs ?? cmDocs.length === 0);
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
  // Reserved tag — BC has no native status field on contactMessage, so we
  // mark resolution via index/tags. csrSetContactTags persists across devices
  // and is durable in BC's audit trail.
  const RESOLVED_TAG = 'resolved';
  const isResolved = (item) => Array.isArray(item?.index) && item.index.includes(RESOLVED_TAG);

  // Resolve sender emails → user accounts (drives member status, the customer-detail
  // link, AND the member/non-member filter). Resolved from allItems — NOT the filtered
  // listItems — so the filter can read it without a dependency cycle.
  const senderUsers = useTicketSenderUsers(allItems);
  // Voicemail tickets have no email — resolve the customer by caller phone (item 13).
  const callerUsers = useTicketCallerUsers(allItems);
  // True if a ticket maps to a registered account. Resolved object = member, null =
  // non-member; while the lookup is pending (undefined) fall back to the targetUserId hint.
  const memberStatus = (item) => {
    const email = isContactMessage(item.type) ? contactMessageSenderEmail(item).toLowerCase().trim() : '';
    const entry = email ? senderUsers[email] : undefined;
    return entry === undefined ? isMemberLinked(item) : !!entry;
  };

  const listItems = useMemo(() => {
    if (mode === 'user') {
      // A member's messages live in contactMessage (linked by targetUserId), alongside
      // any userContact-collection mail/replies — include both so user-mode isn't empty.
      const items = allItems.filter((item) => isMailThread(item.type) || isContactMessage(item.type));
      if (filterDir === 'outbound') return items.filter((item) => isCsrMail(item.type));
      if (filterDir === 'inbound') return items.filter((item) => isUserContact(item.type) || isContactMessage(item.type));
      return items;
    }
    // Inbox mode — combine all five filters.
    let items = allItems;
    if (filterDir === 'member')    items = items.filter(memberStatus);
    if (filterDir === 'nonmember') items = items.filter((i) => !memberStatus(i));
    if (statusFilter === 'awaiting') items = items.filter((i) => !hasReply(i));
    if (statusFilter === 'replied')  items = items.filter(hasReply);
    if (categoryFilter !== 'all')   items = items.filter((i) => itemCategory(i) === categoryFilter);
    if (resolutionFilter === 'open')      items = items.filter((i) => !isResolved(i));
    if (resolutionFilter === 'resolved')  items = items.filter(isResolved);
    if (myAssignedOnly)             items = items.filter((i) => isAssignedTo(i, adminUserId));
    if (searchQuery.trim())         items = items.filter((i) => matchesSearch(i, searchQuery.trim()));
    return items;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allItems, filterDir, mode, statusFilter, categoryFilter, resolutionFilter, myAssignedOnly, searchQuery, adminUserId, senderUsers]);

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
      setThreadError('');
      try {
        const res = await api.adminContactHistories({ contactMessageId: resolveId(selected) });
        if (cancelled) return;
        const docs = res?.data ?? res?.docs ?? [];
        setThreadItems(docs.sort((a, b) => new Date(a.createdAt || 0) - new Date(b.createdAt || 0)));
      } catch (err) {
        // Persistent inline error (not just a transient toast) so the thread region
        // doesn't go silently blank with a reply box and no message above it.
        if (!cancelled) { setThreadItems([]); setThreadError(err.message || 'Failed to load thread history.'); }
      } finally {
        if (!cancelled) setLoadingThread(false);
      }
    })();
    return () => { cancelled = true; };
  }, [selected, mode, threadReload]);

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
      await fetchUserContacts(user._id || user.id, null, user.email);
    } catch (err) {
      setSearchError(err.message || 'Failed to find user.');
    } finally {
      setSearching(false);
    }
  };

  const fetchUserContacts = async (userId, cursorId, userEmail = resolvedUser?.email) => {
    setLoadingItems(true);
    setItemsError('');
    try {
      // Mirror fetchInbox: a member's correspondence lives in contactMessage (linked by
      // targetUserId) — fetch that WORKING per-user source (same call the user-detail
      // "Contact tickets" section uses, with an email-merge). ALSO try the userContact
      // collection (notes / CSR mail); it 403s for the CSR role today (BC ask —
      // BC_CSR_LIB_METHOD_LIVE_EVIDENCE.md §2), so tolerate failure and merge whatever
      // it returns. Additive: picks up userContact for free if BC opens that collection.
      const [cmRes, ucRes] = await Promise.all([
        api.adminFindUserContactMessages({ userId, userEmail }).catch(() => ({ docs: [] })),
        api.adminFindUserContacts({ userId, ...(cursorId ? { lastId: cursorId } : {}) }).catch(() => ({ data: [] })),
      ]);
      const cmDocs = cmRes?.docs ?? cmRes?.data ?? (Array.isArray(cmRes) ? cmRes : []);
      const ucDocs = ucRes?.data ?? ucRes?.docs ?? (Array.isArray(ucRes) ? ucRes : []);
      const byId = new Map();
      [...cmDocs, ...ucDocs].forEach((d) => { const k = d._id || d.id; byId.set(k || byId.size, d); });
      const all = [...byId.values()]
        .sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
      if (cursorId) {
        setAllItems((prev) => [...prev, ...all]);
      } else {
        setAllItems(all);
      }
      setLastId(all.length > 0 ? resolveId(all[all.length - 1]) : null);
      // The per-user contactMessage finder returns all matches in one pass, so there's
      // no further page to fetch.
      setNoMoreDocs(true);
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
      } else {
        // Reply to a userContact doc — works in both inbox mode (selected
        // doc carries its own targetUserId) and user mode (resolvedUser).
        const targetUserId =
          selected?.content?.targetUserId ||
          selected?.targetUserId ||
          resolvedUser?._id ||
          resolvedUser?.id;
        if (!targetUserId) throw new Error('No target user for reply');
        await api.adminCreateCsrMail({
          targetUserId,
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

  // Build the consumer paste-link format for a contactMessage thread. BC's
  // CSR find response includes the per-thread `hash` on contactMessage docs
  // (csrApi.csv:413), so we can construct the same value a reply email would
  // surface. Tester pastes this into the consumer Account → Messages
  // "Have a reply link?" box to bind the thread without email round-trip.
  const buildPasteLink = (item) => {
    const id = resolveId(item);
    const hash = item?.hash;
    if (!id || !hash) return null;
    return `${id}:${hash}`;
  };

  const handleCopyPasteLink = async (item, ev) => {
    if (ev && typeof ev.stopPropagation === 'function') ev.stopPropagation();
    const value = buildPasteLink(item);
    if (!value) { showToast('No hash on this thread — cannot build paste-link.'); return; }
    try {
      await navigator.clipboard.writeText(value);
      showToast('Paste-link copied. Paste into consumer Messages → Have a reply link.');
    } catch {
      // Older browsers / non-secure contexts — prompt() as a manual fallback.
      window.prompt('Copy this paste-link (id:hash):', value);
    }
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

  // Reset selection when leaving inbox mode or when search/filter changes the list.
  useEffect(() => {
    if (mode !== 'inbox') setSelectedIds(new Set());
  }, [mode]);

  const toggleSelected = (id) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const selectAllVisible = () => {
    setSelectedIds(new Set(listItems.filter((i) => isContactMessage(i.type)).map(resolveId).filter(Boolean)));
  };

  const clearSelection = () => setSelectedIds(new Set());

  const handleBulkAssignToMe = async () => {
    if (!adminUserId || selectedIds.size === 0) return;
    setBulkBusy(true);
    let ok = 0, fail = 0;
    // Always start from the loaded list to read currentRevisionId.
    const targets = allItems.filter((i) => selectedIds.has(resolveId(i)) && isContactMessage(i.type));
    for (const t of targets) {
      try {
        await api.adminSetContactActor({
          contactMessageId: resolveId(t),
          currentRevisionId: t.currentRevisionId,
          actorId: adminUserId,
        });
        ok++;
      } catch {
        fail++;
      }
    }
    setBulkBusy(false);
    showToast(fail === 0 ? `Assigned ${ok} ticket${ok === 1 ? '' : 's'} to you.` : `${ok} assigned, ${fail} failed.`);
    clearSelection();
    await fetchInbox(null);
  };

  const handleBulkApplyTag = async () => {
    if (selectedIds.size === 0) return;
    const raw = window.prompt('Apply tag to selected tickets (existing tags are preserved):');
    if (raw == null) return;
    const tag = raw.trim();
    if (!tag) return;
    setBulkBusy(true);
    let ok = 0, fail = 0;
    const targets = allItems.filter((i) => selectedIds.has(resolveId(i)) && isContactMessage(i.type));
    for (const t of targets) {
      try {
        const existing = Array.isArray(t.index) ? t.index : [];
        const merged = existing.includes(tag) ? existing : [...existing, tag];
        await api.adminSetContactTags({
          contactMessageId: resolveId(t),
          tags: merged,
        });
        ok++;
      } catch {
        fail++;
      }
    }
    setBulkBusy(false);
    showToast(fail === 0 ? `Tagged ${ok} ticket${ok === 1 ? '' : 's'} with "${tag}".` : `${ok} tagged, ${fail} failed.`);
    clearSelection();
    await fetchInbox(null);
  };

  const beginEditTags = () => {
    if (!selected) return;
    const existing = Array.isArray(selected.index) ? selected.index : [];
    setTagDraft(existing.join(', '));
    setEditingTags(true);
  };

  const handleToggleResolved = async () => {
    if (!selected || !isContactMessage(selected.type)) return;
    setResolving(true);
    try {
      const existing = Array.isArray(selected.index) ? selected.index : [];
      const next = isResolved(selected)
        ? existing.filter((t) => t !== RESOLVED_TAG)
        : (existing.includes(RESOLVED_TAG) ? existing : [...existing, RESOLVED_TAG]);
      await api.adminSetContactTags({
        contactMessageId: resolveId(selected),
        tags: next,
      });
      showToast(isResolved(selected) ? 'Ticket reopened.' : 'Ticket marked resolved.');
      await fetchInbox(null);
    } catch (err) {
      showToast(err.message || 'Failed to update ticket.');
    } finally {
      setResolving(false);
    }
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
      {sourceWarning && !itemsError && (
        <div role="status" style={{ margin: '0 0 0.75rem', padding: '0.6rem 0.9rem', background: '#fffbeb', border: '1px solid #f59e0b', borderRadius: '0.5rem', color: '#92400e', fontSize: '0.85rem' }}>
          ⚠ {sourceWarning}
        </div>
      )}

      {/* Empty states */}
      {mode === 'user' && resolvedUser && !loadingItems && listItems.length === 0 && allItems.length > 0 && !itemsError && (
        <div className={styles.emptyState}>
          <p className={styles.emptyIcon}>No mail threads found for this customer.{sourceWarning ? ' (Some sources couldn’t be loaded — see notice above.)' : ''}</p>
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
              setResolutionFilter('all');
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
            value={resolutionFilter}
            onChange={(e) => setResolutionFilter(e.target.value)}
            aria-label="Resolution"
          >
            <option value="open">Open</option>
            <option value="resolved">Resolved</option>
            <option value="all">Open + Resolved</option>
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

      {/* Bulk action bar — visible when at least one ticket is selected */}
      {mode === 'inbox' && selectedIds.size > 0 && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap',
          padding: '0.5rem 0.75rem',
          background: '#0d5d2f', color: '#fff',
          borderRadius: 6, marginBottom: '0.5rem',
          position: 'sticky', top: 0, zIndex: 5,
        }}>
          <span style={{ fontWeight: 600, fontSize: '0.85rem' }}>
            {selectedIds.size} selected
          </span>
          <button
            type="button"
            onClick={handleBulkAssignToMe}
            disabled={bulkBusy || !adminUserId}
            style={{
              background: '#fff', color: '#0d5d2f', border: 'none',
              padding: '0.3rem 0.7rem', borderRadius: 4,
              fontSize: '0.82rem', fontWeight: 600, cursor: bulkBusy ? 'wait' : 'pointer',
            }}
          >
            {bulkBusy ? 'Working…' : 'Assign to me'}
          </button>
          <button
            type="button"
            onClick={handleBulkApplyTag}
            disabled={bulkBusy}
            style={{
              background: '#fff', color: '#0d5d2f', border: 'none',
              padding: '0.3rem 0.7rem', borderRadius: 4,
              fontSize: '0.82rem', fontWeight: 600, cursor: bulkBusy ? 'wait' : 'pointer',
            }}
          >
            Apply tag…
          </button>
          <button
            type="button"
            onClick={selectAllVisible}
            disabled={bulkBusy}
            style={{
              background: 'transparent', color: '#fff', border: '1px solid rgba(255,255,255,0.5)',
              padding: '0.3rem 0.7rem', borderRadius: 4,
              fontSize: '0.82rem', fontWeight: 600, cursor: bulkBusy ? 'wait' : 'pointer',
            }}
          >
            Select all visible
          </button>
          <button
            type="button"
            onClick={clearSelection}
            disabled={bulkBusy}
            style={{
              background: 'transparent', color: '#fff', border: '1px solid rgba(255,255,255,0.5)',
              padding: '0.3rem 0.7rem', borderRadius: 4,
              fontSize: '0.82rem', fontWeight: 600, cursor: bulkBusy ? 'wait' : 'pointer',
              marginLeft: 'auto',
            }}
          >
            Clear
          </button>
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
                // Resolve sender email → account: object = member, null = non-member,
                // undefined = lookup pending. Falls back to the targetUserId hint while pending.
                const senderEmail = isCM ? contactMessageSenderEmail(item) : '';
                const member = senderEmail ? senderUsers?.[senderEmail.toLowerCase()] : null;
                const memberSuffix = member
                  ? (member.isSubscriber ? ' · Subscriber' : ' · Member')
                  : (member === null
                      ? (isMemberLinked(item) ? ' · Member' : ' · Non-member')
                      : '');
                // Voicemail rows read "No Name / Non-member" — surface the caller
                // phone inline so a CSR can identify/return the call from the list.
                const callerPhone = isCM ? contactMessageCallerPhone(item) : '';
                // If the caller phone matches a customer, link straight to them
                // (voicemails carry no email, so this is the only join — item 13).
                const callerDigits = isCM ? ticketCallerPhone(item) : '';
                const callerMember = callerDigits ? callerUsers?.[callerDigits] : null;
                const linkedMember = member || callerMember;
                const senderLabel = isCM
                  ? `${callerPhone ? formatPhone(callerPhone) : contactMessageSenderName(item)}${memberSuffix}`
                  : (isCsrMail(item.type)
                      ? (item.owner ? `${item.owner.firstName || ''} ${item.owner.lastName || ''}`.trim() : 'CSR')
                      : (userName || 'Customer'));
                const showCheckbox = mode === 'inbox' && isCM;
                const checked = selectedIds.has(id);
                return (
                  <div
                    key={id}
                    style={{ display: 'flex', alignItems: 'stretch', gap: 0, flexWrap: 'wrap' }}
                  >
                    {showCheckbox && (
                      <label
                        onClick={(e) => e.stopPropagation()}
                        style={{
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          padding: '0 0.5rem',
                          background: checked ? '#f0fdf4' : '#fff',
                          borderTop: '1px solid #e5e7eb',
                          borderLeft: '1px solid #e5e7eb',
                          borderBottom: '1px solid #e5e7eb',
                          cursor: 'pointer',
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggleSelected(id)}
                          aria-label={`Select ticket: ${subject}`}
                        />
                      </label>
                    )}
                    <button
                      className={`${styles.ticketItem} ${id === selectedId ? styles.ticketItemActive : ''}`}
                      onClick={() => setSelectedId(id)}
                      style={{ flex: 1 }}
                    >
                      <div className={styles.ticketItemTop}>
                        <DirectionBadge type={item.type} />
                        {isResolved(item) && (
                          <span
                            className={styles.badge}
                            style={{ background: '#dcfce7', color: '#166534', marginLeft: 4 }}
                          >
                            Resolved
                          </span>
                        )}
                        <span className={styles.ticketDate}>{shortDate(item.createdAt)}</span>
                      </div>
                      <div className={styles.ticketSubject}>{subject}</div>
                      <div className={styles.ticketMeta}>
                        {senderLabel}
                        {preview ? ` — ${preview.length > 60 ? preview.slice(0, 60) + '...' : preview}` : ''}
                      </div>
                    </button>
                    {linkedMember && (
                      <Link
                        to={`/users/${linkedMember.userId}${senderEmail ? `?email=${encodeURIComponent(senderEmail)}` : ''}`}
                        title="Open customer detail"
                        onClick={(e) => e.stopPropagation()}
                        style={{
                          flexBasis: '100%', display: 'block',
                          padding: '0.3rem 0.75rem', background: '#f0fdf4',
                          borderLeft: '1px solid #e5e7eb', borderRight: '1px solid #e5e7eb', borderBottom: '1px solid #e5e7eb',
                          color: '#0d5d2f', fontWeight: 600, fontSize: '0.78rem', textDecoration: 'none',
                        }}
                      >
                        {member ? 'View customer profile' : 'Caller matches a customer — view profile'}&nbsp;→
                      </Link>
                    )}
                  </div>
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
                        {/* Caller ID for voicemail/live-call tickets (BC now returns it). */}
                        {isContactMessage(selected.type) && contactMessageCallerPhone(selected) && (
                          <>
                            &nbsp;&middot;&nbsp;
                            📞 <a href={`tel:${contactMessageCallerPhone(selected)}`}>{formatPhone(contactMessageCallerPhone(selected))}</a>
                          </>
                        )}
                        &nbsp;&middot;&nbsp;
                        {formatDate(selected.createdAt)}
                      </p>
                      {/* Caller matched to a customer by phone → jump to their profile. */}
                      {isContactMessage(selected.type) && (() => {
                        const cd = ticketCallerPhone(selected);
                        const cm = cd ? callerUsers?.[cd] : null;
                        return cm ? (
                          <p className={styles.detailMeta} style={{ marginTop: 4 }}>
                            <Link to={`/users/${cm.userId}`} style={{ color: '#0d5d2f', fontWeight: 600 }}>
                              Caller matches a customer — view profile&nbsp;→
                            </Link>
                          </p>
                        ) : null;
                      })()}
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
                      {isContactMessage(selected.type) && (
                        <button
                          type="button"
                          className={styles.clearBtn}
                          onClick={handleToggleResolved}
                          disabled={resolving}
                          style={isResolved(selected)
                            ? { background: '#dcfce7', color: '#166534', borderColor: '#86efac' }
                            : undefined}
                        >
                          {resolving
                            ? 'Working…'
                            : isResolved(selected) ? 'Reopen' : 'Mark resolved'}
                        </button>
                      )}
                      {isContactMessage(selected.type) && selected?.hash && (
                        <button
                          type="button"
                          className={styles.clearBtn}
                          onClick={(e) => handleCopyPasteLink(selected, e)}
                          title="Copy contactMessageId:hash so a tester can bind this thread on the consumer Messages tab without email"
                        >
                          Copy paste-link
                        </button>
                      )}
                      {isContactMessage(selected.type) && isResolved(selected) && (
                        <span className={`${styles.badge} ${styles.badgeStatus}`} style={{ background: '#dcfce7', color: '#166534' }}>
                          Resolved
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
                    {isContactMessage(selected.type) && !loadingThread && threadError && (
                      <div role="alert" style={{ padding: '0.75rem 1rem', background: '#fef2f2', border: '1px solid #fca5a5', borderRadius: '0.5rem', color: '#991b1b', fontSize: '0.85rem' }}>
                        Couldn’t load this thread: {threadError}{' '}
                        <button type="button" onClick={() => setThreadReload((n) => n + 1)} style={{ marginLeft: 8, textDecoration: 'underline', background: 'none', border: 'none', color: '#991b1b', cursor: 'pointer', font: 'inherit' }}>Retry</button>
                      </div>
                    )}
                    {isContactMessage(selected.type) && !loadingThread && !threadError && threadItems.length > 0 ? (
                      threadItems.map((msg) => {
                        const msgId = resolveId(msg);
                        const agent = isCsrMail(msg.type) || isCsrReply(msg.type);
                        const contentType = msg.content?.contentType;
                        const rawBody = agent
                          ? (msg.content?.message || '')
                          // Never JSON.stringify the body — that leaked the NOORDERID sentinel
                          // and internal fields to the CSR. Fall back to a plain placeholder.
                          : (msg.content?.input?.description || msg.content?.input?.message || msg.content?.message || '');
                        // XSS-safe: customer/CSR message bodies are rendered as TEXT via JSX
                        // (auto-escaped); HTML bodies are tag-stripped to stay readable. No
                        // dangerouslySetInnerHTML on un-sanitized, partly customer-controlled content.
                        const body = ((contentType === 'text/html' || contentType === 'html') ? stripHtml(rawBody) : rawBody) || '(No message body)';
                        return (
                          <div key={msgId} className={`${styles.message} ${agent ? styles.messageAgent : styles.messageCustomer}`}>
                            <div className={styles.msgHeader}>
                              <DirectionBadge type={msg.type} />
                              <span style={{ marginLeft: 8 }}>{formatDate(msg.createdAt)}</span>
                            </div>
                            <div className={styles.msgBody}>
                              <pre style={{ margin: 0, whiteSpace: 'pre-wrap', fontFamily: 'inherit' }}>{body}</pre>
                            </div>
                          </div>
                        );
                      })
                    ) : !isContactMessage(selected.type) ? (
                      <div className={`${styles.message} ${isCsrMail(selected.type) ? styles.messageAgent : styles.messageCustomer}`}>
                        <div className={styles.msgBody}>
                          {/* XSS-safe: render as text (HTML tag-stripped), never dangerouslySetInnerHTML. */}
                          <p style={{ margin: 0, whiteSpace: 'pre-wrap' }}>
                            {(() => {
                              const ct = selected.content?.contentType;
                              const m = selected.content?.message || '';
                              return ((ct === 'html' || ct === 'text/html') ? stripHtml(m) : m) || '(Empty message)';
                            })()}
                          </p>
                        </div>
                      </div>
                    ) : null}
                  </div>

                  {selected.attachments && selected.attachments.length > 0 && (
                    <div className={styles.attachments}>
                      <p className={styles.attachmentsLabel}>Attachments ({selected.attachments.length}):</p>
                      {selected.attachments.map((att, idx) => {
                        // BC returns an attachmentId on each attachment (Find User Contact);
                        // download via api.adminDownloadAttachment → csrWrapper.api.attachment.download.
                        const attId = att.id || att.attachmentId || att._id || att.attachment_id;
                        // BC labels the file as originalname/filename (e.g. live-call
                        // recordings: "liveCall_18.aac"); name/fileName are fallbacks.
                        const label = att.originalname || att.filename || att.name || att.fileName || `Attachment ${idx + 1}`;
                        // Audio (e.g. live-call recordings) → ask BC to PLAY inline via
                        // playAudioFlag instead of forcing a download. Detect by mimetype
                        // OR file extension (the rendered object may omit mimetype).
                        const isAudio = /^audio\//.test(att.mimetype || att.mimeType || '')
                          || /\.(aac|mp3|wav|m4a|ogg|oga|opus|amr|wma)$/i.test(label);
                        return attId ? (
                          <button
                            key={idx}
                            type="button"
                            className={styles.attachmentItem}
                            style={{ cursor: 'pointer', textDecoration: 'underline', background: 'none', border: 'none', padding: 0, font: 'inherit', color: '#1a56db' }}
                            title={isAudio ? 'Play recording' : 'Download attachment'}
                            onClick={() => { api.adminDownloadAttachment(attId, { playAudioFlag: isAudio }).catch(() => {}); }}
                          >
                            {isAudio ? '▶️' : '📎'} {label}
                          </button>
                        ) : (
                          <span key={idx} className={styles.attachmentItem}>{label}</span>
                        );
                      })}
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
