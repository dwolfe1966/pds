import React, { useEffect, useState } from 'react';
import api from '../../api';
import { useAuth } from '../../context/AuthContext';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  LineChart, Line, CartesianGrid, Cell,
} from 'recharts';

const TRACKING_API = process.env.REACT_APP_TRACKING_API_URL || null;
const ADMIN_KEY = process.env.REACT_APP_TRACKING_ADMIN_KEY || 'dev-admin-key';

const FUNNEL_COLORS = [
  '#1e3a5f', '#1d5c8c', '#1a7bbf', '#1a9ed4',
  '#17b8a8', '#15c96e', '#0f9e46', '#0d5d2f', '#06401f',
];

function pct(rate) {
  if (rate == null) return '—';
  return `${Math.round(rate * 100)}%`;
}

function KpiCard({ label, value, sub, color = '#0d5d2f' }) {
  return (
    <div style={{
      background: '#fff', border: '1px solid #e5e7eb', borderRadius: '0.75rem',
      padding: '1.25rem 1.5rem', flex: '1 1 180px', minWidth: '160px',
    }}>
      <p style={{ margin: '0 0 0.25rem', fontSize: '0.78rem', color: '#6b7280', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.04em' }}>{label}</p>
      <p style={{ margin: '0 0 0.25rem', fontSize: '1.75rem', fontWeight: 700, color }}>{value}</p>
      {sub && <p style={{ margin: 0, fontSize: '0.78rem', color: '#9ca3af' }}>{sub}</p>}
    </div>
  );
}

function isToday(iso) {
  if (!iso) return false;
  const d = new Date(iso);
  const now = new Date();
  return d.getFullYear() === now.getFullYear()
    && d.getMonth() === now.getMonth()
    && d.getDate() === now.getDate();
}

const AnalyticsPage = () => {
  const { token } = useAuth();
  const [metrics, setMetrics] = useState(null);
  const [metricsLoading, setMetricsLoading] = useState(true);
  const [metricsError, setMetricsError] = useState('');
  const [summary, setSummary] = useState(null);
  const [summaryLoading, setSummaryLoading] = useState(true);

  // CSR performance state — derived from BC contactMessages + CS rep list.
  const [tickets, setTickets] = useState([]);
  const [csReps, setCsReps]   = useState([]);
  const [csrLoading, setCsrLoading] = useState(true);

  // Legacy mock-server metrics (totals, revenue)
  useEffect(() => {
    api.get('/admin/analytics', { token })
      .then(data => setMetrics(data))
      .catch(err => setMetricsError(err.message))
      .finally(() => setMetricsLoading(false));
  }, [token]);

  // Tracking API summary
  useEffect(() => {
    if (!TRACKING_API) {
      setSummaryLoading(false);
      return;
    }
    fetch(`${TRACKING_API}/events/summary`, {
      headers: { 'x-admin-key': ADMIN_KEY },
    })
      .then(r => r.json())
      .then(data => setSummary(data))
      .catch(() => {})
      .finally(() => setSummaryLoading(false));
  }, []);

  // CSR performance — single fetch of contactMessages + cs reps. Stats are
  // derived client-side from real BC state.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      setCsrLoading(true);
      const settle = (p) => p.then((v) => v).catch(() => null);
      const [t, r] = await Promise.all([
        settle(api.adminFindContactMessages?.({}) ?? Promise.resolve(null)),
        settle(api.adminListCsReps?.() ?? Promise.resolve(null)),
      ]);
      if (cancelled) return;
      setTickets(t?.data ?? t?.docs ?? (Array.isArray(t) ? t : []));
      setCsReps(r?.data?.docs ?? r?.docs ?? r?.data ?? (Array.isArray(r) ? r : []));
      setCsrLoading(false);
    })();
    return () => { cancelled = true; };
  }, []);

  const kpis = summary?.kpis || {};
  const funnel = summary?.funnel || [];

  // ── CSR performance derivations ───────────────────────────────────────────
  const inboxStats = (() => {
    const total = tickets.length;
    const replied = tickets.filter((t) => Boolean(t?.latestReply)).length;
    const awaiting = total - replied;
    const unassigned = tickets.filter((t) => !t?.content?.actorId).length;
    const newToday = tickets.filter((t) => isToday(t?.createdAt)).length;
    const repliedToday = tickets.filter((t) => isToday(t?.latestReply?.createdAt)).length;
    return { total, replied, awaiting, unassigned, newToday, repliedToday };
  })();

  // Per-CSR rollup. Falls back to actorId tags when csReps fails to load.
  const csrPerformance = (() => {
    const byId = new Map();

    // Seed with known reps so empty-row CSRs still appear in the table.
    csReps.forEach((rep) => {
      const id = rep._id || rep.id;
      if (!id) return;
      const name = `${rep.firstName || ''} ${rep.lastName || ''}`.trim() || rep.email || id;
      byId.set(id, {
        id,
        name,
        email: rep.email || '',
        assigned: 0,
        awaiting: 0,
        repliedToday: 0,
        repliedTotal: 0,
      });
    });

    const ensure = (id) => {
      if (!byId.has(id)) {
        byId.set(id, { id, name: id.slice(-8), email: '', assigned: 0, awaiting: 0, repliedToday: 0, repliedTotal: 0 });
      }
      return byId.get(id);
    };

    tickets.forEach((t) => {
      const actor = t?.content?.actorId;
      if (actor) {
        const row = ensure(actor);
        row.assigned += 1;
        if (!t?.latestReply) row.awaiting += 1;
      }
      const replyOwner = t?.latestReply?.ownerId;
      if (replyOwner) {
        const row = ensure(replyOwner);
        row.repliedTotal += 1;
        if (isToday(t?.latestReply?.createdAt)) row.repliedToday += 1;
      }
    });

    return Array.from(byId.values())
      .filter((r) => r.assigned > 0 || r.repliedTotal > 0)
      .sort((a, b) => (b.repliedTotal + b.assigned) - (a.repliedTotal + a.assigned));
  })();

  return (
    <main style={{ padding: '2rem', maxWidth: '1100px', margin: '0 auto' }}>
      <h1 style={{ fontSize: '1.5rem', fontWeight: 700, marginBottom: '1.5rem' }}>Analytics</h1>

      {/* ── CSR Inbox Overview ──────────────────────────────────────────── */}
      <section style={{ marginBottom: '2rem' }}>
        <h2 style={{ fontSize: '1.125rem', fontWeight: 700, marginBottom: '0.75rem' }}>Inbox Overview</h2>
        <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
          <KpiCard
            label="Open tickets"
            value={csrLoading ? '…' : inboxStats.awaiting}
            sub={`${inboxStats.total} total in current page`}
            color="#92400e"
          />
          <KpiCard
            label="Unassigned"
            value={csrLoading ? '…' : inboxStats.unassigned}
            sub="needs an actor"
            color={inboxStats.unassigned > 0 ? '#991b1b' : '#0d5d2f'}
          />
          <KpiCard
            label="New today"
            value={csrLoading ? '…' : inboxStats.newToday}
            sub="created in the last 24h"
            color="#1a7bbf"
          />
          <KpiCard
            label="Replies today"
            value={csrLoading ? '…' : inboxStats.repliedToday}
            sub="across all CSRs"
            color="#0d5d2f"
          />
        </div>
      </section>

      {/* ── CSR Performance ─────────────────────────────────────────────── */}
      <section style={{ marginBottom: '2rem' }}>
        <h2 style={{ fontSize: '1.125rem', fontWeight: 700, marginBottom: '0.75rem' }}>CSR Performance</h2>
        <div style={{ background: '#fff', borderRadius: '0.75rem', border: '1px solid #e5e7eb', overflow: 'hidden' }}>
          {csrLoading ? (
            <p style={{ padding: '1.5rem', color: '#6b7280', fontSize: '0.875rem', margin: 0 }}>Loading CSR performance…</p>
          ) : csrPerformance.length === 0 ? (
            <p style={{ padding: '1.5rem', color: '#6b7280', fontSize: '0.875rem', margin: 0 }}>
              No CSR activity yet — assign a ticket or send a reply to populate this table.
            </p>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
              <thead>
                <tr style={{ background: '#f9fafb' }}>
                  {['CSR', 'Email', 'Assigned', 'Awaiting (mine)', 'Replied today', 'Replied total'].map((h) => (
                    <th key={h} style={{ padding: '0.75rem 1rem', textAlign: 'left', fontWeight: 600, color: '#374151', borderBottom: '1px solid #e5e7eb' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {csrPerformance.map((row) => (
                  <tr key={row.id} style={{ borderBottom: '1px solid #f3f4f6' }}>
                    <td style={{ padding: '0.625rem 1rem', fontWeight: 600 }}>{row.name}</td>
                    <td style={{ padding: '0.625rem 1rem', color: '#6b7280' }}>{row.email || '—'}</td>
                    <td style={{ padding: '0.625rem 1rem', fontWeight: 600 }}>{row.assigned}</td>
                    <td style={{ padding: '0.625rem 1rem', color: row.awaiting > 0 ? '#92400e' : '#9ca3af' }}>{row.awaiting}</td>
                    <td style={{ padding: '0.625rem 1rem', fontWeight: 600, color: '#0d5d2f' }}>{row.repliedToday}</td>
                    <td style={{ padding: '0.625rem 1rem' }}>{row.repliedTotal}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
        <p style={{ margin: '0.4rem 0.25rem 0', fontSize: '0.75rem', color: '#9ca3af' }}>
          Derived from the current contactMessages page + CS rep directory. Reflects tickets where the rep is the actor or sent the latest reply.
        </p>
      </section>

      {/* ── KPI summary cards ─────────────────────────────────────────────── */}
      <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', marginBottom: '2rem' }}>
        <KpiCard
          label="Total Events"
          value={summaryLoading ? '…' : (summary?.totalEvents ?? '—').toLocaleString()}
          sub={`${summary?.uniqueSessions ?? 0} unique sessions`}
        />
        <KpiCard
          label="Overall Conversion"
          value={summaryLoading ? '…' : pct(kpis.overallConversion)}
          sub="landing → payment"
          color="#1a7bbf"
        />
        <KpiCard
          label="Teaser → Signup"
          value={summaryLoading ? '…' : pct(kpis.teaserToSignup)}
          sub="teaser view → signup start"
          color="#d97706"
        />
        <KpiCard
          label="Signup → Paid"
          value={summaryLoading ? '…' : pct(kpis.signupToPayment)}
          sub="signup complete → payment"
          color="#7c3aed"
        />
        {!metricsLoading && metrics && (
          <>
            <KpiCard label="Total Searches" value={metrics.totalSearches ?? '—'} sub="all time" />
            <KpiCard label="New Users" value={metrics.newUsers ?? '—'} sub="all time" />
            <KpiCard label="Revenue" value={metrics.revenue ? `$${metrics.revenue}` : '—'} sub="all time" color="#0d5d2f" />
          </>
        )}
      </div>
      {metricsError && <p style={{ color: '#dc2626', marginBottom: '1rem', fontSize: '0.875rem' }}>{metricsError}</p>}

      {/* ── Conversion funnel ─────────────────────────────────────────────── */}
      {!summaryLoading && funnel.length > 0 && (
        <section style={{ marginBottom: '2rem' }}>
          <h2 style={{ fontSize: '1.125rem', fontWeight: 700, marginBottom: '0.75rem' }}>Conversion Funnel</h2>
          <div style={{ background: '#fff', borderRadius: '0.75rem', border: '1px solid #e5e7eb', padding: '1.5rem' }}>
            <p style={{ fontSize: '0.8rem', color: '#6b7280', marginBottom: '1rem' }}>
              {summary.totalEvents.toLocaleString()} total events · {summary.uniqueSessions.toLocaleString()} unique sessions
            </p>
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={funnel} margin={{ top: 5, right: 20, left: 0, bottom: 40 }}>
                <XAxis dataKey="step" tick={{ fontSize: 11 }} angle={-30} textAnchor="end" interval={0} />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip />
                <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                  {funnel.map((_, i) => <Cell key={i} fill={FUNNEL_COLORS[i % FUNNEL_COLORS.length]} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </section>
      )}

      {/* ── Step-by-step conversion rates ─────────────────────────────────── */}
      {!summaryLoading && Object.keys(kpis).length > 0 && (
        <section style={{ marginBottom: '2rem' }}>
          <h2 style={{ fontSize: '1.125rem', fontWeight: 700, marginBottom: '0.75rem' }}>Step Conversion Rates</h2>
          <div style={{
            background: '#fff', borderRadius: '0.75rem', border: '1px solid #e5e7eb',
            display: 'flex', flexWrap: 'wrap', gap: 0, overflow: 'hidden',
          }}>
            {[
              { label: 'Search → Results', value: kpis.searchToResults },
              { label: 'Results → Teaser',  value: kpis.resultsToTeaser },
              { label: 'Teaser → Signup',   value: kpis.teaserToSignup },
              { label: 'Signup Complete',   value: kpis.signupComplete },
              { label: 'Signup → Payment',  value: kpis.signupToPayment },
              { label: 'Overall',           value: kpis.overallConversion },
            ].map(({ label, value }, i) => (
              <div key={i} style={{
                flex: '1 1 150px', padding: '1rem 1.25rem',
                borderRight: i < 5 ? '1px solid #f3f4f6' : 'none',
                borderBottom: '1px solid #f3f4f6',
              }}>
                <p style={{ margin: '0 0 0.25rem', fontSize: '0.75rem', color: '#6b7280' }}>{label}</p>
                <p style={{ margin: 0, fontSize: '1.5rem', fontWeight: 700, color: value == null ? '#d1d5db' : '#0d5d2f' }}>
                  {pct(value)}
                </p>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ── Daily activity ────────────────────────────────────────────────── */}
      {!summaryLoading && summary?.daily?.length > 0 && (
        <section style={{ marginBottom: '2rem' }}>
          <h2 style={{ fontSize: '1.125rem', fontWeight: 700, marginBottom: '0.75rem' }}>Daily Activity (last 14 days)</h2>
          <div style={{ background: '#fff', borderRadius: '0.75rem', border: '1px solid #e5e7eb', padding: '1.5rem' }}>
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={summary.daily} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip />
                <Line type="monotone" dataKey="total" stroke="#0d5d2f" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </section>
      )}

      {/* ── Landing variant performance ───────────────────────────────────── */}
      {!summaryLoading && summary?.variants?.length > 0 && (
        <section style={{ marginBottom: '2rem' }}>
          <h2 style={{ fontSize: '1.125rem', fontWeight: 700, marginBottom: '0.75rem' }}>Landing Variant Views</h2>
          <div style={{ background: '#fff', borderRadius: '0.75rem', border: '1px solid #e5e7eb', overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
              <thead>
                <tr style={{ background: '#f9fafb' }}>
                  {['Variant', 'Search Type', 'Views'].map(h => (
                    <th key={h} style={{ padding: '0.75rem 1rem', textAlign: 'left', fontWeight: 600, color: '#374151', borderBottom: '1px solid #e5e7eb' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {summary.variants.map((row, i) => (
                  <tr key={i} style={{ borderBottom: '1px solid #f3f4f6' }}>
                    <td style={{ padding: '0.625rem 1rem', fontWeight: 500 }}>{row.variant}</td>
                    <td style={{ padding: '0.625rem 1rem', color: '#6b7280' }}>{row.search_type || '—'}</td>
                    <td style={{ padding: '0.625rem 1rem', fontWeight: 600 }}>{row.views}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* ── Top events breakdown ──────────────────────────────────────────── */}
      {!summaryLoading && summary?.topEvents?.length > 0 && (
        <section>
          <h2 style={{ fontSize: '1.125rem', fontWeight: 700, marginBottom: '0.75rem' }}>Top Events</h2>
          <div style={{ background: '#fff', borderRadius: '0.75rem', border: '1px solid #e5e7eb', overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
              <thead>
                <tr style={{ background: '#f9fafb' }}>
                  {['Event', 'Count'].map(h => (
                    <th key={h} style={{ padding: '0.75rem 1rem', textAlign: 'left', fontWeight: 600, color: '#374151', borderBottom: '1px solid #e5e7eb' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {summary.topEvents.map((row, i) => (
                  <tr key={i} style={{ borderBottom: '1px solid #f3f4f6' }}>
                    <td style={{ padding: '0.625rem 1rem', fontFamily: 'monospace', fontSize: '0.8rem' }}>{row.event_name}</td>
                    <td style={{ padding: '0.625rem 1rem', fontWeight: 600 }}>{row.count.toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {summaryLoading && (
        <p style={{ color: '#6b7280', fontSize: '0.875rem' }}>Loading analytics…</p>
      )}
    </main>
  );
};

export default AnalyticsPage;
