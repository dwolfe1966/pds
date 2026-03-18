import React, { useEffect, useState } from 'react';
import api from '../../api';
import { useAuth } from '../../context/AuthContext';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  LineChart, Line, CartesianGrid, Cell,
} from 'recharts';

const TRACKING_API = process.env.REACT_APP_TRACKING_API_URL || 'http://localhost:3002';
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

const AnalyticsPage = () => {
  const { token } = useAuth();
  const [metrics, setMetrics] = useState(null);
  const [metricsLoading, setMetricsLoading] = useState(true);
  const [metricsError, setMetricsError] = useState('');
  const [summary, setSummary] = useState(null);
  const [summaryLoading, setSummaryLoading] = useState(true);

  // Legacy mock-server metrics (totals, revenue)
  useEffect(() => {
    api.get('/admin/analytics', { token })
      .then(data => setMetrics(data))
      .catch(err => setMetricsError(err.message))
      .finally(() => setMetricsLoading(false));
  }, [token]);

  // Tracking API summary
  useEffect(() => {
    fetch(`${TRACKING_API}/events/summary`, {
      headers: { 'x-admin-key': ADMIN_KEY },
    })
      .then(r => r.json())
      .then(data => setSummary(data))
      .catch(() => {})
      .finally(() => setSummaryLoading(false));
  }, []);

  const kpis = summary?.kpis || {};
  const funnel = summary?.funnel || [];

  return (
    <main style={{ padding: '2rem', maxWidth: '1100px', margin: '0 auto' }}>
      <h1 style={{ fontSize: '1.5rem', fontWeight: 700, marginBottom: '1.5rem' }}>Analytics</h1>

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
