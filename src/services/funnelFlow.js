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
 * Landing-page hook: declare this landing's flow. Sets it on mount (overwriting any prior landing's flow),
 * so the whole session downstream knows the intent. Call once at the top of each landing component:
 *   useFunnelFlow('inmate');
 */
export function useFunnelFlow(flow) {
  useEffect(() => { setFlow(flow); }, [flow]);
}
