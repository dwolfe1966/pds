import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import styles from './SearchBar.module.css';

const SearchBar = ({ initialQuery = '' }) => {
  const [query, setQuery] = useState(initialQuery);
  const [state, setState] = useState('');
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const usStates = [
    { value: '', label: 'State *' },
    { value: 'AL', label: 'AL' },
    { value: 'AK', label: 'AK' },
    { value: 'AZ', label: 'AZ' },
    { value: 'AR', label: 'AR' },
    { value: 'CA', label: 'CA' },
    { value: 'CO', label: 'CO' },
    { value: 'CT', label: 'CT' },
    { value: 'DE', label: 'DE' },
    { value: 'FL', label: 'FL' },
    { value: 'GA', label: 'GA' },
    { value: 'HI', label: 'HI' },
    { value: 'ID', label: 'ID' },
    { value: 'IL', label: 'IL' },
    { value: 'IN', label: 'IN' },
    { value: 'IA', label: 'IA' },
    { value: 'KS', label: 'KS' },
    { value: 'KY', label: 'KY' },
    { value: 'LA', label: 'LA' },
    { value: 'ME', label: 'ME' },
    { value: 'MD', label: 'MD' },
    { value: 'MA', label: 'MA' },
    { value: 'MI', label: 'MI' },
    { value: 'MN', label: 'MN' },
    { value: 'MS', label: 'MS' },
    { value: 'MO', label: 'MO' },
    { value: 'MT', label: 'MT' },
    { value: 'NE', label: 'NE' },
    { value: 'NV', label: 'NV' },
    { value: 'NH', label: 'NH' },
    { value: 'NJ', label: 'NJ' },
    { value: 'NM', label: 'NM' },
    { value: 'NY', label: 'NY' },
    { value: 'NC', label: 'NC' },
    { value: 'ND', label: 'ND' },
    { value: 'OH', label: 'OH' },
    { value: 'OK', label: 'OK' },
    { value: 'OR', label: 'OR' },
    { value: 'PA', label: 'PA' },
    { value: 'RI', label: 'RI' },
    { value: 'SC', label: 'SC' },
    { value: 'SD', label: 'SD' },
    { value: 'TN', label: 'TN' },
    { value: 'TX', label: 'TX' },
    { value: 'UT', label: 'UT' },
    { value: 'VT', label: 'VT' },
    { value: 'VA', label: 'VA' },
    { value: 'WA', label: 'WA' },
    { value: 'WV', label: 'WV' },
    { value: 'WI', label: 'WI' },
    { value: 'WY', label: 'WY' },
  ];

  const handleSubmit = (e) => {
    e.preventDefault();
    setError('');
    if (!query.trim()) { setError('Please enter a name to search.'); return; }
    if (!state) { setError('Please select a state.'); return; }
    const params = new URLSearchParams();
    params.set('q', query);
    params.set('state', state);
    navigate(`/search-results?${params.toString()}`);
  };

  return (
    <div>
      <form onSubmit={handleSubmit} className={styles.searchForm}>
        <input
          type="text"
          placeholder="Name"
          value={query}
          onChange={(e) => { setQuery(e.target.value); if (error) setError(''); }}
          className={styles.searchInput}
          required
        />
        <select
          value={state}
          onChange={(e) => { setState(e.target.value); if (error) setError(''); }}
          required
          aria-invalid={!!error}
          className={styles.stateSelect}
        >
          {usStates.map((stateOption) => (
            <option key={stateOption.value} value={stateOption.value}>
              {stateOption.label}
            </option>
          ))}
        </select>
        <button type="submit" className={styles.searchButton}>
          Search Now
        </button>
      </form>
      {error && (
        <p style={{ color: '#b91c1c', fontSize: '0.875rem', margin: '0.5rem 0 0' }} role="alert">{error}</p>
      )}
    </div>
  );
};

export default SearchBar;