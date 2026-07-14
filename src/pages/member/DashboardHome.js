import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  RadialBarChart,
  RadialBar,
  PolarAngleAxis,
  ResponsiveContainer,
} from 'recharts';
import { useAuth } from '../../context/AuthContext';
import api from '../../api';
import { getReportList, createReportForIdentity } from '../../services/reportService';
import { track } from '../../services/trackingService';
import DevBCSession from '../../components/DevBCSession';
import EnrichProfileCard from '../../components/EnrichProfileCard';
import styles from './DashboardHome.module.css';
import {
  hashString,
  generateEvents,
  generateWatchlist,
  generateRecordsFeed,
  generateBrokerStatuses,
  computeBrokerProgress,
  computeExposureScore,
  computeStats,
  relativeDate,
  maskName,
  maskLocation,
  buildWatchlistFromReports,
  buildRecordsFeedFromAlerts,
  computeExposureFromReports,
} from './watchingHelpers';

/* ---------------------------------------------------------------------------
 * Member Dashboard — widget-based layout
 *
 * Row 1  — Exposure Score + Who's Watching You
 * Row 2  — Quick action tiles
 * Row 3  — Data Broker Removal Tracker
 * Row 4  — Records Found feed + Sidebar (quota, reports, searches)
 * Row 5  — Watchlist (People You're Watching) + Alerts preview
 *
 * Real API integration (reports, alerts, searches, profile views) is preserved.
 * Mock data for exposure score, watchers, brokers, watchlist, and records feed
 * is seeded by the user id so it's stable across refreshes.
 * -------------------------------------------------------------------------*/

// ---------- Icons (inline SVG, no emojis) ----------

const Icon = {
  Search: (props) => (
    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor"
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}>
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-3.5-3.5" />
    </svg>
  ),
  Shield: (props) => (
    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor"
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}>
      <path d="M12 2 4 5v6c0 5 3.5 9.3 8 11 4.5-1.7 8-6 8-11V5l-8-3Z" />
    </svg>
  ),
  Eye: (props) => (
    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor"
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}>
      <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  ),
  Bell: (props) => (
    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor"
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}>
      <path d="M18 16v-5a6 6 0 1 0-12 0v5l-2 2h16Z" />
      <path d="M10 21a2 2 0 0 0 4 0" />
    </svg>
  ),
  User: (props) => (
    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor"
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}>
      <circle cx="12" cy="8" r="4" />
      <path d="M4 21c0-4 4-7 8-7s8 3 8 7" />
    </svg>
  ),
  Phone: (props) => (
    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor"
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}>
      <path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1.9.3 1.8.6 2.6a2 2 0 0 1-.5 2.1L8 9.6a16 16 0 0 0 6 6l1.2-1.2a2 2 0 0 1 2.1-.5c.8.3 1.7.5 2.6.6A2 2 0 0 1 22 16.9Z" />
    </svg>
  ),
  Home: (props) => (
    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor"
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}>
      <path d="M3 11 12 3l9 8" />
      <path d="M5 10v10h14V10" />
    </svg>
  ),
  Mail: (props) => (
    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor"
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}>
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <path d="m3 7 9 6 9-6" />
    </svg>
  ),
  Users: (props) => (
    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor"
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}>
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M22 21v-2a4 4 0 0 0-3-3.9" />
      <path d="M16 3.1A4 4 0 0 1 16 11" />
    </svg>
  ),
  Briefcase: (props) => (
    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor"
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}>
      <rect x="2" y="7" width="20" height="13" rx="2" />
      <path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
    </svg>
  ),
  Check: (props) => (
    <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor"
      strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}>
      <path d="m5 12 5 5 9-10" />
    </svg>
  ),
  Arrow: (props) => (
    <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor"
      strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}>
      <path d="M5 12h14" />
      <path d="m12 5 7 7-7 7" />
    </svg>
  ),
  Plus: (props) => (
    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor"
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}>
      <path d="M12 5v14" />
      <path d="M5 12h14" />
    </svg>
  ),
  Download: (props) => (
    <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor"
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}>
      <path d="M12 3v12" />
      <path d="m7 10 5 5 5-5" />
      <path d="M5 21h14" />
    </svg>
  ),
  TriangleUp: () => <span aria-hidden="true">{'\u25B2'}</span>,
  TriangleDown: () => <span aria-hidden="true">{'\u25BC'}</span>,
  Lock: (props) => (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor"
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}>
      <rect x="4" y="11" width="16" height="10" rx="2" />
      <path d="M8 11V7a4 4 0 0 1 8 0v4" />
    </svg>
  ),
  Warning: (props) => (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor"
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}>
      <path d="M12 3 2 20h20Z" />
      <path d="M12 10v4" />
      <path d="M12 18h.01" />
    </svg>
  ),
};

// ---------- Helpers ----------

const gradeClass = (score, styles) => {
  if (score >= 80) return styles.gaugeGradeA;
  if (score >= 70) return styles.gaugeGradeB;
  if (score >= 60) return styles.gaugeGradeC;
  if (score >= 50) return styles.gaugeGradeD;
  return styles.gaugeGradeF;
};

const scoreColor = (score) => {
  if (score >= 80) return '#0d5d2f';
  if (score >= 50) return '#d97706';
  return '#dc2626';
};

const getReportTitle = (report) => {
  if (!report) return 'Report';
  return (
    report.fullName ||
    report.name ||
    report.title ||
    report.targetName ||
    report.data?.fullName ||
    report.data?.teaserInput?.fullName ||
    `Report ${report.id ? String(report.id).slice(0, 6) : ''}`.trim()
  );
};

