import React, { useState } from 'react';
import api from '../../api';
import { useAuth } from '../../context/AuthContext';
import { setSearchContext } from '../../services/searchContext';

/**
 * Enhanced people search page for authenticated members.
 */
const SearchPage = () => {
  const { token } = useAuth();
  const [form, setForm] = useState({ name: '', state: '' });
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const usStates = [
    { value: '', label: 'Select State (Optional)' },
    { value: 'AL', label: 'Alabama' },
    { value: 'AK', label: 'Alaska' },
    { value: 'AZ', label: 'Arizona' },
    { value: 'AR', label: 'Arkansas' },
    { value: 'CA', label: 'California' },
    { value: 'CO', label: 'Colorado' },
    { value: 'CT', label: 'Connecticut' },
    { value: 'DE', label: 'Delaware' },
    { value: 'FL', label: 'Florida' },
    { value: 'GA', label: 'Georgia' },
    { value: 'HI', label: 'Hawaii' },
    { value: 'ID', label: 'Idaho' },
    { value: 'IL', label: 'Illinois' },
    { value: 'IN', label: 'Indiana' },
    { value: 'IA', label: 'Iowa' },
    { value: 'KS', label: 'Kansas' },
    { value: 'KY', label: 'Kentucky' },
    { value: 'LA', label: 'Louisiana' },
    { value: 'ME', label: 'Maine' },
    { value: 'MD', label: 'Maryland' },
    { value: 'MA', label: 'Massachusetts' },
    { value: 'MI', label: 'Michigan' },
    { value: 'MN', label: 'Minnesota' },
    { value: 'MS', label: 'Mississippi' },
    { value: 'MO', label: 'Missouri' },
    { value: 'MT', label: 'Montana' },
    { value: 'NE', label: 'Nebraska' },
    { value: 'NV', label: 'Nevada' },
    { value: 'NH', label: 'New Hampshire' },
    { value: 'NJ', label: 'New Jersey' },
    { value: 'NM', label: 'New Mexico' },
    { value: 'NY', label: 'New York' },
    { value: 'NC', label: 'North Carolina' },
    { value: 'ND', label: 'North Dakota' },
    { value: 'OH', label: 'Ohio' },
    { value: 'OK', label: 'Oklahoma' },
    { value: 'OR', label: 'Oregon' },
    { value: 'PA', label: 'Pennsylvania' },
    { value: 'RI', label: 'Rhode Island' },
    { value: 'SC', label: 'South Carolina' },
    { value: 'SD', label: 'South Dakota' },
    { value: 'TN', label: 'Tennessee' },
    { value: 'TX', label: 'Texas' },
    { value: 'UT', label: 'Utah' },
    { value: 'VT', label: 'Vermont' },
    { value: 'VA', label: 'Virginia' },
    { value: 'WA', label: 'Washington' },
    { value: 'WV', label: 'West Virginia' },
    { value: 'WI', label: 'Wisconsin' },
    { value: 'WY', label: 'Wyoming' },
  ];

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

      const searchParams = {
        firstName,
        lastName,
        type: 'name'
      };
      if (form.state && form.state.trim()) {
        searchParams.state = form.state.trim();
      }
      
      const response = await api.searchPeople(searchParams);
      // Response is already adapted: { data: [...], pagination: {...}, searchContext: {...} }
      setResults(response.data || []);
      
      // Store search context for report creation
      if (response.searchContext) {
        setSearchContext(response.searchContext);
      }

    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <main style={{ padding: '2rem' }}>
      <h1>People Search</h1>
      <form
        onSubmit={handleSubmit}
        style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', marginBottom: '1rem' }}
      >
        <input type="text" name="name" placeholder="Full Name (First Last)" value={form.name} onChange={handleChange} required />
        <select 
          name="state" 
          value={form.state} 
          onChange={handleChange}
          style={{ padding: '0.5rem', fontSize: '1rem', border: '1px solid #d1d5db', borderRadius: '0.375rem' }}
        >
          {usStates.map((stateOption) => (
            <option key={stateOption.value} value={stateOption.value}>
              {stateOption.label}
            </option>
          ))}
        </select>
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