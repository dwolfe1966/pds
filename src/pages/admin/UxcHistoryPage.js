import React, { useEffect, useMemo, useState } from 'react';
import styles from './UxcHistoryPage.module.css';

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

function formatTime(iso) {
  if (!iso) return '—';
  try { return new Date(iso).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' }); }
  catch { return '—'; }
}

function formatDateLabel(dateStr) {
  try {
    return new Date(dateStr + 'T00:00:00').toLocaleDateString(undefined, {
      weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
    });
  } catch { return dateStr; }
}

function truncate(s, n = 12) { return s && s.length > n ? s.slice(0, n) + '…' : s || '—'; }

function resolveUxFlow(e) {
  const variant = e.properties?.variant;
  const type    = e.properties?.search_type;
  if (variant && type) return `${type} search – ${variant}`;
  if (variant) return variant;
  if (type) return `${type} search`;
  return e.event_name || '—';
}

function resolveOffer(e) {
  const offer = e.properties?.offer || e.properties?.product || e.properties?.plan;
  const price = e.properties?.price;
  if (offer && price) return `${offer} – $${price}`;
  if (offer) return offer;
  return '—';
}

// ─── UxcHistoryPage ───────────────────────────────────────────────────────────

const UxcHistoryPage = () => {
  const [events, setEvents]   = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState('');
  const [search, setSearch]   = useState('');
  const [openDates, setOpenDates] = useState(new Set());

  useEffect(() => {
    let cancelled = false;
    fetchEvents()
      .then((evts) => { if (!cancelled) setEvents(evts); })
      .catch((err) => { if (!cancelled) setError(err.message); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  // Group all events (not just landing) by date
  const byDate = useMemo(() => {
    const map = {};
    events.forEach((e) => {
      const date = (e.created_at || '').slice(0, 10);
      if (!date) return;
      if (!map[date]) map[date] = [];
      map[date].push(e);
    });
    return Object.entries(map)
      .sort(([a], [b]) => b.localeCompare(a))
      .map(([date, evts]) => ({ date, evts }));
  }, [events]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return byDate;
    return byDate.map(({ date, evts }) => ({
      date,
      evts: evts.filter((e) =>
        (e.session_id || '').toLowerCase().includes(q) ||
        (e.user_id || '').toLowerCase().includes(q) ||
        (e.event_name || '').toLowerCase().includes(q)
      ),
    })).filter(({ evts }) => evts.length > 0);
  }, [byDate, search]);

  // Stats
  const uniqueVariants  = new Set(events.map((e) => e.properties?.variant).filter(Boolean)).size;
  const uniqueSessions  = new Set(events.map((e) => e.session_id).filter(Boolean)).size;

  const toggle = (date) => setOpenDates((prev) => {
    const s = new Set(prev);
    if (s.has(date)) s.delete(date); else s.add(date);
    return s;
  });

  return (
    <main className={styles.page}>
      <div className={styles.pageHeader}>
        <h1 className={styles.title}>UXC History Overview</h1>
        <p className={styles.subtitle}>Event history grouped by date — sessions, UX flows, and offers.</p>
      </div>

      {/* Stats */}
      <div className={styles.statsBar}>
        <div className={styles.statCard}><div className={styles.statNumber}>{events.length}</div><div className={styles.statLabel}>Total Logs</div></div>
        <div className={styles.statCard}><div className={styles.statNumber}>{uniqueVariants}</div><div className={styles.statLabel}>Unique UXC Variants</div></div>
        <div className={styles.statCard}><div className={styles.statNumber}>{uniqueSessions}</div><div className={styles.statLabel}>Unique Sessions</div></div>
      </div>

      {/* Filter */}
      <div className={styles.filterBar}>
        <input
          className={styles.searchInput}
          type="text"
          placeholder="Search by session or user ID…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {error && (
        <div className={styles.infoBox}>
          <strong>Tracking API unavailable:</strong> {error}
          <br /><small>Start the tracking server with <code>npm run tracking</code> to view history.</small>
        </div>
      )}

      {loading && <div className={styles.loadingMsg}>Loading history…</div>}

      {!loading && !error && filtered.length === 0 && (
        <div className={styles.emptyState}>No UXC history found.</div>
      )}

      <div className={styles.accordion}>
        {filtered.map(({ date, evts }) => {
          const open = openDates.has(date);
          return (
            <div key={date} className={styles.dateBlock}>
              <button className={styles.dateHeader} onClick={() => toggle(date)}>
                <span className={styles.dateLabel}>{formatDateLabel(date)}</span>
                <span className={styles.dateCount}>{evts.length} event{evts.length !== 1 ? 's' : ''}</span>
                <span className={styles.chevron}>{open ? '▲' : '▼'}</span>
              </button>

              {open && (
                <div className={styles.dateBody}>
                  <table className={styles.table}>
                    <thead>
                      <tr>
                        <th className={styles.th}>Time</th>
                        <th className={styles.th}>Session</th>
                        <th className={styles.th}>Event / UX Flow</th>
                        <th className={styles.th}>Offer / Info</th>
                        <th className={styles.th}>User</th>
                      </tr>
                    </thead>
                    <tbody>
                      {evts.map((e) => (
                        <tr key={e.id} className={styles.tr}>
                          <td className={styles.td}>{formatTime(e.created_at)}</td>
                          <td className={styles.td}><code className={styles.sessionCode}>{truncate(e.session_id, 10)}</code></td>
                          <td className={styles.td}>{resolveUxFlow(e)}</td>
                          <td className={styles.td}>{resolveOffer(e)}</td>
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

export default UxcHistoryPage;
