import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Area,
  AreaChart,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  ResponsiveContainer,
} from 'recharts';
import { useAuth } from '../../context/AuthContext';
import { track } from '../../services/trackingService';
import { fetchWhoIsSearching } from '../../services/wsfyClient';
import styles from './WhoIsSearchingPage.module.css';
import {
  relativeDate,
  formatExactDate,
  computeStats,
  buildTrendSeries,
} from './watchingHelpers';

/* ---------------------------------------------------------------------------
 * Who's Watching You — member analytics dashboard
 *
 * Two tabs:
 *   1. Searchers — people who searched for the member
 *   2. Viewers   — people who opened the member's full profile / report
 *
 * Free members see real totals/charts + a tease summary but obfuscated names on the
 * detail list; paid members see full data with sort/filter/CSV. Masking is SERVER-SIDE
 * (buildWsfySummary) — real names never reach a free client.
 *
 * Searchers = live, from our own search-activity capture (/api/wsfy, WSFY Phase 2).
 * Viewers   = profile-open tracking, not captured yet (honest empty state / coming soon).
 * -------------------------------------------------------------------------*/

// ---------- Design tokens ----------
const COLOR_PRIMARY = '#0d5d2f';
const COLOR_PRIMARY_LIGHT = '#1a7a4a';
const PIE_COLORS = ['#0d5d2f', '#1a7a4a', '#34c759', '#86efac'];
const BAR_COLORS = { Pro: '#d97706', Basic: '#2563eb', Visitor: '#6b7280' };

function buildTypeBreakdown(events, kind) {
  if (kind === 'searchers') {
    const counts = { Name: 0, Phone: 0, Email: 0, Address: 0 };
    events.forEach((e) => {
      if (counts[e.searchType] != null) counts[e.searchType]++;
    });
    return Object.entries(counts)
      .filter(([, v]) => v > 0)
      .map(([name, value]) => ({ name, value }));
  }
  // For viewers, break down by most-viewed sections
  const counts = {};
  events.forEach((e) => {
    (e.sectionsViewed || []).forEach((s) => {
      counts[s] = (counts[s] || 0) + 1;
    });
  });
  return Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 4)
    .map(([name, value]) => ({ name, value }));
}

function buildTierBreakdown(events) {
  const counts = { Pro: 0, Basic: 0, Visitor: 0 };
  events.forEach((e) => {
    if (counts[e.tier] != null) counts[e.tier]++;
  });
  return Object.entries(counts).map(([name, value]) => ({ name, value }));
}

