import React, { useEffect, useState } from 'react';
import api from '../../api';
import { useAuth } from '../../context/AuthContext';
import Skeleton from '../../components/Skeleton';
import styles from './AlertsPage.module.css';

/**
 * Manage search alerts for the current user.
 */
const AlertsPage = () => {
  const { token } = useAuth();
  const [alerts, setAlerts] = useState([]);
  const [newAlert, setNewAlert] = useState({ criteria: '', frequency: 'daily' });
  const [loading, setLoading] = useState(false);
  const [fetchLoading, setFetchLoading] = useState(true);
  const [error, setError] = useState('');
  const [pendingDeleteId, setPendingDeleteId] = useState(null);
  const [alertsUnavailable, setAlertsUnavailable] = useState(false);

  const fetchAlerts = async () => {
    if (!token) {
      setFetchLoading(false);
      return;
    }
    setFetchLoading(true);
    try {
      const data = await api.get('/alerts', { token });
      setAlerts(data?.data || data || []);
      setAlertsUnavailable(false);
    } catch (err) {
      if (err.isMockUnavailable) {
        // BC session user — alerts endpoint is not yet implemented on BC.
        setAlertsUnavailable(true);
      } else {
        setError(err.message);
      }
    } finally {
      setFetchLoading(false);
    }
  };

  useEffect(() => {
    fetchAlerts();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const handleChange = (e) => {
    setNewAlert({ ...newAlert, [e.target.name]: e.target.value });
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      await api.post('/alerts', { body: newAlert, token });
      setNewAlert({ criteria: '', frequency: 'daily' });
      fetchAlerts();
    } catch (err) {
      setError(err.isMockUnavailable ? 'Alerts are not yet available for your account type.' : err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id) => {
    try {
      await api.delete(`/alerts/${id}`, { token });
      setAlerts(alerts.filter((a) => a.id !== id));
    } catch (err) {
      if (!err.isMockUnavailable) {
        setError(err.message);
      }
    }
  };

  const frequencyClass = (freq) => {
    if (freq === 'instant') return `${styles.frequencyBadge} ${styles.instant}`;
    if (freq === 'weekly') return `${styles.frequencyBadge} ${styles.weekly}`;
    return `${styles.frequencyBadge} ${styles.daily}`;
  };

  return (
    <main className={styles.pageWrapper}>
      {pendingDeleteId && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000
        }}>
          <div style={{
            background: '#fff', borderRadius: '0.75rem', padding: '2rem',
            maxWidth: '400px', width: '90%', boxShadow: '0 20px 60px rgba(0,0,0,0.3)'
          }}>
            <h3 style={{ marginTop: 0, color: '#111827' }}>Delete Alert?</h3>
            <p style={{ color: '#6b7280', lineHeight: '1.6' }}>
              This alert will stop monitoring. You can create a new one at any time.
            </p>
            <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end', marginTop: '1.5rem' }}>
              <button
                onClick={() => setPendingDeleteId(null)}
                style={{ padding: '0.6rem 1.25rem', border: '1px solid #d1d5db', borderRadius: '0.375rem', background: '#fff', cursor: 'pointer' }}
              >
                Cancel
              </button>
              <button
                onClick={() => { handleDelete(pendingDeleteId); setPendingDeleteId(null); }}
                style={{ padding: '0.6rem 1.25rem', background: '#dc2626', color: '#fff', border: 'none', borderRadius: '0.375rem', cursor: 'pointer' }}
              >
                Delete Alert
              </button>
            </div>
          </div>
        </div>
      )}
      <h1 className={styles.pageTitle}>Search Alerts</h1>

      {alertsUnavailable && (
        <div style={{
          background: '#fef3c7',
          border: '1px solid #f59e0b',
          borderRadius: '0.5rem',
          padding: '1rem 1.25rem',
          marginBottom: '1.5rem',
          color: '#78350f',
        }}>
          <strong>Alerts are coming soon.</strong>
          <p style={{ margin: '0.35rem 0 0', fontSize: '0.9rem' }}>
            We're finishing work on scheduled monitoring. When it's ready, you'll be able to create alerts from this page and receive notifications when new records match your criteria.
          </p>
        </div>
      )}

      {/* Create alert */}
      <div className={styles.createSection}>
        <h2 className={styles.sectionTitle}>Create New Alert</h2>
        <form onSubmit={handleCreate}>
          <div className={styles.formRow}>
            <input
              type="text"
              name="criteria"
              placeholder="Name or keyword to monitor"
              value={newAlert.criteria}
              onChange={handleChange}
              required
              disabled={alertsUnavailable}
              className={styles.input}
            />
            <select
              name="frequency"
              value={newAlert.frequency}
              onChange={handleChange}
              disabled={alertsUnavailable}
              className={styles.select}
            >
              <option value="instant">Instant</option>
              <option value="daily">Daily</option>
              <option value="weekly">Weekly</option>
            </select>
            <button type="submit" disabled={loading || alertsUnavailable} className={styles.addBtn}>
              {loading ? 'Adding…' : 'Add Alert'}
            </button>
          </div>
        </form>
      </div>

      {error && <p className={styles.errorMsg}>{error}</p>}

      {/* Existing alerts */}
      {fetchLoading ? (
        <div>
          <Skeleton variant="card" height={64} style={{ marginBottom: '0.5rem' }} />
          <Skeleton variant="card" height={64} style={{ marginBottom: '0.5rem' }} />
          <Skeleton variant="card" height={64} style={{ marginBottom: '0.5rem' }} />
          <Skeleton variant="card" height={64} style={{ marginBottom: '0.5rem' }} />
        </div>
      ) : alerts.length === 0 ? (
        <p className={styles.emptyState}>
          {alertsUnavailable
            ? 'No alerts yet — we\'ll enable this feature soon.'
            : 'You have no alerts set up yet. Create one above to get started.'}
        </p>
      ) : (
        <div className={styles.alertsList}>
          {alerts.map((alert) => (
            <div key={alert.id} className={styles.alertItem}>
              <div className={styles.alertIcon}>🔔</div>
              <div className={styles.alertDetails}>
                <strong>
                  {typeof alert.criteria === 'object' && alert.criteria !== null
                    ? [alert.criteria.name, alert.criteria.location].filter(Boolean).join(', ')
                    : alert.criteria || '(no criteria)'}
                </strong>
                <span className={frequencyClass(alert.frequency)}>{alert.frequency}</span>
                <span style={{ fontSize: '0.8rem', color: '#9ca3af', marginTop: '0.2rem', display: 'block' }}>
                  {alert.lastTriggered
                    ? `Last triggered: ${new Date(alert.lastTriggered).toLocaleDateString()}`
                    : 'Not yet triggered'}
                </span>
              </div>
              <button
                className={styles.deleteBtn}
                onClick={() => setPendingDeleteId(alert.id)}
                aria-label={`Delete alert for ${alert.criteria}`}
              >
                ✕
              </button>
            </div>
          ))}
        </div>
      )}
    </main>
  );
};

export default AlertsPage;