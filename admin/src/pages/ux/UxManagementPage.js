import React, { useState } from 'react';

const STUB_CONFIGS = [
  { _id: 'ux1', name: 'default-private',   desc: 'Default people search config',         uxlId: '5e912345678901234567', status: 'Active' },
  { _id: 'ux2', name: 'abtest-incentive',  desc: 'People search A/B incentive',          uxlId: '5e8123abcdef012345678', status: 'Active' },
];

export default function UxManagementPage() {
  const [activeTab, setActiveTab] = useState('configs');
  // TODO BC API: no UX management endpoint in current spec

  return (
    <>
      <h1 className="page-title">UX Management</h1>
      <div className="tabs">
        {['configs', 'layouts', 'collections', 'components'].map(t => (
          <button key={t} className={`tab-btn${activeTab === t ? ' active' : ''}`} onClick={() => setActiveTab(t)}>
            UX {t.charAt(0).toUpperCase() + t.slice(1)}
          </button>
        ))}
      </div>

      {activeTab === 'configs' && (
        <table className="data-table">
          <thead><tr><th>Name</th><th>Description</th><th>UXL ID</th><th>Status</th><th>Actions</th></tr></thead>
          <tbody>
            {STUB_CONFIGS.map(c => (
              <tr key={c._id}>
                <td>{c.name}</td><td>{c.desc}</td><td><code style={{ fontSize: '0.75rem' }}>{c.uxlId}</code></td>
                <td><span className="badge badge-success">{c.status}</span></td>
                <td><button className="btn btn-secondary btn-sm">Edit</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {activeTab !== 'configs' && (
        <div className="card">
          <p className="mini-text">UX {activeTab} management — content will be loaded from BC API when endpoint is available.</p>
          <button className="btn btn-secondary btn-sm">+ Add</button>
        </div>
      )}
    </>
  );
}
