import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import api from '../../api';
import { getReportList } from '../../services/reportService';
import { track } from '../../services/trackingService';
import { readLoginHistory } from '../../services/loginHistory';
import { getBrand } from '../../services/brand';
import { generateSyntheticActivity, hashString } from './watchingHelpers';
import { US_STATES } from '../../data/usStates';

/**
 * Dashboard — research-workbench layout.
 *
 * Now the canonical dashboard at /dashboard. Every widget is backed by real
 * BC data or the mock-server search log — no seeded PRNG. The previous
 * monitoring-framed DashboardHome is parked but still in the repo for
 * reference. /dashboard2 redirects here.
 */

const PAGE = {
  bg: '#f7f8fa',
  card: '#ffffff',
  border: '#e5e7eb',
  borderStrong: '#d1d5db',
  text: '#111827',
  textMuted: '#6b7280',
  textSubtle: '#9ca3af',
  brand: '#0d5d2f',
  brandSoft: '#dcfce7',
  accent: '#1a56db',
  accentSoft: '#dbeafe',
  warn: '#92400e',
  warnSoft: '#fef3c7',
};

const INTENT_COPY = {
  find_someone: "Looking for someone specific? Run a name, phone, or email search to start.",
  my_record:    "Want to see what's on your own record? Search yourself first — you can always pull a fresh copy later.",
  safety_check: "Doing a safety check? Pull reports for any new contacts or neighbors and revisit them anytime.",
  reconnect:    "Reconnecting? Pull a report to find current contact info and recent locations.",
  other:        "Run a name, phone, or email search to pull your first report.",
};

function readSignupIntent() {
  try {
    const raw = sessionStorage.getItem('signupProfile');
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed?.intent || null;
  } catch { return null; }
}

function formatRelative(value) {
  if (!value) return '—';
  const d = typeof value === 'number' ? new Date(value) : new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  const diffMs = Date.now() - d.getTime();
  const sec = Math.floor(diffMs / 1000);
  if (sec < 60) return 'just now';
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const day = Math.floor(hr / 24);
  if (day < 30) return `${day}d ago`;
  const month = Math.floor(day / 30);
  if (month < 12) return `${month}mo ago`;
  return `${Math.floor(month / 12)}y ago`;
}

function formatDate(value) {
  if (!value) return '—';
  try {
    return new Date(value).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
  } catch { return '—'; }
}

function freshnessBucket(value) {
  if (!value) return { label: 'unknown', color: PAGE.textSubtle };
  const days = (Date.now() - new Date(value).getTime()) / 86400000;
  if (days < 7) return { label: 'fresh', color: PAGE.brand };
  if (days < 30) return { label: 'recent', color: PAGE.accent };
  if (days < 90) return { label: 'aging', color: PAGE.warn };
  return { label: 'stale', color: '#b91c1c' };
}

function reportSubject(report) {
  const ti = report?.data?.teaserInput || report?.teaserInput || {};
  if (ti.fName || ti.lName) {
    return [ti.fName, ti.lName].filter(Boolean).join(' ') + (ti.state ? ` · ${ti.state.toUpperCase()}` : '');
  }
  if (ti.phone) return ti.phone;
  if (ti.email) return ti.email;
  return '(unnamed report)';
}

function reportType(report) {
  const t = report?.data?.teaserInput?.type || report?.teaserInput?.type;
  if (t === 'name') return 'Name';
  if (t === 'phone') return 'Phone';
  if (t === 'email') return 'Email';
  return '—';
}

// ─── Subscription tile ──────────────────────────────────────────────────────

