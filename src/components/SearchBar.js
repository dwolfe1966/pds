import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import styles from './SearchBar.module.css';
import { setSearchInput as gtmSetSearchInput } from '../services/gtmContext';

/**
 * Shared name-search bar — first name + last name + state.
 *
 * Backward compat: callers can still pass `initialQuery="John Smith"` and the
 * first token becomes firstName, the rest joins as lastName. Prefer the
 * explicit `initialFirstName` / `initialLastName` props.
 *
 * Emits URL: `/search-results?firstName=X&lastName=Y&state=ZZ`
 */
const SearchBar = ({ initialQuery = '', initialFirstName = '', initialLastName = '' }) => {
  // Seed from explicit first/last props when provided, otherwise split the
  // legacy `initialQuery` on whitespace so existing call-sites still work.
  const seed = (() => {
    if (initialFirstName || initialLastName) {
      return { f: initialFirstName, l: initialLastName };
    }
    const parts = (initialQuery || '').trim().split(/\s+/).filter(Boolean);
    if (parts.length === 0) return { f: '', l: '' };
    if (parts.length === 1) return { f: parts[0], l: '' };
    return { f: parts[0], l: parts.slice(1).join(' ') };
  })();

  const [firstName, setFirstName] = useState(seed.f);
  const [lastName, setLastName] = useState(seed.l);
  const [state, setState] = useState('');
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const usStates = [
    { value: '', label: 'State *' },
    { value: 'AL', label: 'AL' }, { value: 'AK', label: 'AK' }, { value: 'AZ', label: 'AZ' },
    { value: 'AR', label: 'AR' }, { value: 'CA', label: 'CA' }, { value: 'CO', label: 'CO' },
    { value: 'CT', label: 'CT' }, { value: 'DE', label: 'DE' }, { value: 'FL', label: 'FL' },
    { value: 'GA', label: 'GA' }, { value: 'HI', label: 'HI' }, { value: 'ID', label: 'ID' },
    { value: 'IL', label: 'IL' }, { value: 'IN', label: 'IN' }, { value: 'IA', label: 'IA' },
    { value: 'KS', label: 'KS' }, { value: 'KY', label: 'KY' }, { value: 'LA', label: 'LA' },
    { value: 'ME', label: 'ME' }, { value: 'MD', label: 'MD' }, { value: 'MA', label: 'MA' },
    { value: 'MI', label: 'MI' }, { value: 'MN', label: 'MN' }, { value: 'MS', label: 'MS' },
    { value: 'MO', label: 'MO' }, { value: 'MT', label: 'MT' }, { value: 'NE', label: 'NE' },
    { value: 'NV', label: 'NV' }, { value: 'NH', label: 'NH' }, { value: 'NJ', label: 'NJ' },
    { value: 'NM', label: 'NM' }, { value: 'NY', label: 'NY' }, { value: 'NC', label: 'NC' },
    { value: 'ND', label: 'ND' }, { value: 'OH', label: 'OH' }, { value: 'OK', label: 'OK' },
    { value: 'OR', label: 'OR' }, { value: 'PA', label: 'PA' }, { value: 'RI', label: 'RI' },
    { value: 'SC', label: 'SC' }, { value: 'SD', label: 'SD' }, { value: 'TN', label: 'TN' },
    { value: 'TX', label: 'TX' }, { value: 'UT', label: 'UT' }, { value: 'VT', label: 'VT' },
    { value: 'VA', label: 'VA' }, { value: 'WA', label: 'WA' }, { value: 'WV', label: 'WV' },
    { value: 'WI', label: 'WI' }, { value: 'WY', label: 'WY' },
  ];

  const handleSubmit = (e) => {
    e.preventDefault();
    setError('');
    if (!firstName.trim()) { setError('Please enter a first name.'); return; }
    if (!lastName.trim()) { setError('Please enter a last name.'); return; }
    if (!state) { setError('Please select a state.'); return; }
    gtmSetSearchInput({ firstName: firstName.trim(), lastName: lastName.trim(), state });
    const params = new URLSearchParams();
    params.set('firstName', firstName.trim());
    params.set('lastName', lastName.trim());
    params.set('state', state);
    navigate(`/search-results?${params.toString()}`);
  };

  const clearError = () => { if (error) setError(''); };

  return (
    <div>
      <form onSubmit={handleSubmit} className={styles.searchForm}>
        <input
          type="text"
          placeholder="First name"
          value={firstName}
          onChange={(e) => { setFirstName(e.target.value); clearError(); }}
          className={styles.searchInput}
          aria-label="First name"
          autoComplete="given-name"
          required
        />
        <input
          type="text"
          placeholder="Last name"
          value={lastName}
          onChange={(e) => { setLastName(e.target.value); clearError(); }}
          className={styles.searchInput}
          aria-label="Last name"
          autoComplete="family-name"
          required
        />
        <select
          value={state}
          onChange={(e) => { setState(e.target.value); clearError(); }}
          required
          aria-invalid={!!error}
          aria-label="State"
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
