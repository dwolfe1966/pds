import { useEffect } from 'react';

/**
 * Session-wide FUNNEL FLOW (search intent) — set by the landing page (`/name/landing/v#`, `/phone/...`,
 * etc.) and read across the ENTIRE session so every downstream surface (loader, SERP, SUP, payment,
 * report) can customize copy, modules, and offers to the intent the searcher arrived with.
 *
 * Intents: 'inmate' | 'divorce' | 'dating' | 'background' | ... (extend as landings are added).
 *
 * Lifecycle (owner 2026-07-18): a landing page sets its flow on mount, which OVERWRITES any prior flow —
 * so seeing a new landing URL naturally "clears" the old intent while the current one persists through the
 * rest of the session. Kept in sessionStorage (per-tab, cleared when the tab closes).
 */
const KEY = 'funnelFlow';

export function setFlow(flow) {
  try { if (flow) sessionStorage.setItem(KEY, String(flow)); else sessionStorage.removeItem(KEY); } catch { /* ignore */ }
}

export function getFlow() {
  try { return sessionStorage.getItem(KEY) || ''; } catch { return ''; }
}

export function clearFlow() {
  try { sessionStorage.removeItem(KEY); } catch { /* ignore */ }
}

export function isFlow(flow) { return getFlow() === flow; }

/**
 * Funnel VARIANT — the experience treatment layered on top of the search intent (`flow`). ONE slot, set at the
 * loader chokepoint every name search passes through, so choosing one treatment implicitly clears the others
 * (no sibling-boolean leak: an honest search followed by a proof search in the same tab can't carry both).
 *
 * Values: 'honest' | 'proof' | 'self' | '' (standard). Read downstream by PaymentPage (which disclosure/payoff
 * to show) and SignalTeaser (proof reveals one real fact in the clear; self frames records as the viewer's own).
 * Kept in sessionStorage (per-tab). Supersedes the old single 'honestFunnel' boolean.
 */
const VARIANT_KEY = 'funnelVariant';
export function setVariant(v) {
  try { if (v) sessionStorage.setItem(VARIANT_KEY, String(v)); else sessionStorage.removeItem(VARIANT_KEY); } catch { /* ignore */ }
}
export function getVariant() {
  try { return sessionStorage.getItem(VARIANT_KEY) || ''; } catch { return ''; }
}

// Onboarding-reveal session flag. The ?onboard=1 test param is set on a LANDING, but the reveal fires on the
// SERP — and the landing→loader→SERP hops rebuild query params, dropping it. So we PERSIST it to sessionStorage
// on the landing (per-tab) and read it on the SERP. A real per-flow variant would set onboarding via its
// campaign config; this makes the ?onboard=1 test carry through the whole funnel.
const ONBOARD_KEY = 'onboardReveal';
export function captureOnboardParam() {
  try { if (new URLSearchParams(window.location.search).has('onboard')) sessionStorage.setItem(ONBOARD_KEY, '1'); } catch { /* ignore */ }
}
export function onboardRevealOn() {
  try {
    if (sessionStorage.getItem(ONBOARD_KEY) === '1') return true;
    return new URLSearchParams(window.location.search).has('onboard');
  } catch { return false; }
}

/**
 * Landing-page hook: declare this landing's flow. Sets it on mount (overwriting any prior landing's flow),
 * so the whole session downstream knows the intent. Call once at the top of each landing component:
 *   useFunnelFlow('inmate');
 */
export function useFunnelFlow(flow) {
  useEffect(() => { setFlow(flow); captureOnboardParam(); }, [flow]);
}
