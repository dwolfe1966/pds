import React, { useEffect, useState } from 'react';
import { useNavigate, Link, useSearchParams, useLocation } from 'react-router-dom';
import api from '../../api';
import { useAuth } from '../../context/AuthContext';
import { getReportList } from '../../services/reportService';
import Skeleton from '../../components/Skeleton';
import { setUser as gtmSetUser } from '../../services/gtmContext';
import { track } from '../../services/trackingService';
import { getMappedIdentity, fetchMappedIdentity, computeExposure, fetchSuppression, setSuppression, setFieldSuppression, setVerifiedLevel } from '../../services/memberEnrichment';
import SelfIdentifyCard from '../../components/SelfIdentifyCard';
import DlScanVerify from '../../components/DlScanVerify';
import DigitalFootprint from '../../components/DigitalFootprint';
import ProtectionScoreRing from '../../components/ProtectionScoreRing';
import MyProfileReport from '../../components/MyProfileReport';
import MyProfileModularLive from '../../components/MyProfileModularLive';
import MyProfileSummary from '../../components/MyProfileSummary';
import PageHeader, { PageShell } from '../../components/PageHeader';
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
// Cancellation reasons — captured to feed churn analytics (WHY people leave).
const CANCEL_REASONS = [
  { id: 'too_expensive', label: 'Too expensive' },
  { id: 'not_found', label: "Didn't find what I was looking for" },
  { id: 'found_it', label: 'Found what I needed (one-time use)' },
  { id: 'not_using', label: 'Not using it enough' },
  { id: 'technical', label: 'Technical problems' },
  { id: 'other', label: 'Other' },
];

// Reason-tailored save pitch. HONEST saves only — no fake discounts/pauses we
// can't actually honor via BC. Levers: value reframe, support/callback, keep-for-
// later, and the (already true) cancel-at-period-end grace.
function savePitch(reasonId, phone) {
  switch (reasonId) {
    case 'too_expensive':
      return { emoji: '💬', title: "Let's see what we can do", body: `Before you go — our team can often help with your plan. Give us a call at ${phone} and we'll do our best to keep it working for you.` };
    case 'not_found':
      return { emoji: '🔎', title: 'We can help you find it', body: `Not finding the right person or record? Our support team at ${phone} can help you get more out of every search — that's what we're here for.` };
    case 'technical':
      return { emoji: '🛠️', title: 'Let us fix that', body: `Sorry you hit a snag. Call ${phone} and we'll sort it out — no need to lose your access over something we can fix.` };
    case 'not_using':
      return { emoji: '🔓', title: 'Your full access is still here', body: 'You have unlimited searches, monitoring, and reports whenever you need them — keep your membership ready for the next time.' };
    case 'found_it':
      return { emoji: '📌', title: 'Keep it for next time', body: 'People-search needs tend to come back around. Keep your membership for one-click access whenever you need it again — you can cancel anytime.' };
    default:
      return { emoji: '👋', title: 'Before you go', body: "You'll keep full access until the end of your billing period, and you can reactivate anytime with one click." };
  }
}

