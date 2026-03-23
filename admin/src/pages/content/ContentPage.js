import React, { useState } from 'react';

const STUB_ITEMS = [
  { _id: 'c1', key: 'inmate.state.al', title: 'Inmate Resources', body: 'Provide important information here...', help: 'content editor tips', about: 'privacy policy' },
];

export default function ContentPage() {
  const [items] = useState(STUB_ITEMS);
  const [editing, setEditing] = useState(null);
  const [msg, setMsg] = useState('');

  // TODO BC API: no content management endpoint in current spec

  const save = () => { setMsg('Saved (stub).'); setEditing(null); };

  return (
    <>
      <h1 className="page-title">Content Management</h1>
      <div className="filter-bar">
        <label>Search <input type="text" placeholder="Search content items" /></label>
        <button className="btn btn-primary">+ Add New</button>
      </div>
      {msg && <div className="success-msg">{msg}</div>}
      {items.map(item => (
        <div key={item._id} className="card" style={{ marginBottom: '1rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <p style={{ margin: 0, fontWeight: 600 }}>{item.title}</p>
              <p className="mini-text">Key: {item.key} &nbsp;|&nbsp; Help: {item.help} &nbsp;|&nbsp; About: {item.about}</p>
            </div>
            <button className="btn btn-secondary btn-sm" onClick={() => setEditing(item._id === editing ? null : item._id)}>Edit</button>
          </div>
          {editing === item._id && (
            <div style={{ marginTop: '0.75rem' }}>
              <textarea defaultValue={item.body} style={{ width: '100%' }} rows={4} />
              <div className="btn-row"><button className="btn btn-primary" onClick={save}>Save</button></div>
            </div>
          )}
        </div>
      ))}
    </>
  );
}
