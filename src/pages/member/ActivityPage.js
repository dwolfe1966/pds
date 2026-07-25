import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import PageHeader, { PageShell } from '../../components/PageHeader';
import { getSearchHistory, deleteSearchHistoryItem } from '../../utils/searchHistory';
import { fetchSearchHistory, deleteServerSearch } from '../../services/searchActivity';
import { readLoginHistory } from '../../services/loginHistory';
import { getIdentityEvents } from '../../services/identityMonitorService';
import api from '../../api';

/**
 * Activity — the unified event feed (formerly "History"). Aggregates everything we track about the
 * member: searches (cross-device, server-backed), logins, and notifications (best-effort; wired when
 * the notifications source lands). Structured as a merge of normalized event streams so new kinds
 * (report views, profile edits, footprint changes…) drop in cheaply.
 */

const KIND = {
  search: { icon: '🔍', label: 'Search' },
  login: { icon: '🔑', label: 'Login' },
  exposure: { icon: '🛡️', label: 'Identity' },
  notification: { icon: '🔔', label: 'Notification' },
};

function formatQuery(q) {
  if (!q) return 'Search';
  if (q.firstName || q.lastName) return `${q.firstName || ''} ${q.lastName || ''}`.trim();
  if (q.email) return q.email;
  if (q.phone) return q.phone;
  return 'Search';
}

// Merge server + local searches (server = source of truth; keep just-run local entries newer than the
// newest server row, deduped) — same logic as the old SearchHistoryPage.
function mergeSearches(server, local) {
  if (!server.length) return local;
  const sig = (e) => `${e.type}|${(e.query && e.query.firstName) || ''}|${(e.query && e.query.lastName) || ''}|${(e.query && e.query.email) || ''}|${(e.query && e.query.phone) || ''}`.toLowerCase();
  const newest = Math.max(0, ...server.map((e) => e.timestamp || 0));
  const sigs = new Set(server.map(sig));
  const extras = local.filter((e) => (e.timestamp || 0) > newest && !sigs.has(sig(e)));
  return [...extras, ...server];
}

