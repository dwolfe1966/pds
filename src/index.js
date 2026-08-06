import React from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import { AuthProvider } from './context/AuthContext';
import { ToastProvider } from './context/ToastContext';
import { CampaignProvider } from './context/CampaignContext';
import { captureReferralParams } from './services/gtm';
import {
  setCampaign as gtmSetCampaign,
  setBcAttributionFromShape as gtmSetBcAttributionFromShape,
} from './services/gtmContext';
import apiWrapper from './services/apiWrapper';
import './styles/variables.css';
import './styles/base.css';
import './styles/contentContainer.css';

captureReferralParams();
// Onboarding-reveal test flag: persist ?onboard=1 synchronously at entry (before any
// render/redirect) so it survives the landing→loader→SERP hops and the SERP can read it.
try { if (new URLSearchParams(window.location.search).has('onboard')) sessionStorage.setItem('onboardReveal', '1'); } catch { /* ignore */ }
// NOTE: GTM is loaded by the per-brand snippet in public/index.html (maps
// hostname → container). We intentionally do NOT call a second JS loader here —
// doing so double-loaded GTM (and loaded the dev container on prod via
// REACT_APP_GTM_ID), double-counting Google Ads conversions.

// Capture shn/shl from URL and persist to sessionStorage BEFORE the BC IIFE
// initializes — `apiWrapper.getInstance()` reads sessionStorage for the
// `initialShParams` config. First-touch wins: once values are stored, later
// URL params with different shn/shl are ignored. shn/shl are NOT stripped from
// the URL — they must survive the campaign redirect to reach the tracking service.
try {
  const url = new URL(window.location.href);
  const sp = url.searchParams;
  const urlShn = sp.get('shn') || sp.get('shConId');
  const urlShl = sp.get('shl') || sp.get('shColId');
  // Durable first-touch shn/shl (60-day TTL). sessionStorage alone is per-tab/session, so a checkout in a
  // new tab or on a return visit lost the shn (~7% of orders had none; owner 2026-08-06). Mirror the
  // first-touch shn to localStorage and REHYDRATE sessionStorage from it when this session lost it — purely
  // additive, so every existing sessionStorage read (apiWrapper.setShapeParams, CampaignContext, GTM) is unchanged.
  const SHN_TTL_MS = 60 * 24 * 60 * 60 * 1000; // 60 days
  try {
    const ts = parseInt(localStorage.getItem('attribution.shn.ts') || '0', 10);
    const fresh = ts && (Date.now() - ts) < SHN_TTL_MS;
    if (ts && !fresh) {                       // expired → drop stale attribution
      localStorage.removeItem('attribution.shn.durable');
      localStorage.removeItem('attribution.shl.durable');
      localStorage.removeItem('attribution.shn.ts');
    } else if (fresh && !sessionStorage.getItem('attribution.shn')) { // this session lost it → recover
      const dShn = localStorage.getItem('attribution.shn.durable');
      const dShl = localStorage.getItem('attribution.shl.durable');
      if (dShn) sessionStorage.setItem('attribution.shn', dShn);
      if (dShl) sessionStorage.setItem('attribution.shl', dShl);
    }
  } catch { /* storage unavailable */ }

  // First-touch persistence: only set if not already present (rehydrate above may have filled it).
  if (urlShn && !sessionStorage.getItem('attribution.shn')) sessionStorage.setItem('attribution.shn', urlShn);
  if (urlShl && !sessionStorage.getItem('attribution.shl')) sessionStorage.setItem('attribution.shl', urlShl);
  // Durable first-touch mirror — only if none stored yet, so the FIRST shn wins for the full 60-day window.
  try {
    if (urlShn && !localStorage.getItem('attribution.shn.durable')) {
      localStorage.setItem('attribution.shn.durable', urlShn);
      if (urlShl) localStorage.setItem('attribution.shl.durable', urlShl);
      localStorage.setItem('attribution.shn.ts', String(Date.now()));
    }
  } catch { /* storage unavailable */ }
  // One-shot landing-redirect flag — set ONLY when `/` is loaded with attribution
  // params (the redirect only fires from `/`), cleared by HomePageRedirect after a
  // single use. Gated to pathname '/' so that — now that shn stays in the URL — a
  // reload of a landing page (/name/landing/vN?shn=…) doesn't re-arm the redirect and
  // bounce a later homepage visit.
  if ((urlShn || urlShl) && url.pathname === '/') {
    sessionStorage.setItem('attribution.landingPending', '1');
  }
  // shn/shl are intentionally LEFT in the URL (not stripped) so they survive the
  // campaign redirect (/?shn=… → /name/landing/vN?shn=…) and reach the tracking
  // service from the landing URL. First-touch is already captured above.
} catch {}

// Seed partnerChannel / partnerName from URL on first boot. `?c=<key>` is the
// future campaign-config primary; UTM params are the fallback while the
// campaign registry is being built out. Persisted in sessionStorage by
// gtmContext so navigation preserves the attribution.
try {
  const params = new URLSearchParams(window.location.search);
  const campaignKey = params.get('c');
  const utmSource = params.get('utm_source');
  const utmCampaign = params.get('utm_campaign');
  if (campaignKey || utmSource || utmCampaign) {
    gtmSetCampaign({
      channel: utmSource || (campaignKey ? campaignKey.split('-')[0] : undefined),
      name: utmCampaign || campaignKey || undefined,
    });
  }
} catch {}

// Pull BC visitor-level attribution from ShapeCompiled and seed shn/shl/shnName.
// Fire-and-forget — must not block render if the IIFE is slow or unavailable.
// IIFE is now initialized with the shn/shl from sessionStorage above, so the
// shape will be cascade-resolved for the right partner/page combo.
apiWrapper.getShapeCompiled()
  .then((shape) => gtmSetBcAttributionFromShape(shape))
  .catch(() => { /* shape unavailable — response-walker fallback still captures */ });

const container = document.getElementById('root');
const root = createRoot(container);

root.render(
  <React.StrictMode>
    <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <AuthProvider>
        <CampaignProvider>
          <ToastProvider>
            <App />
          </ToastProvider>
        </CampaignProvider>
      </AuthProvider>
    </BrowserRouter>
  </React.StrictMode>
);