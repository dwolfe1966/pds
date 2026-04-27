import React, { useEffect, useMemo, useState } from 'react';
import styles from './SessionsPage.module.css';

// ─── tracking API helpers ─────────────────────────────────────────────────────

const TRACKING_URL = process.env.REACT_APP_TRACKING_API_URL || null;
const ADMIN_KEY    = process.env.REACT_APP_TRACKING_ADMIN_KEY || 'admin';

async function fetchEvents(limit = 500) {
  const res = await fetch(`${TRACKING_URL}/events?limit=${limit}`, {
    headers: { 'x-admin-key': ADMIN_KEY },
  });
  if (!res.ok) throw new Error(`Tracking API: HTTP ${res.status}`);
  const data = await res.json();
  return data.events || [];
}

// ─── helpers ──────────────────────────────────────────────────────────────────

function formatTs(iso) {
  if (!iso) return '—';
  try { return new Date(iso).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }); }
  catch { return iso; }
}

function truncate(s, n = 12) { return s && s.length > n ? s.slice(0, n) + '…' : s || '—'; }

// ─── SessionsPage ─────────────────────────────────────────────────────────────

const SessionsPage = () => {
  const [events, setEvents]   = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState('');
  const [search, setSearch]   = useState('');
  const [openIds, setOpenIds] = useState(new Set());

  useEffect(() => {
    if (!TRACKING_URL) {
      setError('Tracking API URL not configured (REACT_APP_TRACKING_API_URL).');
      setLoading(false);
      return;
    }
    let cancelled = false;
    fetchEvents()
      .then((evts) => { if (!cancelled) setEvents(evts); })
      .catch((err) => { if (!cancelled) setError(err.message); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  // Group by session_id
  const sessions = useMemo(() => {
    const map = {};
    events.forEach((e) => {
      const sid = e.session_id || '__none__';
      if (!map[sid]) map[sid] = [];
      map[sid].push(e);
    });
    // Sort each session by time asc, sessions by first-event desc
    return Object.entries(map)
      .map(([sid, evts]) => {
        const sorted = [...evts].sort((a, b) => a.created_at?.localeCompare(b.created_at));
        return { sid, evts: sorted, first: sorted[0]?.created_at, last: sorted[sorted.length - 1]?.created_at };
      })
      .sort((a, b) => (b.last || '').localeCompare(a.last || ''));
  }, [events]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return sessions;
    return sessions.filter((s) => s.sid.toLowerCase().includes(q));
  }, [sessions, search]);

  // Stats
  const uniqueUsers    = new Set(events.map((e) => e.user_id).filter(Boolean)).size;
  const uniqueLocations = new Set(events.map((e) => e.properties?.path).filter(Boolean)).size;

  const toggle = (sid) => setOpenIds((prev) => {
    const s = new Set(prev);
    if (s.has(sid)) s.delete(sid); else s.add(sid);
    return s;
  });

  return (
    <main className={styles.page}>
      <div className={styles.pageHeader}>
        <h1 className={styles.title}>Activity Tracking</h1>
        <p className={styles.subtitle}>Session-level event log from the tracking API.</p>
      </div>

      {/* Stats */}
      <div className={styles.statsBar}>
        <div className={styles.statCard}><div className={styles.statNumber}>{sessions.length}</div><div className={styles.statLabel}>Total Sessions</div></div>
        <div className={styles.statCard}><div className={styles.statNumber}>{uniqueUsers}</div><div className={styles.statLabel}>Unique Users</div></div>
        <div className={styles.statCard}><div className={styles.statNumber}>{uniqueLocations}</div><div className={styles.statLabel}>Locations Visited</div></div>
        <div className={styles.statCard}><div className={styles.statNumber}>{events.length}</div><div className={styles.statLabel}>Total Events</div></div>
      </div>

      {/* Filter */}
      <div className={styles.filterBar}>
        <input
          className={styles.searchInput}
          type="text"
          placeholder="Search by session hash…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {error && (
        <div className={styles.infoBox}>
          <strong>Tracking API unavailable:</strong> {error}
          <br /><small>Start the tracking server with <code>npm run tracking</code> to view session data.</small>
        </div>
      )}

      {loading && <div className={styles.loadingMsg}>Loading events…</div>}

      {!loading && !error && filtered.length === 0 && (
        <div className={styles.emptyState}>No sessions found.</div>
      )}

      {/* Accordion */}
      <div className={styles.accordion}>
        {filtered.map(({ sid, evts, first, last }) => {
          const open = openIds.has(sid);
          return (
            <div key={sid} className={styles.sessionBlock}>
              <button className={styles.sessionHeader} onClick={() => toggle(sid)}>
                <span className={styles.sessionHash}>{truncate(sid, 16)}</span>
                <span className={styles.sessionMeta}>{evts.length} event{evts.length !== 1 ? 's' : ''}</span>
                <span className={styles.sessionTime}>{formatTs(last)}</span>
                <span className={styles.chevron}>{open ? '▲' : '▼'}</span>
              </button>

              {open && (
                <div className={styles.sessionBody}>
                  <table className={styles.table}>
                    <thead>
                      <tr>
                        <th className={styles.th}>Time</th>
                        <th className={styles.th}>Event</th>
                        <th className={styles.th}>Path</th>
                        <th className={styles.th}>User</th>
                      </tr>
                    </thead>
                    <tbody>
                      {evts.map((e) => (
                        <tr key={e.id} className={styles.tr}>
                          <td className={styles.td}>{formatTs(e.created_at)}</td>
                          <td className={styles.td}><code className={styles.eventName}>{e.event_name}</code></td>
                          <td className={styles.td}>{e.properties?.path || e.properties?.page || '—'}</td>
                          <td className={styles.td}>{e.user_id ? truncate(e.user_id, 10) : '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </main>
  );
};

export default SessionsPage;