// ---------- CSV export ----------
function downloadCSV(events, kind) {
  const headers =
    kind === 'searchers'
      ? ['Name', 'Location', 'Search Type', 'Tier', 'Date']
      : ['Name', 'Location', 'Sections Viewed', 'Tier', 'Date'];
  const rows = events.map((e) => {
    const base = [
      `"${e.name}"`,
      `"${e.city}, ${e.state}"`,
      kind === 'searchers' ? e.searchType : `"${(e.sectionsViewed || []).join('; ')}"`,
      e.tier,
      new Date(e.timestamp).toISOString(),
    ];
    return base.join(',');
  });
  const csv = [headers.join(','), ...rows].join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${kind}-${new Date().toISOString().split('T')[0]}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// ---------- Sub-components ----------

const StatCard = ({ label, value, delta, deltaLabel }) => {
  let deltaClass = styles.statDeltaFlat;
  let arrow = '—';
  if (delta > 0) {
    deltaClass = styles.statDeltaUp;
    arrow = '\u25B2';
  } else if (delta < 0) {
    deltaClass = styles.statDeltaDown;
    arrow = '\u25BC';
  }
  return (
    <div className={styles.statCard}>
      <p className={styles.statLabel}>{label}</p>
      <p className={styles.statValue}>{value.toLocaleString()}</p>
      {delta != null && (
        <div>
          <span className={`${styles.statDelta} ${deltaClass}`}>
            {arrow} {Math.abs(delta)}%
          </span>
          {deltaLabel && <span className={styles.statSublabel}>{deltaLabel}</span>}
        </div>
      )}
    </div>
  );
};

const TrendChart = ({ data }) => (
  <div className={styles.chartBox}>
    <ResponsiveContainer width="100%" height="100%">
      <AreaChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
        <defs>
          <linearGradient id="trendGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={COLOR_PRIMARY} stopOpacity={0.4} />
            <stop offset="100%" stopColor={COLOR_PRIMARY} stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" vertical={false} />
        <XAxis
          dataKey="label"
          tick={{ fontSize: 11, fill: '#6b7280' }}
          interval={Math.floor(data.length / 6)}
          tickLine={false}
          axisLine={{ stroke: '#e5e7eb' }}
        />
        <YAxis
          tick={{ fontSize: 11, fill: '#6b7280' }}
          tickLine={false}
          axisLine={{ stroke: '#e5e7eb' }}
          allowDecimals={false}
        />
        <Tooltip
          contentStyle={{
            background: '#fff',
            border: '1px solid #e5e7eb',
            borderRadius: '8px',
            fontSize: '0.85rem',
          }}
          labelStyle={{ color: '#111827', fontWeight: 600 }}
        />
        <Area
          type="monotone"
          dataKey="count"
          stroke={COLOR_PRIMARY}
          strokeWidth={2.5}
          fill="url(#trendGradient)"
        />
      </AreaChart>
    </ResponsiveContainer>
  </div>
);

const TypePieChart = ({ data }) => (
  <div className={styles.chartBox}>
    <ResponsiveContainer width="100%" height="100%">
      <PieChart>
        <Pie
          data={data}
          cx="50%"
          cy="50%"
          innerRadius={55}
          outerRadius={95}
          paddingAngle={2}
          dataKey="value"
          label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
          labelLine={false}
        >
          {data.map((entry, idx) => (
            <Cell key={idx} fill={PIE_COLORS[idx % PIE_COLORS.length]} />
          ))}
        </Pie>
        <Tooltip
          contentStyle={{
            background: '#fff',
            border: '1px solid #e5e7eb',
            borderRadius: '8px',
            fontSize: '0.85rem',
          }}
        />
      </PieChart>
    </ResponsiveContainer>
  </div>
);

const TierBarChart = ({ data }) => (
  <div className={styles.chartBox}>
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" vertical={false} />
        <XAxis
          dataKey="name"
          tick={{ fontSize: 12, fill: '#6b7280' }}
          tickLine={false}
          axisLine={{ stroke: '#e5e7eb' }}
        />
        <YAxis
          tick={{ fontSize: 11, fill: '#6b7280' }}
          tickLine={false}
          axisLine={{ stroke: '#e5e7eb' }}
          allowDecimals={false}
        />
        <Tooltip
          cursor={{ fill: 'rgba(13, 93, 47, 0.06)' }}
          contentStyle={{
            background: '#fff',
            border: '1px solid #e5e7eb',
            borderRadius: '8px',
            fontSize: '0.85rem',
          }}
        />
        <Bar dataKey="value" radius={[8, 8, 0, 0]}>
          {data.map((entry, idx) => (
            <Cell key={idx} fill={BAR_COLORS[entry.name] || COLOR_PRIMARY} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  </div>
);

const EventRow = ({ event, kind, isPaid }) => {
  // Names/locations arrive already tiered from the server (free = masked there, so real PII
  // never reaches a free client). Render as-is; the !isPaid CSS just adds the blur treatment.
  const displayName = event.name;
  const displayLocation = [event.city, event.state].filter(Boolean).join(', ') || '—';
  const displayDate = isPaid ? formatExactDate(event.timestamp) : relativeDate(event.timestamp);

  const tierClass =
    event.tier === 'Pro' ? styles.tierPro : event.tier === 'Basic' ? styles.tierBasic : styles.tierVisitor;

  const initial = isPaid && event.firstName ? event.firstName[0] : '?';

  return (
    <li className={styles.eventRow}>
      <div className={`${styles.avatar} ${!isPaid ? styles.avatarBlurred : ''}`}>{initial}</div>
      <div className={styles.eventBody}>
        <p className={`${styles.eventName} ${!isPaid ? styles.masked : ''}`}>{displayName}</p>
        <div className={styles.eventMeta}>
          <span className={styles.eventLocation}>
            <svg
              aria-hidden="true"
              width="12"
              height="12"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.25"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 1 1 16 0Z" />
              <circle cx="12" cy="10" r="3" />
            </svg>
            <span className={!isPaid ? styles.masked : ''}>{displayLocation}</span>
          </span>
          {kind === 'searchers' && event.searchType && (
            <span className={styles.typePill}>{event.searchType}</span>
          )}
          {kind === 'viewers' && event.sectionsViewed && (
            <span className={styles.typePill}>
              {event.sectionsViewed.length} section{event.sectionsViewed.length === 1 ? '' : 's'}
            </span>
          )}
          <span className={`${styles.tierBadge} ${tierClass}`}>{event.tier}</span>
        </div>
      </div>
      <span className={styles.eventDate}>{displayDate}</span>
    </li>
  );
};

const UpgradeBanner = () => (
  <div className={styles.upgradeBanner}>
    <div className={styles.upgradeContent}>
      <h3 className={styles.upgradeTitle}>Upgrade to see exactly who's searching for you</h3>
      <p className={styles.upgradeText}>
        Your account shows activity — unlock full names, exact locations, and real-time alerts
        when someone searches for or views your profile.
      </p>
    </div>
    <Link to="/upgrade" className={styles.upgradeButton} style={{ textDecoration: 'none' }}>
      {'Upgrade to Pro \u203A'}
    </Link>
  </div>
);

const SkeletonLoader = () => (
  <>
    <div className={styles.statsGrid}>
      <div className={`${styles.skeleton} ${styles.skelStat}`} />
      <div className={`${styles.skeleton} ${styles.skelStat}`} />
      <div className={`${styles.skeleton} ${styles.skelStat}`} />
    </div>
    <div className={`${styles.skeleton} ${styles.skelChart}`} />
    <div className={styles.breakdownGrid}>
      <div className={`${styles.skeleton} ${styles.skelChart}`} style={{ marginBottom: 0 }} />
      <div className={`${styles.skeleton} ${styles.skelChart}`} style={{ marginBottom: 0 }} />
    </div>
  </>
);

// ---------- Tab content ----------

const TabContent = ({ events, kind, isPaid }) => {
  const [visibleCount, setVisibleCount] = useState(10);
  const [sortBy, setSortBy] = useState('recent');
  const [tierFilter, setTierFilter] = useState('all');

  const stats = useMemo(() => computeStats(events), [events]);
  const trendData = useMemo(() => buildTrendSeries(events), [events]);
  const typeData = useMemo(() => buildTypeBreakdown(events, kind), [events, kind]);
  const tierData = useMemo(() => buildTierBreakdown(events), [events]);

  const filteredEvents = useMemo(() => {
    let list = tierFilter === 'all' ? events : events.filter((e) => e.tier === tierFilter);
    if (sortBy === 'recent') list = [...list].sort((a, b) => b.timestamp - a.timestamp);
    if (sortBy === 'oldest') list = [...list].sort((a, b) => a.timestamp - b.timestamp);
    if (sortBy === 'name') list = [...list].sort((a, b) => a.name.localeCompare(b.name));
    return list;
  }, [events, tierFilter, sortBy]);

  const visible = filteredEvents.slice(0, visibleCount);

  const monthLabel = kind === 'searchers' ? 'vs last month' : 'vs last month';
  const weekLabel = kind === 'searchers' ? 'vs last week' : 'vs last week';

  return (
    <>
      {/* Searchers is now real (our own search-activity capture). Viewers (profile-open
          tracking) isn't captured yet, so only that tab carries a "coming soon" note. */}
      {kind === 'viewers' && (
        <div style={{
          display: 'inline-flex', alignItems: 'center', gap: '0.4rem',
          padding: '0.25rem 0.6rem',
          background: '#fef3c7', border: '1px solid #fde68a',
          borderRadius: '999px', color: '#92400e',
          fontSize: '0.7rem', fontWeight: 700,
          letterSpacing: '0.04em', textTransform: 'uppercase',
          marginBottom: '0.5rem',
        }}>
          Profile-view tracking · coming soon
        </div>
      )}

      {/* Stat cards */}
      <div className={styles.statsGrid}>
        <StatCard label="Total (all time)" value={stats.total} />
        <StatCard label="This month" value={stats.thisMonth} delta={stats.monthChange} deltaLabel={monthLabel} />
        <StatCard label="This week" value={stats.thisWeek} delta={stats.weekChange} deltaLabel={weekLabel} />
      </div>

      {/* Trend chart */}
      <div className={styles.chartSection}>
        <div className={styles.sectionHeader}>
          <h2 className={styles.sectionTitle}>
            {kind === 'searchers' ? 'Searches over time' : 'Profile views over time'}
          </h2>
          <p className={styles.sectionCaption}>Last 30 days</p>
        </div>
        <TrendChart data={trendData} />
      </div>

      {/* Breakdown charts */}
      <div className={styles.breakdownGrid}>
        <div className={styles.breakdownCard}>
          <div className={styles.sectionHeader}>
            <h2 className={styles.sectionTitle}>
              {kind === 'searchers' ? 'By search type' : 'By section viewed'}
            </h2>
          </div>
          {typeData.length > 0 ? (
            <TypePieChart data={typeData} />
          ) : (
            <div className={styles.emptyState}>
              <p className={styles.emptyText}>No data to display.</p>
            </div>
          )}
        </div>
        <div className={styles.breakdownCard}>
          <div className={styles.sectionHeader}>
            <h2 className={styles.sectionTitle}>By searcher tier</h2>
          </div>
          <TierBarChart data={tierData} />
        </div>
      </div>

      {/* Upgrade banner for free tier */}
      {!isPaid && <UpgradeBanner />}

      {/* Event list */}
      <div className={styles.listCard}>
        <div className={styles.sectionHeader}>
          <h2 className={styles.sectionTitle}>
            Recent {kind === 'searchers' ? 'searches' : 'profile views'}
          </h2>
          {isPaid && (
            <div className={styles.listControls}>
              <select
                className={styles.selectControl}
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                aria-label="Sort by"
              >
                <option value="recent">Newest first</option>
                <option value="oldest">Oldest first</option>
                <option value="name">Name (A-Z)</option>
              </select>
              <select
                className={styles.selectControl}
                value={tierFilter}
                onChange={(e) => setTierFilter(e.target.value)}
                aria-label="Filter by tier"
              >
                <option value="all">All tiers</option>
                <option value="Pro">Pro only</option>
                <option value="Basic">Basic only</option>
                <option value="Visitor">Visitors only</option>
              </select>
              <button
                className={styles.exportButton}
                onClick={() => {
                  track('watchers_csv_export', { kind, count: filteredEvents.length });
                  downloadCSV(filteredEvents, kind);
                }}
                type="button"
              >
                Export CSV
              </button>
            </div>
          )}
        </div>

        {visible.length === 0 ? (
          <div className={styles.emptyState}>
            <svg
              className={styles.emptyIcon}
              width="44"
              height="44"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <circle cx="11" cy="11" r="7" />
              <path d="m20 20-3.5-3.5" />
            </svg>
            <p className={styles.emptyTitle}>No activity yet</p>
            <p className={styles.emptyText}>
              When someone {kind === 'searchers' ? 'searches for' : 'views'} your profile, it will appear here.
            </p>
          </div>
        ) : (
          <>
            <ul className={styles.eventList}>
              {visible.map((event) => (
                <EventRow key={event.id} event={event} kind={kind} isPaid={isPaid} />
              ))}
            </ul>
            {visibleCount < filteredEvents.length && (
              <div className={styles.showMoreWrap}>
                <button
                  type="button"
                  className={styles.showMoreButton}
                  onClick={() => setVisibleCount((c) => c + 10)}
                >
                  Show more ({filteredEvents.length - visibleCount} more)
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </>
  );
};

// ---------- Main page ----------

const WhoIsSearchingPage = () => {
  const { user, isPaid } = useAuth();
  const [activeTab, setActiveTab] = useState('searchers');
  const [loading, setLoading] = useState(true);
  const [searchers, setSearchers] = useState([]);
  const [viewers, setViewers] = useState([]);
  const [teaseSummary, setTeaseSummary] = useState(null);

  // The member's own identity — what we match incoming searches against.
  const identity = useMemo(() => {
    const name = [user?.firstName, user?.lastName].filter(Boolean).join(' ') || user?.name || '';
    return {
      name,
      city: user?.city || user?.addressCity || '',
      state: user?.state || user?.addressState || '',
      selfUserId: user?.id || user?._id || user?.userId || undefined,
    };
  }, [user]);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    if (!identity.name) { setSearchers([]); setViewers([]); setLoading(false); return () => {}; }
    fetchWhoIsSearching({ ...identity, tier: isPaid ? 'paid' : 'free' })
      .then((res) => {
        if (!alive) return;
        setSearchers(Array.isArray(res.events) ? res.events : []);
        setTeaseSummary(res.teaseSummary || null);
        setViewers([]); // profile-view capture isn't live yet — honest empty state
      })
      .catch(() => { if (alive) { setSearchers([]); setViewers([]); setTeaseSummary(null); } })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [identity, isPaid]);

  useEffect(() => {
    track('watchers_view', { isPaid: !!isPaid });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <main className={styles.main}>
      {/* Tease summary — the real "N people are searching for you…" hook. For free members
          it's the conversion driver (masked list below, this line proves it's real). */}
      {!loading && teaseSummary && teaseSummary.headline && (
        <div
          role="status"
          style={{
            marginBottom: '1.25rem',
            background: '#f0fdf4',
            border: '1px solid #16a34a',
            borderRadius: '0.5rem',
            padding: '1rem 1.25rem',
            display: 'flex',
            alignItems: 'flex-start',
            gap: '0.75rem',
          }}
        >
          <span aria-hidden="true" style={{ fontSize: '1.35rem', lineHeight: 1 }}>👀</span>
          <div>
            <p style={{ margin: 0, fontWeight: 800, color: '#14532d', fontSize: '1.05rem' }}>
              {teaseSummary.headline}
            </p>
            {teaseSummary.lines && teaseSummary.lines.length > 0 && (
              <p style={{ margin: '0.35rem 0 0', color: '#166534', fontSize: '0.9rem', lineHeight: 1.5 }}>
                {teaseSummary.lines.join(' · ')}
                {!isPaid && '  —  upgrade to see every name and exact details'}
              </p>
            )}
          </div>
        </div>
      )}

      <header className={styles.header}>
        <h1 className={styles.title}>Who's Watching You</h1>
        <p className={styles.subtitle}>
          See who's been searching for and viewing your profile
        </p>
      </header>

      {/* Tab bar */}
      <div className={styles.tabBar} role="tablist">
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'searchers'}
          className={`${styles.tab} ${activeTab === 'searchers' ? styles.tabActive : ''}`}
          onClick={() => {
            track('watchers_tab_change', { tab: 'searchers' });
            setActiveTab('searchers');
          }}
        >
          Searchers
          {!loading && <span className={styles.tabCount}>{searchers.length}</span>}
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'viewers'}
          className={`${styles.tab} ${activeTab === 'viewers' ? styles.tabActive : ''}`}
          onClick={() => {
            track('watchers_tab_change', { tab: 'viewers' });
            setActiveTab('viewers');
          }}
        >
          Viewers
          {!loading && <span className={styles.tabCount}>{viewers.length}</span>}
        </button>
      </div>

      {loading ? (
        <SkeletonLoader />
      ) : activeTab === 'searchers' ? (
        <TabContent events={searchers} kind="searchers" isPaid={isPaid} />
      ) : (
        <TabContent events={viewers} kind="viewers" isPaid={isPaid} />
      )}
    </main>
  );
};

export default WhoIsSearchingPage;
