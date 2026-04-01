import React, { useCallback, useEffect, useState } from 'react';
import api from '../../api';
import { useAuth } from '../../context/AuthContext';
import styles from './TimesheetsPage.module.css';

// ─── helpers ──────────────────────────────────────────────────────────────────

function getWeekStart(date = new Date()) {
  const d = new Date(date);
  const day = d.getDay(); // 0 = Sunday
  d.setDate(d.getDate() - day);
  return d.toISOString().slice(0, 10);
}

function formatWeekRange(weekStart) {
  const start = new Date(weekStart);
  const end = new Date(weekStart);
  end.setDate(end.getDate() + 6);
  const fmt = (d) => d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  return `${fmt(start)} – ${fmt(end)}, ${start.getFullYear()}`;
}

function getDisplayName(rep) {
  if (rep.firstName || rep.lastName) return `${rep.firstName || ''} ${rep.lastName || ''}`.trim();
  return rep.email || rep._id || rep.id || 'Unknown';
}

// ─── localStorage timesheet storage ───────────────────────────────────────────

const STORAGE_KEY = 'adminTimesheets';

function loadTimesheets() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}'); }
  catch { return {}; }
}

function saveTimesheets(data) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

function getRepEntry(all, weekStart, repId) {
  return all?.[weekStart]?.[repId] || { hoursToday: 0, hoursYesterday: 0, hoursWeek: 0, status: 'offline' };
}

// ─── StatusBadge ──────────────────────────────────────────────────────────────

function StatusBadge({ status }) {
  const s = (status || 'offline').toLowerCase();
  if (s === 'online') return <span className={`${styles.badge} ${styles.badgeOnline}`}>Online</span>;
  if (s === 'break') return <span className={`${styles.badge} ${styles.badgeBreak}`}>Break</span>;
  return <span className={`${styles.badge} ${styles.badgeOffline}`}>Offline</span>;
}

// ─── TimesheetCard ────────────────────────────────────────────────────────────

function TimesheetCard({ rep, entry, onUpdate }) {
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({ ...entry });

  const handleSave = () => {
    onUpdate(rep._id || rep.id, {
      hoursToday: Number(form.hoursToday) || 0,
      hoursYesterday: Number(form.hoursYesterday) || 0,
      hoursWeek: Number(form.hoursWeek) || 0,
      status: form.status,
    });
    setEditing(false);
  };

  return (
    <div className={styles.card}>
      <div className={styles.cardHeader}>
        <h3 className={styles.repName}>{getDisplayName(rep)}</h3>
        <StatusBadge status={entry.status} />
      </div>
      <p className={styles.repEmail}>{rep.email || '—'}</p>

      {editing ? (
        <div className={styles.editForm}>
          <div className={styles.editRow}>
            <label className={styles.editLabel}>Status</label>
            <select className={styles.editSelect} value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
              <option value="online">Online</option>
              <option value="break">Break</option>
              <option value="offline">Offline</option>
            </select>
          </div>
          <div className={styles.editRow}>
            <label className={styles.editLabel}>Today (hrs)</label>
            <input className={styles.editInput} type="number" min="0" max="24" step="0.5" value={form.hoursToday} onChange={(e) => setForm({ ...form, hoursToday: e.target.value })} />
          </div>
          <div className={styles.editRow}>
            <label className={styles.editLabel}>Yesterday (hrs)</label>
            <input className={styles.editInput} type="number" min="0" max="24" step="0.5" value={form.hoursYesterday} onChange={(e) => setForm({ ...form, hoursYesterday: e.target.value })} />
          </div>
          <div className={styles.editRow}>
            <label className={styles.editLabel}>Week total (hrs)</label>
            <input className={styles.editInput} type="number" min="0" max="168" step="0.5" value={form.hoursWeek} onChange={(e) => setForm({ ...form, hoursWeek: e.target.value })} />
          </div>
          <div className={styles.editActions}>
            <button className={styles.cancelEditBtn} onClick={() => setEditing(false)}>Cancel</button>
            <button className={styles.saveEditBtn} onClick={handleSave}>Save</button>
          </div>
        </div>
      ) : (
        <>
          <div className={styles.stats}>
            <div className={styles.stat}><span className={styles.statLabel}>Today</span><span className={styles.statValue}>{entry.hoursToday}h</span></div>
            <div className={styles.stat}><span className={styles.statLabel}>Yesterday</span><span className={styles.statValue}>{entry.hoursYesterday}h</span></div>
            <div className={styles.stat}><span className={styles.statLabel}>This Week</span><span className={styles.statValue}>{entry.hoursWeek}h</span></div>
          </div>
          <button className={styles.editBtn} onClick={() => { setForm({ ...entry }); setEditing(true); }}>Edit Hours</button>
        </>
      )}
    </div>
  );
}

