import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import api from '../../api';
import { useAuth } from '../../context/AuthContext';

/**
 * MyDashboardPage — CSR landing page.
 *
 * Defaults the admin app's first screen to a personalized triage view rather
 * than the customer list. Sources: a single adminFindContactMessages call,
 * filtered client-side. Nothing fabricated; everything derives from real BC
 * state.
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
  danger: '#991b1b',
  dangerSoft: '#fee2e2',
};

function formatRelative(value) {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  const diff = Date.now() - d.getTime();
  const min = Math.floor(diff / 60000);
  if (min < 1) return 'just now';
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const day = Math.floor(hr / 24);
  if (day < 30) return `${day}d ago`;
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function isToday(value) {
  if (!value) return false;
  const d = new Date(value);
  const now = new Date();
  return d.getFullYear() === now.getFullYear()
    && d.getMonth() === now.getMonth()
    && d.getDate() === now.getDate();
}

function ticketSubject(t) {
  return t?.content?.input?.topic
    || (t?.content?.category === 'billing' ? 'Billing inquiry'
    : t?.content?.category === 'general' ? 'General inquiry'
    : t?.content?.subject || '(No subject)');
}

function ticketSenderEmail(t) {
  return t?.content?.input?.email || t?.content?.email || '';
}

function isAssignedToCsr(t, csrId) {
  return Boolean(csrId) && t?.content?.actorId === csrId;
}

function hasReply(t) {
  return Boolean(t?.latestReply || (Array.isArray(t?.referenceIds) && t.referenceIds.length > 0));
}

// ─── Tile ───────────────────────────────────────────────────────────────────

function StatTile({ label, value, sublabel, color = PAGE.text, accent = PAGE.brand, link, linkLabel = 'View' }) {
  return (
    <div style={{
      flex: 1, minWidth: 180,
      background: PAGE.card,
      border: `1px solid ${PAGE.border}`,
      borderRadius: '0.75rem',
      padding: '1rem 1.1rem',
      position: 'relative',
    }}>
      <div style={{ fontSize: '0.7rem', color: PAGE.textMuted, textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 700 }}>
        {label}
      </div>
      <div style={{ fontSize: '1.7rem', fontWeight: 800, color, marginTop: '0.25rem', lineHeight: 1.1 }}>
        {value}
      </div>
      {sublabel && (
        <div style={{ fontSize: '0.78rem', color: PAGE.textSubtle, marginTop: '0.2rem' }}>
          {sublabel}
        </div>
      )}
      {link && (
        <Link
          to={link}
          style={{
            position: 'absolute', top: '0.7rem', right: '0.85rem',
            fontSize: '0.78rem', color: accent, fontWeight: 600, textDecoration: 'none',
          }}
        >
          {linkLabel} →
        </Link>
      )}
    </div>
  );
}

// ─── Ticket row ─────────────────────────────────────────────────────────────

function TicketRow({ ticket, csrId }) {
  const id = ticket._id || ticket.id;
  const subject = ticketSubject(ticket);
  const email = ticketSenderEmail(ticket);
  const replied = hasReply(ticket);
  const lastEvent = ticket?.latestReply?.createdAt || ticket?.updatedAt || ticket?.createdAt;
  const targetUserId = ticket?.content?.targetUserId;
  return (
    <li style={{
      display: 'flex', alignItems: 'center', gap: '0.75rem',
      padding: '0.6rem 0.875rem',
      borderBottom: `1px solid ${PAGE.border}`,
    }}>
      <span style={{
        fontSize: '0.65rem', fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase',
        padding: '0.15rem 0.5rem', borderRadius: 12,
        background: replied ? PAGE.brandSoft : PAGE.warnSoft,
        color: replied ? PAGE.brand : PAGE.warn,
        whiteSpace: 'nowrap',
      }}>
        {replied ? 'Replied' : 'Awaiting'}
      </span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 600, fontSize: '0.9rem', color: PAGE.text, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {subject}
        </div>
        <div style={{ fontSize: '0.78rem', color: PAGE.textMuted, marginTop: '0.1rem' }}>
          {email && <>{email} · </>}
          {formatRelative(lastEvent)}
          {!targetUserId && <> · <span style={{ color: PAGE.warn, fontWeight: 600 }}>non-member</span></>}
          {isAssignedToCsr(ticket, csrId) && <> · <span style={{ color: PAGE.accent, fontWeight: 600 }}>assigned to you</span></>}
        </div>
      </div>
      <Link
        to={`/tickets?contactMessageId=${encodeURIComponent(id || '')}`}
        style={{ fontSize: '0.82rem', color: PAGE.accent, fontWeight: 600, textDecoration: 'none' }}
      >
        Open →
      </Link>
    </li>
  );
}

// ─── MyDashboardPage ────────────────────────────────────────────────────────

const MyDashboardPage = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const csrId = user?._id || user?.id || null;
  const csrName = user?.firstName || (user?.fullName || '').split(/\s+/)[0] || 'there';

  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError('');
      try {
        // Pull a single page (BC default ~10 by default; pass nothing). If you
        // need more, click through to the inbox where pagination is wired.
        const res = await api.adminFindContactMessages({});
        if (cancelled) return;
        const docs = res?.data ?? res?.docs ?? (Array.isArray(res) ? res : []);
        setTickets(docs);
      } catch (e) {
        if (!cancelled) setError(e?.message || 'Failed to load inbox.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  // Derived buckets
  const myTickets        = useMemo(() => tickets.filter((t) => isAssignedToCsr(t, csrId)), [tickets, csrId]);
  const myAwaiting       = useMemo(() => myTickets.filter((t) => !hasReply(t)), [myTickets]);
  const unassigned       = useMemo(() => tickets.filter((t) => !t?.content?.actorId), [tickets]);
  const newToday         = useMemo(() => tickets.filter((t) => isToday(t.createdAt)), [tickets]);
  const myAssignedToday  = useMemo(() => myTickets.filter((t) => isToday(t?.updatedAt || t?.createdAt)), [myTickets]);
  const replyByMeToday   = useMemo(
    () => tickets.filter((t) => t?.latestReply?.ownerId === csrId && isToday(t?.latestReply?.createdAt)),
    [tickets, csrId]
  );
  const myOpenTopFive    = useMemo(
    () => [...myAwaiting].sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0)).slice(0, 5),
    [myAwaiting]
  );
  const newestUnassigned = useMemo(
    () => [...unassigned].sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0)).slice(0, 5),
    [unassigned]
  );

  return (
    <main style={{ background: PAGE.bg, minHeight: 'calc(100vh - 4rem)', paddingBottom: '2.5rem' }}>
      <div style={{ maxWidth: 1180, margin: '0 auto', padding: '1.5rem 1rem 0' }}>

        {/* Header */}
        <header style={{ marginBottom: '1.25rem' }}>
          <h1 style={{ margin: 0, fontSize: '1.5rem', fontWeight: 800, color: PAGE.text, letterSpacing: '-0.01em' }}>
            Welcome back, {csrName}.
          </h1>
          <p style={{ margin: '0.35rem 0 0', fontSize: '0.95rem', color: PAGE.textMuted }}>
            Your CSR queue, today's activity, and what's incoming — all from real inbox state.
          </p>
        </header>

        {error && (
          <div style={{
            background: PAGE.dangerSoft, border: `1px solid ${PAGE.danger}`,
            color: PAGE.danger, borderRadius: 6, padding: '0.5rem 0.75rem',
            marginBottom: '1rem', fontSize: '0.85rem',
          }}>
            {error}
          </div>
        )}

        {/* Queue tiles */}
        <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', marginBottom: '1rem' }}>
          <StatTile
            label="Open & assigned to you"
            value={loading ? '…' : myAwaiting.length}
            sublabel={`out of ${myTickets.length} total in your queue`}
            color={PAGE.warn}
            accent={PAGE.warn}
            link="/tickets"
            linkLabel="Triage"
          />
          <StatTile
            label="Unassigned"
            value={loading ? '…' : unassigned.length}
            sublabel="waiting for a CSR to claim"
            color={unassigned.length > 0 ? PAGE.danger : PAGE.text}
            accent={PAGE.danger}
            link="/tickets"
            linkLabel="Claim"
          />
          <StatTile
            label="New today"
            value={loading ? '…' : newToday.length}
            sublabel="across the whole inbox"
            link="/tickets"
            linkLabel="Open inbox"
          />
          <StatTile
            label="Replies you sent today"
            value={loading ? '…' : replyByMeToday.length}
            sublabel="confirmed via latestReply"
            color={PAGE.brand}
            accent={PAGE.brand}
          />
          <StatTile
            label="Tickets you assigned today"
            value={loading ? '…' : myAssignedToday.length}
            sublabel="based on updated timestamps"
          />
        </div>

        {/* Quick actions */}
        <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.25rem', flexWrap: 'wrap' }}>
          <button
            type="button"
            onClick={() => navigate('/tickets')}
            style={{
              background: PAGE.brand, color: '#fff', border: 'none',
              padding: '0.6rem 1rem', borderRadius: 6,
              fontSize: '0.9rem', fontWeight: 600, cursor: 'pointer',
            }}
          >
            ✉ Open inbox
          </button>
          <button
            type="button"
            onClick={() => navigate('/users')}
            style={{
              background: PAGE.card, color: PAGE.text, border: `1px solid ${PAGE.borderStrong}`,
              padding: '0.6rem 1rem', borderRadius: 6,
              fontSize: '0.9rem', fontWeight: 600, cursor: 'pointer',
            }}
          >
            🔍 Search customers
          </button>
          <button
            type="button"
            onClick={() => navigate('/orders')}
            style={{
              background: PAGE.card, color: PAGE.text, border: `1px solid ${PAGE.borderStrong}`,
              padding: '0.6rem 1rem', borderRadius: 6,
              fontSize: '0.9rem', fontWeight: 600, cursor: 'pointer',
            }}
          >
            🧾 Recent orders
          </button>
          <button
            type="button"
            onClick={() => navigate('/analytics')}
            style={{
              background: PAGE.card, color: PAGE.text, border: `1px solid ${PAGE.borderStrong}`,
              padding: '0.6rem 1rem', borderRadius: 6,
              fontSize: '0.9rem', fontWeight: 600, cursor: 'pointer',
            }}
          >
            📊 Analytics
          </button>
        </div>

        {/* Two-column: My open + Newest unassigned */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)',
          gap: '1rem',
          alignItems: 'start',
        }}>
          {/* My open tickets */}
          <section style={{
            background: PAGE.card, border: `1px solid ${PAGE.border}`,
            borderRadius: '0.75rem', overflow: 'hidden',
          }}>
            <header style={{
              padding: '0.875rem 1.25rem',
              borderBottom: `1px solid ${PAGE.border}`,
              display: 'flex', justifyContent: 'space-between', alignItems: 'baseline',
            }}>
              <div>
                <h2 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 700, color: PAGE.text }}>
                  Your open tickets
                </h2>
                <p style={{ margin: '0.15rem 0 0', fontSize: '0.8rem', color: PAGE.textMuted }}>
                  Awaiting your reply, newest first.
                </p>
              </div>
              <Link to="/tickets" style={{ fontSize: '0.82rem', color: PAGE.brand, fontWeight: 600, textDecoration: 'none' }}>
                All my tickets →
              </Link>
            </header>
            {loading ? (
              <div style={{ padding: '1rem 1.25rem' }}>Loading…</div>
            ) : myOpenTopFive.length === 0 ? (
              <div style={{ padding: '1.5rem 1.25rem', textAlign: 'center', fontSize: '0.9rem', color: PAGE.textMuted }}>
                {myTickets.length === 0
                  ? 'No tickets are assigned to you yet.'
                  : 'You have no open tickets — all caught up. ✓'}
              </div>
            ) : (
              <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
                {myOpenTopFive.map((t) => (
                  <TicketRow key={t._id || t.id} ticket={t} csrId={csrId} />
                ))}
              </ul>
            )}
          </section>

          {/* Newest unassigned */}
          <section style={{
            background: PAGE.card, border: `1px solid ${PAGE.border}`,
            borderRadius: '0.75rem', overflow: 'hidden',
          }}>
            <header style={{
              padding: '0.875rem 1.25rem',
              borderBottom: `1px solid ${PAGE.border}`,
              display: 'flex', justifyContent: 'space-between', alignItems: 'baseline',
            }}>
              <div>
                <h2 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 700, color: PAGE.text }}>
                  Newest unassigned
                </h2>
                <p style={{ margin: '0.15rem 0 0', fontSize: '0.8rem', color: PAGE.textMuted }}>
                  Tickets without an actor — claim one to add to your queue.
                </p>
              </div>
              <Link to="/tickets" style={{ fontSize: '0.82rem', color: PAGE.brand, fontWeight: 600, textDecoration: 'none' }}>
                Open inbox →
              </Link>
            </header>
            {loading ? (
              <div style={{ padding: '1rem 1.25rem' }}>Loading…</div>
            ) : newestUnassigned.length === 0 ? (
              <div style={{ padding: '1.5rem 1.25rem', textAlign: 'center', fontSize: '0.9rem', color: PAGE.textMuted }}>
                Inbox is clean — every ticket has an owner.
              </div>
            ) : (
              <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
                {newestUnassigned.map((t) => (
                  <TicketRow key={t._id || t.id} ticket={t} csrId={csrId} />
                ))}
              </ul>
            )}
          </section>
        </div>

        <p style={{
          marginTop: '1.5rem',
          fontSize: '0.78rem',
          color: PAGE.textSubtle,
          textAlign: 'center',
        }}>
          All counts are derived from the current contactMessages page. Open the inbox for full pagination + filters.
        </p>

        {/* Mobile — collapse columns */}
        <style>{`
          @media (max-width: 880px) {
            main > div > div:last-of-type { grid-template-columns: 1fr !important; }
          }
        `}</style>
      </div>
    </main>
  );
};

export default MyDashboardPage;
