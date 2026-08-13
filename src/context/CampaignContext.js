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
import { push as gtmPush, setCampaign as gtmSetCampaign } from '../services/gtmContext';

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

  // shn/shl are intentionally KEPT in the URL (not stripped) so they survive the
  // campaign redirect and reach the tracking service from the landing URL.
  return { shn, shl };
}

// Persist resolved partner identity to sessionStorage so trackingService can
// stamp it into BC's data.refer (per-partner/channel reporting) and so GTM
// carries partner/channel. Re-runs on every campaign change (initial + BC-shape
// enriched).
function persistIdentity(campaign) {
  if (typeof sessionStorage === 'undefined') return;
  const id = (campaign && campaign.identity) || {};
  try {
    if (id.shnName) sessionStorage.setItem('attribution.shnName', id.shnName);
    if (id.partner) sessionStorage.setItem('attribution.partner', id.partner);
    if (id.channel) sessionStorage.setItem('attribution.channel', id.channel);
    // Derived refer attribution (partner-specific source/medium/campaign/partnerId) — stamped into BC
    // tracking data.refer + the order's commerceorders.refer by trackingService when the inbound link
    // carried no utm/refer_ of its own (e.g. shn-only HomeFacts links). JSON so it round-trips intact.
    if (id.refer && typeof id.refer === 'object') sessionStorage.setItem('attribution.refer', JSON.stringify(id.refer));
  } catch { /* sessionStorage unavailable */ }
  // Push the resolved partner identity into gtmContext so every dataLayer event
  // (incl. the post-payment `purchase` conversion) carries partnerName/partnerChannel.
  // The GTM Ads conversion tag GATES on these (Google/Search etc.) — without this,
  // shN-driven traffic (no UTM) reaches `purchase` with empty partner fields and the
  // conversion never fires. gtmSetCampaign maps name→partnerName, channel→partnerChannel.
  if (id.partner || id.channel) {
    gtmSetCampaign({ name: id.partner || undefined, channel: id.channel || undefined });
  }
}

export const CampaignProvider = ({ children }) => {
  const [campaign, setCampaign] = useState(() => {
    const { shn, shl } = captureAttribution();
    const resolved = resolveCampaign(shn, shl);
    // GTM partner-race fix: set partnerName/partnerChannel in gtmContext SYNCHRONOUSLY
    // here in the initializer — this runs during the provider's first render, BEFORE any
    // child mounts and BEFORE ScrollToTop fires the first `virtualPageview`. Without this,
    // partner attribution was set in a [campaign] effect that could run after the first
    // pageview, leaving the landing pageview without partner. (The async BC-shape enrich
    // below still refines it for subsequent events via persistIdentity.)
    try {
      const id = (resolved && resolved.identity) || {};
      if (id.partner || id.channel) gtmSetCampaign({ name: id.partner || undefined, channel: id.channel || undefined });
    } catch { /* never block render */ }
    // _shapeSettled: false until the BC shape resolves/fails/times-out. The `/` boot
    // redirect waits on this so it routes to the theme's A/B arm (v3a/v3b), not the
    // registry's static fallback (which is all that's known pre-shape).
    return { ...resolved, _shapeSettled: false };
  });

  useEffect(() => { persistIdentity(campaign); }, [campaign]);

  useEffect(() => {
    // Best-effort BC shape fetch to enrich the resolved campaign with partner/brand metadata
    // AND the A/B theme (landing/sup). Fire-and-forget — failure/timeout leaves the initial
    // registry resolution intact but still marks _shapeSettled so the boot redirect proceeds.
    let cancelled = false;
    const settle = () => { if (!cancelled) setCampaign((prev) => (prev._shapeSettled ? prev : { ...prev, _shapeSettled: true })); };
    // Backstop: never trap the boot redirect if the shape request hangs.
    const timer = setTimeout(settle, 2500);
    apiWrapper.getShapeCompiled()
      .then((shape) => {
        if (cancelled) return;
        const { shn, shl } = captureAttribution();
        const enriched = resolveCampaign(shn, shl, { shape });
        setCampaign({ ...enriched, _shapeSettled: true });
        // Mirror BC's OWN resolved partner attribution (tracking.partner.*, the source of truth) into
        // sessionStorage so trackingService reports BC's value VERBATIM — it can never diverge from or
        // override BC's automation because it IS BC's value. Falls back to our registry identity only
        // where BC has none (default/unconfigured shns). getShComp returns "" (not null/throw) when a
        // component is absent — so treat empty as absent. (accessor confirmed: comp.tracking.partner.*)
        try {
          const readComp = (k) => {
            try { const v = (shape && typeof shape.getShComp === 'function') ? shape.getShComp(k) : ''; return v || undefined; }
            catch { return undefined; }
          };
          const bcPartner = readComp('comp.tracking.partner.name');
          const bcChannel = readComp('comp.tracking.partner.channel');
          if (bcPartner) sessionStorage.setItem('attribution.bc.partner', bcPartner);
          if (bcChannel) sessionStorage.setItem('attribution.bc.channel', bcChannel);
          // Drift alarm: BC HAS a value AND it disagrees with our registry → surface it so we fix the
          // registry, not the tracking. With the registry currently proven consistent (all live shns
          // match BC's sheet), this should stay silent; it fires only if BC/registry drift apart.
          const id = (enriched && enriched.identity) || {};
          const differs = (a, b) => a && b && String(a).toLowerCase() !== String(b).toLowerCase();
          if (differs(bcPartner, id.partner) || differs(bcChannel, id.channel)) {
            gtmPush('partner_attribution_divergence', { shn, bcPartner, registryPartner: id.partner, bcChannel, registryChannel: id.channel });
          }
        } catch { /* never block render on attribution mirror */ }
        if (enriched._matchKey === 'default' && (shn || shl)) {
          // Visibility for marketing: flag campaigns that hit our site
          // without a registry entry, so we know to add or fix them.
          gtmPush('campaign_not_found', { shn, shl });
        }
      })
      .catch(() => { settle(); })
      .finally(() => { clearTimeout(timer); });
    return () => { cancelled = true; clearTimeout(timer); };
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
