import { useEffect } from 'react';
import { track } from '../services/trackingService';

/**
 * Fire-and-forget `landing_view` event on mount.
 * @param {string} searchType  'name' | 'phone' | 'email'
 * @param {string} variant     'v1' … 'v6'
 */
export function useLandingTrack(searchType, variant) {
  useEffect(() => {
    track('landing_view', { search_type: searchType, variant });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
}
