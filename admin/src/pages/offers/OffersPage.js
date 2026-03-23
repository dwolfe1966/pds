import React, { useState } from 'react';

const STUB_OFFERS = [
  { _id: 'o1', name: 'Search Trial', trial: '$1.50 / 5 days', monthly: '$49.97', sup: false },
  { _id: 'o2', name: 'Sup Offer',    trial: '$5.00 / 7 days', monthly: '$59.97', sup: true },
];

export default function OffersPage() {
  const [search, setSearch] = useState('');
  // TODO BC API: no offers/products endpoint in current spec

  const offers = STUB_OFFERS.filter(o => !search || o.name.toLowerCase().includes(search.toLowerCase()));

  return (
    <>
      <h1 className="page-title">Offers &amp; Products</h1>
      <div className="filter-bar">
        <label>Search<input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="Search offers" /></label>
        <button className="btn btn-primary">+ Add</button>
      </div>
      <table className="data-table">
        <thead><tr><th>Offer Name</th><th>Trial</th><th>Monthly</th><th>Sup Offer</th><th>Actions</th></tr></thead>
        <tbody>
          {offers.map(o => (
            <tr key={o._id}>
              <td>{o.name}</td>
              <td>{o.trial}</td>
              <td>{o.monthly}</td>
              <td>{o.sup ? 'True' : 'False'}</td>
              <td><button className="btn btn-secondary btn-sm">Edit Offer</button></td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  );
}