// ---------- Widgets ----------

const ExposureScoreWidget = ({ score, isPaid }) => {
  const color = scoreColor(score.score);
  const gaugeData = [{ name: 'score', value: score.score, fill: color }];

  const deltaClass =
    score.delta > 0 ? styles.deltaUp : score.delta < 0 ? styles.deltaDown : styles.deltaFlat;
  const DeltaArrow = score.delta > 0 ? Icon.TriangleUp : score.delta < 0 ? Icon.TriangleDown : () => <span>—</span>;

  const factors = [
    { key: 'addresses', label: 'Addresses', value: score.factors.addresses, max: 12 },
    { key: 'phones', label: 'Phone numbers', value: score.factors.phones, max: 8 },
    { key: 'emails', label: 'Email addresses', value: score.factors.emails, max: 6 },
    { key: 'relatives', label: 'Relatives linked', value: score.factors.relatives, max: 15 },
  ];

  return (
    <div className={styles.heroCard}>
      <div className={styles.heroHeader}>
        <p className={styles.heroLabel}>
          Privacy Exposure Score
          {score.isReal && (
            <span style={{
              marginLeft: '0.5rem',
              fontSize: '0.65rem',
              fontWeight: 700,
              color: '#065f46',
              background: '#d1fae5',
              padding: '0.1rem 0.5rem',
              borderRadius: '9999px',
              letterSpacing: '0.04em',
              textTransform: 'uppercase',
              verticalAlign: 'middle',
            }}>Live</span>
          )}
        </p>
        <Link to="/who-is-searching" className={styles.heroHelpLink}>
          How it works <Icon.Arrow />
        </Link>
      </div>

      <div className={styles.exposureBody}>
        <div className={styles.gaugeWrap}>
          <ResponsiveContainer width="100%" height="100%">
            <RadialBarChart
              innerRadius="72%"
              outerRadius="100%"
              startAngle={90}
              endAngle={-270}
              data={gaugeData}
            >
              <PolarAngleAxis type="number" domain={[0, 100]} tick={false} />
              <RadialBar background={{ fill: '#f3f4f6' }} dataKey="value" cornerRadius={12} fill={color} />
            </RadialBarChart>
          </ResponsiveContainer>
          <div className={styles.gaugeCenter}>
            <div className={styles.gaugeNumber}>{score.score}</div>
            <div className={`${styles.gaugeGrade} ${gradeClass(score.score, styles)}`}>
              Grade {score.letter}
            </div>
          </div>
        </div>

        <div className={styles.exposureMeta}>
          <div className={`${styles.exposureDelta} ${deltaClass}`}>
            <DeltaArrow /> {Math.abs(score.delta)} pts vs last month
          </div>
          <p className={styles.exposureSummary}>
            Based on <strong>{score.totalRecords}</strong> records found across{' '}
            <strong>{score.sources}</strong> public sources.
          </p>

          {isPaid ? (
            <ul className={styles.factorList}>
              {factors.map((f) => (
                <li key={f.key} className={styles.factorRow}>
                  <span>{f.label}</span>
                  <div className={styles.factorBar}>
                    <div
                      className={styles.factorBarFill}
                      style={{ width: `${Math.min(100, (f.value / f.max) * 100)}%` }}
                    />
                  </div>
                  <span className={styles.factorCount}>{f.value}</span>
                </li>
              ))}
            </ul>
          ) : (
            <div className={styles.factorsLocked}>
              <Icon.Lock /> <Link to="/payment">Upgrade to Pro</Link> to unlock the factors driving your score.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

const WatchingYouWidget = ({ searchers, seed }) => {
  const stats = useMemo(() => computeStats(searchers), [searchers]);
  const monthCount = stats.thisMonth;
  const delta = stats.monthChange;
  const deltaClass = delta > 0 ? styles.deltaUp : delta < 0 ? styles.deltaDown : styles.deltaFlat;
  const DeltaArrow = delta > 0 ? Icon.TriangleUp : delta < 0 ? Icon.TriangleDown : () => <span>—</span>;

  // Deterministic initials for blurred avatars
  const initials = useMemo(() => {
    const letters = 'ABCDEFGHJKLMNPRSTVW';
    const out = [];
    let n = seed;
    for (let i = 0; i < 6; i++) {
      n = (n * 1103515245 + 12345) & 0x7fffffff;
      out.push(letters[n % letters.length]);
    }
    return out;
  }, [seed]);

  return (
    <div className={styles.heroCard}>
      <div className={styles.heroHeader}>
        <p className={styles.heroLabel}>People Watching You</p>
        <Link to="/who-is-searching" className={styles.heroHelpLink}>
          See who <Icon.Arrow />
        </Link>
      </div>

      <div className={styles.watchBody}>
        <p className={styles.watchNumber}>{monthCount.toLocaleString()}</p>
        <p className={styles.watchCaption}>
          {monthCount === 1 ? 'person searched' : 'people searched'} or viewed your profile this month
        </p>

        <div className={`${styles.exposureDelta} ${deltaClass}`} style={{ alignSelf: 'flex-start' }}>
          <DeltaArrow /> {Math.abs(delta)}% vs last month
        </div>

        <div className={styles.watchAvatars}>
          {initials.map((letter, i) => (
            <div key={i} className={styles.watchAvatar}>{letter}</div>
          ))}
          <span className={styles.watchMore}>+{Math.max(0, monthCount - 6)} more</span>
        </div>

        <Link to="/who-is-searching" className={styles.watchLink}>
          See who's watching <Icon.Arrow />
        </Link>
      </div>
    </div>
  );
};

const QuickActionTile = ({ icon: IconCmp, title, desc, onClick }) => (
  <button type="button" className={styles.quickTile} onClick={onClick}>
    <div className={styles.quickTileIcon}>
      <IconCmp />
    </div>
    <h3 className={styles.quickTileTitle}>{title}</h3>
    <p className={styles.quickTileDesc}>{desc}</p>
  </button>
);

const BrokerTracker = ({ brokers, isPaid, navigate }) => {
  const progress = useMemo(() => computeBrokerProgress(brokers), [brokers]);
  const progressClass =
    progress.percent >= 70
      ? styles.brokerProgressHigh
      : progress.percent >= 30
        ? styles.brokerProgressMid
        : styles.brokerProgressLow;

  const visible = isPaid ? brokers : brokers.slice(0, 3);

  return (
    <div className={styles.brokerCard}>
      <div className={styles.brokerHeader}>
        <div>
          <h2 className={styles.brokerTitle}>Data Broker Removal</h2>
          <p className={styles.brokerCaption}>
            Your personal info is being automatically removed from data broker sites.
          </p>
        </div>
        <div className={styles.brokerStats}>
          <span className={styles.brokerBigNumber}>{progress.removed}</span>
          <span className={styles.brokerOfTotal}>of {progress.total} sites cleaned</span>
        </div>
      </div>

      <div className={styles.brokerProgressTrack}>
        <div
          className={`${styles.brokerProgressFill} ${progressClass}`}
          style={{ width: `${Math.max(progress.percent, 3)}%` }}
        />
      </div>

      <div className={styles.brokerGrid}>
        {visible.map((b) => {
          const chipClass =
            b.status === 'removed'
              ? styles.chipRemoved
              : b.status === 'removing'
                ? styles.chipRemoving
                : styles.chipFound;
          return (
            <div key={b.name} className={styles.brokerItem}>
              <div className={styles.brokerLogo}>{b.code}</div>
              <div className={styles.brokerItemBody}>
                <p className={styles.brokerName}>{b.name}</p>
                <span className={`${styles.brokerChip} ${chipClass}`}>{b.status}</span>
              </div>
            </div>
          );
        })}
      </div>

      {isPaid ? (
        <div className={styles.brokerFooter}>
          <Link to="/opt-out">View all {progress.total} sites <Icon.Arrow /></Link>
          <span className={styles.brokerCaption}>Auto-updated every 7 days</span>
        </div>
      ) : (
        <div className={styles.brokerUpgradeBanner}>
          <p>
            <Icon.Lock /> <strong>Upgrade to Pro</strong> to start automatic removals on all {progress.total} data broker sites.
          </p>
          <button type="button" className={styles.brokerUpgradeBtn} onClick={() => navigate('/payment')}>
            Start Removals
          </button>
        </div>
      )}
    </div>
  );
};

// Map a record kind to an icon component
const recordIcon = (kind) => {
  switch (kind) {
    case 'phone': return Icon.Phone;
    case 'address': return Icon.Home;
    case 'email': return Icon.Mail;
    case 'relative': return Icon.Users;
    case 'employment': return Icon.Briefcase;
    default: return Icon.User;
  }
};

const RecordsFeed = ({ records, isLive }) => {
  const [tab, setTab] = useState('all');

  const filtered = useMemo(() => {
    if (tab === 'all') return records;
    if (tab === 'records') return records.filter((r) => r.type === 'record');
    if (tab === 'removals') return records.filter((r) => r.type === 'removal');
    if (tab === 'alerts') return records.filter((r) => r.type === 'alert');
    return records;
  }, [records, tab]);

  const counts = useMemo(
    () => ({
      all: records.length,
      records: records.filter((r) => r.type === 'record').length,
      removals: records.filter((r) => r.type === 'removal').length,
      alerts: records.filter((r) => r.type === 'alert').length,
    }),
    [records],
  );

  const tabs = [
    { key: 'all', label: 'All' },
    { key: 'records', label: 'New Records' },
    { key: 'removals', label: 'Removals' },
    { key: 'alerts', label: 'Alerts' },
  ];

  return (
    <section className={styles.panel}>
      <div className={styles.panelHeader}>
        <h2 className={styles.panelTitle}>
          Recent Activity
          {isLive && <LivePill />}
        </h2>
        <Link to="/search-history" className={styles.panelLink}>View all</Link>
      </div>

      <div className={styles.feedTabs} role="tablist">
        {tabs.map((t) => (
          <button
            key={t.key}
            type="button"
            role="tab"
            aria-selected={tab === t.key}
            className={`${styles.feedTab} ${tab === t.key ? styles.feedTabActive : ''}`}
            onClick={() => setTab(t.key)}
          >
            {t.label}
            <span className={styles.feedTabCount}>{counts[t.key]}</span>
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <div className={styles.emptyState}>
          <p className={styles.emptyTitle}>No activity to show</p>
          <p className={styles.emptyText}>New discoveries will appear here.</p>
        </div>
      ) : (
        <ul className={styles.feedList}>
          {filtered.slice(0, 10).map((r) => {
            const IconCmp = recordIcon(r.recordKind);
            const iconClass =
              r.type === 'removal'
                ? styles.feedIconRemoval
                : r.type === 'alert'
                  ? styles.feedIconAlert
                  : styles.feedIconRecord;
            return (
              <li key={r.id} className={styles.feedRow}>
                <div className={`${styles.feedIcon} ${iconClass}`}>
                  <IconCmp />
                </div>
                <div className={styles.feedBody}>
                  <p className={styles.feedTitle}>{r.title}</p>
                  <div className={styles.feedMeta}>
                    <span className={styles.feedSourcePill}>{r.source}</span>
                  </div>
                </div>
                <span className={styles.feedDate}>{relativeDate(r.timestamp)}</span>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
};

const QuotaRing = ({ used, limit, isPaid, onUpgrade }) => {
  const pct = isPaid ? 100 : Math.min(100, Math.round((used / limit) * 100));
  const unlimited = isPaid;
  const color = pct >= 90 ? '#dc2626' : pct >= 70 ? '#d97706' : '#0d5d2f';
  const data = [{ name: 'used', value: unlimited ? 100 : pct, fill: color }];

  const showCta = !isPaid && pct >= 70;

  return (
    <div className={styles.quotaCard}>
      <div className={styles.quotaRing}>
        <ResponsiveContainer width="100%" height="100%">
          <RadialBarChart
            innerRadius="70%"
            outerRadius="100%"
            startAngle={90}
            endAngle={-270}
            data={data}
          >
            <PolarAngleAxis type="number" domain={[0, 100]} tick={false} />
            <RadialBar background={{ fill: '#f3f4f6' }} dataKey="value" cornerRadius={10} fill={color} />
          </RadialBarChart>
        </ResponsiveContainer>
        <div className={styles.quotaRingCenter}>
          <div className={styles.quotaNumber}>{unlimited ? '\u221E' : used}</div>
          <div className={styles.quotaLabel}>{unlimited ? 'Unlimited' : `of ${limit} used`}</div>
        </div>
      </div>
      <h3 className={styles.quotaTitle}>Monthly Searches</h3>
      <p className={styles.quotaSubtitle}>
        {unlimited ? 'Pro members get unlimited lookups.' : `${limit - used} searches remaining this month`}
      </p>
      {showCta && (
        <button type="button" className={styles.quotaCta} onClick={onUpgrade}>
          Upgrade for Unlimited
        </button>
      )}
    </div>
  );
};

const RecentReportsPanel = ({ reports, onDownload, downloadingId, navigate }) => (
  <div className={styles.miniPanel}>
    <div className={styles.miniPanelHeader}>
      <h3 className={styles.miniPanelTitle}>Recent Reports</h3>
      <Link to="/search-history" className={styles.panelLink}>All</Link>
    </div>
    {reports.length === 0 ? (
      <div className={styles.emptyState} style={{ padding: '1rem 0' }}>
        <p className={styles.emptyText}>No reports yet.</p>
      </div>
    ) : (
      <ul className={styles.miniList}>
        {reports.slice(0, 3).map((report) => {
          const target = report.commerceContentId || report.id || report.reportId;
          return (
            <li key={report.id || report.reportId} className={styles.miniRow}>
              <div
                className={styles.miniRowBody}
                onClick={() => target && navigate(`/people/${target}`)}
                role={target ? 'button' : undefined}
                tabIndex={target ? 0 : undefined}
                style={{ cursor: target ? 'pointer' : 'default' }}
              >
                <p className={styles.miniRowTitle}>{getReportTitle(report)}</p>
                <p className={styles.miniRowSub}>{relativeDate(report.createdAt)}</p>
              </div>
              {target && (
                <button
                  type="button"
                  className={styles.miniActionBtn}
                  disabled={downloadingId === target}
                  onClick={(e) => onDownload(e, target)}
                  title="Download PDF"
                >
                  {downloadingId === target ? '…' : <><Icon.Download /> PDF</>}
                </button>
              )}
            </li>
          );
        })}
      </ul>
    )}
  </div>
);

const RecentSearchesPanel = ({ searches, navigate }) => (
  <div className={styles.miniPanel}>
    <div className={styles.miniPanelHeader}>
      <h3 className={styles.miniPanelTitle}>Recent Searches</h3>
      <Link to="/search-history" className={styles.panelLink}>All</Link>
    </div>
    {searches.length === 0 ? (
      <div className={styles.emptyState} style={{ padding: '1rem 0' }}>
        <p className={styles.emptyText}>No searches yet.</p>
      </div>
    ) : (
      <ul className={styles.miniList}>
        {searches.slice(0, 3).map((s) => {
          const label =
            s.query?.firstName || s.query?.email || s.query?.phone || s.type || 'Search';
          const sub = `${s.query?.lastName ? s.query.lastName + ' ' : ''}${s.query?.state || ''}`.trim();
          return (
            <li key={s.id || label + Math.random()} className={styles.miniRow}>
              <div className={styles.miniRowBody}>
                <p className={styles.miniRowTitle}>{label}</p>
                <p className={styles.miniRowSub}>
                  {sub || (s.type || 'name')} • {relativeDate(s.timestamp)}
                </p>
              </div>
              <button
                type="button"
                className={styles.miniActionBtn}
                onClick={() => navigate('/people-search')}
              >
                Search
              </button>
            </li>
          );
        })}
      </ul>
    )}
  </div>
);

const RecentMessagesPanel = ({ messages, navigate }) => {
  if (!messages || messages.length === 0) return null;
  return (
    <div className={styles.miniPanel}>
      <div className={styles.miniPanelHeader}>
        <h3 className={styles.miniPanelTitle}>
          Messages{' '}
          <span style={{
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            background: '#0d5d2f', color: '#fff', fontSize: '0.7rem', fontWeight: 700,
            borderRadius: '9999px', minWidth: '20px', height: '20px', padding: '0 5px',
            marginLeft: '0.35rem', verticalAlign: 'middle',
          }}>
            {messages.length}
          </span>
        </h3>
        <Link to="/account?tab=messages" className={styles.panelLink}>View all</Link>
      </div>
      <ul className={styles.miniList}>
        {messages.slice(0, 3).map((msg) => {
          const isSupport = msg.type === 'userContactCsrMail';
          const subject = msg.content?.subject || (isSupport ? 'Support message' : 'Your message');
          const body = msg.content?.message || '';
          // Strip HTML tags for preview text
          const plainText = body.replace(/<[^>]*>/g, '').trim();
          const preview = plainText.length > 60 ? plainText.substring(0, 60) + '...' : plainText;
          return (
            <li key={msg._id} className={styles.miniRow}>
              <div
                className={styles.miniRowBody}
                onClick={() => navigate('/account?tab=messages')}
                role="button"
                tabIndex={0}
                style={{ cursor: 'pointer' }}
              >
                <p className={styles.miniRowTitle}>
                  <span style={{
                    display: 'inline-block', width: '8px', height: '8px', borderRadius: '50%',
                    background: isSupport ? '#0d5d2f' : '#9ca3af', marginRight: '0.4rem', verticalAlign: 'middle',
                  }} />
                  {subject}
                </p>
                <p className={styles.miniRowSub}>{preview || 'No content'}</p>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
};

const LivePill = () => (
  <span style={{
    marginLeft: '0.5rem',
    fontSize: '0.65rem',
    fontWeight: 700,
    color: '#065f46',
    background: '#d1fae5',
    padding: '0.1rem 0.5rem',
    borderRadius: '9999px',
    letterSpacing: '0.04em',
    textTransform: 'uppercase',
    verticalAlign: 'middle',
  }}>Live</span>
);

const WatchlistCard = ({ watchlist, isPaid, navigate, isLive }) => (
  <div className={styles.watchlistCard}>
    <div className={styles.panelHeader}>
      <div>
        <h2 className={styles.panelTitle}>
          People You're Watching
          {isLive && <LivePill />}
        </h2>
        <p className={styles.brokerCaption}>
          {isLive
            ? "People you've pulled reports on. We'll flag new records when they appear."
            : 'Get notified when new records are found about someone you care about.'}
        </p>
      </div>
      <Link to="/alerts" className={styles.panelLink}>Manage</Link>
    </div>
    <div className={styles.watchlistScroll}>
      {watchlist.map((p) => {
        const displayName = isPaid ? p.name : maskName(p.name);
        const displayLocation = isPaid ? `${p.city}, ${p.state}` : maskLocation(p.city, p.state);
        const initial = isPaid ? p.firstName[0] : '?';
        return (
          <div key={p.id} className={styles.watchlistItem}>
            <div className={`${styles.watchlistAvatar} ${!isPaid ? styles.watchlistAvatarBlurred : ''}`}>
              {initial}
            </div>
            <p className={`${styles.watchlistName} ${!isPaid ? styles.masked : ''}`}>{displayName}</p>
            <p className={styles.watchlistMeta}>{displayLocation}</p>
            <p className={styles.watchlistMeta}>Updated {relativeDate(p.lastUpdated)}</p>
            {p.hasChanges && (
              <span className={styles.watchlistChangeBadge}>
                {p.newRecords} new {p.newRecords === 1 ? 'record' : 'records'}
              </span>
            )}
          </div>
        );
      })}
      <button type="button" className={styles.watchlistAdd} onClick={() => navigate('/people-search')}>
        <Icon.Plus />
        <span>Add to Watchlist</span>
      </button>
    </div>
  </div>
);

// ---------- Main page ----------

const DashboardHome = () => {
  const navigate = useNavigate();
  const { user, token, isPaid } = useAuth();

  // Real API state
  const [loading, setLoading] = useState(true);
  const [recentReports, setRecentReports] = useState([]);
  const [recentSearches, setRecentSearches] = useState([]);
  const [recentAlerts, setRecentAlerts] = useState([]);
  const [searchesUsed, setSearchesUsed] = useState(0);
  const [apiErrors, setApiErrors] = useState({});
  const [pdfDownloadingId, setPdfDownloadingId] = useState(null);
  const [recentMessages, setRecentMessages] = useState([]);
  // A pendingReport is stashed by PaymentPage when createReport failed or the
  // response came back without a commerceContentId. We retry here once on mount
  // and, on failure, surface a small banner so the member can resume the flow.
  const [pendingReport, setPendingReport] = useState(() => {
    try {
      const raw = sessionStorage.getItem('pendingReport');
      return raw ? JSON.parse(raw) : null;
    } catch { return null; }
  });
  const [pendingReportStatus, setPendingReportStatus] = useState(null);

  // Seeded mock state (exposure, watchers, brokers, watchlist, records feed)
  const seed = useMemo(() => {
    const id = user?.id || user?._id || user?.email || 'anonymous';
    return hashString(String(id));
  }, [user]);

  // Prefer real data where we have it; fall back to seeded demo data otherwise.
  // - watchlist: people the member has actually pulled reports on
  // - recordsFeed: merge real alerts with seeded until alert volume is high enough alone
  // - exposureScore: computed from field density across real reports if any exist;
  //   null → show a prompt to run a search on yourself
  const realWatchlist = useMemo(
    () => buildWatchlistFromReports(recentReports, 5),
    [recentReports]
  );
  const realRecordsFeed = useMemo(
    () => buildRecordsFeedFromAlerts(recentAlerts, 12),
    [recentAlerts]
  );
  const realExposure = useMemo(
    () => computeExposureFromReports(recentReports),
    [recentReports]
  );

  const watchlist = useMemo(
    () => (realWatchlist.length > 0 ? realWatchlist : generateWatchlist(seed, 5)),
    [realWatchlist, seed]
  );
  const recordsFeed = useMemo(() => {
    if (realRecordsFeed.length >= 4) return realRecordsFeed;
    // Blend real alerts on top of seeded so the feed never looks empty, but
    // any real alerts always surface first.
    const seededFeed = generateRecordsFeed(seed, 12);
    return [...realRecordsFeed, ...seededFeed].slice(0, 12);
  }, [realRecordsFeed, seed]);

  const exposureScore = useMemo(
    () => realExposure || computeExposureScore(seed),
    [realExposure, seed]
  );

  const searchers = useMemo(() => generateEvents(seed, 'searchers', 47), [seed]);
  const brokers = useMemo(() => generateBrokerStatuses(seed), [seed]);

  const displayName = useMemo(() => {
    if (!user) return 'Member';
    return user.fullName || user.name || user.email || 'Member';
  }, [user]);

  const SEARCH_LIMIT = 10;

  const handleDownloadPdf = async (e, commerceContentId) => {
    e.stopPropagation();
    if (!commerceContentId || pdfDownloadingId) return;
    setPdfDownloadingId(commerceContentId);
    try {
      await api.downloadPdfReport(commerceContentId);
    } catch (err) {
      console.error('[Dashboard] PDF download failed:', err?.message);
    } finally {
      setPdfDownloadingId(null);
    }
  };

  useEffect(() => {
    const fetchAll = async () => {
      if (!token) {
        setLoading(false);
        return;
      }

      const errors = {};

      // Reports
      try {
        const result = await getReportList({ token });
        if (result?.success) {
          setRecentReports(result.reports?.slice(0, 5) || []);
        } else {
          errors.reports = true;
        }
      } catch (err) {
        console.error('[Dashboard] Failed to fetch reports:', err?.message || err);
        errors.reports = true;
      }

      // Alerts
      try {
        const alertsData = await api.getAlerts(token);
        if (alertsData?.data) {
          setRecentAlerts(alertsData.data.slice(0, 5));
        }
      } catch (err) {
        if (!err?.isMockUnavailable) console.warn('[Dashboard] Alerts unavailable:', err?.message);
        errors.alerts = true;
      }

      // Searches — prefer BC's server-side counter when available so the quota ring
      // reflects real usage across devices/sessions, not just this browser's history.
      try {
        const searchesData = await api.get('/searches/me', { token });
        if (searchesData?.data) {
          const list = searchesData.data || [];
          setRecentSearches(list.slice(0, 5));
          setSearchesUsed(list.length);
        }
      } catch (err) {
        errors.searches = true;
        setSearchesUsed(0);
      }
      try {
        const teaserCount = await api.countUserTeaserSearches();
        const n = teaserCount?.count ?? teaserCount?.data?.count;
        if (typeof n === 'number') setSearchesUsed(n);
      } catch { /* BC counter optional — fall back to local list */ }

      // Profile views — still fetched to keep API warm but no longer shown directly
      try {
        await api.get('/profile-views/me', { token });
      } catch (err) {
        errors.profileViews = true;
      }

      // Messages — BC's consumer model has no aggregate-inbox endpoint;
      // apiWrapper.api.message.contact.histories(id, hash) is the only path.
      // The Recent Messages panel needs an aggregate view to be useful, so
      // it stays empty until/unless we build a client-side aggregator from
      // localStorage-tracked thread refs. Members access full threads via
      // the Account → Messages tab.
      setRecentMessages([]);

      setApiErrors(errors);
      setLoading(false);
    };

    fetchAll();
  }, [token]);

  useEffect(() => {
    track('dashboard_view', { isPaid: !!isPaid });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // One-shot retry for a pending report stashed by PaymentPage. On success we
  // navigate the member straight to their report; on failure we keep the
  // hint visible so the banner below offers a manual resume.
  useEffect(() => {
    if (!pendingReport?.extId || !token) return;
    let cancelled = false;
    setPendingReportStatus('retrying');
    (async () => {
      try {
        const res = await createReportForIdentity(pendingReport.extId, pendingReport);
        if (cancelled) return;
        if (res?.success && res.commerceContentId) {
          sessionStorage.removeItem('pendingReport');
          setPendingReport(null);
          setPendingReportStatus(null);
          navigate(`/people/${res.commerceContentId}`);
          return;
        }
        setPendingReportStatus('failed');
      } catch {
        if (!cancelled) setPendingReportStatus('failed');
      }
    })();
    return () => { cancelled = true; };
  }, [pendingReport?.extId, token, navigate]);

  const handleResumePendingReport = async () => {
    if (!pendingReport?.extId) return;
    setPendingReportStatus('retrying');
    try {
      const res = await createReportForIdentity(pendingReport.extId, pendingReport);
      if (res?.success && res.commerceContentId) {
        sessionStorage.removeItem('pendingReport');
        setPendingReport(null);
        setPendingReportStatus(null);
        navigate(`/people/${res.commerceContentId}`);
        return;
      }
      setPendingReportStatus('failed');
    } catch {
      setPendingReportStatus('failed');
    }
  };

  const handleDismissPendingReport = () => {
    sessionStorage.removeItem('pendingReport');
    setPendingReport(null);
    setPendingReportStatus(null);
  };

  const hasApiErrors = Object.keys(apiErrors).length > 0;

  return (
    <main className={styles.main}>
      <DevBCSession user={user} />

      {/* Header */}
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>Welcome back, {displayName}</h1>
          <p className={styles.subtitle}>Here's your identity protection snapshot.</p>
        </div>
        <div className={styles.headerActions}>
          <Link to="/people-search" className={styles.primaryLink}>Start a Search</Link>
          <Link to="/account" className={styles.secondaryLink}>Account Settings</Link>
          <Link
            to="/dashboard2"
            style={{
              fontSize: '0.78rem', fontWeight: 600,
              color: '#1a56db', textDecoration: 'underline',
              alignSelf: 'center', marginLeft: '0.25rem',
            }}
            title="Research-workbench prototype using only real BC data"
          >
            Try the new dashboard ↗
          </Link>
        </div>
      </div>

      {/* Profile completion (WSFY Phase 2b enrichment) — self-manages visibility once done. */}
      <div style={{ margin: '0 0 1rem' }}>
        <EnrichProfileCard />
      </div>

      {/* Pending-report resume banner — shown when PaymentPage stashed a selected
          person but createReport failed. Lets the member retry without losing
          who they originally picked. */}
      {pendingReport && pendingReportStatus === 'failed' && (
        <div
          role="alert"
          style={{
            background: '#fef3c7',
            border: '1px solid #fde68a',
            color: '#92400e',
            borderRadius: '0.5rem',
            padding: '0.75rem 1rem',
            margin: '0 0 1rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '0.75rem',
            flexWrap: 'wrap',
          }}
        >
          <span>
            Your report for <strong>{pendingReport.fullName || 'your selected person'}</strong>
            {pendingReport.location ? ` (${pendingReport.location})` : ''} isn't ready yet.
          </span>
          <span style={{ display: 'flex', gap: '0.5rem' }}>
            <button
              type="button"
              onClick={handleResumePendingReport}
              style={{
                background: '#92400e', color: '#fff', border: 'none',
                padding: '0.4rem 0.9rem', borderRadius: '0.375rem',
                fontSize: '0.85rem', fontWeight: 600, cursor: 'pointer',
              }}
            >
              Retry now
            </button>
            <button
              type="button"
              onClick={handleDismissPendingReport}
              style={{
                background: 'transparent', color: '#92400e',
                border: '1px solid #92400e',
                padding: '0.4rem 0.9rem', borderRadius: '0.375rem',
                fontSize: '0.85rem', cursor: 'pointer',
              }}
            >
              Dismiss
            </button>
          </span>
        </div>
      )}

      {/* Complete profile banner */}
      {!loading && user && (!user.zip || !user.fullName) && (
        <div className={styles.profileWarningBanner}>
          <div>
            <strong>Complete your profile</strong>
            <p>
              Add your {!user.fullName ? 'name' : ''}
              {!user.fullName && !user.zip ? ' and ' : ''}
              {!user.zip ? 'ZIP code' : ''} to get personalized results.
            </p>
          </div>
          <Link to="/profile" className={styles.profileWarningLink}>
            Update Profile <Icon.Arrow />
          </Link>
        </div>
      )}

      {/* Membership banner */}
      {!loading && (
        isPaid ? (
          <div className={`${styles.membershipBanner} ${styles.membershipBannerPro}`}>
            <div className={styles.membershipInner}>
              <div className={styles.membershipIcon}><Icon.Shield /></div>
              <div>
                <p className={styles.membershipTitle}>Pro Member</p>
                <p className={styles.membershipSub}>
                  Full access to unlimited searches, detailed reports, and data broker removals.
                </p>
              </div>
            </div>
            <span className={styles.membershipBadge}>Active</span>
          </div>
        ) : (
          <div className={styles.membershipBanner}>
            <div className={styles.membershipInner}>
              <div className={styles.membershipIcon}><Icon.Lock /></div>
              <div>
                <p className={styles.membershipTitle}>Free Account</p>
                <p className={styles.membershipSub}>
                  Upgrade to Pro for unlimited searches, full reports, and automatic data broker removals.
                </p>
              </div>
            </div>
            <button
              type="button"
              className={styles.membershipCta}
              onClick={() => {
                track('dashboard_upgrade_click', { source: 'membership_banner' });
                navigate('/payment');
              }}
            >
              Upgrade to Pro
            </button>
          </div>
        )
      )}

      {hasApiErrors && (
        <div className={styles.errorBanner}>
          <Icon.Warning />
          <span>
            Some activity data could not be loaded.{' '}
            <button type="button" onClick={() => window.location.reload()}>Refresh</button>
          </span>
        </div>
      )}

      {/* Honest data-source disclosure. Precise per widget — widgets update to
          live data as soon as the member has corresponding real activity. */}
      {!loading && (
        <div
          role="note"
          style={{
            background: realWatchlist.length > 0 || realRecordsFeed.length > 0 || realExposure ? '#ecfdf5' : '#fffbeb',
            border: `1px solid ${realWatchlist.length > 0 || realRecordsFeed.length > 0 || realExposure ? '#bbf7d0' : '#fde68a'}`,
            color: realWatchlist.length > 0 || realRecordsFeed.length > 0 || realExposure ? '#065f46' : '#92400e',
            borderRadius: '0.5rem',
            padding: '0.5rem 0.875rem',
            fontSize: '0.8rem',
            margin: '0 0 1rem',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            flexWrap: 'wrap',
          }}
        >
          <strong style={{ textTransform: 'uppercase', letterSpacing: '0.04em', fontSize: '0.72rem' }}>
            Data sources
          </strong>
          <span>
            <strong>Live:</strong> reports, searches, alerts, usage
            {realWatchlist.length > 0 ? ', watchlist' : ''}
            {realRecordsFeed.length > 0 ? ', records feed' : ''}
            {realExposure ? ', exposure score' : ''}
            . <strong>Preview:</strong> who's watching you, data-broker statuses
            {realWatchlist.length === 0 ? ', watchlist' : ''}
            {realRecordsFeed.length === 0 ? ', records feed' : ''}
            {!realExposure ? ', exposure score' : ''}
            .
          </span>
        </div>
      )}

      {/* Row 1 — Hero widgets */}
      {loading ? (
        <div className={styles.heroRow}>
          <div className={`${styles.skeleton} ${styles.skelHero}`} />
          <div className={`${styles.skeleton} ${styles.skelHero}`} />
        </div>
      ) : (
        <div className={styles.heroRow}>
          <ExposureScoreWidget score={exposureScore} isPaid={isPaid} />
          <WatchingYouWidget searchers={searchers} seed={seed} />
        </div>
      )}

      {/* Row 2 — Quick action tiles */}
      <div className={styles.quickRow}>
        <QuickActionTile
          icon={Icon.Search}
          title="Run a New Search"
          desc="Look up anyone by name, phone, or email."
          onClick={() => {
            track('dashboard_cta_click', { target: 'people_search' });
            navigate('/people-search');
          }}
        />
        <QuickActionTile
          icon={Icon.Shield}
          title="View Your Exposure"
          desc="See which records expose your identity."
          onClick={() => {
            track('dashboard_cta_click', { target: 'broker_tracker' });
            document.getElementById('broker-tracker')?.scrollIntoView({ behavior: 'smooth' });
          }}
        />
        <QuickActionTile
          icon={Icon.Eye}
          title="Check Who's Watching"
          desc="See who searched or viewed your profile."
          onClick={() => {
            track('dashboard_cta_click', { target: 'who_is_searching' });
            navigate('/who-is-searching');
          }}
        />
        <QuickActionTile
          icon={Icon.Bell}
          title="Manage Alerts"
          desc="Get notified the moment new records appear."
          onClick={() => {
            track('dashboard_cta_click', { target: 'alerts' });
            navigate('/alerts');
          }}
        />
      </div>

      {/* Row 3 — Broker tracker */}
      <div id="broker-tracker">
        {loading ? (
          <div className={`${styles.skeleton} ${styles.skelBroker}`} style={{ marginBottom: '2rem' }} />
        ) : (
          <BrokerTracker brokers={brokers} isPaid={isPaid} navigate={navigate} />
        )}
      </div>

      {/* Row 4 — Records feed + sidebar */}
      {loading ? (
        <div className={styles.activityGrid}>
          <div className={`${styles.skeleton} ${styles.skelPanel}`} />
          <div className={`${styles.skeleton} ${styles.skelPanel}`} />
        </div>
      ) : (
        <div className={styles.activityGrid}>
          <RecordsFeed records={recordsFeed} isLive={realRecordsFeed.length > 0} />
          <div className={styles.sidebarStack}>
            <QuotaRing
              used={searchesUsed}
              limit={SEARCH_LIMIT}
              isPaid={isPaid}
              onUpgrade={() => navigate('/payment')}
            />
            <RecentReportsPanel
              reports={recentReports}
              onDownload={handleDownloadPdf}
              downloadingId={pdfDownloadingId}
              navigate={navigate}
            />
            <RecentSearchesPanel searches={recentSearches} navigate={navigate} />
            <RecentMessagesPanel messages={recentMessages} navigate={navigate} />
          </div>
        </div>
      )}

      {/* Row 5 — Watchlist */}
      {!loading && (
        <WatchlistCard watchlist={watchlist} isPaid={isPaid} navigate={navigate} isLive={realWatchlist.length > 0} />
      )}

      {/* Row 6 — Alerts preview */}
      {!loading && recentAlerts.length > 0 && (
        <section className={styles.alertsPreview}>
          <div className={styles.panelHeader}>
            <h2 className={styles.panelTitle}>Recent Alerts</h2>
            <Link to="/alerts" className={styles.panelLink}>View all alerts <Icon.Arrow /></Link>
          </div>
          <ul className={styles.feedList}>
            {recentAlerts.slice(0, 3).map((alert) => (
              <li key={alert.id || alert.alertId || alert.name} className={styles.feedRow}>
                <div className={`${styles.feedIcon} ${styles.feedIconAlert}`}>
                  <Icon.Bell />
                </div>
                <div className={styles.feedBody}>
                  <p className={styles.feedTitle}>{alert.name || alert.title || 'Alert'}</p>
                  <div className={styles.feedMeta}>Alert active</div>
                </div>
                <span className={styles.feedDate}>{relativeDate(alert.createdAt)}</span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </main>
  );
};

export default DashboardHome;
