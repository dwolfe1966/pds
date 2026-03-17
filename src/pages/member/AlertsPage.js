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

  const fetchAlerts = async () => {
    if (!token) {
      setFetchLoading(false);
      return;
    }
    setFetchLoading(true);
    try {
      const data = await api.get('/alerts', { token });
      setAlerts(data?.data || data || []);
    } catch (err) {
      setError(err.message);
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
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id) => {
    try {
      await api.delete(`/alerts/${id}`, { token });
      setAlerts(alerts.filter((a) => a.id !== id));
    } catch (err) {
      setError(err.message);
    }
  };

  const frequencyClass = (freq) => {
    if (freq === 'instant') return `${styles.frequencyBadge} ${styles.instant}`;
    if (freq === 'weekly') return `${styles.frequencyBadge} ${styles.weekly}`;
    return `${styles.frequencyBadge} ${styles.daily}`;
  };

  return (
    <main className={styles.pageWrapper}>
      <h1 className={styles.pageTitle}>Search Alerts</h1>

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
              className={styles.input}
            />
            <select
              name="frequency"
              value={newAlert.frequency}
              onChange={handleChange}
              className={styles.select}
            >
              <option value="instant">Instant</option>
              <option value="daily">Daily</option>
              <option value="weekly">Weekly</option>
            </select>
            <button type="submit" disabled={loading} className={styles.addBtn}>
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
        <p className={styles.emptyState}>You have no alerts set up yet. Create one above to get started.</p>
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
              </div>
              <button
                className={styles.deleteBtn}
                onClick={() => handleDelete(alert.id)}
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