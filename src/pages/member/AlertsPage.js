import React, { useEffect, useState } from 'react';
import api from '../../api';
import { useAuth } from '../../context/AuthContext';

/**
 * Manage search alerts for the current user.
 */
const AlertsPage = () => {
  const { token } = useAuth();
  const [alerts, setAlerts] = useState([]);
  const [newAlert, setNewAlert] = useState({ criteria: '', frequency: 'daily' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const fetchAlerts = async () => {
    try {
      const data = await api.get('/alerts', { token });
      setAlerts(data || []);
    } catch (err) {
      setError(err.message);
    }
  };

  useEffect(() => {
    fetchAlerts();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleChange = (e) => {
    setNewAlert({ ...newAlert, [e.target.name]: e.target.value });
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      await api.post('/alerts', newAlert, { token });
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

  return (
    <main style={{ padding: '2rem' }}>
      <h1>Search Alerts</h1>
      <form onSubmit={handleCreate} style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem' }}>
        <input
          type="text"
          name="criteria"
          placeholder="Name or keyword"
          value={newAlert.criteria}
          onChange={handleChange}
          required
        />
        <select name="frequency" value={newAlert.frequency} onChange={handleChange}>
          <option value="instant">Instant</option>
          <option value="daily">Daily</option>
          <option value="weekly">Weekly</option>
        </select>
        <button type="submit" disabled={loading}>
          {loading ? 'Creating…' : 'Create Alert'}
        </button>
      </form>
      {error && <p style={{ color: 'red' }}>{error}</p>}
      <ul style={{ listStyle: 'none', padding: 0 }}>
        {alerts.length === 0 && <li>No alerts</li>}
        {alerts.map((alert) => (
          <li key={alert.id} style={{ borderBottom: '1px solid #eee', padding: '0.5rem 0' }}>
            <strong>{alert.criteria}</strong> – {alert.frequency}
            <button onClick={() => handleDelete(alert.id)} style={{ marginLeft: '1rem' }}>
              Delete
            </button>
          </li>
        ))}
      </ul>
    </main>
  );
};

export default AlertsPage;