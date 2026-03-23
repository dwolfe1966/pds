import React, { useState } from 'react';

const STUB_EMAILS = [
  { _id: 'e1', owner: 'Agent A', customerId: 'CUS123', name: 'John Doe',   from: 'support@example.com', subject: 'Unable to login',   date: '2025-09-08', status: 'open' },
  { _id: 'e2', owner: 'Agent B', customerId: 'CUS124', name: 'Jane Smith', from: 'info@example.com',    subject: 'Billing question', date: '2025-09-07', status: 'open' },
];

export default function EmailsPage() {
  const [tab, setTab]     = useState('open');
  const [expanded, setExpanded] = useState(null);

  const emails = STUB_EMAILS.filter(e => e.status === tab || tab === 'all');

  return (
    <>
      <h1 className="page-title">Support Emails</h1>
      {/* TODO BC API: no email management endpoint in current spec — stub UI */}
      <div className="tabs">
        {['open', 'closed', 'deleted', 'all'].map(t => (
          <button key={t} className={`tab-btn${tab === t ? ' active' : ''}`} onClick={() => setTab(t)}>
            {t.charAt(0).toUpperCase() + t.slice(1)}
          </button>
        ))}
      </div>
      <table className="data-table">
        <thead><tr><th>Actions</th><th>Owner</th><th>Customer ID</th><th>Name</th><th>From</th><th>Subject</th><th>Date</th></tr></thead>
        <tbody>
          {emails.map(e => (
            <React.Fragment key={e._id}>
              <tr>
                <td><button className="btn btn-secondary btn-sm" onClick={() => setExpanded(expanded === e._id ? null : e._id)}>
                  {expanded === e._id ? 'Collapse' : 'Expand'}
                </button></td>
                <td>{e.owner}</td>
                <td>{e.customerId}</td>
                <td>{e.name}</td>
                <td>{e.from}</td>
                <td>{e.subject}</td>
                <td>{e.date}</td>
              </tr>
              {expanded === e._id && (
                <tr><td colSpan={7} style={{ background: '#f0faf6', padding: '1rem' }}>
                  <p className="mini-text">Email body placeholder. BC email management API endpoint not yet available.</p>
                </td></tr>
              )}
            </React.Fragment>
          ))}
          {emails.length === 0 && <tr><td colSpan={7} className="empty-state">No emails.</td></tr>}
        </tbody>
      </table>
    </>
  );
}