// ─── TimesheetsPage ───────────────────────────────────────────────────────────

const TimesheetsPage = () => {
  const { token } = useAuth();
  const [weekStart, setWeekStart] = useState(getWeekStart());
  const [reps, setReps] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [timesheets, setTimesheets] = useState(() => loadTimesheets());

  const fetchReps = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await api.adminListCsReps({ token });
      const list = res?.data || res?.docs || res?.users || (Array.isArray(res) ? res : []);
      setReps(list);
    } catch (err) {
      setError(err.message || 'Failed to load CS reps.');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => { fetchReps(); }, [fetchReps]);

  const handleUpdate = (repId, entry) => {
    const updated = {
      ...timesheets,
      [weekStart]: { ...(timesheets[weekStart] || {}), [repId]: entry },
    };
    saveTimesheets(updated);
    setTimesheets(updated);
  };

  const totalWeekHours = reps.reduce((sum, rep) => {
    const e = getRepEntry(timesheets, weekStart, rep._id || rep.id);
    return sum + (Number(e.hoursWeek) || 0);
  }, 0);

  const onlineCount = reps.filter((rep) => {
    const e = getRepEntry(timesheets, weekStart, rep._id || rep.id);
    return e.status === 'online';
  }).length;

  return (
    <main className={styles.page}>
      <div className={styles.pageHeader}>
        <div>
          <h1 className={styles.title}>Support Timesheets</h1>
          <p className={styles.subtitle}>Track CS rep hours and availability by week.</p>
        </div>
      </div>

      {/* Week selector */}
      <div className={styles.weekBar}>
        <label className={styles.weekLabel}>
          Week starting
          <input
            className={styles.weekInput}
            type="date"
            value={weekStart}
            onChange={(e) => setWeekStart(e.target.value)}
          />
        </label>
        <span className={styles.weekRange}>{formatWeekRange(weekStart)}</span>
      </div>

      {/* Stats bar */}
      {!loading && reps.length > 0 && (
        <div className={styles.statsBar}>
          <div className={styles.statPill}><strong>{reps.length}</strong> reps</div>
          <div className={styles.statPill}><strong>{onlineCount}</strong> online</div>
          <div className={styles.statPill}><strong>{totalWeekHours}h</strong> total this week</div>
        </div>
      )}

      {loading && <div className={styles.loadingMsg}>Loading reps…</div>}
      {error && <div className={styles.errorBox}>{error}</div>}

      {!loading && reps.length === 0 && !error && (
        <div className={styles.emptyState}>
          No CS reps found. Add reps on the <strong>CS Reps</strong> page first.
        </div>
      )}

      <div className={styles.grid}>
        {reps.map((rep) => {
          const repId = rep._id || rep.id;
          const entry = getRepEntry(timesheets, weekStart, repId);
          return (
            <TimesheetCard
              key={repId}
              rep={rep}
              entry={entry}
              onUpdate={handleUpdate}
            />
          );
        })}
      </div>
    </main>
  );
};

export default TimesheetsPage;
