import React from 'react';
import { FOUNDATIONAL, FOUNDATIONAL_CAVEAT } from '../services/foundationalProviders';

const GREEN = '#0d5d2f';

/**
 * "Foundational sources" — the wholesale, high-stakes data providers (LexisNexis, TransUnion) that set your
 * insurance rate and gate your loan / apartment / job. Distinct from the retail broker list: their levers
 * are freeze / dispute / suppress (regulated), grouped into two honest jobs. Copy states the real degree —
 * this is the differentiated, competitors-skip-it tier — see docs/product/foundational-data-providers.md.
 */
export default function FoundationalSources() {
  return (
    <div style={{ border: '1px solid #d7ddd9', background: '#fff', borderRadius: 14, padding: '18px 20px', marginTop: 12 }}>
      <div style={{ fontSize: 16, fontWeight: 800, color: '#111827' }}>Foundational sources <span style={{ fontSize: 11, fontWeight: 800, color: '#7c2d12', background: '#fff7ed', border: '1px solid #fed7aa', borderRadius: 999, padding: '1px 8px', verticalAlign: 'middle' }}>HIGH IMPACT</span></div>
      <p style={{ margin: '4px 0 10px', fontSize: 13, color: '#4b5563', lineHeight: 1.55 }}>
        The wholesale providers behind your insurance rate, background checks, and lending decisions. Acting
        here is higher-leverage than any single people-search site — and it’s where most services never take you.
      </p>
      <div style={{ fontSize: 12, color: '#6b7280', background: '#f9fafb', border: '1px solid #eef2f0', borderRadius: 8, padding: '8px 11px', marginBottom: 14, lineHeight: 1.5 }}>{FOUNDATIONAL_CAVEAT}</div>

      <div style={{ display: 'grid', gap: 14 }}>
        {FOUNDATIONAL.map((p) => (
          <div key={p.key} style={{ border: '1px solid #e5e7eb', borderRadius: 12, overflow: 'hidden' }}>
            <div style={{ padding: '11px 14px', background: '#f0fdf4', borderBottom: '1px solid #dcfce7' }}>
              <div style={{ fontSize: 15, fontWeight: 800, color: '#111827' }}>{p.name}</div>
              <div style={{ fontSize: 12, color: '#4b5563', marginTop: 1 }}>{p.blurb}</div>
            </div>
            <div style={{ padding: '10px 14px', display: 'flex', flexDirection: 'column', gap: 12 }}>
              {p.jobs.map((job) => (
                <div key={job.id}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 13, fontWeight: 800, color: job.tone === 'strong' ? GREEN : '#92400e' }}>{job.title}</span>
                  </div>
                  <div style={{ fontSize: 11.5, color: '#6b7280', margin: '1px 0 7px' }}>{job.lead}</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {job.actions.map((a) => (
                      <div key={a.label} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '8px 0', borderTop: '1px solid #f3f4f6' }}>
                        <span style={{ flex: 1, minWidth: 0 }}>
                          <span style={{ display: 'block', fontSize: 13, fontWeight: 700, color: '#111827' }}>
                            {a.label}
                            {a.badge && <span style={{ marginLeft: 6, fontSize: 10, fontWeight: 800, color: GREEN, background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 999, padding: '0 6px' }}>{a.badge}</span>}
                          </span>
                          <span style={{ display: 'block', fontSize: 12, color: '#4b5563', marginTop: 2, lineHeight: 1.45 }}>{a.effect}</span>
                          {a.gate && <span style={{ display: 'block', fontSize: 11, color: '#92400e', marginTop: 3, lineHeight: 1.4 }}>⚠ {a.gate}</span>}
                          {a.recheck && <span style={{ display: 'block', fontSize: 11, color: '#6b7280', marginTop: 3, lineHeight: 1.4 }}>⏱ {a.recheck}</span>}
                        </span>
                        <a href={a.url} target="_blank" rel="noopener noreferrer"
                          style={{ flexShrink: 0, fontSize: 12, fontWeight: 800, color: '#fff', background: GREEN, borderRadius: 8, padding: '7px 13px', textDecoration: 'none', whiteSpace: 'nowrap' }}>
                          Do this →
                        </a>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
