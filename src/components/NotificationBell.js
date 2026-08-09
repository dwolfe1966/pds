import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { getIdentityEvents } from '../services/identityMonitorService';
import { confirmReappearance } from '../services/memberEnrichment';

// Global notification bell — surfaces the member's identity-events stream (breach alerts, opt-out re-check
// reminders, suspected reappearances) so an ABSENT user sees them on their next visit without hunting through
// My Activity. This is the "reach" end of the monitoring loop: the cron + extension write events; this makes
// them visible everywhere in the member area, with an unread badge and inline actions.
const GREEN = '#0d5d2f';
const SEEN_KEY = 'idlNotifSeenAt';
const HANDLED_KEY = 'idlNotifHandled'; // event ids the member has confirmed/dismissed (client-side resolve)

// Icon per identity-event type. Re-check reminders, breach alerts, and suspected reappearances are live.
const iconFor = (type) => {
  if (type === 'optout_recheck') return '🔁';
  if (type === 'reappearance_suspected') return '👀';
  if (type === 'breach_new' || type === 'breach_found') return '🔓';
  if (type === 'exposure' || type === 'new_record') return '🛡️';
  return '🔔';
};

const readSeen = () => { try { return Number(localStorage.getItem(SEEN_KEY)) || 0; } catch { return 0; } };
const readHandled = () => { try { return new Set(JSON.parse(localStorage.getItem(HANDLED_KEY) || '[]')); } catch { return new Set(); } };

const NotificationBell = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [events, setEvents] = useState([]);
  const [seenAt, setSeenAt] = useState(readSeen);
  const [handled, setHandled] = useState(readHandled); // Set of resolved event ids
  const [flash, setFlash] = useState('');

  const email = user && user.email;

  useEffect(() => {
    let alive = true;
    if (!email) { setEvents([]); return undefined; }
    getIdentityEvents(email, 20).then((list) => { if (alive) setEvents(Array.isArray(list) ? list : []); });
    return () => { alive = false; };
  }, [email]);

  const tsOf = (e) => new Date(e.created_at || 0).getTime() || 0;
  // Confirmed/dismissed suspected-reappearances drop off the list (the confirm already persisted the state
  // change server-side; there's no need to keep prompting).
  const visible = events.filter((e) => !handled.has(e.id));
  const unread = visible.filter((e) => tsOf(e) > seenAt).length;

  const markHandled = (id) => {
    setHandled((prev) => {
      const next = new Set(prev); next.add(id);
      try { localStorage.setItem(HANDLED_KEY, JSON.stringify(Array.from(next))); } catch { /* ignore */ }
      return next;
    });
  };

  const onConfirm = async (e) => {
    const sk = e && e.data && e.data.sourceKey;
    markHandled(e.id); // optimistic — remove the prompt immediately
    setFlash(`Marked as back on ${(e.data && e.data.displayName) || 'that site'}. Re-submit from Digital Footprint.`);
    if (sk) { try { await confirmReappearance(sk); } catch { /* best effort */ } }
  };
  const onDismiss = (e) => { markHandled(e.id); setFlash(''); };

  const toggle = useCallback(() => {
    setOpen((o) => {
      const next = !o;
      if (next) { const now = Date.now(); setSeenAt(now); try { localStorage.setItem(SEEN_KEY, String(now)); } catch { /* ignore */ } }
      else setFlash('');
      return next;
    });
  }, []);

  // Close on outside click / Escape.
  useEffect(() => {
    if (!open) return undefined;
    const onDoc = (e) => { if (!e.target.closest || !e.target.closest('[data-idl-bell]')) setOpen(false); };
    const onEsc = (e) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onEsc);
    return () => { document.removeEventListener('mousedown', onDoc); document.removeEventListener('keydown', onEsc); };
  }, [open]);

  if (!email) return null;

  return (
    <div data-idl-bell style={{ position: 'relative' }}>
      <button type="button" onClick={toggle} aria-label={`Notifications${unread ? ` (${unread} unread)` : ''}`}
        style={{ position: 'relative', background: 'transparent', border: 'none', cursor: 'pointer', color: 'inherit', fontSize: 18, lineHeight: 1, padding: 4 }}>
        🔔
        {unread > 0 && (
          <span aria-hidden="true" style={{ position: 'absolute', top: -2, right: -2, minWidth: 16, height: 16, padding: '0 4px', borderRadius: 999, background: '#dc2626', color: '#fff', fontSize: 10, fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>
      {open && (
        <div role="menu" style={{ position: 'absolute', right: 0, top: '2.2rem', background: '#fff', border: '1px solid #e5e7eb', borderRadius: 12, boxShadow: '0 12px 40px rgba(0,0,0,0.18)', width: 340, maxWidth: '92vw', zIndex: 200, overflow: 'hidden' }}>
          <div style={{ padding: '11px 14px', borderBottom: '1px solid #f0f2f1', fontSize: 13.5, fontWeight: 800, color: '#111827' }}>Notifications</div>
          {flash && <div style={{ padding: '9px 14px', fontSize: 12, color: GREEN, background: '#f0fdf4', borderBottom: '1px solid #dcfce7' }}>{flash}</div>}
          {visible.length === 0 ? (
            <div style={{ padding: '18px 14px', fontSize: 13, color: '#6b7280' }}>You're all caught up — we'll flag anything new here.</div>
          ) : (
            <ul style={{ listStyle: 'none', margin: 0, padding: 0, maxHeight: 360, overflowY: 'auto' }}>
              {visible.slice(0, 8).map((e) => {
                const suspected = e.type === 'reappearance_suspected';
                return (
                  <li key={e.id} style={{ display: 'flex', gap: 10, padding: '10px 14px', borderTop: '1px solid #f6f7f6' }}>
                    <span aria-hidden="true" style={{ fontSize: 16, flexShrink: 0 }}>{iconFor(e.type)}</span>
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div style={{ fontSize: 13, fontWeight: 700, color: '#111827' }}>{e.title || 'Identity update'}</div>
                      {e.detail && <div style={{ fontSize: 12, color: '#4b5563', lineHeight: 1.45, marginTop: 1 }}>{e.detail}</div>}
                      {suspected ? (
                        <div style={{ display: 'flex', gap: 8, marginTop: 7 }}>
                          <button type="button" onClick={() => onConfirm(e)}
                            style={{ fontSize: 12, fontWeight: 800, color: '#fff', background: GREEN, border: 'none', borderRadius: 8, padding: '5px 11px', cursor: 'pointer' }}>Yes, I'm listed</button>
                          <button type="button" onClick={() => onDismiss(e)}
                            style={{ fontSize: 12, fontWeight: 700, color: '#4b5563', background: '#fff', border: '1px solid #d1d5db', borderRadius: 8, padding: '5px 11px', cursor: 'pointer' }}>Not there</button>
                        </div>
                      ) : (
                        <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 2 }}>{tsOf(e) ? new Date(tsOf(e)).toLocaleDateString() : ''}</div>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
          <button type="button" onClick={() => { setOpen(false); navigate('/activity'); }}
            style={{ width: '100%', border: 'none', borderTop: '1px solid #f0f2f1', background: '#fff', color: GREEN, fontSize: 13, fontWeight: 800, padding: '11px 14px', cursor: 'pointer', textAlign: 'center' }}>
            View all activity →
          </button>
        </div>
      )}
    </div>
  );
};

export default NotificationBell;
