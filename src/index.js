import React from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import { AuthProvider } from './context/AuthContext';
import { ToastProvider } from './context/ToastContext';
import { CampaignProvider } from './context/CampaignContext';
import { initGtm, captureReferralParams } from './services/gtm';
import {
  setCampaign as gtmSetCampaign,
  setBcAttributionFromShape as gtmSetBcAttributionFromShape,
} from './services/gtmContext';
import apiWrapper from './services/apiWrapper';
import './styles/variables.css';
import './styles/base.css';
import './styles/contentContainer.css';

captureReferralParams();
initGtm();

// Capture shn/shl from URL and persist to sessionStorage BEFORE the BC IIFE
// initializes — `apiWrapper.getInstance()` reads sessionStorage for the
// `initialShParams` config. First-touch wins: once values are stored, later
// URL params with different shn/shl are ignored. URL is stripped after
// capture so shareable URLs stay clean.
try {
  const url = new URL(window.location.href);
  const sp = url.searchParams;
  const urlShn = sp.get('shn') || sp.get('shConId');
  const urlShl = sp.get('shl') || sp.get('shColId');
  if (urlShn && !sessionStorage.getItem('attribution.shn')) sessionStorage.setItem('attribution.shn', urlShn);
  if (urlShl && !sessionStorage.getItem('attribution.shl')) sessionStorage.setItem('attribution.shl', urlShl);
  if (sp.has('shn') || sp.has('shl') || sp.has('shConId') || sp.has('shColId')) {
    ['shn', 'shl', 'shConId', 'shColId'].forEach((k) => sp.delete(k));
    const newSearch = sp.toString();
    window.history.replaceState({}, '', url.pathname + (newSearch ? `?${newSearch}` : '') + url.hash);
  }
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