import React from 'react';

const STUB = [
  { ts: '2025-09-09 10:14:37', level: 'INFO',  user: '68bf7d…', message: 'User called API /admin/csr/tracking-view', req: '{"user":"support","action":"view"}', res: '{"status":"ok"}' },
  { ts: '2025-09-09 10:10:53', level: 'WARN',  user: 'system',  message: 'Email service unreachable for t1@gmail.com', req: '{"action":"send"}', res: '{"status":"error"}' },
];

export default function LogsPage() {
  // TODO BC API: no system logs endpoint in current spec
  return (
    <>
      <h1 className="page-title">System Logs</h1>
      <p className="mini-text" style={{ marginBottom: '1rem' }}>Review raw log entries for debugging.</p>
      <div className="log-accordion">
        {STUB.map((l, i) => (
          <details key={i} style={{ marginBottom: '0.75rem' }}>
            <summary style={{ cursor: 'pointer', padding: '0.6rem', background: '#f0faf6', borderRadius: 4 }}>
              <span style={{ marginRight: '1rem', color: l.level === 'WARN' ? '#d69e2e' : '#017a53', fontWeight: 600 }}>{l.level}</span>
              <span style={{ marginRight: '1rem', color: '#718096', fontSize: '0.8rem' }}>{l.ts}</span>
              {l.message}
            </summary>
            <div style={{ padding: '0.75rem', background: '#f7fafc', fontSize: '0.8rem', fontFamily: 'monospace' }}>
              <strong>User:</strong> {l.user}<br />
              <strong>Request:</strong> {l.req}<br />
              <strong>Response:</strong> {l.res}
            </div>
          </details>
        ))}
      </div>
    </>
  );
}
