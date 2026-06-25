import { useEffect } from 'react';
import { track, persistFunnelEntry } from '../services/trackingService';

/**
 * Fire-and-forget `landing_view` event on mount, and persist the funnel entry
 * point (search_type + variant) so every downstream/conversion event can be
 * attributed back to the ad-unit variant the user arrived on.
 * @param {string} searchType  'name' | 'phone' | 'email'
 * @param {string} variant     'v1' … 'v6'
 * @param {boolean} enabled    default true; pass false to suppress the event +
 *   persistence (e.g. the generic HomePage when a campaign is about to redirect
 *   to a vertical LP — avoids a spurious `home/home` landing_view polluting the
 *   per-page funnel reporting before the real vertical landing_view fires).
 */
export function useLandingTrack(searchType, variant, enabled = true) {
  useEffect(() => {
    if (!enabled) return;
    persistFunnelEntry(searchType, variant);
    track('landing_view', { search_type: searchType, variant });
  }, [enabled]); // eslint-disable-line react-hooks/exhaustive-deps
}
