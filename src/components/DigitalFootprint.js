import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { getMappedIdentity, fetchMappedIdentity, fetchExposureGraph, setExposureControl, runOptOut } from '../services/memberEnrichment';
import { useBrand } from '../services/brand';

/**
 * "Your Digital Footprint" — the Transparency + Control panel, now rendered off the Exposure Graph
 * (docs/product/exposure-graph-spine.md). One row per place-you-appear, on one provider, with its REAL
 * status (found / requested / removed / hidden) from the graph. Federates the surfaces we already own
 * (IDLookup suppression + breach monitor) and lists the broker/search catalog with opt-out actions that
 * are now TRACKED (clicking Remove marks the node so status persists).
 *
 * Core narrative unchanged: you can't delete yourself from the internet, but you can take control.
 * Degrades gracefully — if the graph backend isn't reachable, falls back to the static opt-out catalog.
 *
 * <DigitalFootprint compact /> — Dashboard summary. <DigitalFootprint /> — full list (My Identity).
 */

const GREEN = '#0d5d2f';

// Fallback catalog (used only if the graph backend returns no registry — same honest opt-out directory as before).
const FALLBACK = [
  { source_key: 'idlookup', surface_type: 'idlookup', display_name: 'IDLookup', opt_out_url: null },
  { source_key: 'spokeo', surface_type: 'data_broker', display_name: 'Spokeo', opt_out_url: 'https://www.spokeo.com/optout' },
  { source_key: 'beenverified', surface_type: 'data_broker', display_name: 'BeenVerified', opt_out_url: 'https://www.beenverified.com/app/optout/search' },
  { source_key: 'peoplefinders', surface_type: 'data_broker', display_name: 'PeopleFinders', opt_out_url: 'https://www.peoplefinders.com/opt-out' },
  { source_key: 'whitepages', surface_type: 'data_broker', display_name: 'Whitepages', opt_out_url: 'https://www.whitepages.com/suppression-requests' },
  { source_key: 'intelius', surface_type: 'data_broker', display_name: 'Intelius', opt_out_url: 'https://www.intelius.com/opt-out/' },
  { source_key: 'radaris', surface_type: 'data_broker', display_name: 'Radaris', opt_out_url: 'https://radaris.com/control/privacy' },
  { source_key: 'mylife', surface_type: 'data_broker', display_name: 'MyLife', opt_out_url: 'https://www.mylife.com/ccpa/index.pubview' },
  { source_key: 'google', surface_type: 'search_result', display_name: 'Google Search results', opt_out_url: 'https://myactivity.google.com/results-about-you' },
];

// The "map" is grouped by CATEGORY — every place your data may live, across the web.
const CATS = [
  { key: 'ours', label: 'IDLookup — our search', icon: '🏠' },
  { key: 'people_search', label: 'People-search sites', icon: '🔍' },
  { key: 'background_check', label: 'Background-check sites', icon: '🪪' },
  { key: 'marketing', label: 'Marketing & data brokers', icon: '📣' },
  { key: 'b2b_data', label: 'Business & professional data', icon: '🏢' },
  { key: 'search', label: 'Search engines', icon: '🌐' },
  { key: 'social', label: 'Social profiles', icon: '👥' },
  { key: 'genealogy', label: 'Genealogy & family history', icon: '🌳' },
  { key: 'property', label: 'Property & real estate', icon: '🏡' },
  { key: 'credit', label: 'Credit bureaus', icon: '💳' },
  { key: 'location', label: 'Location data brokers', icon: '📡' },
  { key: 'public_record', label: 'Public records', icon: '🏛️' },
  { key: 'ai', label: 'AI & chatbots', icon: '🤖' },
  { key: 'images', label: 'Face & image search', icon: '📸' },
  { key: 'breach', label: 'Data breaches', icon: '🔓' },
];
const catOf = (it) => it.surfaceType === 'idlookup' ? 'ours' : it.surfaceType === 'breach' ? 'breach'
  : (it.category || (it.surfaceType === 'search_result' ? 'search' : it.surfaceType === 'social_profile' ? 'social' : 'people_search'));
