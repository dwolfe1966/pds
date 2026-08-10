import React, { useState, useEffect } from 'react';
import IdentityDetailsCard from './IdentityDetailsCard';
import { fetchHistoryInsights } from '../services/memberEnrichment';
import { getIdentityEvents } from '../services/identityMonitorService';

const GREEN = '#0d5d2f';
const EXT_URL = 'https://idlookup.me/extension'; // extension landing → Chrome Web Store when published

// The extension marks our pages with <html data-idl-ext="<version>"> (extension/identity-bridge.js).
const extVersion = () => { try { return document.documentElement.getAttribute('data-idl-ext'); } catch { return null; } };

// Which identity-events the assistant is responsible for (its activity feed).
const EXT_EVENT = { reappearance_suspected: '👀', removal_verified_suspected: '✅', optout_recheck: '🔁' };

/**
 * "Browser Assistant" tab — the home for the IDLookup browser extension inside My Identity, and the landing
 * page the extension deep-links to (/my-identity?sub=extension). Shows: whether the assistant is active +
 * how to add it, what it's seen/done (browsing insights + removal activity), and your saved details for
 * removals (the form moved here from Digital Footprint).
 */
export default function BrowserAssistantTab() {
  const [ver, setVer] = useState(extVersion);
  const [insights, setInsights] = useState(null);
  const [events, setEvents] = useState([]);

  const email = (() => { try { const u = JSON.parse(localStorage.getItem('user') || 'null'); return (u && u.email) || ''; } catch { return ''; } })();
  const active = !!ver;

  useEffect(() => {
    let alive = true;
    // The marker is set by the extension's content script on document_idle — re-read shortly after mount.
    const t = setTimeout(() => { if (alive) setVer(extVersion()); }, 800);
    fetchHistoryInsights().then((h) => { if (alive && h) setInsights(h); });
    if (email) getIdentityEvents(email, 40).then((e) => { if (alive) setEvents(Array.isArray(e) ? e : []); });
    return () => { alive = false; clearTimeout(t); };
  }, [email]);

  const extEvents = events.filter((e) => EXT_EVENT[e.type]);
  const seenHosts = insights && insights.uniqueHosts ? insights.uniqueHosts : 0;
  const brokers = (insights && insights.brokers) || [];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Header — what it is + status + install */}
      <div style={{ border: '1px solid #d7ddd9', borderRadius: 14, padding: '18px 20px', background: '#fff', boxShadow: '0 2px 10px rgba(13,93,47,0.06)' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 18, fontWeight: 800, color: '#111827' }}>Browser Assistant</div>
            <p style={{ margin: '5px 0 0', fontSize: 13.5, color: '#4b5563', lineHeight: 1.55, maxWidth: 560 }}>
              A browser add-on that <strong>autofills data-broker opt-out forms</strong>, flags risky pages as you browse,
              and <strong>watches for your info re-appearing</strong> after a removal — all in your own browser.
            </p>
          </div>
          <span style={{ flexShrink: 0, display: 'inline-flex', alignItems: 'center', gap: 7, fontSize: 12.5, fontWeight: 800, padding: '5px 12px', borderRadius: 999, background: active ? '#f0fdf4' : '#f3f4f6', color: active ? GREEN : '#6b7280', border: `1px solid ${active ? '#bbf7d0' : '#e5e7eb'}` }}>
            <span aria-hidden="true" style={{ width: 8, height: 8, borderRadius: '50%', background: active ? GREEN : '#9ca3af' }} />
            {active ? `Active${ver && ver !== '1' ? ` · v${ver}` : ''}` : 'Not installed'}
          </span>
        </div>
        {!active && (
          <div style={{ marginTop: 14, display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
            <a href={EXT_URL} target="_blank" rel="noopener noreferrer" style={{ background: GREEN, color: '#fff', textDecoration: 'none', borderRadius: 9, padding: '10px 18px', fontSize: 14, fontWeight: 800 }}>Add to Chrome →</a>
            <span style={{ fontSize: 12.5, color: '#6b7280' }}>Free · works in your browser · nothing runs until you turn it on.</span>
          </div>
        )}
      </div>

      {/* Activity — what the assistant has seen / done */}
      <div style={{ border: '1px solid #d7ddd9', borderRadius: 14, padding: '18px 20px', background: '#fff', boxShadow: '0 2px 10px rgba(13,93,47,0.06)' }}>
        <div style={{ fontSize: 15.5, fontWeight: 800, color: '#111827', marginBottom: 4 }}>Assistant activity</div>
        {!active ? (
          <p style={{ margin: 0, fontSize: 13, color: '#6b7280', lineHeight: 1.55 }}>Once the assistant is added, you’ll see the sites it flags and the removals it helps with here.</p>
        ) : (
          <>
            {/* Sites seen (browsing insights — consent-gated in the extension) */}
            {seenHosts > 0 || brokers.length > 0 ? (
              <div style={{ margin: '6px 0 12px' }}>
                <div style={{ fontSize: 13, color: '#374151' }}>
                  Seen <strong>{seenHosts}</strong> site{seenHosts === 1 ? '' : 's'} in your browsing{brokers.length ? <> · <strong>{brokers.length}</strong> data broker{brokers.length === 1 ? '' : 's'} spotted</> : ''}.
                </div>
                {brokers.length > 0 && (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
                    {brokers.slice(0, 12).map((b) => (
                      <span key={b.sourceKey || b.name} style={{ fontSize: 12, fontWeight: 700, color: '#374151', background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: 999, padding: '4px 11px' }}>{b.name}</span>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <p style={{ margin: '6px 0 12px', fontSize: 12.5, color: '#6b7280', lineHeight: 1.5 }}>
                Turn on <strong>browsing insights</strong> in the assistant (off by default) to see where your data spreads. You can delete it any time.
              </p>
            )}

            {/* Removal activity feed */}
            <div style={{ fontSize: 12.5, fontWeight: 800, color: '#374151', textTransform: 'uppercase', letterSpacing: '0.03em', margin: '6px 0 6px' }}>Recent</div>
            {extEvents.length === 0 ? (
              <p style={{ margin: 0, fontSize: 12.5, color: '#6b7280' }}>No monitoring activity yet — we’ll flag re-listings and re-checks here as they happen.</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                {extEvents.slice(0, 8).map((e) => (
                  <div key={e.id} style={{ display: 'flex', gap: 10, padding: '9px 0', borderTop: '1px solid #f3f4f6' }}>
                    <span aria-hidden="true" style={{ fontSize: 15, flexShrink: 0 }}>{EXT_EVENT[e.type]}</span>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 700, color: '#111827' }}>{e.title || 'Update'}</div>
                      {e.detail && <div style={{ fontSize: 12, color: '#4b5563', lineHeight: 1.45, marginTop: 1 }}>{e.detail}</div>}
                      <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 2 }}>{e.created_at ? new Date(e.created_at).toLocaleDateString() : ''}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>

      {/* Your details for removals — moved here from Digital Footprint. The assistant uses these to autofill forms. */}
      <IdentityDetailsCard />
    </div>
  );
}
