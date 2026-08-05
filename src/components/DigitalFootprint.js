import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { getMappedIdentity, fetchMappedIdentity, fetchExposureGraph, setExposureControl } from '../services/memberEnrichment';

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

export default function DigitalFootprint({ compact = false, onManage } = {}) {
  const navigate = useNavigate();
  const manage = onManage || (() => navigate('/my-identity'));
  const [identity, setIdentity] = useState(() => getMappedIdentity());
  const [graph, setGraph] = useState({ nodes: [], registry: [], summary: { score: 0, found: 0, controlled: 0, exposed: 0 } });
  const [overrides, setOverrides] = useState({}); // optimistic per-source control after a Remove click

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
    const list = catalog.map((r) => ({ sourceKey: r.source_key, surfaceType: r.surface_type, category: r.category, name: r.display_name, url: r.opt_out_url, node: nodesBySource[r.source_key] }));
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
              {list.map((it) => (
                <div key={it.sourceKey} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 0', borderTop: '1px solid #f3f4f6' }}>
                  <span style={{ width: 8, height: 8, borderRadius: '50%', background: dotColor(it.node, overrides[it.sourceKey]), flexShrink: 0 }} aria-hidden="true" />
                  <span style={{ flex: 1, fontSize: 12.5, fontWeight: 600, color: '#374151', minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={it.name}>{it.name}</span>
                  {c.key === 'ours'
                    ? <button type="button" onClick={manage} style={{ flexShrink: 0, fontSize: 11.5, fontWeight: 700, color: '#fff', background: GREEN, border: 'none', borderRadius: 999, padding: '3px 10px', cursor: 'pointer' }}>{mapped ? 'Manage' : 'Claim'}</button>
                    : it.url
                      ? <a href={it.url} target="_blank" rel="noopener noreferrer" onClick={() => markRequested(it)} style={{ flexShrink: 0, fontSize: 11.5, fontWeight: 700, color: GREEN, textDecoration: 'none' }}>Remove →</a>
                      : null}
                </div>
              ))}
            </div>
          );
        })}
      </div>

      {/* Legend */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px 14px', margin: '14px 0 0', fontSize: 11, color: '#6b7280' }}>
        <Dot c="#dc2626" /> Exposed <Dot c="#d97706" /> Removal requested <Dot c={GREEN} /> Removed / hidden <Dot c="#d1d5db" /> Not yet detected
      </div>
      <p style={{ margin: '10px 0 0', fontSize: 11.5, color: '#9ca3af', lineHeight: 1.5 }}>
        Remove opens each site's own opt-out form and tracks the request here. Data can re-list — we keep monitoring
        and flag re-appearances. Coverage grows as we scan more sources; automated removal is coming.
      </p>
    </div>
  );
}

function Dot({ c }) {
  return <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', background: c, marginRight: 2, verticalAlign: 'middle' }} aria-hidden="true" />;
}