const dotColor = (node, override) => {
  const cs = override || (node && node.control_status);
  if (cs === 'hidden' || cs === 'removed' || cs === 'optout_confirmed') return GREEN;
  if (cs === 'optout_requested') return '#d97706';
  if (node && node.found_status === 'found') return '#dc2626';
  return '#d1d5db';
};

function Badge({ label, color, bg }) {
  return <span style={{ fontSize: 11.5, fontWeight: 700, color, background: bg, borderRadius: 999, padding: '3px 10px', whiteSpace: 'nowrap' }}>{label}</span>;
}
function Avatar({ name }) {
  return (
    <span aria-hidden="true" style={{ width: 30, height: 30, borderRadius: 8, background: '#f0fdf4', border: '1px solid #d1fae5', color: GREEN, fontWeight: 800, fontSize: 13, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
      {(name.trim()[0] || '?').toUpperCase()}
    </span>
  );
}
function Row({ name, statusNode, action }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '11px 0', borderTop: '1px solid #f0f2f1' }}>
      <Avatar name={name} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: '#111827' }}>{name}</div>
        <div style={{ marginTop: 2 }}>{statusNode}</div>
      </div>
      {action}
    </div>
  );
}

// Map a node's control/found state → a status chip. `hasUrl` softens the "no node" case to "opt-out available".
function statusFor(node, override, hasUrl) {
  const cs = override || (node && node.control_status);
  if (cs === 'hidden') return <Badge label="✓ Hidden here" color={GREEN} bg="#f0fdf4" />;
  if (cs === 'removed' || cs === 'optout_confirmed') return <Badge label="✓ Removed" color={GREEN} bg="#f0fdf4" />;
  if (cs === 'optout_requested') return <Badge label="Removal requested" color="#92400e" bg="#fffbeb" />;
  if (node && node.found_status === 'found') return <Badge label="Exposed" color="#b91c1c" bg="#fef2f2" />;
  return <span style={{ fontSize: 12.5, color: '#6b7280' }}>{hasUrl ? 'Opt-out available' : 'Not detected'}</span>;
}

// What an opt-out ACTUALLY achieves at each source (from source_registry.nature). Deliberately states the
// DEGREE — most of these don't fully erase you, and a few can't remove you at all — instead of a blanket
// "Remove". `verb` is the accurate action word; null verb = no actionable opt-out. Unknown nature → generic.
const OUTCOME = {
  true_removal:     { label: 'Deletes your record here',            verb: 'Remove',        tone: '#166534' },
  suppression:      { label: 'Hides your listing (data can return)', verb: 'Opt out',      tone: '#92400e' },
  search_delist:    { label: 'Removes from search results, not the source', verb: 'Delist', tone: '#92400e' },
  file_access_only: { label: 'View or dispute only — not removable', verb: 'Request file',  tone: '#6b7280' },
  account_deletion: { label: 'Only by deleting your own account',    verb: 'Manage',        tone: '#6b7280' },
  no_optout:        { label: 'No opt-out available',                 verb: null,            tone: '#6b7280' },
};
const outcomeFor = (nature) => OUTCOME[nature] || null;

const CONSENT_KEY = 'optoutAgentConsent';