const AccountPage = () => {
  const brand = useBrand();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { token, user, setUser, subscription, isPaid, refreshSubscription } = useAuth();

  // ─── Tab state (supports ?tab=messages deep-linking) ────────────────────────
  // Default lands on the Overview landing; other tabs are deep-linkable.
  // 'identity' is served by the top-level /my-identity page (not an Account tab), but the render
  // block still keys on activeTab==='identity' there.
  const validTabs = ['overview', 'contact', 'security', 'billing', 'messages', 'communications'];
  // My Identity is also a top-level page (/my-identity) — force the identity view + drop the account
  // tab chrome so it reads as its own surface.
  const location = useLocation();
  const isIdentityPage = location.pathname === '/my-identity';
  // 'profile' merged into 'identity' — remap legacy ?tab=profile links.
  const requestedTab = searchParams.get('tab') === 'profile' ? 'identity' : searchParams.get('tab');
  const initialTab = isIdentityPage ? 'identity' : (validTabs.includes(requestedTab) ? requestedTab : 'overview');
  const [activeTab, setActiveTab] = useState(initialTab);

  // ─── Identity tab (WSFY mapped-identity view) ────────────────────────────────
  const [identity, setIdentity] = useState(() => getMappedIdentity());
  const [editingIdentity, setEditingIdentity] = useState(false);
  const [suppressed, setSuppressed] = useState(false);
  const [hiddenFields, setHiddenFields] = useState([]); // per-item exposure hides (Identity Mgmt)
  const [pullingReport, setPullingReport] = useState(false); // "Pull my full report" in-progress (state c)
  const [identitySubTab, setIdentitySubTab] = useState('profile'); // My Identity command-center subnav
  // Re-read the mapped identity on mount AND whenever a tab is opened, so a confirmation done on
  // the dashboard (or another device) is reflected here. Local mirror first, then the server copy.
  useEffect(() => {
    let alive = true;
    const local = getMappedIdentity();
    if (local) setIdentity(local);
    if (activeTab === 'identity') {
      fetchMappedIdentity().then((srv) => { if (alive && srv) setIdentity(srv); });
      fetchSuppression().then((s) => { if (alive) { setSuppressed(s.activityHidden); setHiddenFields(s.hiddenFields || []); } });
    }
    return () => { alive = false; };
  }, [activeTab]);

  // /my-identity and /account render the SAME AccountPage component, so navigating between them does
  // NOT remount it — activeTab would stay stale and you'd see Account content on /my-identity (and
  // vice versa: the identity block over Account). Re-sync activeTab to the path on every pathname change.
  useEffect(() => {
    if (isIdentityPage) {
      setActiveTab('identity');
    } else {
      setActiveTab((cur) => (cur === 'identity'
        ? (validTabs.includes(requestedTab) ? requestedTab : 'overview')
        : cur));
    }
  }, [location.pathname]); // eslint-disable-line react-hooks/exhaustive-deps

  // Follow ?tab= changes (e.g., the mobile hamburger sub-nav links to /account?tab=X while we're
  // already on /account, which doesn't remount the page).
  useEffect(() => {
    let t = searchParams.get('tab');
    if (t === 'profile') t = 'identity';
    // My Identity moved to its own top-level page — redirect legacy ?tab=identity there.
    if (t === 'identity' && !isIdentityPage) { navigate('/my-identity', { replace: true }); return; }
    if (t && validTabs.includes(t)) setActiveTab(t);
  }, [searchParams]); // eslint-disable-line react-hooks/exhaustive-deps

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
  const [cancelStep, setCancelStep] = useState(1);
  const [cancelReason, setCancelReason] = useState('');
  const [cancelReasonText, setCancelReasonText] = useState('');
  const [cancelError, setCancelError] = useState('');
  const [cancelSuccess, setCancelSuccess] = useState('');
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
  // Conversations grouped by thread: [{ contactMessageId, hash, subject, messages[], canReply }]
  const [threads, setThreads] = useState([]);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [messagesError, setMessagesError] = useState('');
  const [lastMessageId, setLastMessageId] = useState(null);
  const [hasMoreMessages, setHasMoreMessages] = useState(false);
  // Inline reply — per-thread drafts so each conversation has its own reply box (members
  // reply in place instead of being sent to Contact Us). Reply is only allowed by BC when
  // the thread's last message is from CSR.
  const [replyDrafts, setReplyDrafts] = useState({});   // { [contactMessageId]: text }
  const [replySendingId, setReplySendingId] = useState(null);
  const [replyErrors, setReplyErrors] = useState({});   // { [contactMessageId]: error }
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
      // Stage 1: enumerate via BC and merge into local ref cache. PAGE through every
      // page (BC returns one page per call) so older threads aren't missed — the cause
      // of "not all messages show up" (item ii).
      try {
        const listDocs = [];
        let cursor = null;
        for (let pages = 0; pages < 20; pages++) {
          const list = await api.getUserContacts(cursor || undefined);
          const docs = list?.docs || [];
          listDocs.push(...docs);
          const last = docs[docs.length - 1];
          const next = last?._id || last?.id || null;
          if (list?.noMoreDocs || !docs.length || !next || next === cursor) break;
          cursor = next;
        }
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
              // Thread context so a member can reply inline to this conversation (item iii).
              contactMessageId: ref.contactMessageId,
              hash: ref.hash,
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

      // Group messages into conversation threads so the UI shows each conversation
      // (original + its replies) together instead of one flat date-sorted list. Within a
      // thread, messages render oldest→newest; threads are ordered most-recent-first.
      // A thread is replyable only when its LAST message is from CSR — BC rejects a reply
      // otherwise ("UserReply can be written only if the last written message is a CSR").
      const threadMap = new Map();
      for (const m of finalMsgs) {
        const tid = m.contactMessageId || `solo-${m._id}`;
        if (!threadMap.has(tid)) {
          threadMap.set(tid, { id: tid, contactMessageId: m.contactMessageId || null, hash: m.hash || null, messages: [] });
        }
        threadMap.get(tid).messages.push(m);
      }
      const builtThreads = Array.from(threadMap.values()).map((t) => {
        const msgs = t.messages.slice().sort((a, b) => new Date(a.createdAt || 0) - new Date(b.createdAt || 0));
        const last = msgs[msgs.length - 1];
        const subjectMsg = msgs.find((x) => x.content?.subject);
        return {
          ...t,
          subject: subjectMsg?.content?.subject || 'Support conversation',
          messages: msgs,
          lastTs: new Date(last?.createdAt || 0).getTime(),
          lastIsCsr: last?.type === 'userContactCsrMail',
          canReply: !!(t.contactMessageId && t.hash) && last?.type === 'userContactCsrMail',
        };
      }).sort((a, b) => b.lastTs - a.lastTs);
      setThreads(builtThreads);

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

  // Inline reply to a specific conversation thread — no redirect to Contact Us.
  const handleSendReply = async (thread) => {
    const tid = thread?.contactMessageId;
    const text = (replyDrafts[tid] || '').trim();
    if (!tid || !thread?.hash || !text || replySendingId) return;
    setReplySendingId(tid);
    setReplyErrors((e) => ({ ...e, [tid]: '' }));
    try {
      await api.replyContactMessage({
        contactMessageId: thread.contactMessageId,
        hash: thread.hash,
        message: text,
        contentType: 'text/plain',
      });
      setReplyDrafts((d) => ({ ...d, [tid]: '' }));
      await fetchMessages(); // refresh to show the sent reply
    } catch (err) {
      // BC rejects a reply when the thread's last message isn't a CSR one (the gate
      // should prevent this, but handle it gracefully if state is stale).
      const msg = /last written message is a CSR/i.test(err?.data?.message || err?.message || '')
        ? 'Support needs to reply before you can send another message.'
        : (err?.message || 'Could not send your reply. Please try again.');
      setReplyErrors((e) => ({ ...e, [tid]: msg }));
      await fetchMessages(); // re-sync so the composer reflects the real thread state
    } finally {
      setReplySendingId(null);
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
      // BC answers 403 'Forbidden resource' when the session predates a real BC
      // login (funnel signup issues a synthetic session; the BC user only exists
      // after billing.sale). Raw 'Forbidden resource' means nothing to a member —
      // give them the actionable path (bug list 7/2 #1).
      const raw = err?.message || '';
      const forbidden = err?.status === 403 || /forbidden/i.test(raw);
      setProfileError(
        forbidden
          ? "We couldn't save your changes to this session. Please sign out, sign back in, and try again — if it still doesn't work, contact support and we'll update it for you."
          : (raw || 'Failed to save profile')
      );
      track('profile_save_error', { forbidden, message: raw });
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
      track('subscription_cancel', { orderId: activeOrder._id || activeOrder.id, reason: cancelReason || 'unspecified', reasonText: cancelReasonText || undefined });
      refreshSubscription();
      setCancelError('');
      // The action previously completed with zero feedback (bug list 7/2 #11).
      setCancelSuccess("Your subscription has been cancelled. You'll keep access until the end of your paid period — no further charges.");
    } catch (err) {
      setCancelSuccess('');
      // Instrument the failed-cancel path so churn analytics can see attempts
      // that errored (not just the ones that completed).
      track('subscription_cancel_error', { orderId: activeOrder._id || activeOrder.id, reason: cancelReason || 'unspecified', message: err?.message || err?.data?.error?.message });
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
      // Win-back signal: a cancelled-in-period member turned auto-renew back on.
      track('subscription_reactivate', { orderId: subscription.orderId });
      refreshSubscription();
      setCancelError('');
      setCancelSuccess('Your subscription is active again — auto-renew is back on.');
    } catch (err) {
      setCancelSuccess('');
      track('subscription_reactivate_error', { orderId: subscription.orderId, message: err?.message || err?.data?.error?.message });
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
  // display comes from styles.tabBar (flex on desktop, hidden on mobile — mobile uses the
  // hamburger sub-nav in MemberNav). Keep the rest inline.
  const tabBarStyle = {
    gap: 0,
    marginBottom: '2rem',
    border: '1px solid #e5e7eb',
    borderRadius: '0.5rem',
    overflowX: 'auto',
    WebkitOverflowScrolling: 'touch',
  };

  const tabBtnBase = {
    padding: '0.75rem 1.25rem',
    cursor: 'pointer',
    fontWeight: 600,
    fontSize: '0.9rem',
    flex: '1 0 auto',        // grow to fill on desktop; don't shrink → scroll on mobile
    whiteSpace: 'nowrap',
    transition: 'all 0.15s',
    textAlign: 'center',
  };

  const tabBtnActive = { ...tabBtnBase, background: '#0d5d2f', color: '#fff', border: 'none' };
  const tabBtnInactive = { ...tabBtnBase, background: '#fff', color: '#374151', border: '1px solid transparent' };

  const TABS = [
    { key: 'overview', label: 'Overview' },
    { key: 'contact', label: 'Contact' },
    { key: 'security', label: 'Security' },
    { key: 'billing', label: 'Subscription & Billing' },
    { key: 'messages', label: 'Messages' },
    { key: 'communications', label: 'Communications' },
  ];

  return (
    <PageShell>
      <PageHeader
        title={isIdentityPage ? 'My Identity' : 'Account'}
        subtitle={isIdentityPage
          ? 'See what’s public about you, control your footprint, and protect your identity.'
          : 'Manage your account, subscription, and communication preferences.'}
      />

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
            {cancelStep === 1 ? (
              <>
                <h3 style={{ marginTop: 0, color: '#111827' }}>We&apos;re sorry to see you go</h3>
                <p style={{ color: '#6b7280', lineHeight: '1.6', margin: '0 0 1rem' }}>
                  Help us improve — what&apos;s the main reason you&apos;re cancelling?
                </p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', marginBottom: '1rem' }}>
                  {CANCEL_REASONS.map((r) => (
                    <label key={r.id} style={{
                      display: 'flex', alignItems: 'center', gap: '0.6rem', padding: '0.6rem 0.75rem',
                      border: `1px solid ${cancelReason === r.id ? '#0d5d2f' : '#e5e7eb'}`,
                      background: cancelReason === r.id ? '#f0fdf4' : '#fff',
                      borderRadius: '0.5rem', cursor: 'pointer', fontSize: '0.9rem', color: '#374151',
                    }}>
                      <input type="radio" name="cancelReason" checked={cancelReason === r.id} onChange={() => setCancelReason(r.id)} />
                      {r.label}
                    </label>
                  ))}
                  {cancelReason === 'other' && (
                    <textarea
                      value={cancelReasonText}
                      onChange={(e) => setCancelReasonText(e.target.value)}
                      placeholder="Tell us more (optional)"
                      rows={2}
                      style={{ width: '100%', boxSizing: 'border-box', padding: '0.6rem 0.75rem', border: '1px solid #e5e7eb', borderRadius: '0.5rem', fontSize: '0.9rem', resize: 'vertical' }}
                    />
                  )}
                </div>
                <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
                  <button
                    onClick={() => { track('subscription_keep', { step: 1 }); setShowCancelModal(false); }}
                    style={{ padding: '0.6rem 1.25rem', border: '1px solid #d1d5db', borderRadius: '0.375rem', background: '#fff', cursor: 'pointer' }}
                  >
                    Keep Subscription
                  </button>
                  <button
                    disabled={!cancelReason}
                    onClick={() => { track('subscription_cancel_reason', { reason: cancelReason }); setCancelStep(2); }}
                    style={{ padding: '0.6rem 1.25rem', background: cancelReason ? '#374151' : '#d1d5db', color: '#fff', border: 'none', borderRadius: '0.375rem', cursor: cancelReason ? 'pointer' : 'not-allowed' }}
                  >
                    Continue
                  </button>
                </div>
              </>
            ) : (() => {
              const pitch = savePitch(cancelReason, brand.supportPhone);
              return (
                <>
                  <div style={{ fontSize: '2rem', lineHeight: 1 }} aria-hidden="true">{pitch.emoji}</div>
                  <h3 style={{ margin: '0.5rem 0 0.5rem', color: '#111827' }}>{pitch.title}</h3>
                  <p style={{ color: '#6b7280', lineHeight: '1.6', margin: '0 0 0.75rem' }}>{pitch.body}</p>
                  <p style={{ color: '#9ca3af', fontSize: '0.82rem', lineHeight: '1.5', margin: 0 }}>
                    If you still cancel, you&apos;ll keep access until the end of your billing period — no further charges — then lose your saved reports and member features.
                  </p>
                  <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end', marginTop: '1.5rem' }}>
                    <button
                      onClick={handleCancelConfirm}
                      style={{ padding: '0.6rem 1rem', border: '1px solid #e5e7eb', borderRadius: '0.375rem', background: '#fff', color: '#6b7280', cursor: 'pointer', fontSize: '0.9rem' }}
                    >
                      No thanks, cancel
                    </button>
                    <button
                      onClick={() => { track('subscription_save', { reason: cancelReason }); setShowCancelModal(false); }}
                      style={{ padding: '0.6rem 1.25rem', background: '#0d5d2f', color: '#fff', border: 'none', borderRadius: '0.375rem', cursor: 'pointer', fontWeight: 600 }}
                    >
                      Keep my membership
                    </button>
                  </div>
                </>
              );
            })()}
          </div>
        </div>
      )}

      {/* Tab Bar */}
      <div className={styles.tabBar} style={{ ...tabBarStyle, ...(isIdentityPage ? { display: 'none' } : {}) }}>
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

      {/* ── OVERVIEW TAB (account landing) ───────────────────────────────────── */}
      {activeTab === 'overview' && (
        <div className={styles.section}>
          <h2 className={styles.sectionTitle}>This is your account</h2>
          <p style={{ color: '#4b5563', marginTop: 0 }}>
            Welcome{user && user.firstName ? `, ${user.firstName}` : ''}. Manage your identity, security, subscription, and messages — all in one place.
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 12, marginTop: 16 }}>
            {[
              { key: 'contact', icon: '✉️', title: 'Contact', desc: 'Your email and phone.' },
              { key: 'security', icon: '🔒', title: 'Security', desc: 'Password and privacy controls.' },
              { key: 'billing', icon: '💳', title: 'Subscription & Billing', desc: isPaid ? 'Manage your plan.' : 'Upgrade your plan.' },
              { key: 'messages', icon: '✉️', title: 'Messages', desc: 'Your support conversations.' },
              { key: 'communications', icon: '🔔', title: 'Communications', desc: 'Email preferences.' },
            ].map((c) => (
              <button key={c.key} type="button" onClick={() => setActiveTab(c.key)}
                style={{ textAlign: 'left', background: '#fff', border: '1px solid #e5e7eb', borderRadius: 12, padding: '16px 18px', cursor: 'pointer', boxShadow: '0 1px 3px rgba(17,24,39,0.05)' }}>
                <div style={{ fontSize: 22 }} aria-hidden="true">{c.icon}</div>
                <div style={{ fontWeight: 800, color: '#0d5d2f', marginTop: 6 }}>{c.title}</div>
                <div style={{ fontSize: 13, color: '#6b7280', marginTop: 2 }}>{c.desc}</div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ── MY IDENTITY TAB (WSFY mapped identity) ───────────────────────────── */}
      {activeTab === 'identity' && (
        <div className={styles.section}>
          {/* Subnav — My Identity is a command center: your profile + your footprint across the web
              (docs/design/profile-concept-model.md). */}
          <div style={{ display: 'flex', gap: 4, borderBottom: '1px solid #e5e7eb', marginBottom: 20, flexWrap: 'wrap' }}>
            {[{ k: 'profile', label: 'Overview' }, { k: 'modular', label: 'My Profile' }, { k: 'footprint', label: 'Digital Footprint' }].map((t) => (
              <button key={t.k} type="button" onClick={() => setIdentitySubTab(t.k)}
                style={{ background: 'none', border: 'none', borderBottom: `2px solid ${identitySubTab === t.k ? '#0d5d2f' : 'transparent'}`, color: identitySubTab === t.k ? '#0d5d2f' : '#6b7280', fontSize: 14.5, fontWeight: 700, padding: '9px 14px', cursor: 'pointer', marginBottom: -1 }}>
                {t.label}
              </button>
            ))}
          </div>

          {/* Per-tab value explainer — clarifies Overview (assessment) vs My Profile (workspace) vs Footprint. */}
          <p style={{ margin: '-10px 0 20px', fontSize: 13, color: '#6b7280', lineHeight: 1.5, maxWidth: 660 }}>
            {identitySubTab === 'profile'
              ? 'Your identity protection at a glance — your score, what’s exposed, and quick actions.'
              : identitySubTab === 'modular'
                ? 'Curate what you show and hide what you don’t — protect or promote each part of your profile, and preview exactly how others see you.'
                : 'Everywhere you appear online, and how to take control.'}
          </p>

          {identitySubTab === 'modular' && <MyProfileModularLive />}

          {identitySubTab === 'footprint' && (
            <>
              <DigitalFootprint onManage={() => setIdentitySubTab('profile')} />
              <div style={{ marginTop: 16 }}>
                <ProtectionScoreRing />
              </div>
            </>
          )}

          {identitySubTab === 'profile' && (
          <>
          {identity && (identity.confirmed || identity.name || identity.hasReport) && !editingIdentity ? (
            // ── MAPPED — vCard of your linked public record + exposure, then tier-specific actions:
            //    state (b) free = obfuscated profile + unlock upsell; state (c) paid = Protect / Promote.
            <>
            {(() => {
              const name = identity.name || [user && user.firstName, user && user.lastName].filter(Boolean).join(' ') || 'Your record';
              const initial = (name.trim()[0] || '?').toUpperCase();
              const location = [identity.city, identity.state].filter(Boolean).join(', ');
              // Free tier sees a LOCKED preview: the categories + risk stats stay crisp, but the
              // specific values (employer, schools, exact location) blur behind the upsell.
              const locked = !isPaid;
              const chips = [
                (identity.jobTitle || identity.occupation) ? { icon: '💼', text: identity.jobTitle || identity.occupation, sensitive: true } : null,
                identity.employer ? { icon: '🏢', text: identity.employer, sensitive: true } : null,
                identity.highSchool ? { icon: '🎓', text: identity.highSchool, sensitive: true } : null,
                identity.college ? { icon: '🎓', text: identity.college, sensitive: true } : null,
                identity.relativesCount != null ? { icon: '👥', text: `${identity.relativesCount} relatives on record`, sensitive: false } : null,
                location ? { icon: '📍', text: location, sensitive: true } : null,
              ].filter(Boolean);
              const exposure = computeExposure(identity, hiddenFields);
              // Per-item hide handler (paid only) — optimistic, server-persisted, updates the score.
              const toggleHide = async (key, on) => {
                setHiddenFields((prev) => on ? [...new Set([...prev, key])] : prev.filter((k) => k !== key));
                const res = await setFieldSuppression(key, on, { name: identity.name, state: identity.state });
                if (Array.isArray(res)) setHiddenFields(res);
              };
              const expColor = !exposure ? '#0d5d2f' : exposure.score >= 65 ? '#dc2626' : exposure.score >= 35 ? '#f59e0b' : '#0d5d2f';
              return (
                <div style={{ border: '1px solid #d7ddd9', borderRadius: 14, overflow: 'hidden', boxShadow: '0 4px 18px rgba(13,93,47,0.10)' }}>
                  <div style={{ background: '#0d5d2f', color: '#fff', padding: '18px 20px', display: 'flex', gap: 14, alignItems: 'center' }}>
                    <div style={{ width: 52, height: 52, borderRadius: '50%', background: 'rgba(255,255,255,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, fontWeight: 800 }}>{initial}</div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 20, fontWeight: 800 }}>{name}{identity.age ? `, ${identity.age}` : ''}</div>
                      {location && <div style={{ color: '#eafff0', fontSize: 14 }}>{location}</div>}
                      <div style={{ marginTop: 5, display: 'inline-flex', flexWrap: 'wrap', gap: 6 }}>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 11, fontWeight: 700, background: 'rgba(255,255,255,0.18)', borderRadius: 999, padding: '2px 9px' }}>✓ Identity confirmed</span>
                        {identity.verified === 'id' ? (
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 11, fontWeight: 700, background: '#fff', color: '#0d5d2f', borderRadius: 999, padding: '2px 9px' }}>🛡️ ID verified</span>
                        ) : identity.verified === 'kba' ? (
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 11, fontWeight: 700, background: 'rgba(255,255,255,0.28)', borderRadius: 999, padding: '2px 9px' }}>✓ Verified</span>
                        ) : null}
                      </div>
                    </div>
                  </div>
                  <div style={{ padding: '16px 20px', background: '#fff' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 8 }}>
                      <span style={{ fontSize: 11, fontWeight: 800, letterSpacing: '0.06em', textTransform: 'uppercase', color: '#6b7280' }}>What's public about you</span>
                      {locked && <span style={{ fontSize: 11, fontWeight: 700, color: '#0d5d2f' }}>🔒 Locked preview</span>}
                    </div>
                    {chips.length > 0 ? (
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                        {chips.map((chip, i) => {
                          const blur = locked && chip.sensitive;
                          return (
                            <span key={i} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13, background: '#f0fdf4', border: '1px solid #bbf7d0', color: '#166534', borderRadius: 999, padding: '5px 12px' }}>
                              <span aria-hidden="true">{chip.icon}</span>
                              <span style={blur ? { filter: 'blur(5px)', userSelect: 'none' } : undefined}>{chip.text}</span>
                              {blur && <span aria-hidden="true">🔒</span>}
                            </span>
                          );
                        })}
                      </div>
                    ) : (
                      <p style={{ margin: 0, color: '#6b7280', fontSize: 13 }}>Your record is linked. We'll surface what's exposed here.</p>
                    )}

                    {/* Exposure score — the Identity Management hook, with a substantiated breakdown. */}
                    {exposure && (exposure.count > 0 || (exposure.hidden && exposure.hidden.length > 0)) && (
                      <div style={{ marginTop: 16, padding: '14px 16px', background: '#f8faf9', border: '1px solid #e5e7eb', borderRadius: 10 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 8 }}>
                          <span style={{ fontSize: 14, fontWeight: 800, color: '#111827' }}>Exposure score: <span style={{ color: expColor }}>{exposure.level}</span></span>
                          <span style={{ fontSize: 13, fontWeight: 700, color: expColor }}>{exposure.score}/100</span>
                        </div>
                        <div style={{ height: 8, background: '#eef2f0', borderRadius: 999, overflow: 'hidden', marginBottom: 12 }}>
                          <div style={{ height: '100%', width: `${exposure.score}%`, background: expColor, transition: 'width .3s' }} />
                        </div>
                        {/* Backed-up breakdown: what's driving the score, from your actual record. */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                          {exposure.breakdown.map((b) => (
                            <div key={b.key} style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                              <span style={{ marginTop: 2, width: 8, height: 8, borderRadius: '50%', background: expColor, flexShrink: 0 }} aria-hidden="true" />
                              <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ fontSize: 13, fontWeight: 700, color: '#111827' }}>{b.label} <span style={{ fontWeight: 400, color: '#9ca3af', fontSize: 12 }}>+{b.points}</span></div>
                                <div style={{ fontSize: 12.5, color: '#6b7280', lineHeight: 1.4, ...(locked ? { filter: 'blur(4px)', userSelect: 'none' } : {}) }}>{b.detail}</div>
                              </div>
                              {isPaid ? (
                                <button type="button" onClick={() => toggleHide(b.key, true)}
                                  style={{ flexShrink: 0, alignSelf: 'center', fontSize: 12, fontWeight: 700, color: '#0d5d2f', background: 'none', cursor: 'pointer', whiteSpace: 'nowrap', border: '1px solid #bbf7d0', borderRadius: 999, padding: '4px 10px' }}>
                                  Hide →
                                </button>
                              ) : (
                                <Link to={`/payment?upgrade=1&reason=identity&hide=${b.key}`}
                                  style={{ flexShrink: 0, alignSelf: 'center', fontSize: 12, fontWeight: 700, color: '#0d5d2f', textDecoration: 'none', whiteSpace: 'nowrap', border: '1px solid #bbf7d0', borderRadius: 999, padding: '4px 10px' }}>
                                  Hide →
                                </Link>
                              )}
                            </div>
                          ))}
                        </div>
                        {/* Per-item hides — struck through, with an Unhide affordance. Paid only. */}
                        {exposure.hidden && exposure.hidden.length > 0 && (
                          <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px dashed #e5e7eb' }}>
                            <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: '0.05em', textTransform: 'uppercase', color: '#0d5d2f', marginBottom: 8 }}>✓ Hidden ({exposure.hidden.length})</div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                              {exposure.hidden.map((h) => (
                                <div key={h.key} style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                                  <span style={{ flex: 1, minWidth: 0, fontSize: 13, color: '#9ca3af', textDecoration: 'line-through' }}>{h.label}</span>
                                  <button type="button" onClick={() => toggleHide(h.key, false)}
                                    style={{ flexShrink: 0, fontSize: 12, fontWeight: 700, color: '#6b7280', background: 'none', cursor: 'pointer', whiteSpace: 'nowrap', border: '1px solid #e5e7eb', borderRadius: 999, padding: '4px 10px' }}>
                                    Unhide
                                  </button>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                        <p style={{ margin: '12px 0 0', fontSize: 11.5, color: '#9ca3af', lineHeight: 1.5 }}>
                          {isPaid
                            ? "Calculated from your confirmed public record. Hiding a driver above removes it from your exposure — and stops it being surfaced about you across IDLookup."
                            : 'Calculated from your confirmed public record. Reducing any of these — hiding your record here and opting out of data brokers — lowers your score.'}
                        </p>
                      </div>
                    )}

                    <div style={{ marginTop: 14 }}>
                      <button type="button" onClick={() => setEditingIdentity(true)}
                        style={{ background: 'none', border: 'none', color: '#6b7280', fontSize: 13, cursor: 'pointer', textDecoration: 'underline' }}>
                        Update my record
                      </button>
                    </div>
                  </div>
                </div>
              );
            })()}

            {/* Tier-specific actions below the vCard. (c) paid → Protect / Promote tracks;
                (b) free → single "unlock full report & protection" upsell. */}
            {isPaid ? (
              <>
              {/* State (c) headline — access the member's full background report. identity.reportId is
                  the canonical, re-fetchable commerceContentId; /people/:id renders the paid
                  expose-all report we already ship. No reportId (mapped while free, then upgraded) →
                  re-run the identify flow, which auto-creates the report on the paid path. */}
              {/* My Profile connector — Overview links into the full modular profile workspace, which now
                  owns the report-as-profile (no redundant full report here). Summary → workspace pattern. */}
              <div style={{ marginTop: 16 }}>
                <MyProfileSummary onManage={() => setIdentitySubTab('modular')} />
              </div>
              {/* Optional, non-blocking ID verification — upgrade KBA/self-asserted mapping to ID-verified. */}
              <div style={{ marginTop: 12 }}>
                {identity.verified === 'id' ? (
                  <div style={{ border: '1px solid #d7ddd9', borderRadius: 12, padding: '16px 18px', background: '#f8faf9', display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span style={{ fontSize: 18 }}>🛡️</span>
                    <div>
                      <div style={{ fontSize: 14, fontWeight: 800, color: '#0d5d2f' }}>ID verified</div>
                      <div style={{ fontSize: 12.5, color: '#6b7280' }}>You've confirmed this record with a government ID.</div>
                    </div>
                  </div>
                ) : (
                  <DlScanVerify recordName={identity.name}
                    onVerified={() => { setVerifiedLevel('id'); setIdentity(getMappedIdentity()); }} />
                )}
              </div>
              <div style={{ marginTop: 12, display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 12 }}>
                <div style={{ border: '1px solid #e5e7eb', borderRadius: 12, padding: '16px 18px', background: '#fff' }}>
                  <div style={{ fontSize: 15, fontWeight: 800, color: '#0d5d2f' }}>🔒 Protect</div>
                  <p style={{ margin: '6px 0 10px', fontSize: 13, color: '#4b5563', lineHeight: 1.5 }}>
                    Control what's visible about you — hide individual details and manage your footprint across the web.
                  </p>
                  <button type="button" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
                    style={{ background: 'none', border: 'none', padding: 0, fontSize: 13, fontWeight: 700, color: '#0d5d2f', textDecoration: 'underline', cursor: 'pointer' }}>
                    Manage my footprint →
                  </button>
                </div>
                <div style={{ border: '1px solid #e5e7eb', borderRadius: 12, padding: '16px 18px', background: '#fff' }}>
                  <div style={{ fontSize: 15, fontWeight: 800, color: '#0d5d2f' }}>📣 Promote</div>
                  <p style={{ margin: '6px 0 10px', fontSize: 13, color: '#4b5563', lineHeight: 1.5 }}>
                    Curate what people find — control the profile you present and share it on your terms.
                  </p>
                  <span style={{ fontSize: 12, fontWeight: 700, color: '#9ca3af' }}>Coming soon</span>
                </div>
              </div>
              </>
            ) : (
              <div style={{ marginTop: 16, background: '#0d5d2f', color: '#fff', borderRadius: 12, padding: '18px 20px' }}>
                <div style={{ fontSize: 16, fontWeight: 800 }}>🔒 Unlock your full identity report & protection</div>
                <p style={{ margin: '6px 0 12px', fontSize: 13.5, color: '#eafff0', lineHeight: 1.5 }}>
                  See every address, phone, relative, and record tied to you — plus the tools to hide what you don't want public and monitor who's searching for you.
                </p>
                <button type="button" onClick={() => navigate('/payment?upgrade=1&reason=identity')}
                  style={{ background: '#fff', color: '#0d5d2f', border: 'none', borderRadius: 8, padding: '11px 22px', fontSize: 14, fontWeight: 800, cursor: 'pointer' }}>
                  Unlock full report →
                </button>
              </div>
            )}
            </>
          ) : (
            <>
              {/* STATE (a) not mapped — promotional framing above the confirm-identity form. */}
              <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 12, padding: '16px 18px', marginBottom: 14 }}>
                <div style={{ fontSize: 16, fontWeight: 800, color: '#0d5d2f' }}>Confirm your identity to unlock your protection dashboard</div>
                <ul style={{ margin: '8px 0 0', paddingLeft: 18, fontSize: 13.5, color: '#166534', lineHeight: 1.7 }}>
                  <li>See who's searching for you</li>
                  <li>See exactly what's public about you</li>
                  <li>Take control — hide what you don't want exposed</li>
                </ul>
              </div>
              <SelfIdentifyCard forceShow onComplete={(id) => { setIdentity(id || getMappedIdentity()); setEditingIdentity(false); }} />
            </>
          )}

          {/* Privacy control — "Hide me" on our own surfaces (WSFY). External data-broker removal
              is a separate BC-owned opt-out linked below. Only meaningful once identity is mapped. */}
          {identity && (identity.confirmed || identity.name) && (
            <div style={{ marginTop: 18, padding: '14px 16px', border: '1px solid #e5e7eb', borderRadius: 12, background: '#fff' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                <div style={{ flex: 1, minWidth: 220 }}>
                  <div style={{ fontWeight: 700, color: '#111827', fontSize: 14 }}>Hide my activity on {brand.name}</div>
                  <p style={{ margin: '3px 0 0', color: '#6b7280', fontSize: 13 }}>When on, others won't see that you've searched for them.</p>
                </div>
                <button type="button" role="switch" aria-checked={suppressed}
                  onClick={async () => { const next = !suppressed; setSuppressed(next); await setSuppression(next, { name: identity.name, state: identity.state }); }}
                  style={{ width: 50, height: 28, borderRadius: 999, border: 'none', cursor: 'pointer', background: suppressed ? '#0d5d2f' : '#d1d5db', position: 'relative', transition: 'background .2s', flexShrink: 0 }}>
                  <span style={{ position: 'absolute', top: 3, left: suppressed ? 25 : 3, width: 22, height: 22, borderRadius: '50%', background: '#fff', transition: 'left .2s' }} />
                </button>
              </div>
            </div>
          )}
          </>
          )}
        </div>
      )}

      {/* ── CONTACT TAB (email + phone; name lives in My Identity) ─────────────── */}
      {activeTab === 'contact' && (
        <div className={styles.section}>
          <h2 className={styles.sectionTitle}>Contact information</h2>

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
                {/* First/Last name intentionally NOT editable here — the name is your IDENTITY
                    (shown in the summary above; source of truth = your confirmed record / account).
                    Editing it in two places caused misalignment. Contact info = email + phone.
                    handleProfileSave still sends the existing name unchanged. */}

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
            {cancelSuccess && (
              <p style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', color: '#166534', borderRadius: '0.5rem', padding: '0.65rem 0.9rem', fontSize: '0.9rem' }}>
                ✓ {cancelSuccess}
              </p>
            )}
            {isPaid && subscription ? (
              <div>
                <div className={styles.planInfo}>
                  <span>
                    <strong>Plan:</strong> {planDisplayName || 'Subscription'}
                  </span>
                  {subscription.subStatus === 'canceled' ? (
                    <span className={styles.subscriptionBadge} style={{ background: '#fef3c7', color: '#92400e' }}>
                      Cancelled
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
                      background: '#f59e0b',
                      color: '#111827',
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
                  <button className={styles.cancelBtn} onClick={() => { track('cancel_lightbox_view', {}); setCancelStep(1); setCancelReason(''); setCancelReasonText(''); setShowCancelModal(true); }}>
                    Cancel Subscription
                  </button>
                )}
              </div>
            ) : (
              <div>
                {/* Say WHY there's no subscription when we can tell (bug list 7/2 #11:
                    a CSR-refunded/expired account read like the user never paid). */}
                <p style={{ color: '#6b7280', marginBottom: '1rem' }}>
                  {(() => {
                    const list = orders || [];
                    const refunded = list.some((o) =>
                      Number(o?.transient?.amount?.refunded ?? 0) > 0
                      || String(o?.type || '').toLowerCase() === 'refund'
                      || /refund/i.test(o?.statusReason || ''));
                    if (refunded) return 'Your subscription has ended and your payment was refunded.';
                    const expired = list.some((o) => String(o?.subStatus || '').toLowerCase() === 'expired');
                    if (expired) return 'Your subscription has expired.';
                    return 'You do not have an active subscription.';
                  })()}
                </p>
                <Link
                  to="/payment"
                  style={{
                    display: 'inline-block',
                    padding: '0.75rem 1.5rem',
                    background: '#f59e0b',
                    color: '#111827',
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
                  const rows = [{
                    id: `synth-${o._id || o.id || ts}`,
                    ts,
                    amount: trialPrice.amount,
                    currency: (trialPrice.code || 'usd').toUpperCase(),
                    type: 'sale',
                    status: 'paid',
                  }];
                  // CSR refunds must show here too — the synthesized fallback
                  // previously only ever produced the sale row, so a refunded
                  // account still read "$1.00 Paid" (bug list 7/2 #11).
                  const refundedAmt = Number(o?.transient?.amount?.refunded ?? 0);
                  if (refundedAmt > 0) {
                    rows.push({
                      id: `synth-refund-${o._id || o.id || ts}`,
                      ts: (o.updatedAt ? new Date(o.updatedAt).getTime() : 0) || ts,
                      amount: refundedAmt,
                      currency: (trialPrice.code || 'usd').toUpperCase(),
                      type: 'refund',
                      status: 'refunded',
                    });
                  }
                  return rows;
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
                    className={`${styles.loadMoreBtn} ${styles.loadMoreBtnTeal}`}
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
              {threads.map((thread, ti) => {
                const draft = replyDrafts[thread.contactMessageId] || '';
                const sending = replySendingId === thread.contactMessageId;
                const err = replyErrors[thread.contactMessageId];
                const last = thread.messages[thread.messages.length - 1];
                return (
                  <div key={thread.id || ti} style={{ border: '1px solid #e5e7eb', borderRadius: '0.75rem', marginBottom: '1.25rem', overflow: 'hidden' }}>
                    {/* Thread header — subject + summary */}
                    <div style={{ background: '#f9fafb', borderBottom: '1px solid #e5e7eb', padding: '0.7rem 1rem' }}>
                      <div style={{ fontWeight: 700, fontSize: '0.95rem', color: '#111827' }}>{thread.subject}</div>
                      <div style={{ fontSize: '0.78rem', color: '#9ca3af', marginTop: '0.15rem' }}>
                        {thread.messages.length} message{thread.messages.length === 1 ? '' : 's'} · last activity {formatMessageDate(last?.createdAt)}
                      </div>
                    </div>
                    {/* Conversation — oldest first; original message labelled, replies indented in time */}
                    <div style={{ padding: '0.75rem 1rem' }}>
                      {thread.messages.map((msg, mi) => {
                        const isSupport = msg.type === 'userContactCsrMail';
                        const isOriginal = mi === 0 && !isSupport;
                        const messageBody = msg.content?.message || '';
                        const isHtml = msg.content?.contentType === 'text/html';
                        return (
                          <div key={msg._id || mi} style={{
                            padding: '0.6rem 0.8rem', marginBottom: '0.5rem',
                            marginLeft: isSupport ? '1.25rem' : 0,
                            background: isSupport ? '#f0fdf4' : '#f9fafb',
                            borderLeft: `3px solid ${isSupport ? '#0d5d2f' : '#d1d5db'}`, borderRadius: '0.4rem',
                          }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.3rem', gap: '0.5rem', flexWrap: 'wrap' }}>
                              <span style={{ fontWeight: 600, fontSize: '0.84rem', color: isSupport ? '#0d5d2f' : '#374151' }}>
                                {isSupport ? 'Support Team' : (isOriginal ? 'You · original message' : 'You · reply')}
                              </span>
                              <span style={{ fontSize: '0.78rem', color: '#9ca3af' }}>{formatMessageDate(msg.createdAt)}</span>
                            </div>
                            {isHtml ? (
                              <div style={{ color: '#374151', fontSize: '0.88rem', lineHeight: '1.6', wordBreak: 'break-word' }} dangerouslySetInnerHTML={{ __html: sanitizeMessageHtml(messageBody) }} />
                            ) : (
                              <p style={{ color: '#374151', fontSize: '0.88rem', lineHeight: '1.6', margin: 0, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{messageBody}</p>
                            )}
                          </div>
                        );
                      })}
                      {/* Per-thread reply — only when support replied last (BC rule) */}
                      {thread.canReply ? (
                        <div style={{ marginTop: '0.5rem' }}>
                          <textarea
                            value={draft}
                            onChange={(e) => setReplyDrafts((d) => ({ ...d, [thread.contactMessageId]: e.target.value }))}
                            placeholder="Reply to support…"
                            rows={2}
                            disabled={sending}
                            style={{ width: '100%', boxSizing: 'border-box', padding: '0.6rem 0.75rem', border: '1px solid #d1d5db', borderRadius: '0.5rem', fontSize: '0.92rem', fontFamily: 'inherit', resize: 'vertical' }}
                          />
                          {err && <p style={{ margin: '0.3rem 0 0', color: '#dc2626', fontSize: '0.82rem' }}>{err}</p>}
                          <button
                            type="button"
                            onClick={() => handleSendReply(thread)}
                            disabled={sending || !draft.trim()}
                            style={{ marginTop: '0.5rem', padding: '0.55rem 1.05rem', background: '#0d5d2f', color: '#fff', border: 'none', borderRadius: '0.5rem', fontSize: '0.88rem', fontWeight: 600, cursor: sending || !draft.trim() ? 'default' : 'pointer', opacity: sending || !draft.trim() ? 0.6 : 1 }}
                          >
                            {sending ? 'Sending…' : 'Send reply'}
                          </button>
                        </div>
                      ) : (
                        thread.contactMessageId && (
                          <p style={{ margin: '0.4rem 0 0', fontSize: '0.8rem', color: '#9ca3af' }}>
                            You'll be able to reply here once support responds.
                          </p>
                        )
                      )}
                    </div>
                  </div>
                );
              })}

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
    </PageShell>
  );
};

export default AccountPage;
