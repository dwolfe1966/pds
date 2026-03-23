import React from 'react';

const STUB = [
  { date: '2025-09-08 10:12', user: 'Sa02d0ba', location: 'bc/admin/csr/tracking-view', type: 'tracking', uxc: 'm1xk35v8…', session: 'm1xk35v8…' },
  { date: '2025-09-08 10:10', user: 'Sa02d0ba', location: 'bc/admin/csr/mail-sent',     type: 'mail',     uxc: 'm1xk35v8…', session: 'm1xk35v8…' },
];

export default function TrackingPage() {
  // TODO BC API: no tracking logs endpoint in current spec
  return (
    <>
      <h1 className="page-title">Tracking Logs</h1>
      <div className="filter-bar">
        <label>Date<input type="date" /></label>
        <label>User<input type="text" placeholder="Filter by user" /></label>
        <label>Type<input type="text" placeholder="Filter by type" /></label>
        <button className="btn btn-primary">Search</button>
      </div>
      <table className="data-table">
        <thead><tr><th>Date</th><th>User</th><th>Location</th><th>Type</th><th>UXC</th><th>Session</th></tr></thead>
        <tbody>
          {STUB.map((t, i) => (
            <tr key={i}>
              <td>{t.date}</td><td>{t.user}</td><td>{t.location}</td>
              <td>{t.type}</td><td>{t.uxc}</td><td>{t.session}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  );
}
