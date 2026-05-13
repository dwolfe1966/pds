import React from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import { AuthProvider } from './context/AuthContext';
import { ToastProvider } from './context/ToastContext';
import { initGtm, captureReferralParams } from './services/gtm';
import { setCampaign as gtmSetCampaign } from './services/gtmContext';
import './styles/variables.css';
import './styles/base.css';
import './styles/contentContainer.css';

captureReferralParams();
initGtm();

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

const container = document.getElementById('root');
const root = createRoot(container);

root.render(
  <React.StrictMode>
    <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <AuthProvider>
        <ToastProvider>
          <App />
        </ToastProvider>
      </AuthProvider>
    </BrowserRouter>
  </React.StrictMode>
);