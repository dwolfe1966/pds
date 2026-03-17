import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import api from '../../api';
import { getReportList } from '../../services/reportService';
import DevBCSession from '../../components/DevBCSession';
import Skeleton from '../../components/Skeleton';
import styles from './DashboardHome.module.css';

/**
 * Pro Dashboard for members.
 * Shows activity metrics, recent activity, quick actions, and feature highlights.
 * Matches the production dashboard design.
 */
const DashboardHome = () => {
  const navigate = useNavigate();
  const { user, token, isPaid } = useAuth();
  const [metrics, setMetrics] = useState({
    searches: null,
    alerts: null,
    profileViews: null,
    reports: null
  });
  const [loading, setLoading] = useState(true);
  const [recentReports, setRecentReports] = useState([]);
  const [recentSearches, setRecentSearches] = useState([]);
  const [recentAlerts, setRecentAlerts] = useState([]);
  const [activityError, setActivityError] = useState('');

  const displayName = useMemo(() => {
    if (!user) return 'Member';
    return user.fullName || user.name || user.email || 'Member';
  }, [user]);

  const formatDate = (value) => {
    if (!value) return 'Recently';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return 'Recently';
    return date.toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
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

  useEffect(() => {
    const fetchMetrics = async () => {
      if (!token) {
        setLoading(false);
        return;
      }

      try {
        // Fetch reports count
        try {
          if (!token) {
            console.warn('[Dashboard] No token available for report list request');
            setMetrics(prev => ({ ...prev, reports: 0 }));
          } else {
            console.log('[Dashboard] Fetching reports with token:', token ? 'present' : 'missing');
            const reportResult = await getReportList({ token });
            if (reportResult && reportResult.success) {
              setMetrics(prev => ({ ...prev, reports: reportResult.reports?.length || 0 }));
              setRecentReports(reportResult.reports?.slice(0, 5) || []);
            } else {
              console.warn('[Dashboard] Report list request returned unsuccessful result:', reportResult);
              setMetrics(prev => ({ ...prev, reports: 0 }));
              setRecentReports([]);
            }
          }
        } catch (err) {
          // More defensive error handling
          const errorMessage = err?.message || err?.toString() || 'Unknown error';
          const errorStatus = err?.status || err?.statusCode || 'N/A';
          const errorData = err?.data || err?.response?.data || null;
          
          console.error('[Dashboard] Failed to fetch reports:', errorMessage);
          console.error('[Dashboard] Error status:', errorStatus);
          if (errorData) {
            console.error('[Dashboard] Error data:', errorData);
          }
          if (err?.stack) {
            console.error('[Dashboard] Error stack:', err.stack);
          }
          
          setMetrics(prev => ({ ...prev, reports: 0 }));
          setRecentReports([]);
        }

        // Fetch alerts count (if API available)
        try {
          const alertsData = await api.getAlerts(token);
          if (alertsData?.data) {
            setMetrics(prev => ({ ...prev, alerts: alertsData.data?.length || 0 }));
            setRecentAlerts(alertsData.data?.slice(0, 5) || []);
          }
        } catch (err) {
          // Alerts API may not be available yet or user not authenticated
          console.error('Failed to fetch alerts:', err);
          setMetrics(prev => ({ ...prev, alerts: 0 }));
          setRecentAlerts([]);
        }

        // Attempt to fetch search history if available
        try {
          const searchesData = await api.get('/searches/me', { token });
          if (searchesData?.data) {
            setMetrics(prev => ({ ...prev, searches: searchesData.data?.length || 0 }));
            setRecentSearches(searchesData.data?.slice(0, 5) || []);
          } else {
            setMetrics(prev => ({ ...prev, searches: 0 }));
            setRecentSearches([]);
          }
        } catch (err) {
          setMetrics(prev => ({ ...prev, searches: 0 }));
          setRecentSearches([]);
        }

        // Fetch profile views
        try {
          const viewsData = await api.get('/profile-views/me', { token });
          if (viewsData?.total !== undefined) {
            setMetrics(prev => ({ ...prev, profileViews: viewsData.total || 0 }));
          } else {
            setMetrics(prev => ({ ...prev, profileViews: viewsData?.data?.length || 0 }));
          }
        } catch (err) {
          setMetrics(prev => ({ ...prev, profileViews: 0 }));
        }
      } catch (err) {
        console.error('Failed to fetch dashboard metrics:', err);
        setActivityError('We could not load all dashboard activity just now.');
      } finally {
        setLoading(false);
      }
    };

    fetchMetrics();
  }, [token]);

  return (
    <main className={styles.main}>
      <DevBCSession user={user} />
      {/* Dashboard Title */}
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>Welcome back, {displayName}</h1>
          <p className={styles.subtitle}>Here is a snapshot of your account activity.</p>
        </div>
        <div className={styles.headerActions}>
          <Link to="/people-search" className={styles.primaryLink}>
            Start a Search
          </Link>
          <Link to="/account" className={styles.secondaryLink}>
            Account Settings
          </Link>
        </div>
      </div>

      {/* Complete Profile Banner */}
      {!loading && user && (!user.zip || !user.fullName) && (
        <div style={{
          background: '#fefce8', border: '1px solid #fde047',
          borderRadius: '0.75rem', padding: '1rem 1.5rem',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          marginBottom: '1.5rem', gap: '1rem', flexWrap: 'wrap',
        }}>
          <div>
            <strong style={{ color: '#713f12' }}>Complete your profile</strong>
            <p style={{ margin: '0.25rem 0 0', color: '#92400e', fontSize: '0.875rem' }}>
              Add your {!user.fullName ? 'name' : ''}{!user.fullName && !user.zip ? ' and ' : ''}{!user.zip ? 'ZIP code' : ''} to get personalized results.
            </p>
          </div>
          <Link to="/profile" style={{ color: '#0d5d2f', fontWeight: 600, whiteSpace: 'nowrap', fontSize: '0.875rem' }}>
            Update Profile →
          </Link>
        </div>
      )}

      {/* Membership Status Banner */}
      {!loading && isPaid ? (
        <div className={styles.statusCard}>
          <div className={styles.statusContent}>
            <div className={styles.statusIcon}>⭐</div>
            <div>
              <h3 className={styles.statusTitle}>Pro Member</h3>
              <p className={styles.statusSubtitle}>
                You have full access to unlimited searches, detailed reports, and advanced analytics.
              </p>
            </div>
          </div>
          <span className={styles.statusBadge}>Active</span>
        </div>
      ) : !loading && (
        <div style={{
          background: 'linear-gradient(135deg, #f0fdf4 0%, #eff6ff 100%)',
          border: '1px solid #d1fae5',
          borderRadius: '0.75rem',
          padding: '1.25rem 1.5rem',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '1rem',
          flexWrap: 'wrap',
          marginBottom: '1.5rem',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <span style={{ fontSize: '1.5rem' }}>🔓</span>
            <div>
              <h3 style={{ margin: 0, color: '#111827', fontWeight: 700, fontSize: '1rem' }}>
                Free Account
              </h3>
              <p style={{ margin: '0.25rem 0 0', color: '#6b7280', fontSize: '0.875rem' }}>
                Upgrade to Pro to unlock unlimited searches, full reports, and more.
              </p>
            </div>
          </div>
          <button
            onClick={() => navigate('/payment')}
            style={{
              background: '#0d5d2f',
              color: '#fff',
              border: 'none',
              borderRadius: '0.5rem',
              padding: '0.625rem 1.25rem',
              fontWeight: 600,
              fontSize: '0.875rem',
              cursor: 'pointer',
              whiteSpace: 'nowrap',
            }}
          >
            Upgrade to Pro — $29.99/mo
          </button>
        </div>
      )}

      {/* Activity Metrics Cards */}
      {loading ? (
        <div className={styles.metricsGrid}>
          <Skeleton variant="card" height={100} />
          <Skeleton variant="card" height={100} />
          <Skeleton variant="card" height={100} />
          <Skeleton variant="card" height={100} />
        </div>
      ) : (
        <div className={styles.metricsGrid}>
          <div className={styles.metricCard}>
            <div className={styles.metricHeader}>
              <p>Searches This Month</p>
            </div>
            <p className={styles.metricValue}>
              {metrics.searches !== null ? metrics.searches : '0'}
            </p>
          </div>
          <div className={styles.metricCard}>
            <div className={styles.metricHeader}>
              <p>Active Alerts</p>
            </div>
            <p className={styles.metricValue}>
              {metrics.alerts !== null ? metrics.alerts : '0'}
            </p>
          </div>
          <div className={styles.metricCard}>
            <div className={styles.metricHeader}>
              <p>Profile Views</p>
            </div>
            <p className={styles.metricValue}>
              {metrics.profileViews !== null ? metrics.profileViews : '0'}
            </p>
          </div>
          <div className={styles.metricCard}>
            <div className={styles.metricHeader}>
              <p>Reports Generated</p>
            </div>
            <p className={styles.metricValue}>
              {metrics.reports !== null ? metrics.reports : '0'}
            </p>
          </div>
        </div>
      )}

      {/* Recent Activity and Quick Actions */}
      <div className={styles.activityGrid}>
        {/* Recent Activity */}
        <div className={styles.panel}>
          <div className={styles.panelHeader}>
            <h2>Recent Activity</h2>
            <Link to="/search-history" className={styles.panelLink}>View all</Link>
          </div>
          {activityError && <p className={styles.errorText}>{activityError}</p>}
          {!activityError && loading && (
            <div>
              {[0, 1, 2, 3].map((i) => (
                <div key={i} style={{ marginBottom: '0.75rem' }}>
                  <Skeleton variant="text" style={{ marginBottom: '0.375rem' }} />
                  <Skeleton variant="textShort" />
                </div>
              ))}
            </div>
          )}
          {!loading && !activityError && recentReports.length === 0 && recentAlerts.length === 0 && recentSearches.length === 0 && (
            <div className={styles.emptyState}>
              <p style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>🔍</p>
              <p style={{ fontWeight: 600, marginBottom: '0.25rem' }}>No activity yet</p>
              <p style={{ color: '#9ca3af', fontSize: '0.875rem', marginBottom: '1rem' }}>
                Run your first search to start building your activity history.
              </p>
              <Link to="/people-search" className={styles.secondaryLink}>
                Start a Search
              </Link>
            </div>
          )}
          {!loading && recentSearches.length > 0 && (
            <div className={styles.activityList}>
              {recentSearches.map((search) => (
                <div key={search.id} className={styles.activityRow}>
                  <div>
                    <p className={styles.activityTitle}>Search • {search.type || 'name'}</p>
                    <p className={styles.mutedText}>
                      {search.query?.firstName || search.query?.email || search.query?.phone || 'Search'}{' '}
                      {search.query?.lastName || ''}{search.query?.state ? ` • ${search.query.state}` : ''}
                    </p>
                  </div>
                  <span className={styles.activityMeta}>{formatDate(search.timestamp)}</span>
                </div>
              ))}
            </div>
          )}
          {!loading && recentReports.length > 0 && (
            <div className={styles.activityList}>
              {recentReports.map((report) => {
                const reportTarget = report.commerceContentId || report.id || report.reportId;
                return (
                  <div
                    key={report.id || report.reportId}
                    className={`${styles.activityRow} ${reportTarget ? styles.activityRowClickable : ''}`}
                    onClick={reportTarget ? () => navigate(`/people/${reportTarget}`) : undefined}
                    role={reportTarget ? 'button' : undefined}
                    tabIndex={reportTarget ? 0 : undefined}
                  >
                    <div>
                      <p className={styles.activityTitle}>{getReportTitle(report)}</p>
                      <p className={styles.mutedText}>Report generated</p>
                    </div>
                    <span className={styles.activityMeta}>{formatDate(report.createdAt)}</span>
                  </div>
                );
              })}
            </div>
          )}
          {!loading && recentAlerts.length > 0 && (
            <div className={styles.activityList}>
              {recentAlerts.map((alert) => (
                <div key={alert.id || alert.alertId || alert.name} className={styles.activityRow}>
                  <div>
                    <p className={styles.activityTitle}>{alert.name || alert.title || 'Alert'}</p>
                    <p className={styles.mutedText}>Alert active</p>
                  </div>
                  <span className={styles.activityMeta}>{formatDate(alert.createdAt)}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Quick Actions */}
        <div className={styles.panel}>
          <div className={styles.panelHeader}>
            <h2>Quick Actions</h2>
          </div>
          {loading && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              <Skeleton variant="button" style={{ width: '100%' }} />
              <Skeleton variant="button" style={{ width: '100%' }} />
              <Skeleton variant="button" style={{ width: '100%' }} />
            </div>
          )}
          {!loading && <div className={styles.actionList}>
            <button
              onClick={() => navigate('/people-search')}
              className={styles.actionButtonPrimary}
            >
              <span>🔍</span>
              Advanced Search
            </button>
            <button
              onClick={() => navigate('/alerts')}
              className={styles.actionButtonInfo}
            >
              <span>🔔</span>
              Manage Alerts
            </button>
            {!isPaid && (
              <button
                onClick={() => navigate('/payment')}
                style={{
                  display: 'flex', alignItems: 'center', gap: '0.5rem',
                  padding: '0.75rem 1rem', borderRadius: '0.5rem', border: 'none',
                  background: '#0d5d2f', color: '#fff', fontWeight: 600,
                  fontSize: '0.9rem', cursor: 'pointer', width: '100%',
                }}
              >
                <span>⭐</span>
                Upgrade to Pro
              </button>
            )}
            <button
              onClick={() => navigate('/account')}
              className={styles.actionButtonSecondary}
            >
              <span>📊</span>
              Account & Billing
            </button>
          </div>}
        </div>
      </div>

      {/* Bottom cards — contextual to plan */}
      {!loading && isPaid ? (
        /* Pro member: tips + plan info + support */
        <div className={styles.featureGrid}>
          <div className={styles.featureCard}>
            <div className={styles.featureIcon}>💡</div>
            <h3>Search Tips</h3>
            <p>Include a state to narrow results by location. Use phone or email search for direct lookups.</p>
          </div>
          <div className={styles.featureCard}>
            <div className={styles.featureIcon}>⭐</div>
            <h3>Pro Plan Active</h3>
            <p>Unlimited searches, full reports, address history, relatives, and criminal records. Your subscription renews monthly — cancel anytime.</p>
          </div>
          <div className={styles.featureCard}>
            <div className={styles.featureIcon}>🛡️</div>
            <h3>Stay Protected</h3>
            <p>Set up alerts to monitor when new records appear for people you care about.</p>
            <Link to="/alerts" style={{ display: 'inline-block', marginTop: '0.75rem', color: '#0d5d2f', fontWeight: 600, fontSize: '0.875rem' }}>Manage Alerts →</Link>
          </div>
        </div>
      ) : !loading && (
        /* Free member: upsell comparison */
        <div className={styles.upgradePanel}>
          <div className={styles.upgradePanelHeader}>
            <span className={styles.upgradePanelIcon}>🔓</span>
            <div>
              <h3 className={styles.upgradePanelTitle}>Unlock Everything with Pro</h3>
              <p className={styles.upgradePanelSub}>Your free account gives you basic search. Here's what you're missing:</p>
            </div>
          </div>
          <div className={styles.upgradeFeatureGrid}>
            {[
              ['📞', 'Phone numbers & emails'],
              ['🏠', 'Full address history'],
              ['👥', 'Relatives & associates'],
              ['⚠️', 'Criminal & arrest records'],
              ['🔔', 'Real-time alerts'],
              ['📄', 'Downloadable PDF reports'],
            ].map(([icon, label]) => (
              <div key={label} className={styles.upgradeFeatureItem}>
                <span>{icon}</span> {label}
              </div>
            ))}
          </div>
          <button
            onClick={() => navigate('/payment')}
            className={styles.upgradeCta}
          >
            Upgrade to Pro — $29.99/mo
          </button>
          <p className={styles.upgradeNote}>No lock-in. Cancel anytime.</p>
        </div>
      )}
    </main>
  );
};

export default DashboardHome;