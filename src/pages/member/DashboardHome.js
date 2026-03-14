import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import api from '../../api';
import { getReportList } from '../../services/reportService';
import DevBCSession from '../../components/DevBCSession';
import styles from './DashboardHome.module.css';

/**
 * Pro Dashboard for members.
 * Shows activity metrics, recent activity, quick actions, and feature highlights.
 * Matches the production dashboard design.
 */
const DashboardHome = () => {
  const navigate = useNavigate();
  const { user, token } = useAuth();
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

      {/* Pro Member Status Banner */}
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

      {/* Activity Metrics Cards */}
      <div className={styles.metricsGrid}>
        <div className={styles.metricCard}>
          <div className={styles.metricHeader}>
            <p>Searches This Month</p>
          </div>
          <p className={styles.metricValue}>
            {loading ? '...' : metrics.searches !== null ? metrics.searches : '0'}
          </p>
        </div>
        <div className={styles.metricCard}>
          <div className={styles.metricHeader}>
            <p>Active Alerts</p>
          </div>
          <p className={styles.metricValue}>
            {loading ? '...' : metrics.alerts !== null ? metrics.alerts : '0'}
          </p>
        </div>
        <div className={styles.metricCard}>
          <div className={styles.metricHeader}>
            <p>Profile Views</p>
          </div>
          <p className={styles.metricValue}>
            {loading ? '...' : metrics.profileViews !== null ? metrics.profileViews : '0'}
          </p>
        </div>
        <div className={styles.metricCard}>
          <div className={styles.metricHeader}>
            <p>Reports Generated</p>
          </div>
          <p className={styles.metricValue}>
            {loading ? '...' : metrics.reports !== null ? metrics.reports : '0'}
          </p>
        </div>
      </div>

      {/* Recent Activity and Quick Actions */}
      <div className={styles.activityGrid}>
        {/* Recent Activity */}
        <div className={styles.panel}>
          <div className={styles.panelHeader}>
            <h2>Recent Activity</h2>
            <Link to="/search-history" className={styles.panelLink}>View all</Link>
          </div>
          {activityError && <p className={styles.errorText}>{activityError}</p>}
          {!activityError && loading && <p className={styles.mutedText}>Loading recent activity...</p>}
          {!loading && !activityError && recentReports.length === 0 && recentAlerts.length === 0 && recentSearches.length === 0 && (
            <div className={styles.emptyState}>
              <p>No activity yet. Start a search to generate your first report.</p>
              <Link to="/people-search" className={styles.secondaryLink}>
                Run a Search
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
              {recentReports.map((report) => (
                <div key={report.id || report.reportId} className={styles.activityRow}>
                  <div>
                    <p className={styles.activityTitle}>{getReportTitle(report)}</p>
                    <p className={styles.mutedText}>Report generated</p>
                  </div>
                  <span className={styles.activityMeta}>{formatDate(report.createdAt)}</span>
                </div>
              ))}
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
          <div className={styles.actionList}>
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
            <button
              onClick={() => navigate('/account')}
              className={styles.actionButtonSecondary}
            >
              <span>📊</span>
              Account & Billing
            </button>
          </div>
        </div>
      </div>

      {/* Feature Highlight Cards */}
      <div className={styles.featureGrid}>
        {/* Advanced Analytics Card */}
        <div className={styles.featureCard}>
          <div className={styles.featureIcon}>📄</div>
          <h3>Advanced Analytics</h3>
          <p>Detailed insights into search patterns, trending names, and report activity.</p>
        </div>

        {/* Unlimited Searches Card */}
        <div className={styles.featureCard}>
          <div className={styles.featureIcon}>🔍</div>
          <h3>Unlimited Searches</h3>
          <p>No limits on searches with full access to phone numbers, emails, and addresses.</p>
        </div>

        {/* Priority Support Card */}
        <div className={styles.featureCard}>
          <div className={styles.featureIcon}>🚀</div>
          <h3>Priority Support</h3>
          <p>Get priority customer support with faster response times and dedicated assistance.</p>
        </div>
      </div>
    </main>
  );
};

export default DashboardHome;