function SubscriptionTile({ subscription, orders, planDisplayName, navigate }) {
  const brand = getBrand();
  const order = (orders || []).find((o) => o.status === 'active' && !o?.transient?.canceled) || (orders || [])[0] || null;
  const renewal = order?.dueTimestamp ? new Date(order.dueTimestamp) : null;
  const status = subscription?.status === 'active' && !order?.transient?.canceled ? 'Active' : subscription?.status === 'active' ? 'Canceling' : 'Free';
  const isFree = status === 'Free';
  // Prefer the human-readable plan name from BC's offer (extName / product name).
  // Fall back to a generic "{brand} Membership" label — never surface the raw
  // commerceOffer ObjectId to the user.
  const planLabel = planDisplayName || (isFree ? 'No plan' : `${brand.name} Membership`);

  return (
    <div style={{
      // Unsubscribed members get a brand-accented banner instead of the neutral
      // card surface — turns the tile into a conversion CTA rather than a
      // passive status indicator.
      background: isFree ? '#f0fdf4' : PAGE.card,
      border: `1px solid ${isFree ? PAGE.brand : PAGE.border}`,
      borderRadius: '0.75rem',
      padding: '1rem 1.25rem',
      display: 'flex',
      gap: '1rem',
      alignItems: 'center',
      flexWrap: 'wrap',
    }}>
      <div style={{ flex: 1, minWidth: 220 }}>
        <div style={{ fontSize: '0.72rem', color: PAGE.textMuted, textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 700 }}>
          Membership
        </div>
        <div style={{ fontSize: '1.05rem', fontWeight: 700, marginTop: '0.15rem', color: PAGE.text }}>
          {planLabel}
        </div>
        <div style={{ fontSize: '0.85rem', color: PAGE.textMuted, marginTop: '0.15rem' }}>
          Status: <strong style={{ color: status === 'Active' ? PAGE.brand : status === 'Canceling' ? PAGE.warn : PAGE.textSubtle }}>{status}</strong>
          {renewal && ` · Renews ${formatDate(renewal)}`}
        </div>
        {isFree && (
          <div style={{ fontSize: '0.85rem', color: PAGE.text, marginTop: '0.5rem', lineHeight: 1.4 }}>
            Unlock unlimited searches and full reports.
          </div>
        )}
      </div>
      <button
        type="button"
        // Free members get routed into the search funnel — start a search,
        // pick a person, hit /payment with that target. Subscribed members
        // keep the original "Manage subscription" affordance.
        onClick={() => navigate(isFree ? '/people-search' : '/account')}
        style={{
          background: isFree ? PAGE.brand : PAGE.card,
          color: isFree ? '#fff' : PAGE.brand,
          border: `1px solid ${PAGE.brand}`,
          padding: '0.5rem 0.875rem',
          borderRadius: '0.375rem',
          fontSize: '0.85rem',
          fontWeight: 600,
          cursor: 'pointer',
        }}
      >
        {isFree ? 'Subscribe Now' : 'Manage subscription'}
      </button>
    </div>
  );
}

// ─── Stat tile ──────────────────────────────────────────────────────────────

function StatTile({ label, value, sublabel, loading }) {
  return (
    <div style={{
      flex: 1, minWidth: 160,
      background: PAGE.card,
      border: `1px solid ${PAGE.border}`,
      borderRadius: '0.75rem',
      padding: '1rem 1.25rem',
    }}>
      <div style={{ fontSize: '0.72rem', color: PAGE.textMuted, textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 700 }}>
        {label}
      </div>
      <div style={{ fontSize: '1.6rem', fontWeight: 800, color: PAGE.text, marginTop: '0.2rem', minHeight: '2rem' }}>
        {loading ? <span style={{ display: 'inline-block', width: 48, height: 22, background: '#eef2f6', borderRadius: 4 }} /> : value}
      </div>
      {sublabel && (
        <div style={{ fontSize: '0.78rem', color: PAGE.textSubtle, marginTop: '0.1rem' }}>{sublabel}</div>
      )}
    </div>
  );
}

// ─── Inline name search — primary CTA (bug #48) ──────────────────────────
// Three required fields (first, last, state) submitted to /people-search via
// URL params — MemberGeneralSearchPage already reads these on mount, so
// landing on that page with prefilled state lets the user fire the search
// with one more click. Two-letter state matches the rest of the funnel.

