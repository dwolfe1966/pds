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

const SURFACE_ORDER = ['idlookup', 'breach', 'data_broker', 'search_result', 'social_profile', 'public_record'];
const SURFACE_LABEL = {
  idlookup: 'IDLookup — our search', breach: 'Data breaches', data_broker: 'People-search sites',
  search_result: 'Search engines', social_profile: 'Social profiles', public_record: 'Public records',
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
    const list = catalog.map((r) => ({ sourceKey: r.source_key, surfaceType: r.surface_type, name: r.display_name, url: r.opt_out_url, node: nodesBySource[r.source_key] }));
    (graph.nodes || []).filter((n) => n.surface_type === 'breach').forEach((n) => {
      list.push({ sourceKey: n.source_key, surfaceType: 'breach', name: (n.exposure_detail && n.exposure_detail.breach) || n.source_key.replace('breach:', ''), url: null, node: n });
    });
    return list;
  }, [graph.registry, graph.nodes, nodesBySource]);

  const bySurface = useMemo(() => {
    const g = {}; items.forEach((it) => { (g[it.surfaceType] = g[it.surfaceType] || []).push(it); }); return g;
  }, [items]);

  const exposedCount = graph.summary?.exposed ?? 0;
  const controlledCount = graph.summary?.controlled ?? 0;
  const catalogSize = items.filter((it) => it.surfaceType !== 'idlookup').length;

  // Remove click: open the site's opt-out page AND mark the node requested (tracked in the graph).
  const onRemove = (it) => {
    if (it.url) { try { window.open(it.url, '_blank', 'noopener,noreferrer'); } catch { /* ignore */ } }
    setOverrides((o) => ({ ...o, [it.sourceKey]: 'optout_requested' }));
    setExposureControl({
      nodeId: it.node && it.node.id, sourceKey: it.sourceKey, surfaceType: it.surfaceType,
      controlStatus: 'optout_requested', controlMethod: 'manual',
    }).then((g) => { if (g && g.nodes) setGraph((prev) => ({ ...prev, nodes: g.nodes, summary: g.summary || prev.summary })); });
  };

  const removeBtn = (it) => (
    <button type="button" onClick={() => onRemove(it)}
      style={{ flexShrink: 0, fontSize: 12.5, fontWeight: 700, color: GREEN, background: 'none', border: '1px solid #bbf7d0', borderRadius: 999, padding: '5px 12px', cursor: 'pointer', whiteSpace: 'nowrap' }}>
      Remove →
    </button>
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

  // ── Full (top of My Identity) ──────────────────────────────────────────────
  return (
    <div style={{ border: '1px solid #d7ddd9', borderRadius: 14, padding: '20px 22px', background: '#fff', boxShadow: '0 2px 10px rgba(13,93,47,0.06)' }}>
      <div style={{ fontSize: 18, fontWeight: 800, color: '#111827' }}>Your Digital Footprint</div>
      <p style={{ margin: '4px 0 0', fontSize: 13, color: '#9ca3af', fontWeight: 600 }}>Where you're represented across the web</p>

      {/* Summary — real counts from the graph */}
      {(exposedCount + controlledCount) > 0 && (
        <div style={{ display: 'flex', gap: 22, marginTop: 14, marginBottom: 4 }}>
          <div><div style={{ fontSize: 26, fontWeight: 800, color: '#b91c1c' }}>{exposedCount}</div><div style={{ fontSize: 11.5, color: '#6b7280', fontWeight: 600 }}>Exposed</div></div>
          <div><div style={{ fontSize: 26, fontWeight: 800, color: GREEN }}>{controlledCount}</div><div style={{ fontSize: 11.5, color: '#6b7280', fontWeight: 600 }}>Under control</div></div>
        </div>
      )}

      <p style={{ margin: '12px 0 12px', fontSize: 13.5, color: '#4b5563', lineHeight: 1.55 }}>
        <strong>You can't delete yourself from the internet</strong> — data re-lists and re-appears. But you
        <strong> can take control</strong>: hide it where we can, and remove it site by site. Here's where you stand.
      </p>

      {SURFACE_ORDER.filter((s) => bySurface[s] && bySurface[s].length).map((surface) => (
        <div key={surface} style={{ marginTop: 14 }}>
          <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: '0.05em', textTransform: 'uppercase', color: '#9ca3af' }}>{SURFACE_LABEL[surface] || surface}</div>
          {bySurface[surface].map((it) => (
            <Row key={it.sourceKey} name={it.name}
              statusNode={surface === 'idlookup' && !mapped
                ? <span style={{ fontSize: 12.5, color: '#6b7280' }}>Claim your record to see &amp; control this</span>
                : statusFor(it.node, overrides[it.sourceKey], !!it.url)}
              action={
                surface === 'idlookup'
                  ? <button type="button" onClick={manage} style={{ flexShrink: 0, fontSize: 12.5, fontWeight: 700, color: '#fff', background: GREEN, border: 'none', borderRadius: 999, padding: '5px 14px', cursor: 'pointer', whiteSpace: 'nowrap' }}>{mapped ? 'Manage' : 'Claim'}</button>
                  : it.url ? removeBtn(it) : null
              }
            />
          ))}
        </div>
      ))}

      <p style={{ margin: '16px 0 0', fontSize: 11.5, color: '#9ca3af', lineHeight: 1.5 }}>
        Opt-out links open each site's own removal form. Clicking Remove tracks the request here. Removals can take
        days and data can re-list — we keep monitoring and will flag re-appearances. Automated removal across sites is coming.
      </p>
    </div>
  );
}
