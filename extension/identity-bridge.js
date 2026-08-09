// Runs on idlookup.ai / idlookup.me. Reads the member's already-claimed identity + removal profile from
// the page's localStorage (same origin) and syncs it into the extension's local storage, so the opt-out
// autofill on broker sites has the member's details WITHOUT them re-typing anything. One-way, local-only:
// the extension never sends this anywhere.
(function () {
  // Signal to the web app that the extension is installed (so the opt-out guide can offer autofill instead
  // of promoting an install). Read via document.documentElement.getAttribute('data-idl-ext').
  try {
    const ver = (chrome.runtime && chrome.runtime.getManifest && chrome.runtime.getManifest().version) || '1';
    document.documentElement.setAttribute('data-idl-ext', ver);
  } catch { /* ignore */ }
  try {
    const raw = localStorage.getItem('wsfyMappedIdentity');
    const id = raw ? JSON.parse(raw) : {};
    let email = '';
    let userId = '';
    try {
      const u = JSON.parse(localStorage.getItem('user') || 'null');
      email = (u && u.email) || '';
      userId = (u && (u.id || u._id || u.userId || u.uniqueId)) || '';
    } catch { /* ignore */ }
    if (userId) chrome.storage.local.set({ idlUserId: String(userId) });
    const parts = String(id.name || '').trim().split(/\s+/).filter(Boolean);
    const identity = {
      name: id.name || '',
      firstName: id.firstName || parts[0] || '',
      lastName: id.lastName || (parts.length > 1 ? parts[parts.length - 1] : '') || '',
      email: email || id.email || '',
      address: id.address || '',
      city: id.city || '',
      state: id.state || '',
      zip: id.zip || '',
      phone: id.phone || '',
      dob: id.dob || '',
      syncedAt: new Date().toISOString(),
    };
    // Only sync if we actually have something identifying (avoid clobbering with an empty object).
    if (identity.name || identity.firstName || identity.email) {
      chrome.storage.local.set({ idlIdentity: identity });
    }
    // Managed sources = the brokers the member has actively opted out of (written by the web app's Digital
    // Footprint when it loads the exposure graph). Reappearance detection ONLY runs/reports for these — so
    // nothing about a random broker visit ever leaves the browser. Consent-scoped by construction.
    try {
      const raw = localStorage.getItem('idlManagedSourceKeys');
      const keys = raw ? JSON.parse(raw) : [];
      if (Array.isArray(keys)) chrome.storage.local.set({ idlManagedSourceKeys: keys.filter(Boolean).map(String) });
    } catch { /* ignore */ }
  } catch { /* storage unavailable or not logged in */ }

  // Relay a "Re-check all" request from the web app (same-window postMessage) to the background worker,
  // which opens each broker's search page for the content script to scan. Strictly scoped: same window +
  // our tag only.
  window.addEventListener('message', (e) => {
    if (e.source !== window || !e.data || e.data.source !== 'idlookup-web' || e.data.type !== 'recheck') return;
    const sourceKeys = Array.isArray(e.data.sourceKeys) ? e.data.sourceKeys.filter(Boolean).map(String) : [];
    if (!sourceKeys.length) return;
    try { chrome.runtime.sendMessage({ type: 'recheckSources', sourceKeys }); } catch { /* ignore */ }
  });
})();
