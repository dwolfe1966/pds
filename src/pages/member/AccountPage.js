import React, { useEffect, useState } from 'react';
import { useNavigate, Link, useSearchParams } from 'react-router-dom';
import api from '../../api';
import { useAuth } from '../../context/AuthContext';
import { getReportList } from '../../services/reportService';
import Skeleton from '../../components/Skeleton';
import { setUser as gtmSetUser } from '../../services/gtmContext';
import { track } from '../../services/trackingService';
import styles from './AccountPage.module.css';
import { useBrand } from '../../services/brand';

// Communications / unsubscribe tab — lets a member stop marketing emails (BC
// unsubscribeMail). Texts are stopped via reply STOP (no consumer text endpoint).
function CommunicationsTab({ email }) {
  const brand = useBrand();
  const [status, setStatus] = useState('idle'); // idle | loading | done | error
  const [error, setError] = useState('');
  const unsub = async () => {
    if (!email) { setError('No email is on file for this account.'); return; }
    setError(''); setStatus('loading');
    try { await api.unsubscribeEmail(email); setStatus('done'); }
    catch (e) { setError(e?.message || 'Could not unsubscribe. Please try again, or contact support.'); setStatus('error'); }
  };
  const box = { border: '1px solid #e5e7eb', borderRadius: '0.5rem', padding: '1.1rem 1.25rem', marginBottom: '1rem' };
  return (
    <div>
      <div style={box}>
        <h3 style={{ margin: '0 0 0.35rem', fontSize: '1rem', fontWeight: 700, color: '#111827' }}>Marketing emails</h3>
        {status === 'done' ? (
          <p style={{ margin: 0, color: '#166534', fontSize: '0.9rem' }}>
            <strong>{email}</strong> has been unsubscribed from {brand.name} marketing emails. You'll
            still receive essential account messages (receipts, password resets, support replies).
          </p>
        ) : (
          <>
            <p style={{ margin: '0 0 0.75rem', color: '#374151', fontSize: '0.9rem', lineHeight: 1.5 }}>
              Stop promotional emails to <strong>{email || 'your account'}</strong>. You'll still get
              essential account and transactional messages.
            </p>
            {error && <p style={{ margin: '0 0 0.5rem', color: '#dc2626', fontSize: '0.85rem' }}>{error}</p>}
            <button type="button" onClick={unsub} disabled={status === 'loading'} style={{
              padding: '0.6rem 1rem', background: '#fff', color: '#0d5d2f', border: '1px solid #0d5d2f',
              borderRadius: '0.5rem', fontSize: '0.9rem', fontWeight: 600, cursor: status === 'loading' ? 'default' : 'pointer',
            }}>
              {status === 'loading' ? 'Unsubscribing…' : 'Unsubscribe from marketing emails'}
            </button>
          </>
        )}
      </div>
      <div style={box}>
        <h3 style={{ margin: '0 0 0.35rem', fontSize: '1rem', fontWeight: 700, color: '#111827' }}>Text messages</h3>
        <p style={{ margin: 0, color: '#374151', fontSize: '0.9rem', lineHeight: 1.5 }}>
          To stop text messages, reply <strong>STOP</strong> to any message from us. Reply
          <strong> START</strong> to opt back in.
        </p>
      </div>
    </div>
  );
}

/**
 * Unified Account page combining Profile, Security & Privacy, Subscription & Billing,
 * and Messages tabs.
 */
