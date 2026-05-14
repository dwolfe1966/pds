/**
 * CampaignContext — exposes the resolved campaign config for the current
 * visitor session. Read by pages that customize UX based on the campaign:
 * SearchResultsPage (perPage, headline), SearchDetailPreviewPage (variant),
 * Signup pages (which fields to show), PaymentPage (offer + payment methods).
 *
 * Resolution happens once on mount (first-touch attribution per the design
 * decision on 2026-05-14). Subsequent navigation reads the same config from
 * the provider — sessionStorage holds shn/shl across reloads.
 */

import React, { createContext, useContext, useEffect, useState } from 'react';
import apiWrapper from '../services/apiWrapper';
import { resolveCampaign } from '../services/campaignResolver';
import { push as gtmPush } from '../services/gtmContext';

const SHN_KEY = 'attribution.shn';
const SHL_KEY = 'attribution.shl';

const CampaignContext = createContext(null);

/**
 * Capture shn/shl from URL (or sessionStorage, first-touch). Strips them
 * from the visible URL after capture so subsequent shares/bookmarks don't
 * inherit attribution. Accepts either BC's native names or our short
 * forms — params not present remain `null`.
 */
function captureAttribution() {
  if (typeof window === 'undefined') return { shn: null, shl: null };
  const url = new URL(window.location.href);
  const params = url.searchParams;
  const urlShn = params.get('shn') || params.get('shConId');
  const urlShl = params.get('shl') || params.get('shColId');

  // First-touch wins: if sessionStorage already has values, keep them.
  let shn = null;
  let shl = null;
  try {
    shn = sessionStorage.getItem(SHN_KEY) || urlShn || null;
    shl = sessionStorage.getItem(SHL_KEY) || urlShl || null;
    if (shn && !sessionStorage.getItem(SHN_KEY)) sessionStorage.setItem(SHN_KEY, shn);
    if (shl && !sessionStorage.getItem(SHL_KEY)) sessionStorage.setItem(SHL_KEY, shl);
  } catch {
    shn = urlShn;
    shl = urlShl;
  }

  // Strip from URL after capture (cleaner shareable URLs; downstream
  // tracking already has the values via sessionStorage + gtmContext + BC).
  const hadAny = params.has('shn') || params.has('shl') || params.has('shConId') || params.has('shColId');
  if (hadAny) {
    ['shn', 'shl', 'shConId', 'shColId'].forEach((k) => params.delete(k));
    const newSearch = params.toString();
    const newUrl = url.pathname + (newSearch ? `?${newSearch}` : '') + url.hash;
    try { window.history.replaceState({}, '', newUrl); } catch {}
  }

  return { shn, shl };
}

export const CampaignProvider = ({ children }) => {
  const [campaign, setCampaign] = useState(() => {
    const { shn, shl } = captureAttribution();
    return resolveCampaign(shn, shl);
  });

  useEffect(() => {
    // Best-effort BC shape fetch to enrich the resolved campaign with
    // partner/brand metadata. Fire-and-forget — failure leaves the
    // initial resolution intact (which uses local registry + defaults).
    let cancelled = false;
    apiWrapper.getShapeCompiled()
      .then((shape) => {
        if (cancelled) return;
        const { shn, shl } = captureAttribution();
        const enriched = resolveCampaign(shn, shl, { shape });
        setCampaign(enriched);
        if (enriched._matchKey === 'default' && (shn || shl)) {
          // Visibility for marketing: flag campaigns that hit our site
          // without a registry entry, so we know to add or fix them.
          gtmPush('campaign_not_found', { shn, shl });
        }
      })
      .catch(() => { /* shape unavailable — keep initial */ });
    return () => { cancelled = true; };
  }, []);

  return (
    <CampaignContext.Provider value={campaign}>
      {children}
    </CampaignContext.Provider>
  );
};

/** Read the active campaign config. Always returns a resolved object
 *  (never null) — `default` config is the floor. */
export function useCampaign() {
  const ctx = useContext(CampaignContext);
  if (ctx) return ctx;
  // Fallback when used outside a provider (e.g., tests) — return resolved default.
  return resolveCampaign(null, null);
}