function InlineNameSearch({ navigate }) {
  const [firstName, setFirstName] = React.useState('');
  const [lastName, setLastName] = React.useState('');
  const [stateAbbr, setStateAbbr] = React.useState('');
  const [error, setError] = React.useState('');

  const submit = (e) => {
    e.preventDefault();
    const fn = firstName.trim();
    const ln = lastName.trim();
    const st = stateAbbr.trim().toUpperCase();
    if (!fn || !ln) { setError('Enter both a first and last name.'); return; }
    if (!/^[A-Z]{2}$/.test(st)) { setError('Enter a 2-letter state (e.g., CA).'); return; }
    track('dashboard_inline_search_submit', {});
    const qs = new URLSearchParams({ firstName: fn, lastName: ln, state: st });
    navigate(`/people-search?${qs.toString()}`);
  };

  return (
    <form
      onSubmit={submit}
      style={{
        background: PAGE.card,
        border: `1px solid ${PAGE.borderStrong}`,
        borderRadius: '0.75rem',
        padding: '1rem 1.25rem',
        marginBottom: '1rem',
      }}
    >
      <div style={{
        fontSize: '0.72rem', color: PAGE.textMuted, textTransform: 'uppercase',
        letterSpacing: '0.06em', fontWeight: 700, marginBottom: '0.5rem',
      }}>
        Run a new search
      </div>
      <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'flex-end' }}>
        <input
          type="text"
          value={firstName}
          onChange={(e) => { setError(''); setFirstName(e.target.value); }}
          placeholder="First name"
          autoComplete="given-name"
          style={{
            flex: '1 1 140px', minWidth: 120,
            padding: '0.55rem 0.7rem', fontSize: '0.9rem',
            border: `1px solid ${PAGE.border}`, borderRadius: '0.375rem',
          }}
        />
        <input
          type="text"
          value={lastName}
          onChange={(e) => { setError(''); setLastName(e.target.value); }}
          placeholder="Last name"
          autoComplete="family-name"
          style={{
            flex: '1 1 140px', minWidth: 120,
            padding: '0.55rem 0.7rem', fontSize: '0.9rem',
            border: `1px solid ${PAGE.border}`, borderRadius: '0.375rem',
          }}
        />
        <select
          value={stateAbbr}
          onChange={(e) => { setError(''); setStateAbbr(e.target.value); }}
          aria-label="State"
          style={{
            flex: '1 1 150px', minWidth: 130,
            padding: '0.55rem 0.7rem', fontSize: '0.9rem',
            background: '#fff',
            border: `1px solid ${PAGE.border}`, borderRadius: '0.375rem',
          }}
        >
          {US_STATES.map((s) => (
            <option key={s.value} value={s.value}>{s.label}</option>
          ))}
        </select>
        <button
          type="submit"
          style={{
            background: PAGE.brand, color: '#fff', border: 'none',
            padding: '0.55rem 1rem', borderRadius: '0.375rem',
            fontSize: '0.9rem', fontWeight: 700, cursor: 'pointer',
          }}
        >
          🔍 Search
        </button>
      </div>
      {error && (
        <div style={{ marginTop: '0.4rem', fontSize: '0.78rem', color: '#dc2626' }}>{error}</div>
      )}
    </form>
  );
}

// ─── Reports library — hero ────────────────────────────────────────────────