const AccountPage = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { token, user, setUser, subscription, isPaid, refreshSubscription } = useAuth();

  // ─── Tab state (supports ?tab=messages deep-linking) ────────────────────────
  // Default lands on Security & Privacy (first tab); Profile is the last tab.
  const validTabs = ['security', 'billing', 'messages', 'communications', 'profile'];
  const initialTab = validTabs.includes(searchParams.get('tab')) ? searchParams.get('tab') : 'security';
  const [activeTab, setActiveTab] = useState(initialTab);

  // ─── Profile tab state ───────────────────────────────────────────────────────
  // BC `user.update` accepts firstName, lastName, and phone — no zip.
  const [profile, setProfile] = useState(null);
  const [profileForm, setProfileForm] = useState({ firstName: '', lastName: '', email: '', phone: '' });
  const [profileLoading, setProfileLoading] = useState(true);
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileError, setProfileError] = useState('');
  const [profileSuccess, setProfileSuccess] = useState(false);

  // ─── Security tab state ──────────────────────────────────────────────────────
  // Privacy toggle and notification preferences are hidden until BC ships
  // matching endpoints (mock-only `PUT /privacy` and `POST /notifications`
  // were removed from the consumer surface for launch).
  const [passwordForm, setPasswordForm] = useState({ currentPassword: '', newPassword: '' });
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [passwordMessage, setPasswordMessage] = useState('');

  // ─── Subscription & Billing tab state ────────────────────────────────────────
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [cancelError, setCancelError] = useState('');
  // BC orders fed both the billing-history panel and the "Plan" display via
  // findOfferByShmName lookup (see fetchPlanName below).
  const [orders, setOrders] = useState([]);
  const [ordersLoading, setOrdersLoading] = useState(true);
  const [ordersError, setOrdersError] = useState('');
  const [planDisplayName, setPlanDisplayName] = useState('');
  const [reports, setReports] = useState([]);
  const [reportsLoading, setReportsLoading] = useState(true);
  const [reportsError, setReportsError] = useState('');
  const [lastReportId, setLastReportId] = useState(null);
  const [hasMoreReports, setHasMoreReports] = useState(false);
  const [pdfDownloadingId, setPdfDownloadingId] = useState(null);

  // ─── Messages tab state ─────────────────────────────────────────────────────
  const [messages, setMessages] = useState([]);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [messagesError, setMessagesError] = useState('');
  const [lastMessageId, setLastMessageId] = useState(null);
  const [hasMoreMessages, setHasMoreMessages] = useState(false);
  const [messagesFetched, setMessagesFetched] = useState(false);

  // ─── Compose message state ──────────────────────────────────────────────────
  const [showCompose, setShowCompose] = useState(false);
  const [composeSubject, setComposeSubject] = useState('General inquiry');
  const [composeMessage, setComposeMessage] = useState('');
  const [composeSending, setComposeSending] = useState(false);
  const [composeSuccess, setComposeSuccess] = useState(false);
  const [composeError, setComposeError] = useState('');

  // Diagnostic counts from the most recent histories walk. Visible inline so
  // we can see — without devtools — whether BC's histories endpoint is
  // returning the initial 'contact' doc or only the replies.
  const [msgDiag, setMsgDiag] = useState(null); // { threadCount, contact, csrReply, userReply, other }
  // Diag line is QA-only — visible when the URL has ?debug=1.
  const showMsgDiag = typeof window !== 'undefined' &&
    new URLSearchParams(window.location.search).get('debug') === '1';

  // ─── Fetch: profile ──────────────────────────────────────────────────────────
  // BC has no consumer GET /me equivalent — seed from the AuthContext user
  // populated at login. We still try /me as a best-effort to pick up any extra
  // fields (createdAt for "Member since"), but don't fail if it's missing.
  useEffect(() => {
    if (!token || !user) return;
    setProfileForm({
      firstName: user.firstName || '',
      lastName: user.lastName || '',
      email: user.email || '',
      phone: user.phone || '',
    });
    const fetchProfile = async () => {
      setProfileLoading(true);
      try {
        const data = await api.get('/me', { token });
        if (data) {
          setProfile(data);
          setProfileForm((prev) => ({
            firstName: data.firstName || prev.firstName,
            lastName: data.lastName || prev.lastName,
            email: data.email || prev.email,
            phone: data.phone || prev.phone,
          }));
        }
      } catch {
        // Best-effort — BC doesn't expose /me, so this fetch may 404 in prod.
        // The form is already seeded from the auth user.
      } finally {
        setProfileLoading(false);
      }
    };
    fetchProfile();
  }, [token, user]);

  // ─── Fetch: orders (billing history source of truth) ─────────────────────────
  // BC `billing.getOrders()` returns the user's full order list; each order
  // carries a `commercePayments[]` array we flatten into rows for the history
  // panel.
  useEffect(() => {
    if (!token) return;
    const fetchOrders = async () => {
      setOrdersLoading(true);
      try {
        const data = await api.getUserOrders();
        setOrders(Array.isArray(data) ? data : []);
      } catch (err) {
        setOrdersError(err.message || 'Failed to load billing history');
      } finally {
        setOrdersLoading(false);
      }
    };
    fetchOrders();
  }, [token]);

  // ─── Fetch: human-readable plan name via findByShmName ──────────────────────
  // The active subscription stores the BC offer ID; the user-visible name lives
  // on the offer record (extName / commerceProducts[].name). We currently only
  // ship one offer (comp.offer.signup.main) so the shmName is fixed.
  useEffect(() => {
    if (!token || !isPaid) return;
    let cancelled = false;
    (async () => {
      try {
        const offer = await api.findOfferByShmName({ shmName: 'comp.offer.signup.main' });
        if (cancelled) return;
        const name =
          offer?.extName ||
          offer?.commerceProducts?.[0]?.extName ||
          offer?.commerceProducts?.[0]?.name ||
          offer?.name ||
          '';
        setPlanDisplayName(name);
      } catch {
        // Non-fatal — fall back to a generic "Subscription" label in render.
      }
    })();
    return () => { cancelled = true; };
  }, [token, isPaid]);

  // ─── Fetch: reports ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (!token) return;
    fetchReports().catch((err) => {
      if (process.env.NODE_ENV === 'development') {
        console.warn('[AccountPage] fetchReports error caught in useEffect:', err);
      }
    });
  }, [token]);

  const fetchReports = async (lastId = null) => {
    if (!token) {
      setReportsLoading(false);
      setReportsError('Not authenticated');
      return;
    }
    setReportsLoading(true);
    setReportsError('');
    try {
      const result = await getReportList({ lastId, token });
      if (result && result.success) {
        if (lastId) {
          setReports((prev) => [...prev, ...(result.reports || [])]);
        } else {
          setReports(result.reports || []);
        }
        setLastReportId(result.pagination?.lastId || null);
        setHasMoreReports(result.pagination?.hasMore || false);
      } else {
        setReportsError('Failed to load reports');
      }
    } catch (err) {
      if (process.env.NODE_ENV === 'development') {
        console.warn('[AccountPage] Failed to fetch reports:', err?.message);
      }
      setReportsError(err?.message || err?.data?.error?.message || 'Failed to load reports');
    } finally {
      setReportsLoading(false);
    }
  };

  // ─── Fetch: messages (lazy — only when tab is active) ─────────────────────
  useEffect(() => {
    if (!token || activeTab !== 'messages' || messagesFetched) return;
    fetchMessages();
  }, [token, activeTab, messagesFetched]);

  // Canonical key is the lowercased email. Earlier we keyed on
  // (user.id || user._id || user.email) but BC's signup response sometimes
  // omits user.id, so writes during the post-signup session landed under
  // accountThreads:<email> while reads after the next login landed under
  // accountThreads:<bc-user-id> — different keys, message vanished.
  // Email is present in both post-signup fallback and post-login responses,
  // so it's the stable identifier.
  const emailKey = (user?.email || '').trim().toLowerCase();
  const localMessagesKey = emailKey ? `accountMessages:${emailKey}` : null;
  const localThreadsKey = emailKey ? `accountThreads:${emailKey}` : null;

  // Read with one-time migration: if data only exists under a legacy
  // (id/_id) key, fold it into the canonical email key and delete the
  // legacy entry so future reads land in the right place.
  const legacyThreadKeys = () => {
    const out = [];
    const ids = [user?.id, user?._id].filter((v) => v && v !== emailKey);
    for (const id of ids) out.push(`accountThreads:${id}`);
    return out;
  };

  const readLocalMessages = () => {
    if (!localMessagesKey) return [];
    try {
      const raw = sessionStorage.getItem(localMessagesKey);
      return raw ? JSON.parse(raw) : [];
    } catch { return []; }
  };
  const writeLocalMessages = (next) => {
    if (!localMessagesKey) return;
    try { sessionStorage.setItem(localMessagesKey, JSON.stringify(next)); }
    catch { /* storage may be unavailable — non-fatal */ }
  };
  // BC's contactMessageIds and hashes are 24-hex MongoDB ObjectId strings.
  // Anything else is junk (placeholder text from a misused DevTools snippet,
  // URL-encoded brackets, etc.) — drop it on read so a bad ref can't keep
  // hammering histories with 400s. Self-heals existing caches.
  const isValidRef = (r) =>
    r &&
    typeof r.contactMessageId === 'string' &&
    typeof r.hash === 'string' &&
    /^[a-f0-9]{24}$/i.test(r.contactMessageId) &&
    /^[a-f0-9]{24,}$/i.test(r.hash);

  const readLocalThreads = () => {
    if (!localThreadsKey) return [];
    try {
      const canonicalRaw = localStorage.getItem(localThreadsKey);
      const canonical = canonicalRaw ? JSON.parse(canonicalRaw) : [];
      const canonicalArr = Array.isArray(canonical) ? canonical : [];
      let merged = canonicalArr;
      let didMigrate = false;
      for (const k of legacyThreadKeys()) {
        const legacyRaw = localStorage.getItem(k);
        if (!legacyRaw) continue;
        try {
          const legacy = JSON.parse(legacyRaw);
          const legacyArr = Array.isArray(legacy) ? legacy : [];
          const haveIds = new Set(merged.map((r) => r?.contactMessageId).filter(Boolean));
          const additions = legacyArr.filter((r) => r?.contactMessageId && !haveIds.has(r.contactMessageId));
          if (additions.length > 0) {
            merged = [...additions, ...merged].slice(0, 100);
            didMigrate = true;
          }
          localStorage.removeItem(k);
        } catch {
          // Bad legacy data — drop it.
          localStorage.removeItem(k);
        }
      }
      const cleaned = merged.filter(isValidRef);
      if (didMigrate || cleaned.length !== merged.length) {
        try { localStorage.setItem(localThreadsKey, JSON.stringify(cleaned)); } catch { /* non-fatal */ }
      }
      return cleaned;
    } catch { return []; }
  };
  const writeLocalThreads = (next) => {
    if (!localThreadsKey) return;
    try { localStorage.setItem(localThreadsKey, JSON.stringify(next)); }
    catch { /* storage may be unavailable — non-fatal */ }
  };

  // Two-stage fetch:
  //  1. Enumerate via BC's getUserContacts (added 2026-05-28) — returns every
  //     contactMessage thread where the user is the targetUserId (own
  //     submissions + CSR-initiated F8 threads), each with `hash` inline.
  //     We merge any new (id, hash) refs into accountThreads:<email> so the
  //     cache stays consistent across devices.
  //  2. Walk all refs (BC-enumerated + anon-migrated from pendingContactThreads)
  //     and call histories(id, hash) per thread to render the full
  //     conversation. BC remains source of truth for thread content.
  const fetchMessages = async () => {
    if (!token) return;
    setMessagesLoading(true);
    setMessagesError('');
    setMsgDiag(null);
    try {
      // Stage 1: enumerate via BC and merge into local ref cache.
      try {
        const list = await api.getUserContacts();
        const listDocs = list?.docs || [];
        if (listDocs.length > 0) {
          const existing = readLocalThreads();
          const haveIds = new Set(existing.map((r) => r?.contactMessageId).filter(Boolean));
          const additions = listDocs
            .filter((d) => (d._id || d.id) && d.hash && !haveIds.has(d._id || d.id))
            .map((d) => ({
              contactMessageId: d._id || d.id,
              hash: d.hash,
              createdAt: d.createdAt || new Date().toISOString(),
              subject: d?.content?.input?.topic || '',
            }));
          if (additions.length > 0) {
            const next = [...additions, ...existing].slice(0, 100);
            writeLocalThreads(next);
          }
        }
      } catch {
        // BC enumeration failed — fall through to whatever refs we have
        // locally (anon-migrated + any from a previous successful call).
      }

      // Stage 2: walk all refs and call histories.
      const byId = new Map();
      const diag = { threadCount: 0, contact: 0, csrReply: 0, userReply: 0, other: 0 };

      for (const ref of readLocalThreads()) {
        if (!ref?.contactMessageId || !ref?.hash) continue;
        diag.threadCount += 1;
        try {
          const result = await api.getContactHistories({
            contactMessageId: ref.contactMessageId,
            hash: ref.hash,
          });
          const data = result?.getData?.() ?? result ?? {};
          const docs = data.docs || (Array.isArray(data) ? data : []);
          for (const d of docs) {
            const id = d._id || d.id;
            if (!id) continue;
            // BC's stored type is `contactCsrReply` / `contactUserReply` (see
            // csrApi.csv:566) — older docs mention bare `csrReply` /
            // `userReply` interchangeably. Lowercase + suffix match keeps us
            // resilient to either form.
            const tRaw = d.type || '';
            const tLow = tRaw.toLowerCase();
            const isContact   = tLow === 'contact';
            // Consumer histories tag CSR replies `userContactCsrMail` (Api.csv 750/806);
            // the admin path uses `…csrReply`. Accept both, else CSR replies render as the
            // member's own outbound message (no support styling).
            const isCsrReply  = tLow.endsWith('csrreply') || tLow === 'usercontactcsrmail';
            const isUserReply = tLow.endsWith('userreply');
            if (isContact) diag.contact += 1;
            else if (isCsrReply) diag.csrReply += 1;
            else if (isUserReply) diag.userReply += 1;
            else diag.other += 1;
            const mappedType = isCsrReply ? 'userContactCsrMail' : 'userContact';
            const subject = d?.content?.input?.topic || d?.content?.subject || '';
            const body = d?.content?.message || d?.content?.input?.description || '';
            const contentType = d?.content?.contentType || 'text/plain';
            byId.set(id, {
              _id: id,
              type: mappedType,
              createdAt: d.createdAt,
              content: {
                subject: isContact ? subject : '',
                message: body,
                contentType,
              },
            });
          }
        } catch { /* skip this thread, keep going */ }
      }

      const merged = Array.from(byId.values())
        .sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
      const finalMsgs = merged.length > 0 ? merged : readLocalMessages();
      setMessages(finalMsgs);
      setMsgDiag(diag);
      setHasMoreMessages(false);
      setMessagesFetched(true);
    } catch (err) {
      setMessagesError('');
      setMessages(readLocalMessages());
      setMessagesFetched(true);
    } finally {
      setMessagesLoading(false);
    }
  };

  const handleLoadMoreMessages = () => {
    if (lastMessageId && !messagesLoading) {
      fetchMessages(lastMessageId);
    }
  };

  const handleComposeSubmit = async (e) => {
    e.preventDefault();
    if (!composeMessage.trim()) return;
    setComposeSending(true);
    setComposeError('');
    setComposeSuccess(false);
    try {
      // BC's general-category contact endpoint requires a non-empty *valid*
      // phone ("input.phone must be a valid phone number"). Use the saved
      // profile phone if we have one; otherwise fall back to 212-555-0100 —
      // a real NANP area code (212 = NYC) paired with the official 555-01XX
      // fictional-use subscriber range. Most phone validators (libphonenumber
      // included) accept this combo as format-valid. Remove this fallback once
      // BC drops the phone requirement.
      const userPhoneDigits = (user?.phone || '').replace(/\D/g, '');
      const phone = userPhoneDigits.length >= 10 ? userPhoneDigits : '2125550100';
      const submittedSubject = composeSubject;
      const submittedMessage = composeMessage.trim();
      // Explicitly send targetUserId so BC's getUserContacts (2026-05-28)
      // can surface this thread on subsequent loads. BC's contact.create
      // doesn't auto-set content.targetUserId for member-submitted threads —
      // testing whether BC honors the explicit field. If BC strips it, we
      // need either auto-linking or an ownerId clause on getUserContacts.
      const created = await api.submitContact({
        category: 'general',
        topic: submittedSubject,
        message: submittedMessage,
        name: `${user?.firstName || ''} ${user?.lastName || ''}`.trim() || 'Member',
        email: user?.email || '',
        phone,
        orderId: subscription?.orderId || '',
        ...(user?.id || user?._id ? { targetUserId: user?.id || user?._id } : {}),
      });
      // BC's contact.create returns { messageResult: { _id, hash, ... }, mailResult }
      // (Api.csv:550). Extractor must check messageResult before falling through
      // to flat or docs[] shapes — older paths kept for resilience but
      // messageResult is the documented contract.
      const newThreadId =
        created?.messageResult?._id || created?.messageResult?.id ||
        created?._id || created?.id ||
        created?.docs?.[0]?._id || created?.docs?.[0]?.id || null;
      const newThreadHash =
        created?.messageResult?.hash ||
        created?.hash ||
        created?.docs?.[0]?.hash || null;
      if (newThreadId && newThreadHash) {
        const nextRefs = [
          { contactMessageId: newThreadId, hash: newThreadHash, createdAt: new Date().toISOString(), subject: submittedSubject },
          ...readLocalThreads().filter((r) => r.contactMessageId !== newThreadId),
        ];
        writeLocalThreads(nextRefs);
      }
      setComposeSuccess(true);
      setComposeMessage('');
      setComposeSubject('General inquiry');
      // Principle: always go to BC for canonical state. Trigger an immediate
      // re-fetch instead of optimistically mirroring the local entry — this
      // catches BC validation/normalization (e.g., subject rewrites, hash
      // assignment) and surfaces any create-time errors that didn't throw.
      setMessagesFetched(false);
      setTimeout(() => {
        setShowCompose(false);
        setComposeSuccess(false);
      }, 2000);
    } catch (err) {
      // Surface BC's response body so we can see exactly what was rejected
      // (status code + payload). Strip later once messaging is stable.
      const status = err?.status ? ` (HTTP ${err.status})` : '';
      const body = err?.data ? ` — ${JSON.stringify(err.data).slice(0, 300)}` : '';
      setComposeError(`${err?.message || 'Failed to send message'}${status}${body}`);
    } finally {
      setComposeSending(false);
    }
  };

  /**
   * Strip BC-internal Reply link HTML (contains loginHash URLs).
   * Returns sanitized HTML string safe for rendering.
   */
  const sanitizeMessageHtml = (html) => {
    if (!html) return '';
    // Remove <a> tags that contain loginHash parameter
    return html.replace(/<a[^>]*loginHash[^>]*>.*?<\/a>/gi, '');
  };

  const formatMessageDate = (dateStr) => {
    try {
      const date = new Date(dateStr);
      if (isNaN(date.getTime())) return 'Unknown date';
      return date.toLocaleDateString(undefined, {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return 'Unknown date';
    }
  };

  // ─── Profile handlers ────────────────────────────────────────────────────────
  const handleProfileChange = (e) => {
    setProfileForm({ ...profileForm, [e.target.name]: e.target.value });
  };

  const handleProfileSave = async (e) => {
    e.preventDefault();
    setProfileSaving(true);
    setProfileSuccess(false);
    setProfileError('');
    try {
      // BC user.update accepts firstName, lastName, phone — all optional.
      await api.updateProfile({
        firstName: profileForm.firstName,
        lastName: profileForm.lastName,
        phone: profileForm.phone,
      }, token);
      // Keep AuthContext.user in sync so header/dashboard reflect the new name
      // immediately (BC doesn't push the updated user back; we mirror locally).
      if (setUser && user) {
        const nextUser = {
          ...user,
          firstName: profileForm.firstName,
          lastName: profileForm.lastName,
          phone: profileForm.phone,
        };
        setUser(nextUser);
        try { localStorage.setItem('user', JSON.stringify(nextUser)); } catch { /* non-fatal */ }
      }
      gtmSetUser({
        firstName: profileForm.firstName,
        lastName: profileForm.lastName,
        phone: profileForm.phone,
      });
      setProfileSuccess(true);
      setTimeout(() => setProfileSuccess(false), 4000);
    } catch (err) {
      setProfileError(err.message || 'Failed to save profile');
    } finally {
      setProfileSaving(false);
    }
  };

  const getInitials = () => {
    const first = (profileForm.firstName || user?.firstName || '').trim();
    const last = (profileForm.lastName || user?.lastName || '').trim();
    const initials = `${first[0] || ''}${last[0] || ''}`.toUpperCase();
    return initials || '?';
  };

  const memberSince = profile?.createdAt
    ? new Date(profile.createdAt).toLocaleDateString(undefined, { year: 'numeric', month: 'long' })
    : null;

  // ─── Security & Privacy handlers ─────────────────────────────────────────────
  const handlePasswordChange = async (e) => {
    e.preventDefault();
    if (passwordForm.newPassword.length < 8) {
      setPasswordMessage('New password must be at least 8 characters.');
      return;
    }
    setPasswordLoading(true);
    setPasswordMessage('');
    try {
      await api.post('/auth/change-password', { body: passwordForm, token });
      setPasswordMessage('Password changed successfully');
      setPasswordForm({ currentPassword: '', newPassword: '' });
    } catch (err) {
      setPasswordMessage(err.message || 'Failed to change password');
    } finally {
      setPasswordLoading(false);
    }
  };

  // ─── Subscription & Billing handlers ─────────────────────────────────────────
  const handleCancelConfirm = async () => {
    if (!token) {
      setCancelError('Not authenticated');
      return;
    }
    // Find the user's currently-active order to target with the cancel call.
    // BC's cancelOrUncancelOrder requires an explicit orderId; we resolve it
    // from the orders state already loaded by the billing-history fetch.
    const activeOrder = (orders || []).find(
      (o) => o.status === 'active' && !o?.transient?.canceled
    );
    if (!activeOrder?._id && !activeOrder?.id) {
      setCancelError('No active subscription found to cancel.');
      setShowCancelModal(false);
      return;
    }
    setShowCancelModal(false);
    try {
      await api.cancelSubscription(activeOrder._id || activeOrder.id);
      track('subscription_cancel', { orderId: activeOrder._id || activeOrder.id });
      refreshSubscription();
      setCancelError('');
    } catch (err) {
      setCancelError(err?.message || err?.data?.error?.message || 'Failed to cancel subscription');
    }
  };

  // Reactivate a cancelled-but-still-in-period order. BC's
  // cancelOrUncancelOrder(flag=false, orderId) revives the auto-renew.
  // Direct fix for #50 (cancel→reactivate previously routed to /payment,
  // which BC rejected with nonMemberOnlyCommerceOffer because the offer
  // is non-member-only).
  const handleReactivate = async () => {
    if (!subscription?.orderId) {
      setCancelError('No subscription to reactivate.');
      return;
    }
    try {
      await api.cancelSubscription(subscription.orderId, { flag: false });
      refreshSubscription();
      setCancelError('');
    } catch (err) {
      setCancelError(err?.message || err?.data?.error?.message || 'Failed to reactivate subscription');
    }
  };

  const handleViewReport = (commerceContentId) => {
    navigate(`/people/${commerceContentId}`);
  };

  const handleDownloadPdf = async (e, commerceContentId) => {
    e.stopPropagation();
    if (pdfDownloadingId) return;
    setPdfDownloadingId(commerceContentId);
    try {
      await api.downloadPdfReport(commerceContentId);
    } catch (err) {
      console.error('[AccountPage] PDF download failed:', err?.message);
    } finally {
      setPdfDownloadingId(null);
    }
  };

  const handleLoadMoreReports = () => {
    if (lastReportId && !reportsLoading) {
      fetchReports(lastReportId);
    }
  };

  const getReportInfo = (report) => {
    try {
      const commerceContent = report?.commerceContent || report || {};
      const teaserInput = report?.data?.teaserInput || report?.teaserInput;
      const createdAt = report?.createdAt || report?.created_at || new Date().toISOString();
      let reportName = 'Report';
      if (teaserInput) {
        if (typeof teaserInput === 'string') {
          reportName = teaserInput;
        } else if (teaserInput?.fName && teaserInput?.lName) {
          reportName = `${teaserInput.fName} ${teaserInput.lName}`;
        } else if (teaserInput?.name) {
          reportName = teaserInput.name;
        }
      }
      const id =
        commerceContent?._id ||
        commerceContent?.id ||
        report?._id ||
        report?.id ||
        `report-${Date.now()}`;
      return { id, name: reportName, createdAt, teaserInput };
    } catch (err) {
      return { id: `report-${Date.now()}`, name: 'Report', createdAt: new Date().toISOString(), teaserInput: null };
    }
  };

  // ─── Invoice status badge helper ──────────────────────────────────────────────
  const getInvoiceBadgeStyle = (status) => {
    if (!status) return {};
    const s = status.toLowerCase();
    if (s === 'paid') return { background: '#dcfce7', color: '#166534' };
    if (s === 'pending') return { background: '#fef9c3', color: '#92400e' };
    if (s === 'overdue') return { background: '#fee2e2', color: '#dc2626' };
    return { background: '#f3f4f6', color: '#374151' };
  };

  // ─── Tab styles ───────────────────────────────────────────────────────────────
  const tabBarStyle = {
    display: 'flex',
    gap: 0,
    marginBottom: '2rem',
    border: '1px solid #e5e7eb',
    borderRadius: '0.5rem',
    overflow: 'hidden',
  };

  const tabBtnBase = {
    padding: '0.75rem 1.5rem',
    cursor: 'pointer',
    fontWeight: 600,
    fontSize: '0.9rem',
    flex: 1,
    transition: 'all 0.15s',
    textAlign: 'center',
  };

  const tabBtnActive = { ...tabBtnBase, background: '#0d5d2f', color: '#fff', border: 'none' };
  const tabBtnInactive = { ...tabBtnBase, background: '#fff', color: '#374151', border: '1px solid transparent' };

  const TABS = [
    { key: 'security', label: 'Security' },
    { key: 'billing', label: 'Subscription & Billing' },
    { key: 'messages', label: 'Messages' },
    { key: 'communications', label: 'Communications' },
    { key: 'profile', label: 'Profile' },
  ];

  return (
    <main className={styles.pageWrapper}>
      <h1 className={styles.pageTitle}>My Account</h1>

      {/* Cancel Confirmation Modal */}
      {showCancelModal && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
          }}
        >
          <div
            style={{
              background: '#fff',
              borderRadius: '0.75rem',
              padding: '2rem',
              maxWidth: '420px',
              width: '90%',
              boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
            }}
          >
            <h3 style={{ marginTop: 0, color: '#111827' }}>Cancel Subscription?</h3>
            <p style={{ color: '#6b7280', lineHeight: '1.6' }}>
              Your access will remain active until the end of your billing period. After that, you will lose access
              to all reports and member features.
            </p>
            <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end', marginTop: '1.5rem' }}>
              <button
                onClick={() => { track('subscription_keep', {}); setShowCancelModal(false); }}
                style={{
                  padding: '0.6rem 1.25rem',
                  border: '1px solid #d1d5db',
                  borderRadius: '0.375rem',
                  background: '#fff',
                  cursor: 'pointer',
                }}
              >
                Keep Subscription
              </button>
              <button
                onClick={handleCancelConfirm}
                style={{
                  padding: '0.6rem 1.25rem',
                  background: '#dc2626',
                  color: '#fff',
                  border: 'none',
                  borderRadius: '0.375rem',
                  cursor: 'pointer',
                }}
              >
                Yes, Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Tab Bar */}
      <div style={tabBarStyle}>
        {TABS.map((tab) => (
          <button
            key={tab.key}
            style={activeTab === tab.key ? tabBtnActive : tabBtnInactive}
            onClick={() => setActiveTab(tab.key)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* ── PROFILE TAB ──────────────────────────────────────────────────────── */}
      {activeTab === 'profile' && (
        <div className={styles.section}>
          <h2 className={styles.sectionTitle}>Profile</h2>

          {profileLoading ? (
            <div>
              <Skeleton variant="card" height={60} style={{ marginBottom: '0.75rem' }} />
              <Skeleton variant="card" height={60} style={{ marginBottom: '0.75rem' }} />
              <Skeleton variant="card" height={60} />
            </div>
          ) : (
            <>
              {/* Avatar + member since */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '1.25rem',
                  marginBottom: '1.75rem',
                }}
              >
                <div
                  style={{
                    width: '64px',
                    height: '64px',
                    borderRadius: '50%',
                    background: '#0d5d2f',
                    color: '#fff',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontWeight: 700,
                    fontSize: '1.4rem',
                    flexShrink: 0,
                  }}
                >
                  {getInitials()}
                </div>
                {memberSince && (
                  <p style={{ margin: 0, color: '#6b7280', fontSize: '0.9rem' }}>
                    Member since {memberSince}
                  </p>
                )}
              </div>

              {/* Editable form */}
              <form onSubmit={handleProfileSave}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '1rem' }}>
                  <div>
                    <label
                      htmlFor="firstName"
                      style={{ display: 'block', fontWeight: 600, marginBottom: '0.4rem', color: '#374151', fontSize: '0.9rem' }}
                    >
                      First Name
                    </label>
                    <input
                      id="firstName"
                      type="text"
                      name="firstName"
                      value={profileForm.firstName}
                      onChange={handleProfileChange}
                      style={{
                        width: '100%',
                        padding: '0.6rem 0.75rem',
                        border: '1px solid #d1d5db',
                        borderRadius: '0.375rem',
                        fontSize: '0.95rem',
                        boxSizing: 'border-box',
                      }}
                    />
                  </div>
                  <div>
                    <label
                      htmlFor="lastName"
                      style={{ display: 'block', fontWeight: 600, marginBottom: '0.4rem', color: '#374151', fontSize: '0.9rem' }}
                    >
                      Last Name
                    </label>
                    <input
                      id="lastName"
                      type="text"
                      name="lastName"
                      value={profileForm.lastName}
                      onChange={handleProfileChange}
                      style={{
                        width: '100%',
                        padding: '0.6rem 0.75rem',
                        border: '1px solid #d1d5db',
                        borderRadius: '0.375rem',
                        fontSize: '0.95rem',
                        boxSizing: 'border-box',
                      }}
                    />
                  </div>
                </div>

                <div style={{ marginBottom: '1rem' }}>
                  <label
                    htmlFor="email"
                    style={{ display: 'block', fontWeight: 600, marginBottom: '0.4rem', color: '#374151', fontSize: '0.9rem' }}
                  >
                    Email
                  </label>
                  <input
                    id="email"
                    type="email"
                    name="email"
                    value={profileForm.email}
                    disabled
                    style={{
                      width: '100%',
                      padding: '0.6rem 0.75rem',
                      border: '1px solid #d1d5db',
                      borderRadius: '0.375rem',
                      fontSize: '0.95rem',
                      background: '#f9fafb',
                      color: '#9ca3af',
                      boxSizing: 'border-box',
                    }}
                  />
                  <span style={{ fontSize: '0.8rem', color: '#9ca3af', marginTop: '0.3rem', display: 'block' }}>
                    Email cannot be changed
                  </span>
                </div>

                <div style={{ marginBottom: '1.25rem' }}>
                  <label
                    htmlFor="phone"
                    style={{ display: 'block', fontWeight: 600, marginBottom: '0.4rem', color: '#374151', fontSize: '0.9rem' }}
                  >
                    Phone Number
                  </label>
                  <input
                    id="phone"
                    type="tel"
                    name="phone"
                    value={profileForm.phone}
                    onChange={handleProfileChange}
                    placeholder="(555) 555-5555"
                    style={{
                      width: '100%',
                      padding: '0.6rem 0.75rem',
                      border: '1px solid #d1d5db',
                      borderRadius: '0.375rem',
                      fontSize: '0.95rem',
                      boxSizing: 'border-box',
                    }}
                  />
                </div>

                {profileSuccess && (
                  <p style={{ color: '#166534', background: '#dcfce7', padding: '0.6rem 0.9rem', borderRadius: '0.375rem', fontSize: '0.9rem', marginBottom: '1rem' }}>
                    Profile updated successfully.
                  </p>
                )}
                {profileError && (
                  <p style={{ color: '#dc2626', fontSize: '0.9rem', marginBottom: '1rem' }}>{profileError}</p>
                )}

                <button
                  type="submit"
                  disabled={profileSaving}
                  style={{
                    padding: '0.7rem 1.75rem',
                    background: '#0d5d2f',
                    color: '#fff',
                    border: 'none',
                    borderRadius: '0.5rem',
                    fontWeight: 600,
                    fontSize: '0.95rem',
                    cursor: profileSaving ? 'not-allowed' : 'pointer',
                    opacity: profileSaving ? 0.7 : 1,
                  }}
                >
                  {profileSaving ? 'Saving...' : 'Save Changes'}
                </button>
              </form>
            </>
          )}
        </div>
      )}

      {/* ── SECURITY & PRIVACY TAB ───────────────────────────────────────────── */}
      {activeTab === 'security' && (
        <>
          {/* Change Password */}
          <div className={styles.section}>
            <h2 className={styles.sectionTitle}>Change Password</h2>
            <form onSubmit={handlePasswordChange} style={{ maxWidth: '480px' }}>
              <div style={{ marginBottom: '1rem' }}>
                <label
                  htmlFor="currentPassword"
                  style={{ display: 'block', fontWeight: 600, marginBottom: '0.4rem', color: '#374151', fontSize: '0.9rem' }}
                >
                  Current Password
                </label>
                <input
                  id="currentPassword"
                  type="password"
                  name="currentPassword"
                  value={passwordForm.currentPassword}
                  onChange={(e) => setPasswordForm({ ...passwordForm, currentPassword: e.target.value })}
                  required
                  style={{
                    width: '100%',
                    padding: '0.6rem 0.75rem',
                    border: '1px solid #d1d5db',
                    borderRadius: '0.375rem',
                    fontSize: '0.95rem',
                    boxSizing: 'border-box',
                  }}
                />
              </div>
              <div style={{ marginBottom: '1.25rem' }}>
                <label
                  htmlFor="newPassword"
                  style={{ display: 'block', fontWeight: 600, marginBottom: '0.4rem', color: '#374151', fontSize: '0.9rem' }}
                >
                  New Password
                </label>
                <input
                  id="newPassword"
                  type="password"
                  name="newPassword"
                  value={passwordForm.newPassword}
                  onChange={(e) => setPasswordForm({ ...passwordForm, newPassword: e.target.value })}
                  required
                  style={{
                    width: '100%',
                    padding: '0.6rem 0.75rem',
                    border: '1px solid #d1d5db',
                    borderRadius: '0.375rem',
                    fontSize: '0.95rem',
                    boxSizing: 'border-box',
                  }}
                />
                <span style={{ fontSize: '0.8rem', color: '#9ca3af', marginTop: '0.3rem', display: 'block' }}>
                  Minimum 8 characters
                </span>
              </div>
              <button
                type="submit"
                disabled={passwordLoading}
                style={{
                  padding: '0.7rem 1.75rem',
                  background: '#0d5d2f',
                  color: '#fff',
                  border: 'none',
                  borderRadius: '0.5rem',
                  fontWeight: 600,
                  fontSize: '0.95rem',
                  cursor: passwordLoading ? 'not-allowed' : 'pointer',
                  opacity: passwordLoading ? 0.7 : 1,
                }}
              >
                {passwordLoading ? 'Changing...' : 'Change Password'}
              </button>
              {passwordMessage && (
                <p
                  style={{
                    marginTop: '0.75rem',
                    fontSize: '0.9rem',
                    color: passwordMessage.includes('successfully') ? '#166534' : '#dc2626',
                    background: passwordMessage.includes('successfully') ? '#dcfce7' : '#fee2e2',
                    padding: '0.6rem 0.9rem',
                    borderRadius: '0.375rem',
                  }}
                >
                  {passwordMessage}
                </p>
              )}
            </form>
          </div>

        </>
      )}

      {/* ── SUBSCRIPTION & BILLING TAB ───────────────────────────────────────── */}
      {activeTab === 'billing' && (
        <>
          {/* Subscription Section */}
          <div className={styles.section}>
            <h2 className={styles.sectionTitle}>Subscription</h2>
            {cancelError && <p className={styles.errorText}>{cancelError}</p>}
            {isPaid && subscription ? (
              <div>
                <div className={styles.planInfo}>
                  <span>
                    <strong>Plan:</strong> {planDisplayName || 'Subscription'}
                  </span>
                  {subscription.subStatus === 'canceled' ? (
                    <span className={styles.subscriptionBadge} style={{ background: '#fef3c7', color: '#92400e' }}>
                      Canceling
                    </span>
                  ) : (
                    <span className={`${styles.subscriptionBadge} ${styles.active}`}>Active</span>
                  )}
                  <span>
                    <strong>{subscription.subStatus === 'canceled' ? 'Access until:' : 'Renewal date:'}</strong>{' '}
                    {subscription.dueDate
                      ? (() => {
                          try { return new Date(subscription.dueDate).toLocaleDateString(); }
                          catch { return 'N/A'; }
                        })()
                      : 'N/A'}
                  </span>
                </div>
                <div style={{ marginTop: '1rem', marginBottom: '1rem' }}>
                  <p style={{ fontWeight: 600, marginBottom: '0.5rem', color: '#374151' }}>
                    What&apos;s included:
                  </p>
                  <ul style={{ margin: 0, paddingLeft: '1.25rem', color: '#6b7280', fontSize: '0.9rem', lineHeight: '1.8' }}>
                    <li>Unlimited people searches</li>
                    <li>Full background reports</li>
                    <li>Saved search history with one-click re-pull</li>
                    <li>PDF report downloads</li>
                    <li>Priority support</li>
                  </ul>
                </div>
                {subscription.subStatus === 'canceled' ? (
                  <button
                    onClick={handleReactivate}
                    style={{
                      padding: '0.75rem 1.5rem',
                      background: '#0d5d2f',
                      color: '#fff',
                      border: 'none',
                      borderRadius: '0.5rem',
                      fontWeight: 600,
                      fontSize: '0.9rem',
                      cursor: 'pointer',
                    }}
                  >
                    Reactivate Subscription
                  </button>
                ) : (
                  <button className={styles.cancelBtn} onClick={() => { track('cancel_lightbox_view', {}); setShowCancelModal(true); }}>
                    Cancel Subscription
                  </button>
                )}
              </div>
            ) : (
              <div>
                <p style={{ color: '#6b7280', marginBottom: '1rem' }}>You do not have an active subscription.</p>
                <Link
                  to="/payment"
                  style={{
                    display: 'inline-block',
                    padding: '0.75rem 1.5rem',
                    background: '#0d5d2f',
                    color: '#fff',
                    borderRadius: '0.5rem',
                    textDecoration: 'none',
                    fontWeight: 600,
                    fontSize: '0.9rem',
                  }}
                >
                  Upgrade to Pro
                </Link>
              </div>
            )}
          </div>

          {/* Billing History Section — flat list of payments across all orders, newest first. */}
          <div className={styles.section}>
            <h2 className={styles.sectionTitle}>Billing History</h2>
            {ordersLoading ? (
              <div>
                <Skeleton variant="card" height={52} style={{ marginBottom: '0.5rem' }} />
                <Skeleton variant="card" height={52} style={{ marginBottom: '0.5rem' }} />
                <Skeleton variant="card" height={52} />
              </div>
            ) : ordersError ? (
              <p className={styles.errorText}>{ordersError}</p>
            ) : (() => {
              // BC's consumer getUserOrders returns the order shell but doesn't
              // always populate commercePayments[] (especially right after a
              // fresh signup). When it's empty for an order that clearly
              // transacted, synthesize a single sale row from the order's
              // own orderTimestamp + S0 price rule so the user can see their
              // trial charge. Real commercePayments take over once BC fills them.
              const payments = orders
                .flatMap((o) => {
                  const real = Array.isArray(o.commercePayments) ? o.commercePayments : [];
                  if (real.length > 0) {
                    return real.map((p) => ({
                      id: p._id || p.id,
                      ts: p.paymentTimestamp || (p.createdAt ? new Date(p.createdAt).getTime() : 0),
                      amount: p.totalPrice?.amount,
                      currency: (p.totalPrice?.code || 'usd').toUpperCase(),
                      type: p.type || 'sale',
                      status: p.status || 'unknown',
                    }));
                  }
                  const trialRule = Array.isArray(o.commercePriceRules)
                    ? o.commercePriceRules.find((r) => r?._DESC_ === 'S0')
                    : null;
                  const trialPrice = trialRule?.candidates?.[0]?.id;
                  const ts = o.orderTimestamp
                    || (o.createdAt ? new Date(o.createdAt).getTime() : 0)
                    || (o.createdTimestamp || 0);
                  if (!ts || trialPrice?.amount == null) return [];
                  return [{
                    id: `synth-${o._id || o.id || ts}`,
                    ts,
                    amount: trialPrice.amount,
                    currency: (trialPrice.code || 'usd').toUpperCase(),
                    type: 'sale',
                    status: 'paid',
                  }];
                })
                .sort((a, b) => (b.ts || 0) - (a.ts || 0));
              if (payments.length === 0) {
                return <p className={styles.emptyState}>No billing history found.</p>;
              }
              return (
                <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
                  {payments.map((p, idx) => {
                    const badgeStyle = getInvoiceBadgeStyle(p.status);
                    const dateLabel = p.ts ? new Date(p.ts).toLocaleDateString() : 'N/A';
                    const isRefund = p.type === 'refund' || p.type === 'void';
                    const amountLabel = p.amount != null
                      ? `${isRefund ? '-' : ''}$${Number(p.amount).toFixed(2)}`
                      : 'N/A';
                    return (
                      <li
                        key={p.id || idx}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          padding: '0.75rem 0.5rem',
                          borderBottom: idx < payments.length - 1 ? '1px solid #e5e7eb' : 'none',
                          gap: '1rem',
                          flexWrap: 'wrap',
                        }}
                      >
                        <span style={{ color: '#374151', fontSize: '0.9rem' }}>{dateLabel}</span>
                        <span style={{ color: '#6b7280', fontSize: '0.85rem', textTransform: 'capitalize' }}>
                          {p.type}
                        </span>
                        <span style={{ fontWeight: 600, color: isRefund ? '#b91c1c' : '#111827', fontSize: '0.95rem' }}>
                          {amountLabel}
                        </span>
                        <span
                          style={{
                            padding: '0.2rem 0.65rem',
                            borderRadius: '9999px',
                            fontSize: '0.78rem',
                            fontWeight: 600,
                            textTransform: 'capitalize',
                            ...badgeStyle,
                          }}
                        >
                          {p.status}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              );
            })()}
          </div>

          {/* Reports Section */}
          <div className={styles.section}>
            <h2 className={styles.sectionTitle}>Your Reports</h2>
            {reportsLoading && reports.length === 0 ? (
              <div>
                <Skeleton variant="card" height={72} style={{ marginBottom: '0.75rem' }} />
                <Skeleton variant="card" height={72} style={{ marginBottom: '0.75rem' }} />
                <Skeleton variant="card" height={72} />
              </div>
            ) : reportsError ? (
              <p className={styles.errorText}>{reportsError}</p>
            ) : reports.length === 0 ? (
              <p className={styles.emptyState}>You haven&apos;t created any reports yet.</p>
            ) : (
              <>
                <ul className={styles.reportsList}>
                  {reports.map((report, index) => {
                    const reportInfo = getReportInfo(report);
                    return (
                      <li
                        key={reportInfo.id || index}
                        className={styles.reportItem}
                        onClick={() => handleViewReport(reportInfo.id)}
                      >
                        <div>
                          <p className={styles.reportName}>{reportInfo.name}</p>
                          <p className={styles.reportDate}>
                            Created:{' '}
                            {(() => {
                              try {
                                const date = new Date(reportInfo.createdAt);
                                if (isNaN(date.getTime())) return 'Unknown date';
                                return date.toLocaleDateString();
                              } catch {
                                return 'Unknown date';
                              }
                            })()}
                          </p>
                        </div>
                        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                          <button
                            className={styles.viewBtn}
                            onClick={(e) => {
                              e.stopPropagation();
                              handleViewReport(reportInfo.id);
                            }}
                          >
                            View Report
                          </button>
                          <button
                            className={styles.viewBtn}
                            style={{ background: 'transparent', color: '#0d5d2f', border: '1px solid #0d5d2f' }}
                            onClick={(e) => handleDownloadPdf(e, reportInfo.id)}
                            disabled={pdfDownloadingId === reportInfo.id}
                            title="Download PDF"
                          >
                            {pdfDownloadingId === reportInfo.id ? '...' : 'PDF'}
                          </button>
                        </div>
                      </li>
                    );
                  })}
                </ul>

                {hasMoreReports ? (
                  <button
                    className={styles.loadMoreBtn}
                    onClick={handleLoadMoreReports}
                    disabled={reportsLoading}
                  >
                    {reportsLoading ? 'Loading...' : 'Load More Reports'}
                  </button>
                ) : (
                  reports.length > 0 && (
                    <p style={{ textAlign: 'center', color: '#9ca3af', fontSize: '0.875rem', marginTop: '1rem' }}>
                      All reports loaded
                    </p>
                  )
                )}
              </>
            )}
          </div>
        </>
      )}

      {/* ── MESSAGES TAB ────────────────────────────────────────────────────── */}
      {activeTab === 'communications' && (
        <div className={styles.section}>
          <h2 className={styles.sectionTitle}>Communications</h2>
          <p style={{ color: '#6b7280', fontSize: '0.9rem', margin: '0 0 1rem' }}>
            Manage the marketing emails and texts you receive from us.
          </p>
          <CommunicationsTab email={user?.email} />
        </div>
      )}

      {activeTab === 'messages' && (
        <div className={styles.section}>
          <h2 className={styles.sectionTitle}>Support Messages</h2>
          <p style={{ color: '#6b7280', fontSize: '0.9rem', margin: '0 0 1rem' }}>
            Your correspondence with our support team
          </p>

          {/* Replies fetched via BC's /contactMessage/histories. Threads
              submitted from this page surface here; we also email you a
              copy with a direct link to the thread. */}
          <div style={{
            display: 'flex',
            alignItems: 'flex-start',
            gap: '0.625rem',
            padding: '0.75rem 1rem',
            marginBottom: '1.25rem',
            background: '#eff6ff',
            border: '1px solid #bfdbfe',
            borderRadius: '0.5rem',
            color: '#1e40af',
            fontSize: '0.85rem',
            lineHeight: 1.5,
          }}>
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, marginTop: '2px' }}>
              <circle cx="12" cy="12" r="10" />
              <path d="M12 8v4M12 16h.01" />
            </svg>
            <div>
              We also email a copy of every reply to <strong>{user?.email || 'your account email'}</strong> so
              you'll never miss one. Reload this page to see new responses from our support team.
            </div>
          </div>

          {/* New Message button */}
          {!showCompose && (
            <button
              onClick={() => { setShowCompose(true); setComposeError(''); setComposeSuccess(false); }}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.5rem',
                padding: '0.6rem 1.25rem',
                background: '#0d5d2f',
                color: '#fff',
                border: 'none',
                borderRadius: '0.375rem',
                fontWeight: 600,
                fontSize: '0.9rem',
                cursor: 'pointer',
                marginBottom: '1.25rem',
              }}
            >
              <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 5v14M5 12h14" />
              </svg>
              New Message
            </button>
          )}

          {/* Compose form */}
          {showCompose && (
            <form
              onSubmit={handleComposeSubmit}
              style={{
                padding: '1.25rem',
                marginBottom: '1.25rem',
                background: '#f9fafb',
                border: '1px solid #e5e7eb',
                borderRadius: '0.5rem',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
                <h3 style={{ margin: 0, fontSize: '1rem', color: '#111827' }}>New Message</h3>
                <button
                  type="button"
                  onClick={() => { setShowCompose(false); setComposeError(''); setComposeSuccess(false); }}
                  style={{
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    color: '#6b7280',
                    fontSize: '1.25rem',
                    lineHeight: 1,
                    padding: '0.25rem',
                  }}
                  aria-label="Close compose form"
                >
                  &times;
                </button>
              </div>

              {/* Subject dropdown */}
              <div style={{ marginBottom: '1rem' }}>
                <label
                  htmlFor="composeSubject"
                  style={{ display: 'block', fontWeight: 600, marginBottom: '0.4rem', color: '#374151', fontSize: '0.9rem' }}
                >
                  Subject
                </label>
                <select
                  id="composeSubject"
                  value={composeSubject}
                  onChange={(e) => setComposeSubject(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '0.6rem 0.75rem',
                    border: '1px solid #d1d5db',
                    borderRadius: '0.375rem',
                    fontSize: '0.95rem',
                    boxSizing: 'border-box',
                    background: '#fff',
                  }}
                >
                  <option value="Billing question">Billing question</option>
                  <option value="Technical support">Technical support</option>
                  <option value="Privacy">Privacy</option>
                  <option value="Remove my information">Remove my information</option>
                  <option value="General inquiry">General inquiry</option>
                  <option value="Other">Other</option>
                </select>
              </div>

              {/* Message textarea */}
              <div style={{ marginBottom: '1rem' }}>
                <label
                  htmlFor="composeMessage"
                  style={{ display: 'block', fontWeight: 600, marginBottom: '0.4rem', color: '#374151', fontSize: '0.9rem' }}
                >
                  Message
                </label>
                <textarea
                  id="composeMessage"
                  value={composeMessage}
                  onChange={(e) => { if (e.target.value.length <= 250) setComposeMessage(e.target.value); }}
                  maxLength={250}
                  rows={4}
                  placeholder="Describe how we can help..."
                  style={{
                    width: '100%',
                    padding: '0.6rem 0.75rem',
                    border: '1px solid #d1d5db',
                    borderRadius: '0.375rem',
                    fontSize: '0.95rem',
                    boxSizing: 'border-box',
                    resize: 'vertical',
                    fontFamily: 'inherit',
                  }}
                />
                <span style={{ display: 'block', textAlign: 'right', fontSize: '0.8rem', color: composeMessage.length >= 240 ? '#dc2626' : '#9ca3af', marginTop: '0.25rem' }}>
                  {composeMessage.length}/250
                </span>
              </div>

              {composeError && (
                <p style={{ color: '#dc2626', background: '#fee2e2', padding: '0.6rem 0.9rem', borderRadius: '0.375rem', fontSize: '0.9rem', marginBottom: '1rem' }}>
                  {composeError}
                </p>
              )}

              {composeSuccess && (
                <p style={{ color: '#166534', background: '#dcfce7', padding: '0.6rem 0.9rem', borderRadius: '0.375rem', fontSize: '0.9rem', marginBottom: '1rem' }}>
                  Message sent successfully!
                </p>
              )}

              <div style={{ display: 'flex', gap: '0.75rem' }}>
                <button
                  type="submit"
                  disabled={composeSending || !composeMessage.trim()}
                  style={{
                    padding: '0.6rem 1.25rem',
                    background: composeSending || !composeMessage.trim() ? '#9ca3af' : '#0d5d2f',
                    color: '#fff',
                    border: 'none',
                    borderRadius: '0.375rem',
                    fontWeight: 600,
                    fontSize: '0.9rem',
                    cursor: composeSending || !composeMessage.trim() ? 'not-allowed' : 'pointer',
                  }}
                >
                  {composeSending ? 'Sending...' : 'Send Message'}
                </button>
                <button
                  type="button"
                  onClick={() => { setShowCompose(false); setComposeError(''); setComposeSuccess(false); }}
                  style={{
                    padding: '0.6rem 1.25rem',
                    background: '#fff',
                    color: '#374151',
                    border: '1px solid #d1d5db',
                    borderRadius: '0.375rem',
                    fontSize: '0.9rem',
                    cursor: 'pointer',
                  }}
                >
                  Cancel
                </button>
              </div>
            </form>
          )}

          {messagesLoading && messages.length === 0 ? (
            <div>
              <Skeleton variant="card" height={80} style={{ marginBottom: '0.75rem' }} />
              <Skeleton variant="card" height={80} style={{ marginBottom: '0.75rem' }} />
              <Skeleton variant="card" height={80} />
            </div>
          ) : messagesError ? (
            <p className={styles.errorText}>{messagesError}</p>
          ) : messages.length === 0 ? (
            <div className={styles.emptyState}>
              <p><strong>No conversations to show here yet.</strong></p>
              <p style={{ fontSize: '0.9rem', color: '#555', marginTop: '0.5rem' }}>
                When support replies, you&apos;ll get an email with a link to your conversation — clicking it opens the full thread here. Start a new conversation any time with the <strong>New Message</strong> button above.
              </p>
              {showMsgDiag && msgDiag && msgDiag.threadCount > 0 && (
                <p style={{ fontSize: '0.78rem', color: '#9ca3af', marginTop: '0.75rem', fontFamily: 'monospace' }}>
                  diag: bound {msgDiag.threadCount} thread{msgDiag.threadCount === 1 ? '' : 's'} · fetched 0 docs (BC histories returned empty)
                </p>
              )}
            </div>
          ) : (
            <>
              <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
                {messages.map((msg, idx) => {
                  const isSupport = msg.type === 'userContactCsrMail';
                  const subject = msg.content?.subject;
                  const messageBody = msg.content?.message || '';
                  const isHtml = msg.content?.contentType === 'text/html';
                  return (
                    <li
                      key={msg._id || idx}
                      style={{
                        padding: '1rem',
                        marginBottom: '0.75rem',
                        background: isSupport ? '#f0fdf4' : '#f9fafb',
                        borderLeft: `4px solid ${isSupport ? '#0d5d2f' : '#d1d5db'}`,
                        borderRadius: '0.5rem',
                      }}
                    >
                      {/* Header row */}
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem', flexWrap: 'wrap', gap: '0.5rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          {/* Direction icon */}
                          <span style={{
                            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                            width: '28px', height: '28px', borderRadius: '50%',
                            background: isSupport ? '#0d5d2f' : '#6b7280', color: '#fff', fontSize: '0.75rem', flexShrink: 0,
                          }}>
                            {isSupport ? (
                              <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M12 2 4 5v6c0 5 3.5 9.3 8 11 4.5-1.7 8-6 8-11V5l-8-3Z" />
                              </svg>
                            ) : (
                              <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <circle cx="12" cy="8" r="4" />
                                <path d="M4 21c0-4 4-7 8-7s8 3 8 7" />
                              </svg>
                            )}
                          </span>
                          <span style={{ fontWeight: 600, fontSize: '0.9rem', color: isSupport ? '#0d5d2f' : '#374151' }}>
                            {isSupport ? 'Support Team' : 'You'}
                          </span>
                        </div>
                        <span style={{ fontSize: '0.8rem', color: '#9ca3af' }}>
                          {formatMessageDate(msg.createdAt)}
                        </span>
                      </div>

                      {/* Subject */}
                      {subject && (
                        <p style={{ fontWeight: 600, color: '#111827', fontSize: '0.95rem', margin: '0 0 0.4rem' }}>
                          {subject}
                        </p>
                      )}

                      {/* Message body */}
                      {isHtml ? (
                        <div
                          style={{ color: '#374151', fontSize: '0.9rem', lineHeight: '1.6', wordBreak: 'break-word' }}
                          dangerouslySetInnerHTML={{ __html: sanitizeMessageHtml(messageBody) }}
                        />
                      ) : (
                        <p style={{ color: '#374151', fontSize: '0.9rem', lineHeight: '1.6', margin: 0, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                          {messageBody}
                        </p>
                      )}
                    </li>
                  );
                })}
              </ul>

              {hasMoreMessages ? (
                <button
                  className={styles.loadMoreBtn}
                  onClick={handleLoadMoreMessages}
                  disabled={messagesLoading}
                >
                  {messagesLoading ? 'Loading...' : 'Load More Messages'}
                </button>
              ) : (
                messages.length > 0 && (
                  <p style={{ textAlign: 'center', color: '#9ca3af', fontSize: '0.875rem', marginTop: '1rem' }}>
                    All messages loaded
                  </p>
                )
              )}
              {showMsgDiag && msgDiag && msgDiag.threadCount > 0 && (
                <p style={{ textAlign: 'center', color: '#9ca3af', fontSize: '0.75rem', marginTop: '0.5rem', fontFamily: 'monospace' }}>
                  diag: bound {msgDiag.threadCount} thread{msgDiag.threadCount === 1 ? '' : 's'} ·
                  fetched {msgDiag.contact + msgDiag.csrReply + msgDiag.userReply + msgDiag.other} docs
                  ({msgDiag.contact} contact, {msgDiag.csrReply} csrReply, {msgDiag.userReply} userReply
                  {msgDiag.other > 0 ? `, ${msgDiag.other} other` : ''})
                </p>
              )}
            </>
          )}
        </div>
      )}
    </main>
  );
};

export default AccountPage;
