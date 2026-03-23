import React, { useState } from 'react';

const STUB = [
  { _id: 'MAIL123', date: '2025-09-09', brand: 'IDLookup', email: 'customer@example.com', status: 'Active' },
  { _id: 'MAIL124', date: '2025-09-08', brand: 'IDLookup', email: 'info@example.com',     status: 'Active' },
  { _id: 'MAIL125', date: '2025-09-07', brand: 'IDLookup', email: 'sales@example.com',    status: 'Active' },
];

export default function MailSentPage() {
  const [brand, setBrand]   = useState('');
  const [search, setSearch] = useState('');

  const items = STUB.filter(m =>
    (!brand  || m.brand === brand) &&
    (!search || m.email.includes(search))
  );

  return (
    <>
      <h1 className="page-title">Mail Sent</h1>
      {/* TODO BC API: mail sent endpoint not yet in spec */}
      <form className="filter-bar" onSubmit={e => e.preventDefault()}>
        <label>
          Brand
          <select value={brand} onChange={e => setBrand(e.target.value)}>
            <option value="">All</option>
            <option value="IDLookup">IDLookup</option>
            <option value="PrivateRecords">PrivateRecords</option>
          </select>
        </label>
        <label>Email<input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="Search email" /></label>
        <button type="submit" className="btn btn-primary">Search</button>
      </form>

      <table className="data-table">
        <thead><tr><th>ID</th><th>Date</th><th>Brand</th><th>Email</th><th>Status</th><th>Action</th></tr></thead>
        <tbody>
          {items.map(m => (
            <tr key={m._id}>
              <td>{m._id}</td>
              <td>{m.date}</td>
              <td>{m.brand}</td>
              <td>{m.email}</td>
              <td><span className="badge badge-success">{m.status}</span></td>
              <td><button className="btn btn-danger btn-sm">Unsubscribe</button></td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  );
}