function ReportsLibrary({ reports, loading, onPdfDownload, navigate }) {
  const [sort, setSort] = useState('newest');

  const sorted = useMemo(() => {
    const arr = [...(reports || [])];
    arr.sort((a, b) => {
      const ad = new Date(a.createdAt || a.updatedAt || 0).getTime();
      const bd = new Date(b.createdAt || b.updatedAt || 0).getTime();
      if (sort === 'newest') return bd - ad;
      if (sort === 'oldest') return ad - bd;
      if (sort === 'subject') return reportSubject(a).localeCompare(reportSubject(b));
      return 0;
    });
    return arr;
  }, [reports, sort]);

  return (
    <section style={{
      background: PAGE.card,
      border: `1px solid ${PAGE.border}`,
      borderRadius: '0.75rem',
      overflow: 'hidden',
    }}>
      <header style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '0.875rem 1.25rem',
        borderBottom: `1px solid ${PAGE.border}`,
      }}>
        <div>
          <h2 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 700, color: PAGE.text }}>Your Reports</h2>
          <p style={{ margin: '0.15rem 0 0', fontSize: '0.8rem', color: PAGE.textMuted }}>
            Every report you've pulled. Sort, re-open, or refresh as needed.
          </p>
        </div>
        <select
          value={sort}
          onChange={(e) => setSort(e.target.value)}
          style={{
            background: PAGE.card, border: `1px solid ${PAGE.borderStrong}`,
            borderRadius: '0.375rem', fontSize: '0.85rem', padding: '0.4rem 0.6rem',
          }}
        >
          <option value="newest">Newest first</option>
          <option value="oldest">Oldest first</option>
          <option value="subject">By subject</option>
        </select>
      </header>

      {loading && (
        <div style={{ padding: '1rem 1.25rem' }}>
          {[0, 1, 2].map((i) => (
            <div key={i} style={{
              height: 56, background: '#f1f5f9', borderRadius: 6, marginBottom: i < 2 ? 8 : 0,
            }} />
          ))}
        </div>
      )}

      {!loading && sorted.length === 0 && (
        <div style={{ padding: '2rem 1.25rem', textAlign: 'center' }}>
          <div style={{ fontSize: '0.95rem', fontWeight: 600, color: PAGE.text, marginBottom: '0.35rem' }}>
            No reports yet — your library is empty.
          </div>
          <div style={{ fontSize: '0.85rem', color: PAGE.textMuted, maxWidth: 420, margin: '0 auto 1rem' }}>
            Reports you pull will appear here. You can re-open them, download as PDF, or refresh them anytime.
          </div>
          <button
            onClick={() => navigate('/people-search')}
            style={{
              background: PAGE.brand, color: '#fff', border: 'none',
              padding: '0.6rem 1.1rem', borderRadius: '0.375rem',
              fontSize: '0.9rem', fontWeight: 600, cursor: 'pointer',
            }}
          >
            Pull your first report →
          </button>
        </div>
      )}

      {!loading && sorted.length > 0 && (
        <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
          {sorted.map((report, idx) => {
            const id = report._id || report.id;
            const subject = reportSubject(report);
            const created = report.createdAt;
            const fresh = freshnessBucket(created);
            const type = reportType(report);
            return (
              <li key={id || idx} style={{
                display: 'flex', alignItems: 'center', gap: '0.75rem',
                padding: '0.75rem 1.25rem',
                borderBottom: idx < sorted.length - 1 ? `1px solid ${PAGE.border}` : 'none',
              }}>
                <div style={{
                  width: 36, height: 36, borderRadius: 8,
                  background: PAGE.brandSoft, color: PAGE.brand,
                  fontWeight: 700, fontSize: '0.78rem',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  flexShrink: 0,
                }}>{type[0] || '—'}</div>

                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 600, color: PAGE.text, fontSize: '0.95rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {subject}
                  </div>
                  <div style={{ fontSize: '0.78rem', color: PAGE.textMuted, marginTop: '0.1rem' }}>
                    {type} report · pulled {formatRelative(created)}
                    <span style={{
                      marginLeft: '0.5rem',
                      fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em',
                      color: fresh.color,
                    }}>· {fresh.label}</span>
                  </div>
                </div>

                <Link
                  to={id ? `/people/${id}` : '#'}
                  style={{
                    fontSize: '0.82rem', color: PAGE.accent, textDecoration: 'none', fontWeight: 600,
                    padding: '0.35rem 0.6rem', borderRadius: 4,
                  }}
                  onClick={() => track('dashboard_report_open', { reportId: id, fresh: fresh.label })}
                >
                  Open →
                </Link>
                <button
                  type="button"
                  onClick={() => onPdfDownload(id)}
                  style={{
                    fontSize: '0.82rem', color: PAGE.text, background: PAGE.card,
                    border: `1px solid ${PAGE.borderStrong}`, borderRadius: 4,
                    padding: '0.35rem 0.6rem', cursor: 'pointer', fontWeight: 600,
                  }}
                >
                  PDF
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

// ─── Activity timeline ─────────────────────────────────────────────────────

function ActivityTimeline({ items, loading }) {
  const KIND_STYLE = {
    report: { bg: PAGE.brandSoft,  fg: PAGE.brand,  letter: 'R' },
    search: { bg: PAGE.accentSoft, fg: PAGE.accent, letter: 'S' },
    login:  { bg: '#f3e8ff',       fg: '#6b21a8',   letter: 'L' },
    signup: { bg: '#fef3c7',       fg: '#92400e',   letter: 'N' },
  };

  return (
    <section style={{
      background: PAGE.card,
      border: `1px solid ${PAGE.border}`,
      borderRadius: '0.75rem',
      overflow: 'hidden',
    }}>
      <header style={{
        padding: '0.875rem 1.25rem',
        borderBottom: `1px solid ${PAGE.border}`,
      }}>
        <h2 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 700, color: PAGE.text }}>Recent Activity</h2>
        <p style={{ margin: '0.15rem 0 0', fontSize: '0.8rem', color: PAGE.textMuted }}>
          Your activity plus what's happening across the platform — newest first.
        </p>
      </header>

      {loading && (
        <div style={{ padding: '1rem 1.25rem' }}>
          {[0, 1, 2, 3].map((i) => (
            <div key={i} style={{
              height: 32, background: '#f1f5f9', borderRadius: 4, marginBottom: i < 3 ? 6 : 0,
            }} />
          ))}
        </div>
      )}

      {!loading && items.length === 0 && (
        <div style={{ padding: '1.5rem 1.25rem', textAlign: 'center', fontSize: '0.85rem', color: PAGE.textMuted }}>
          Nothing here yet — search for someone to start your activity record.
        </div>
      )}

      {!loading && items.length > 0 && (
        <ul style={{ listStyle: 'none', margin: 0, padding: '0.5rem 0' }}>
          {items.map((item, idx) => {
            const ks = KIND_STYLE[item.kind] || KIND_STYLE.search;
            return (
            <li key={`${item.kind}-${item.id || idx}`} style={{
              display: 'flex', gap: '0.75rem', alignItems: 'flex-start',
              padding: '0.5rem 1.25rem',
            }}>
              <div style={{
                width: 28, height: 28, borderRadius: 6, flexShrink: 0,
                background: ks.bg,
                color: ks.fg,
                fontSize: '0.72rem', fontWeight: 700,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                {ks.letter}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: '0.875rem', color: PAGE.text }}>{item.label}</div>
                <div style={{ fontSize: '0.72rem', color: PAGE.textSubtle, marginTop: '0.1rem' }}>
                  {formatRelative(item.timestamp)} · {formatDate(item.timestamp)}
                </div>
              </div>
            </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

// ─── Dashboard2 ─────────────────────────────────────────────────────────────

const Dashboard2 = () => {
  const { user, token, subscription, isPaid, subscriptionLoading } = useAuth();
  const navigate = useNavigate();

  const [reports, setReports] = useState([]);
  const [reportsLoading, setReportsLoading] = useState(true);
  const [searches, setSearches] = useState([]);
  const [searchCount, setSearchCount] = useState(null);
  const [reportCount, setReportCount] = useState(null);
  const [pdfCount, setPdfCount] = useState(null);
  const [orders, setOrders] = useState([]);
  const [statsLoading, setStatsLoading] = useState(true);
  const [logins, setLogins] = useState([]);
  const [planDisplayName, setPlanDisplayName] = useState('');

  const intent = useMemo(() => readSignupIntent(), []);
  const intentCopy = intent ? INTENT_COPY[intent] || INTENT_COPY.other : INTENT_COPY.other;

  // Login history is a localStorage ring buffer maintained by loginHistory.js.
  useEffect(() => {
    setLogins(readLoginHistory());
  }, []);

  // Fetch human-readable plan name from BC's offer record. Mirrors
  // AccountPage's lookup: the active subscription only stores the BC offer
  // ObjectId, so without this we'd show the raw 24-hex id to the user. We
  // currently ship one offer (comp.offer.signup.main); update this shmName
  // if BC introduces tiered plans.
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
        // Non-fatal — SubscriptionTile falls back to "{brand} Membership".
      }
    })();
    return () => { cancelled = true; };
  }, [token, isPaid]);

  useEffect(() => {
    track('dashboard_view', { has_token: !!token });
  }, [token]);

  // Reports — only fire when user has an active subscription. Unsubscribed
  // users 403 on report/list by design (no entitlement to view reports), so
  // skipping the call cleans up console noise on the unsubscribed dashboard.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!isPaid) {
        setReports([]);
        setReportsLoading(false);
        return;
      }
      setReportsLoading(true);
      try {
        const res = await getReportList({ token });
        if (!cancelled) setReports(res.reports || []);
      } catch {
        if (!cancelled) setReports([]);
      } finally {
        if (!cancelled) setReportsLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [token, isPaid]);

  // Stats — paid-only BC counters + searches/me from mock + orders.
  // Counters 403 for unsubscribed users (no entitlement), so we only call
  // them when isPaid. getUserOrders still fires regardless since it is the
  // source of truth for paid state — the IIFE 403 is caught by `settle`
  // and we just treat it as "no orders".
  useEffect(() => {
    let cancelled = false;
    (async () => {
      setStatsLoading(true);
      const settle = (promise) => promise.then((v) => v).catch(() => null);
      const counterCall = (fn) =>
        isPaid && typeof fn === 'function' ? settle(fn()) : Promise.resolve(null);
      const [s, r, p, sm, ord] = await Promise.all([
        counterCall(api.countUserTeaserSearches),
        counterCall(api.countUserReportCreations),
        counterCall(api.countUserPdfDownloads),
        settle(api.get?.('/searches/me', { token }) ?? Promise.resolve(null)),
        settle(api.getUserOrders?.() ?? Promise.resolve(null)),
      ]);
      if (cancelled) return;
      setSearchCount(s?.count ?? null);
      setReportCount(r?.count ?? null);
      setPdfCount(p?.count ?? null);
      const list = sm?.searches || sm?.data || (Array.isArray(sm) ? sm : []);
      setSearches(Array.isArray(list) ? list : []);
      const orderList = Array.isArray(ord) ? ord : (ord?.orders || ord?.docs || []);
      setOrders(orderList);
      setStatsLoading(false);
    })();
    return () => { cancelled = true; };
  }, [token, isPaid]);

  const handlePdfDownload = (commerceContentId) => {
    if (!commerceContentId) return;
    track('dashboard_pdf_download', { reportId: commerceContentId });
    try { api.downloadPdfReport?.(commerceContentId); } catch {}
  };

  // Merge the member's own activity (reports, searches, logins — labelled
  // "You") with synthetic cross-user entries (other members, anonymized
  // per the masking spec) into a single Recent Activity timeline. Real
  // cross-user data isn't available from the consumer SPA today; the
  // synthetic feed will be replaced once BC ships an aggregate endpoint.
  const activity = useMemo(() => {
    const reportItems = (reports || []).slice(0, 20).map((r) => ({
      kind: 'report',
      id: r._id || r.id,
      actor: 'You',
      label: `You pulled a report on ${reportSubject(r)}`,
      timestamp: r.createdAt,
    }));
    const searchItems = (searches || []).slice(0, 20).map((s, i) => {
      const q = s.query || {};
      const subject = q.firstName || q.lastName
        ? [q.firstName, q.lastName].filter(Boolean).join(' ')
        : q.phone || q.email || '(query)';
      return {
        kind: 'search',
        id: s._id || s.id || `s-${i}`,
        actor: 'You',
        label: `You searched ${s.type || 'name'} · ${subject}`,
        timestamp: s.createdAt || s.timestamp,
      };
    });
    // Account creation only happens once per user, so dedupe signup
     // entries — keep the earliest one (the actual signup) and drop any
     // others that loginHistory may have recorded as method='signup'.
    let earliestSignupTs = null;
    for (const l of (logins || [])) {
      if (l.method === 'signup' && l.timestamp) {
        const ts = new Date(l.timestamp).getTime();
        if (earliestSignupTs == null || ts < earliestSignupTs) earliestSignupTs = ts;
      }
    }
    const loginItems = (logins || []).slice(0, 20).reduce((acc, l, i) => {
      const isSignup = l.method === 'signup';
      const ts = l.timestamp ? new Date(l.timestamp).getTime() : null;
      // Skip duplicate signup entries — only the earliest one renders.
      if (isSignup && ts !== earliestSignupTs) return acc;
      const verb = isSignup ? 'created your account' : 'signed in';
      acc.push({
        kind: isSignup ? 'signup' : 'login',
        id: `login-${i}-${l.timestamp}`,
        actor: 'You',
        label: `You ${verb}`,
        timestamp: l.timestamp,
      });
      return acc;
    }, []);

    // Synthetic cross-user feed. Seed combines a 5-minute time bucket with
    // a per-viewer hash so every member sees a slightly different feed and
    // it rotates without re-renders pinning the same items.
    const fiveMinBucket = Math.floor(Date.now() / (5 * 60 * 1000));
    const viewerHash = hashString(user?.id || user?._id || user?.email || 'visitor');
    const syntheticRaw = generateSyntheticActivity(fiveMinBucket ^ viewerHash, 12);
    const syntheticItems = syntheticRaw.map((s, i) => {
      let label;
      if (s.kind === 'search') {
        label = `${s.actor} searched ${s.searchType} · ${s.subject}`;
      } else if (s.kind === 'report') {
        label = `${s.actor} pulled a report on ${s.subject}`;
      } else if (s.kind === 'signup') {
        label = `${s.actor} created an account`;
      } else {
        label = `${s.actor} signed in`;
      }
      return {
        kind: s.kind,
        id: `syn-${i}-${s.timestamp}`,
        actor: s.actor,
        label,
        timestamp: s.timestamp,
        synthetic: true,
      };
    });

    return [...reportItems, ...searchItems, ...loginItems, ...syntheticItems]
      .filter((x) => x.timestamp)
      .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
      .slice(0, 18);
  }, [reports, searches, logins, user]);

  const greetingName = user?.firstName || (user?.fullName || '').split(/\s+/)[0] || (user?.email || '').split('@')[0] || 'there';

  return (
    <main style={{ background: PAGE.bg, minHeight: 'calc(100vh - 4rem)', paddingBottom: '3rem' }}>
      <div style={{ maxWidth: 1180, margin: '0 auto', padding: '1.5rem 1rem 0' }}>

        {/* Greeting */}
        <header style={{ marginBottom: '1rem' }}>
          <h1 style={{ margin: 0, fontSize: '1.5rem', fontWeight: 800, color: PAGE.text, letterSpacing: '-0.01em' }}>
            Welcome back, {greetingName}.
          </h1>
          <p style={{ margin: '0.35rem 0 0', fontSize: '0.95rem', color: PAGE.textMuted, maxWidth: 640 }}>
            {(reports?.length || 0) === 0 ? intentCopy : `You have ${reports.length} report${reports.length === 1 ? '' : 's'} in your library. Open any one to revisit, or pull a new one below.`}
          </p>
        </header>

        {/* Marketing strip — "we watch the world" framing pinned to what BC
            actually delivers: continuous data partner refresh + broad coverage. */}
        <section style={{
          background: `linear-gradient(135deg, #0d5d2f 0%, #16a34a 100%)`,
          color: '#fff',
          borderRadius: '0.75rem',
          padding: '1.1rem 1.25rem',
          marginBottom: '1rem',
          display: 'flex',
          gap: '1.25rem',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}>
          <div style={{ flex: 1, minWidth: 240 }}>
            <div style={{
              fontSize: '0.7rem', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase',
              color: '#bbf7d0',
            }}>
              We watch the world's records
            </div>
            <h2 style={{
              margin: '0.2rem 0 0', fontSize: '1.15rem', fontWeight: 800, letterSpacing: '-0.01em',
              // Explicit yellow — relying on inherited #fff was being clobbered
              // by global heading styles, leaving the headline near-invisible
              // against the green gradient. A small dark shadow gives it edge
              // without making it look neon.
              color: '#fde047',
              textShadow: '0 1px 2px rgba(0,0,0,0.25)',
            }}>
              12B+ public records, refreshed continuously by our data partners.
            </h2>
            <p style={{ margin: '0.3rem 0 0', fontSize: '0.85rem', color: '#dcfce7', maxWidth: 580 }}>
              When you search, you get the latest snapshot of names, phones, addresses, relatives, and arrest records — pulled fresh on demand. Run a search anytime; we keep the data current so you don't have to.
            </p>
          </div>

          <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
            {[
              { v: '12B+', l: 'public records' },
              { v: '50K+', l: 'data sources' },
              { v: '24/7', l: 'refreshed' },
            ].map((s) => (
              <div key={s.l} style={{
                background: 'rgba(255,255,255,0.12)',
                borderRadius: '0.5rem',
                padding: '0.5rem 0.75rem',
                minWidth: 96, textAlign: 'center',
              }}>
                <div style={{ fontSize: '1.1rem', fontWeight: 800, lineHeight: 1.1 }}>{s.v}</div>
                <div style={{ fontSize: '0.7rem', color: '#bbf7d0', marginTop: '0.1rem', letterSpacing: '0.04em', textTransform: 'uppercase', fontWeight: 600 }}>{s.l}</div>
              </div>
            ))}
          </div>
        </section>

        {/* Subscribe promo — signed up but not paying (trial non-converter). Sits
            directly under the marketing strip. Gated on a settled unpaid state so it
            never flashes for subscribers while billing status loads. */}
        {token && !isPaid && !subscriptionLoading && (
          <section style={{
            background: '#f0fdf4',
            border: `1px solid ${PAGE.brand}`,
            borderRadius: '0.75rem',
            padding: '1.1rem 1.25rem',
            marginBottom: '1rem',
            display: 'flex',
            gap: '1.25rem',
            flexWrap: 'wrap',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}>
            <div style={{ flex: 1, minWidth: 240 }}>
              <div style={{ fontSize: '0.7rem', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: PAGE.brand }}>
                You're on a free account
              </div>
              <h2 style={{ margin: '0.2rem 0 0', fontSize: '1.1rem', fontWeight: 800, letterSpacing: '-0.01em', color: PAGE.text }}>
                Subscribe to unlock unlimited searches &amp; full reports
              </h2>
              <p style={{ margin: '0.3rem 0 0', fontSize: '0.85rem', color: PAGE.textMuted, maxWidth: 580 }}>
                Search as many people as you want and view up to 5 full reports a day. Cancel anytime.
              </p>
            </div>
            <button
              type="button"
              onClick={() => { track('dashboard_cta_click', { target: 'subscribe' }); navigate('/payment?upgrade=1'); }}
              style={{
                background: PAGE.brand, color: '#fff', border: 'none',
                padding: '0.7rem 1.4rem', borderRadius: '0.5rem',
                fontSize: '0.95rem', fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap',
              }}
            >
              Subscribe Now
            </button>
          </section>
        )}

        {/* Bug #46 (2026-05-29): SubscriptionTile moved out of the top
            position — it was encouraging cancel taps before users engaged
            with the product. Now rendered below the reports/activity grid. */}

        {/* Stats row — all real counters */}
        <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', marginBottom: '1rem' }}>
          <StatTile
            label="Reports pulled"
            value={reportCount ?? (reports?.length ?? 0)}
            sublabel="lifetime"
            loading={statsLoading && reportCount == null}
          />
          <StatTile
            label="Searches run"
            value={searchCount ?? '—'}
            sublabel="lifetime"
            loading={statsLoading && searchCount == null}
          />
          <StatTile
            label="PDFs downloaded"
            value={pdfCount ?? '—'}
            sublabel="lifetime"
            loading={statsLoading && pdfCount == null}
          />
          <StatTile
            label="Searches this month"
            value={(searches || []).filter((s) => {
              const ts = new Date(s.createdAt || s.timestamp || 0).getTime();
              return Date.now() - ts < 30 * 86400000;
            }).length || '0'}
            sublabel="last 30 days"
            loading={statsLoading && searches.length === 0}
          />
        </div>

        {/* Inline search — bug #48 (2026-05-29): the previous CTA was a
            single button that hid the search behind a click. Surfacing
            first/last/state as the primary action makes the search the
            dashboard's center of gravity. */}
        <InlineNameSearch navigate={navigate} />
        <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.25rem', flexWrap: 'wrap' }}>
          <button
            type="button"
            onClick={() => { track('dashboard_cta_click', { target: 'account' }); navigate('/account'); }}
            style={{
              background: PAGE.card, color: PAGE.text, border: `1px solid ${PAGE.borderStrong}`,
              padding: '0.5rem 0.9rem', borderRadius: '0.375rem',
              fontSize: '0.85rem', fontWeight: 600, cursor: 'pointer',
            }}
          >
            Account & billing
          </button>
          <button
            type="button"
            onClick={() => { track('dashboard_cta_click', { target: 'support' }); navigate('/contact'); }}
            style={{
              background: PAGE.card, color: PAGE.text, border: `1px solid ${PAGE.borderStrong}`,
              padding: '0.5rem 0.9rem', borderRadius: '0.375rem',
              fontSize: '0.85rem', fontWeight: 600, cursor: 'pointer',
            }}
          >
            Contact support
          </button>
        </div>

        {/* Two-column: Reports library (hero) + Activity */}
        <div data-dashboard-grid style={{
          display: 'grid',
          gridTemplateColumns: 'minmax(0, 2fr) minmax(0, 1fr)',
          gap: '1rem',
          alignItems: 'start',
        }}>
          <ReportsLibrary
            reports={reports}
            loading={reportsLoading}
            onPdfDownload={handlePdfDownload}
            navigate={navigate}
          />
          <ActivityTimeline items={activity} loading={reportsLoading || statsLoading} />
        </div>

        {/* Subscription strip — moved down so it's reachable but not the
            first call to action (#46). */}
        <div style={{ marginTop: '1.5rem', marginBottom: '1rem' }}>
          <SubscriptionTile subscription={subscription} orders={orders} planDisplayName={planDisplayName} navigate={navigate} />
        </div>

        {/* Honest disclosure footer */}
        <p style={{
          marginTop: '1.5rem',
          fontSize: '0.78rem',
          color: PAGE.textSubtle,
          textAlign: 'center',
          maxWidth: 720,
          marginLeft: 'auto',
          marginRight: 'auto',
        }}>
          Every number on this page comes from your real activity — reports you pulled, searches you ran, PDFs you downloaded.
          Nothing is fabricated.
        </p>
      </div>

      {/* Mobile: stack columns + tighten the stat row on phones. */}
      <style>{`
        @media (max-width: 880px) {
          [data-dashboard-grid] { grid-template-columns: 1fr !important; }
        }
        @media (max-width: 480px) {
          [data-dashboard-grid] { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </main>
  );
};

export default Dashboard2;