export default function DigitalFootprint({ compact = false, onManage } = {}) {
  const navigate = useNavigate();
  const brand = useBrand();
  const manage = onManage || (() => navigate('/my-identity'));
  const [identity, setIdentity] = useState(() => getMappedIdentity());
  const [graph, setGraph] = useState({ nodes: [], registry: [], summary: { score: 0, found: 0, controlled: 0, exposed: 0 } });
  const [overrides, setOverrides] = useState({}); // optimistic per-source control after a Remove click
  const [consentOpen, setConsentOpen] = useState(false);
  const [agreed, setAgreed] = useState(false);
  const [running, setRunning] = useState(false);
  const [flash, setFlash] = useState('');

  useEffect(() => {
    let alive = true;
    fetchMappedIdentity().then((i) => { if (alive && i) setIdentity(i); });
    fetchExposureGraph().then((g) => { if (alive && g) setGraph(g); });
    return () => { alive = false; };
  }, []);

  const mapped = !!(identity && (identity.confirmed || identity.name || identity.hasReport));
  const nodesBySource = useMemo(() => {
    const m = {}; (graph.nodes || []).forEach((n) => { m[n.source_key] = n; }); return m;
  }, [graph.nodes]);

  // Build the itemized list: registry catalog (or fallback) overlaid with node status, plus dynamic breach nodes.
  const items = useMemo(() => {
    const catalog = (graph.registry && graph.registry.length) ? graph.registry : FALLBACK;
    const list = catalog.map((r) => ({ sourceKey: r.source_key, surfaceType: r.surface_type, category: r.category, name: r.display_name, url: r.opt_out_url, nature: r.nature, node: nodesBySource[r.source_key] }));
    (graph.nodes || []).filter((n) => n.surface_type === 'breach').forEach((n) => {
      list.push({ sourceKey: n.source_key, surfaceType: 'breach', category: 'breach', name: (n.exposure_detail && n.exposure_detail.breach) || n.source_key.replace('breach:', ''), url: null, node: n });
    });
    return list;
  }, [graph.registry, graph.nodes, nodesBySource]);

  const byCategory = useMemo(() => {
    const g = {}; items.forEach((it) => { const c = catOf(it); (g[c] = g[c] || []).push(it); }); return g;
  }, [items]);

  const exposedCount = graph.summary?.exposed ?? 0;
  const controlledCount = graph.summary?.controlled ?? 0;
  const catalogSize = items.filter((it) => it.surfaceType !== 'idlookup').length;

  // Mark the node opt-out-requested (tracked in the graph). The OPEN is the anchor's own navigation —
  // a real <a> reliably opens the opt-out page (window.open was getting popup-blocked; owner 2026-08-04).
  const markRequested = (it) => {
    setOverrides((o) => ({ ...o, [it.sourceKey]: 'optout_requested' }));
    setExposureControl({
      nodeId: it.node && it.node.id, sourceKey: it.sourceKey, surfaceType: it.surfaceType,
      controlStatus: 'optout_requested', controlMethod: 'manual',
    }).then((g) => { if (g && g.nodes) setGraph((prev) => ({ ...prev, nodes: g.nodes, summary: g.summary || prev.summary })); });
  };

  const removeBtn = (it) => (
    <a href={it.url} target="_blank" rel="noopener noreferrer" onClick={() => markRequested(it)}
      style={{ flexShrink: 0, fontSize: 12.5, fontWeight: 700, color: GREEN, textDecoration: 'none', background: 'none', border: '1px solid #bbf7d0', borderRadius: 999, padding: '5px 12px', cursor: 'pointer', whiteSpace: 'nowrap' }}>
      Remove →
    </a>
  );

  // "Remove for me" — the done-for-you path. Targets removable sources (brokers + search) not already
  // handled; requires authorized-agent consent (captured once) + a claimed identity (backend-gated).
  const CONTROLLED = ['hidden', 'removed', 'optout_confirmed', 'optout_requested'];
  // Natures an authorized-agent request CAN'T act on — exclude from "Remove for me" so we don't claim to
  // remove what isn't removable (FCRA file-access, no opt-out, or account-deletion only you can do).
  const NON_AGENT = new Set(['file_access_only', 'no_optout', 'account_deletion']);
  const removableKeys = useMemo(() => items
    .filter((it) => (it.surfaceType === 'data_broker' || it.surfaceType === 'search_result')
      && !NON_AGENT.has(it.nature)
      && !CONTROLLED.includes(overrides[it.sourceKey] || (it.node && it.node.control_status)))
    .map((it) => it.sourceKey), [items, overrides]); // eslint-disable-line react-hooks/exhaustive-deps

  const startRemoveForMe = () => {
    setFlash('');
    if (!mapped) { setFlash('Claim & verify your identity first to remove your records for you.'); return; }
    if (!removableKeys.length) { setFlash("You're already requested everywhere we track — nothing left to submit."); return; }
    let consented = false;
    try { consented = localStorage.getItem(CONSENT_KEY) === '1'; } catch { /* ignore */ }
    if (consented) doRemoveForMe(); else { setAgreed(false); setConsentOpen(true); }
  };

  const doRemoveForMe = async () => {
    const keys = removableKeys;
    setConsentOpen(false); setRunning(true); setFlash('');
    try { localStorage.setItem(CONSENT_KEY, '1'); } catch { /* ignore */ }
    setOverrides((o) => { const n = { ...o }; keys.forEach((k) => { n[k] = 'optout_requested'; }); return n; });
    const res = await runOptOut({ sourceKeys: keys, consent: true });
    setRunning(false);
    if (res && res.error === 403) { setFlash('Claim & verify your identity first to remove your records for you.'); return; }
    if (res && res.nodes) setGraph((g) => ({ ...g, nodes: res.nodes, summary: res.summary || g.summary }));
    setFlash(`Requested removal on your behalf across ${keys.length} site${keys.length !== 1 ? 's' : ''}. We'll track each one and flag re-appearances.`);
  };

  // ── Compact (Dashboard) ────────────────────────────────────────────────────
  if (compact) {
    return (
      <div style={{ border: '1px solid #d7ddd9', borderRadius: 14, padding: '18px 20px', background: '#fff', boxShadow: '0 2px 10px rgba(13,93,47,0.06)' }}>
        <div style={{ fontSize: 16, fontWeight: 800, color: '#111827' }}>Your Digital Footprint <span style={{ fontWeight: 600, fontSize: 12.5, color: '#9ca3af' }}>· across the web</span></div>
        <p style={{ margin: '6px 0 14px', fontSize: 13.5, color: '#4b5563', lineHeight: 1.5 }}>
          {exposedCount > 0
            ? <>Your info is exposed in <strong>{exposedCount}</strong> place{exposedCount !== 1 ? 's' : ''} we track{controlledCount > 0 ? <> · <strong>{controlledCount}</strong> under control</> : ''}. You can't erase it all — but you can take control.</>
            : <>Your personal info is spread across {catalogSize}+ people-search sites and data brokers. You can't erase it all — but you can take control.</>}
        </p>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <button type="button" onClick={() => navigate('/my-identity')}
            style={{ background: GREEN, color: '#fff', border: 'none', borderRadius: 8, padding: '10px 18px', fontSize: 14, fontWeight: 800, cursor: 'pointer' }}>
            {mapped ? 'Manage my footprint →' : 'See my digital footprint →'}
          </button>
          {exposedCount + controlledCount > 0 && (
            <Badge label={`${controlledCount}/${exposedCount + controlledCount} under control`} color={GREEN} bg="#f0fdf4" />
          )}
        </div>
      </div>
    );
  }

  // ── Full (My Identity → Digital Footprint) — the MAP of everywhere your data lives ──────────────
  const cats = CATS.filter((c) => byCategory[c.key] && byCategory[c.key].length);
  return (
    <div style={{ border: '1px solid #d7ddd9', borderRadius: 14, padding: '20px 22px', background: '#fff', boxShadow: '0 2px 10px rgba(13,93,47,0.06)' }}>
      <div style={{ fontSize: 18, fontWeight: 800, color: '#111827' }}>Your Digital Footprint <span style={{ fontWeight: 600, fontSize: 12.5, color: '#9ca3af' }}>· a map of where your data lives</span></div>

      {/* Summary — breadth + control, from the graph */}
      <div style={{ display: 'flex', gap: 24, marginTop: 14, flexWrap: 'wrap' }}>
        <div><div style={{ fontSize: 26, fontWeight: 800, color: '#111827' }}>{items.length}</div><div style={{ fontSize: 11.5, color: '#6b7280', fontWeight: 600 }}>Sources tracked</div></div>
        <div><div style={{ fontSize: 26, fontWeight: 800, color: exposedCount ? '#b91c1c' : '#9ca3af' }}>{exposedCount}</div><div style={{ fontSize: 11.5, color: '#6b7280', fontWeight: 600 }}>Exposed</div></div>
        <div><div style={{ fontSize: 26, fontWeight: 800, color: GREEN }}>{controlledCount}</div><div style={{ fontSize: 11.5, color: '#6b7280', fontWeight: 600 }}>Under control</div></div>
        <div><div style={{ fontSize: 26, fontWeight: 800, color: '#111827' }}>{cats.length}</div><div style={{ fontSize: 11.5, color: '#6b7280', fontWeight: 600 }}>Categories</div></div>
      </div>

      <p style={{ margin: '12px 0 8px', fontSize: 13.5, color: '#4b5563', lineHeight: 1.55 }}>
        Every place across the web we track that may hold your data — brokers, search, social, public records,
        and breaches. <strong>You can't delete yourself from the internet</strong>, but you can see it all and take control.
      </p>

      {/* Done-for-you: Remove for me across all removable sources (authorized-agent consent). */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', margin: '4px 0 6px' }}>
        <button type="button" onClick={startRemoveForMe} disabled={running}
          style={{ background: GREEN, color: '#fff', border: 'none', borderRadius: 10, padding: '11px 20px', fontSize: 14.5, fontWeight: 800, cursor: running ? 'default' : 'pointer', opacity: running ? 0.7 : 1 }}>
          {running ? 'Requesting removals…' : `✨ Remove me — we do it for you${removableKeys.length ? ` (${removableKeys.length})` : ''}`}
        </button>
        <span style={{ fontSize: 12.5, color: '#6b7280' }}>We submit the opt-outs on your behalf, as your authorized agent, and track each one.</span>
      </div>
      {flash && <div style={{ fontSize: 12.5, fontWeight: 600, color: flash.startsWith('Claim') ? '#b45309' : GREEN, margin: '0 0 6px' }}>{flash}</div>}

      {/* The map — category cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(270px, 1fr))', gap: 14, marginTop: 8 }}>
        {cats.map((c) => {
          const list = byCategory[c.key];
          const exposedIn = list.filter((it) => it.node && it.node.found_status === 'found' && !['hidden', 'removed', 'optout_confirmed'].includes(overrides[it.sourceKey] || it.node.control_status)).length;
          return (
            <div key={c.key} style={{ border: '1px solid #e5e7eb', borderRadius: 12, padding: '12px 14px', background: '#fdfdfc' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                <span aria-hidden="true">{c.icon}</span>
                <span style={{ flex: 1, fontSize: 13.5, fontWeight: 800, color: '#111827' }}>{c.label}</span>
                {exposedIn > 0
                  ? <span style={{ fontSize: 11, fontWeight: 800, color: '#b91c1c', background: '#fef2f2', borderRadius: 999, padding: '1px 8px' }}>{exposedIn} exposed</span>
                  : <span style={{ fontSize: 11, color: '#9ca3af', fontWeight: 700 }}>{list.length}</span>}
              </div>
              {list.map((it) => {
                const oc = c.key === 'ours' ? null : outcomeFor(it.nature);
                return (
                <div key={it.sourceKey} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 0', borderTop: '1px solid #f3f4f6' }}>
                  <span style={{ width: 8, height: 8, borderRadius: '50%', background: dotColor(it.node, overrides[it.sourceKey]), flexShrink: 0 }} aria-hidden="true" />
                  <span style={{ flex: 1, minWidth: 0 }}>
                    <span style={{ display: 'block', fontSize: 12.5, fontWeight: 600, color: '#374151', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={it.name}>{it.name}</span>
                    {oc && <span style={{ display: 'block', fontSize: 10.5, color: oc.tone, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{oc.label}</span>}
                  </span>
                  {c.key === 'ours'
                    ? <button type="button" onClick={manage} style={{ flexShrink: 0, fontSize: 11.5, fontWeight: 700, color: '#fff', background: GREEN, border: 'none', borderRadius: 999, padding: '3px 10px', cursor: 'pointer' }}>{mapped ? 'Manage' : 'Claim'}</button>
                    : (it.url && (!oc || oc.verb))
                      ? <a href={it.url} target="_blank" rel="noopener noreferrer" onClick={() => markRequested(it)} style={{ flexShrink: 0, fontSize: 11.5, fontWeight: 700, color: GREEN, textDecoration: 'none' }}>{(oc && oc.verb) || 'Remove'} →</a>
                      : null}
                </div>
                );
              })}
            </div>
          );
        })}
      </div>

      {/* Legend */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px 14px', margin: '14px 0 0', fontSize: 11, color: '#6b7280' }}>
        <Dot c="#dc2626" /> Exposed <Dot c="#d97706" /> Removal requested <Dot c={GREEN} /> Removed / hidden <Dot c="#d1d5db" /> Not yet detected
      </div>
      <p style={{ margin: '10px 0 0', fontSize: 11.5, color: '#9ca3af', lineHeight: 1.5 }}>
        "Remove me" submits opt-outs on your behalf; the per-site "Remove →" opens that site's own form. Data can
        re-list — we keep monitoring and flag re-appearances. Coverage grows as we add sources.
      </p>

      {/* Authorized-agent consent — required once before we act on the member's behalf. */}
      {consentOpen && (
        <div role="dialog" aria-modal="true" onClick={() => setConsentOpen(false)}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999, padding: 16 }}>
          <div onClick={(e) => e.stopPropagation()} style={{ background: '#fff', borderRadius: 16, padding: '22px 24px', maxWidth: 460, width: '100%', boxShadow: '0 20px 60px rgba(0,0,0,0.3)' }}>
            <div style={{ fontSize: 17, fontWeight: 800, color: '#111827', marginBottom: 8 }}>Remove you automatically</div>
            <p style={{ fontSize: 13.5, color: '#4b5563', lineHeight: 1.55, margin: '0 0 14px' }}>
              Authorize {brand.name} to submit opt-out requests <strong>on your behalf, as your authorized agent</strong>, to the
              people-search and data-broker sites where your information appears. We track each request and flag re-appearances,
              and you can stop any time.
            </p>
            <label style={{ display: 'flex', gap: 9, alignItems: 'flex-start', fontSize: 13, color: '#374151', marginBottom: 16, cursor: 'pointer', lineHeight: 1.5 }}>
              <input type="checkbox" checked={agreed} onChange={(e) => setAgreed(e.target.checked)} style={{ marginTop: 2, flexShrink: 0 }} />
              <span>I authorize {brand.name} to act as my authorized agent to request removal of my personal information from the sites listed here.</span>
            </label>
            <div style={{ display: 'flex', gap: 8 }}>
              <button type="button" onClick={doRemoveForMe} disabled={!agreed}
                style={{ background: agreed ? GREEN : '#e5e7eb', color: agreed ? '#fff' : '#9ca3af', border: 'none', borderRadius: 8, padding: '10px 18px', fontSize: 14, fontWeight: 700, cursor: agreed ? 'pointer' : 'not-allowed' }}>Authorize &amp; start</button>
              <button type="button" onClick={() => setConsentOpen(false)}
                style={{ background: 'none', color: '#6b7280', border: '1px solid #d1d5db', borderRadius: 8, padding: '10px 18px', fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Dot({ c }) {
  return <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', background: c, marginRight: 2, verticalAlign: 'middle' }} aria-hidden="true" />;
}
