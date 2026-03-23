import React from 'react';

const STUB = [
  { date: '8/29/25 1:31 PM',  worldId: '65b8288…71cfd', uxcId: '5e4a70c2…750eb5e', uxlId: '572c5…fbob', desc: 'People search – A/B flow incentive test', split: 'CasX – $1.50 Trial', cascade: 'cascade / N/A' },
  { date: '2/10/24 7:48 AM',  worldId: '65b8288…71cfd', uxcId: '5e57b26…bdb61',   uxlId: '50c096…aaa',  desc: 'PS name search CPA wall',                split: 'CasX – $1.50 Trial', cascade: 'default / 0' },
];

export default function UxcHistoryPage() {
  // TODO BC API: no UXC history endpoint in current spec
  return (
    <>
      <h1 className="page-title">UXC History</h1>
      <div className="filter-bar">
        <label>From<input type="date" /></label>
        <label>To<input type="date" /></label>
        <label>UXC<input type="text" placeholder="Filter by UXC ID" /></label>
        <button className="btn btn-primary">Search</button>
      </div>
      <table className="data-table">
        <thead><tr><th>Date/Time</th><th>World ID</th><th>UXC ID</th><th>UXL ID</th><th>Description</th><th>Split Info</th><th>Cascade/Status</th></tr></thead>
        <tbody>
          {STUB.map((r, i) => (
            <tr key={i}>
              <td style={{ whiteSpace: 'nowrap' }}>{r.date}</td>
              <td><code style={{ fontSize: '0.73rem' }}>{r.worldId}</code></td>
              <td><code style={{ fontSize: '0.73rem' }}>{r.uxcId}</code></td>
              <td><code style={{ fontSize: '0.73rem' }}>{r.uxlId}</code></td>
              <td>{r.desc}</td>
              <td>{r.split}</td>
              <td>{r.cascade}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  );
}
