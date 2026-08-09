// Shared config (loaded in the service worker via importScripts, in the popup/bridge via <script>/content).
// The app-key only gates the endpoint against casual scraping — it's the same public key the web app ships.
self.IDL_CONFIG = {
  appKey: 'JQV5HXGO80RIGE9XRSPI',
  historyUrl: 'https://idlookup.me/api/history',
  detectionUrl: 'https://idlookup.me/api/exposure-detection',
  privacyUrl: 'https://idlookup.me/extension-privacy',
  consentVersion: '2026-08-08',
};
