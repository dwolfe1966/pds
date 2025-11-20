import React, { useState } from 'react';
import api from '../api';
import { useAuth } from '../context/AuthContext';

const SearchPage = () => {
  const { token } = useAuth();
  const [form, setForm] = useState({ name: '', phone: '', email: '', address: '' });
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      // Parse name into firstName and lastName
      const nameParts = form.name.trim().split(/\s+/);
      const firstName = nameParts[0] || '';
      const lastName = nameParts.slice(1).join(' ') || '';
      
      if (!firstName || !lastName) {
        setError('Please enter both first and last name');
        setLoading(false);
        return;
      }

      const params = {
        firstName,
        lastName,
        zip: form.address ? form.address.match(/\d{5}/)?.[0] : undefined,
      };
      const response = await api.get('/search', { params, token });
      setResults(response.data || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <main style={{ padding: '2rem' }}>
      <h1>People Search</h1>
      <form onSubmit={handleSubmit} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', marginBottom: '1rem' }}>
        <input type="text" name="name" placeholder="Name" value={form.name} onChange={handleChange} />
        <input type="text" name="phone" placeholder="Phone" value={form.phone} onChange={handleChange} />
        <input type="email" name="email" placeholder="Email" value={form.email} onChange={handleChange} />
        <input type="text" name="address" placeholder="Address" value={form.address} onChange={handleChange} />
        <button type="submit" style={{ padding: '0.5rem 1rem' }} disabled={loading}>
          {loading ? 'Searching…' : 'Search'}
        </button>
      </form>
      {error && <p style={{ color: 'red' }}>{error}</p>}
      {results.length > 0 && (
        <div>
          <h2>Results</h2>
          <ul style={{ listStyle: 'none', padding: 0 }}>
            {results.map((r) => (
              <li key={r.id} style={{ borderBottom: '1px solid #eee', padding: '0.5rem 0' }}>
                {r.fullName} – {r.location}
              </li>
            ))}
          </ul>
        </div>
      )}
    </main>
  );
};

export default SearchPage;