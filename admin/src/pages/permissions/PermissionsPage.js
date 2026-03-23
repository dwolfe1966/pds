import React from 'react';

const MODULES  = ['Customer', 'Orders', 'Payments', 'Content'];
const PERMS    = ['Create', 'Read', 'Update', 'Delete'];
const ROLES_DB = [{ name: 'Admin' }, { name: 'Orders Support' }, { name: 'Payments Editor' }, { name: 'Content' }];

export default function PermissionsPage() {
  // TODO BC API: no permissions endpoint in current spec
  return (
    <>
      <h1 className="page-title">Permissions Management</h1>
      <p className="mini-text" style={{ marginBottom: '1rem' }}>Assign roles and module permissions for staff members.</p>
      <div className="filter-bar">
        <label>Module<select><option value="">All Modules</option>{MODULES.map(m => <option key={m}>{m}</option>)}</select></label>
        <button className="btn btn-primary">Filter</button>
      </div>
      <table className="data-table">
        <thead>
          <tr>
            <th>Role</th><th>Module</th>
            {PERMS.map(p => <th key={p}>{p}</th>)}
          </tr>
        </thead>
        <tbody>
          {ROLES_DB.map(r => (
            <tr key={r.name}>
              <td>{r.name}</td>
              <td>{MODULES[0]}</td>
              {PERMS.map(p => <td key={p}><input type="checkbox" defaultChecked={p === 'Read'} /></td>)}
            </tr>
          ))}
        </tbody>
      </table>
      <div className="btn-row"><button className="btn btn-primary">Save Changes</button></div>
    </>
  );
}
