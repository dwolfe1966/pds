import React from 'react';

const STUB = [
  { name: 'Alex Smith',  email: 'alex@idlookup.ai',  timeIn: '09:00', status: 'Online', today: '4h', weekly: '20h', yesterday: '8h' },
  { name: 'Jamie Doe',   email: 'jamie@idlookup.ai', timeIn: '10:00', status: 'Break',  today: '3h', weekly: '15h', yesterday: '7h' },
];

export default function TimesheetsPage() {
  // TODO BC API: no timesheets endpoint in current spec
  return (
    <>
      <h1 className="page-title">Customer Support Timesheets</h1>
      <div className="filter-bar">
        <label>Week starting <input type="date" /></label>
        <button className="btn btn-primary">Load</button>
      </div>
      <table className="data-table">
        <thead><tr><th>Name</th><th>Contact</th><th>Time In</th><th>Status</th><th>Hours Today</th><th>Weekly Hours</th><th>Hours Yesterday</th></tr></thead>
        <tbody>
          {STUB.map((s, i) => (
            <tr key={i}>
              <td>{s.name}</td><td>{s.email}</td><td>{s.timeIn}</td>
              <td><span className={`badge badge-${s.status === 'Online' ? 'success' : 'warning'}`}>{s.status}</span></td>
              <td>{s.today}</td><td>{s.weekly}</td><td>{s.yesterday}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  );
}
