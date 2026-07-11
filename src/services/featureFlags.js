/**
 * Manual feature flags — default OFF.
 *
 * Owner decision (2026-07-11): the BeenVerified-style optional funnel flow ships
 * behind a MANUAL flag, off by default, for internal/manual testing FIRST — no
 * automatic live A/B split until it's validated. See
 * docs/design/funnel-mimic-plan.md ("optional flow" spec).
 *
 * A flag can be force-enabled for the current tab via a URL query param so QA can
 * exercise it on any environment without a rebuild:
 *   ?flow=bv    → enable the BV flow for this tab (sticky until ?flow=off)
 *   ?flow=off   → clear the override
 * Otherwise it falls back to the build-time env default (REACT_APP_ENABLE_BV_FLOW).
 */

const BV_SESSION_KEY = 'ff.bvFlow';

/** Apply any ?flow= override present on the current URL to sticky session state. */
function syncBvOverrideFromUrl() {
  try {
    const flow = new URLSearchParams(window.location.search).get('flow');
    if (flow === 'bv') sessionStorage.setItem(BV_SESSION_KEY, '1');
    else if (flow === 'off') sessionStorage.removeItem(BV_SESSION_KEY);
  } catch { /* SSR / storage disabled */ }
}

/**
 * Is the BeenVerified-style optional funnel flow enabled?
 * Priority: per-tab URL/session override → build-time env default (off).
 */
export function isBvFlowEnabled() {
  if (typeof window === 'undefined') return false;
  syncBvOverrideFromUrl();
  try {
    if (sessionStorage.getItem(BV_SESSION_KEY) === '1') return true;
  } catch { /* ignore */ }
  return process.env.REACT_APP_ENABLE_BV_FLOW === 'true';
}
