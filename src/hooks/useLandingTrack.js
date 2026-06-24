import { useEffect } from 'react';
import { track, persistFunnelEntry } from '../services/trackingService';

/**
 * Fire-and-forget `landing_view` event on mount, and persist the funnel entry
 * point (search_type + variant) so every downstream/conversion event can be
 * attributed back to the ad-unit variant the user arrived on.
 * @param {string} searchType  'name' | 'phone' | 'email'
 * @param {string} variant     'v1' … 'v6'
 */
export function useLandingTrack(searchType, variant) {
  useEffect(() => {
    persistFunnelEntry(searchType, variant);
    track('landing_view', { search_type: searchType, variant });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
}
