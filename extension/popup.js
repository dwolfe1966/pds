// Popup: view/edit the removal profile stored locally (also auto-synced from idlookup.ai by the bridge).
const FIELDS = ['name', 'email', 'address', 'city', 'state', 'zip', 'phone', 'dob'];

function load() {
  chrome.storage.local.get('idlIdentity', (r) => {
    const id = (r && r.idlIdentity) || {};
    FIELDS.forEach((f) => { const el = document.getElementById(f); if (el) el.value = id[f] || ''; });
    if (id.syncedAt) setStatus('Synced from your IDLookup account.');
  });
}

function save() {
  const id = {};
  FIELDS.forEach((f) => { const el = document.getElementById(f); if (el) id[f] = el.value.trim(); });
  id.updatedAt = new Date().toISOString();
  chrome.storage.local.set({ idlIdentity: id }, () => setStatus('Saved. Broker forms will autofill with these.'));
}

function setStatus(t) { const s = document.getElementById('status'); if (s) { s.textContent = t; setTimeout(() => { s.textContent = ''; }, 2500); } }

document.getElementById('save').addEventListener('click', save);
load();

// ── On-this-page insight (activeTab; runs only because the user clicked the icon) ──────────────────
// Injected into the active tab — must be self-contained (no outside refs) and return serializable data.
function pageAnalyzer() {
  const inputs = Array.from(document.querySelectorAll('input'));
  const hasPassword = inputs.some((i) => (i.type || '').toLowerCase() === 'password');
  const hasEmailField = inputs.some((i) => {
    const t = (i.type || '').toLowerCase();
    const h = ((i.name || '') + (i.id || '') + (i.placeholder || '') + (i.autocomplete || '')).toLowerCase();
    return t === 'email' || /e-?mail/.test(h);
  });
  return { hasPassword, hasEmailField, formCount: document.forms.length };
}

function renderInsight(insight, host) {
  const card = document.getElementById('pageCard');
  const title = document.getElementById('pcTitle');
  const body = document.getElementById('pcBody');
  if (!insight) { card.className = 'pagecard muted'; title.textContent = 'This page can’t be analyzed'; body.textContent = 'Open a normal website tab and click the icon again.'; return; }
  card.className = 'pagecard ' + (insight.tone || 'muted');
  title.textContent = insight.title;
  body.textContent = insight.body;
}

async function analyzePage() {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab || !tab.url || !/^https?:/i.test(tab.url)) { renderInsight(null); return; }
    const host = new URL(tab.url).host;
    let page = {};
    try {
      const res = await chrome.scripting.executeScript({ target: { tabId: tab.id }, func: pageAnalyzer });
      page = (res && res[0] && res[0].result) || {};
    } catch { /* chrome://, web store, PDF viewers etc. can't be scripted */ }
    const cls = window.IDL_classify(host);
    renderInsight(window.IDL_pageInsight(cls, page), host);
  } catch { renderInsight(null); }
}
analyzePage();