const ActivityPage = () => {
  const { token, user } = useAuth();
  const navigate = useNavigate();
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');

  useEffect(() => {
    if (!token) { setLoading(false); return; }
    let alive = true;

    const searchEvents = (searches) => searches.map((s) => ({
      id: `search-${s.id}`, rawId: s.id, kind: 'search', timestamp: s.timestamp || 0,
      title: `${formatQuery(s.query)}${s.query && s.query.state ? ` · ${s.query.state}` : ''}`,
      subtitle: `${s.type || 'name'} search · ${s.resultCount || 0} results`, query: s.query,
    }));
    const loginEvents = readLoginHistory().map((l, i) => ({
      id: `login-${l.timestamp}-${i}`, kind: 'login', timestamp: new Date(l.timestamp).getTime() || 0,
      title: l.method === 'signup' ? 'Account created' : 'Signed in',
      subtitle: [l.method, l.source].filter(Boolean).join(' · ') || 'password',
    }));

    // Identity events (breach alerts now; more kinds later) from the server stream.
    const exposureEvents = (evs) => (evs || []).map((e) => ({
      id: `idev-${e.id}`, kind: 'exposure', timestamp: new Date(e.created_at || 0).getTime() || 0,
      title: e.title || 'Identity update',
      subtitle: e.detail || (e.type === 'breach_new' ? 'New data breach detected' : e.type === 'breach_found' ? 'Data breach exposure' : ''),
    }));

    // Paint instantly from local sources, then reconcile searches with the server + notifications + identity.
    const localSearches = getSearchHistory();
    const rebuild = (searches, notifs, exposures) => {
      const notifEvents = (notifs || []).map((n, i) => ({
        id: `notif-${n.id || i}`, kind: 'notification',
        timestamp: new Date(n.createdAt || n.timestamp || 0).getTime() || 0,
        title: n.title || 'Notification', subtitle: n.message || '',
      }));
      return [...searchEvents(searches), ...loginEvents, ...exposureEvents(exposures), ...notifEvents]
        .sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
    };
    setEvents(rebuild(localSearches, [], []));

    Promise.allSettled([
      fetchSearchHistory(),
      api.get ? api.get('notifications').catch(() => null) : Promise.resolve(null),
      user && user.email ? getIdentityEvents(user.email) : Promise.resolve([]),
    ]).then(([sRes, nRes, eRes]) => {
      if (!alive) return;
      const server = sRes.status === 'fulfilled' && Array.isArray(sRes.value) ? sRes.value : [];
      const searches = mergeSearches(server, localSearches);
      const notifs = nRes.status === 'fulfilled' && nRes.value
        ? (Array.isArray(nRes.value) ? nRes.value : (nRes.value.notifications || nRes.value.data || []))
        : [];
      const exposures = eRes.status === 'fulfilled' && Array.isArray(eRes.value) ? eRes.value : [];
      setEvents(rebuild(searches, notifs, exposures));
      setLoading(false);
    });
    return () => { alive = false; };
  }, [token, user && user.email]);

  const handleDelete = (ev) => {
    if (ev.kind === 'search') { deleteSearchHistoryItem(ev.rawId); deleteServerSearch(ev.rawId); }
    setEvents((prev) => prev.filter((e) => e.id !== ev.id));
  };

  const handleReRun = (ev) => {
    const p = new URLSearchParams();
    const q = ev.query || {};
    if (q.firstName) p.set('firstName', q.firstName);
    if (q.lastName) p.set('lastName', q.lastName);
    if (q.state) p.set('state', q.state);
    if (q.email) p.set('email', q.email);
    if (q.phone) p.set('phone', q.phone);
    navigate(`/people-search?${p.toString()}`);
  };

  const kinds = ['all', ...Object.keys(KIND).filter((k) => events.some((e) => e.kind === k))];
  const shown = filter === 'all' ? events : events.filter((e) => e.kind === filter);

  return (
    <PageShell>
      <PageHeader title="Activity" subtitle="Your searches, logins, and everything we track — newest first." />

      {kinds.length > 2 && (
        <div style={{ display: 'flex', gap: 8, marginBottom: '1.25rem', flexWrap: 'wrap' }}>
          {kinds.map((k) => (
            <button key={k} type="button" onClick={() => setFilter(k)}
              style={{ border: `1px solid ${filter === k ? '#0d5d2f' : '#e5e7eb'}`, background: filter === k ? '#f0fdf4' : '#fff',
                color: filter === k ? '#0d5d2f' : '#6b7280', borderRadius: 999, padding: '5px 14px', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
              {k === 'all' ? 'All' : `${KIND[k].icon} ${KIND[k].label}s`}
            </button>
          ))}
        </div>
      )}

      {loading && <p>Loading your activity…</p>}
      {!loading && shown.length === 0 && (
        <p style={{ color: '#6b7280' }}>No activity yet. Start a search to populate your feed.</p>
      )}

      {shown.length > 0 && (
        <div style={{ display: 'grid', gap: '0.75rem' }}>
          {shown.map((ev) => (
            <div key={ev.id} style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: '0.75rem', padding: '0.9rem 1.1rem', boxShadow: '0 1px 2px rgba(0,0,0,0.05)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem' }}>
                <div style={{ display: 'flex', gap: 12, alignItems: 'center', minWidth: 0 }}>
                  <span aria-hidden="true" style={{ fontSize: 18 }}>{(KIND[ev.kind] || {}).icon || '•'}</span>
                  <div style={{ minWidth: 0 }}>
                    <p style={{ margin: 0, fontWeight: 600, color: '#111827' }}>{ev.title}</p>
                    <p style={{ margin: '0.3rem 0 0', color: '#6b7280', fontSize: '0.85rem' }}>
                      {ev.subtitle}{ev.timestamp ? ` · ${new Date(ev.timestamp).toLocaleDateString()}` : ''}
                    </p>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '0.5rem', flexShrink: 0 }}>
                  {ev.kind === 'search' && (
                    <button onClick={() => handleReRun(ev)}
                      style={{ padding: '0.35rem 0.75rem', borderRadius: '0.375rem', background: '#0d5d2f', color: '#fff', border: 'none', fontSize: '0.8rem', cursor: 'pointer', fontWeight: 500 }}>
                      Search Again
                    </button>
                  )}
                  {ev.kind === 'search' && (
                    <button onClick={() => handleDelete(ev)}
                      style={{ padding: '0.35rem 0.75rem', borderRadius: '0.375rem', background: 'transparent', color: '#6b7280', border: '1px solid #e5e7eb', fontSize: '0.8rem', cursor: 'pointer' }}>
                      Delete
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </PageShell>
  );
};

export default ActivityPage;
