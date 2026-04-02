import React, { useEffect, useMemo, useState } from 'react';
import styles from './LogViewerPage.module.css';

// ─── tracking API helpers ─────────────────────────────────────────────────────

const TRACKING_URL = process.env.REACT_APP_TRACKING_API_URL || null;
const ADMIN_KEY    = process.env.REACT_APP_TRACKING_ADMIN_KEY || 'admin';

async function fetchEvents(limit = 200) {
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
  try {
    return new Date(iso).toLocaleString(undefined, {
      month: 'short', day: 'numeric',
      hour: '2-digit', minute: '2-digit', second: '2-digit',
    });
  } catch { return iso; }
}

function prettyJson(obj) {
  try { return JSON.stringify(obj, null, 2); }
  catch { return String(obj); }
}

// ─── LogViewerPage ────────────────────────────────────────────────────────────

const LogViewerPage = () => {
  const [events, setEvents]   = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState('');
  const [openIds, setOpenIds] = useState(new Set());

  useEffect(() => {
    let cancelled = false;
    fetchEvents()
      .then((evts) => { if (!cancelled) setEvents(evts); })
      .catch((err) => { if (!cancelled) setError(err.message); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  const toggle = (id) => setOpenIds((prev) => {
    const s = new Set(prev);
    if (s.has(id)) s.delete(id); else s.add(id);
    return s;
  });

  const expandAll   = () => setOpenIds(new Set(events.map((e) => e.id)));
  const collapseAll = () => setOpenIds(new Set());

  return (
    <main className={styles.page}>
      <div className={styles.pageHeader}>
        <div>
          <h1 className={styles.title}>Log Viewer</h1>
          <p className={styles.subtitle}>Click an entry to expand its request and response payloads.</p>
        </div>
        <div className={styles.headerActions}>
          <button className={styles.actionBtn} onClick={expandAll}>Expand All</button>
          <button className={styles.actionBtn} onClick={collapseAll}>Collapse All</button>
        </div>
      </div>

      {error && (
        <div className={styles.infoBox}>
          <strong>Tracking API unavailable:</strong> {error}
          <br /><small>Start the tracking server with <code>npm run tracking</code> to view logs.</small>
        </div>
      )}

      {loading && <div className={styles.loadingMsg}>Loading log entries…</div>}

      {!loading && !error && events.length === 0 && (
        <div className={styles.emptyState}>No log entries found. Events will appear here as users interact with the app.</div>
      )}

      <div className={styles.logList}>
        {events.map((e) => {
          const open = openIds.has(e.id);
          const req = {
            event: e.event_name,
            session: e.session_id,
            user: e.user_id,
            properties: e.properties,
          };
          const res = { status: 'recorded', timestamp: e.created_at };

          return (
            <div key={e.id} className={styles.logEntry}>
              <button className={styles.logHeader} onClick={() => toggle(e.id)}>
                <span className={styles.logTs}>{formatTs(e.created_at)}</span>
                <span className={styles.logEndpoint}>{e.event_name || '—'}</span>
                {e.properties?.path && <span className={styles.logPath}>{e.properties.path}</span>}
                <span className={styles.chevron}>{open ? '▲' : '▼'}</span>
              </button>

              {open && (
                <div className={styles.logBody}>
                  <div className={styles.payloadRow}>
                    <div className={styles.payloadBlock}>
                      <div className={styles.payloadLabel}>Request</div>
                      <pre className={styles.pre}>{prettyJson(req)}</pre>
                    </div>
                    <div className={styles.payloadBlock}>
                      <div className={styles.payloadLabel}>Response</div>
                      <pre className={styles.pre}>{prettyJson(res)}</pre>
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </main>
  );
};

export default LogViewerPage;
