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

// ── History insights — opt-in + consented; user can delete anytime ────────────────────────────────
const CFG = self.IDL_CONFIG || {};
const histTitle = document.getElementById('histTitle');
const histBody = document.getElementById('histBody');
const histBtn = document.getElementById('histBtn');
const histCard = document.getElementById('histCard');

async function getUserId() { const r = await chrome.storage.local.get('idlUserId'); return r.idlUserId || ''; }

async function renderHistory() {
  const userId = await getUserId();
  const { idlHistoryOn } = await chrome.storage.local.get('idlHistoryOn');
  if (!userId) {
    histCard.className = 'pagecard muted';
    histTitle.textContent = 'Sign in to enable';
    histBody.textContent = 'Sign in at idlookup.ai first, then history insights can link where your data spreads to your account.';
    histBtn.style.display = 'none';
    return;
  }
  if (idlHistoryOn) {
    histCard.className = 'pagecard info';
    histTitle.textContent = 'History insights: ON';
    histBody.textContent = 'Syncing where you browse to power your footprint. You can remove it all anytime.';
    // best-effort count
    try {
      const res = await fetch(`${CFG.historyUrl}?userId=${encodeURIComponent(userId)}`, { headers: { 'X-App-Key': CFG.appKey } });
      const d = await res.json();
      if (d && d.ok) histBody.textContent = `${(d.total || 0).toLocaleString()} page visits synced across ${(d.topHosts || []).length} sites. Remove it all anytime.`;
    } catch { /* ignore */ }
    histBtn.style.display = 'block';
    histBtn.textContent = 'Delete my history & turn off';
    histBtn.style.background = '#b91c1c';
    histBtn.onclick = deleteHistory;
  } else {
    histCard.className = 'pagecard muted';
    histTitle.textContent = 'History insights: Off';
    histBody.textContent = 'Turn on to map where your data spreads based on the sites you visit. This sends your browsing history to your IDLookup account — you can delete it all at any time.';
    histBtn.style.display = 'block';
    histBtn.textContent = 'Turn on history insights';
    histBtn.style.background = '#0d5d2f';
    histBtn.onclick = enableHistory;
  }
}

async function enableHistory() {
  const userId = await getUserId();
  if (!userId) { renderHistory(); return; }
  // Request the sensitive permission ONLY now, on this explicit click (never at install).
  let granted = false;
  try { granted = await chrome.permissions.request({ permissions: ['history'] }); } catch { granted = false; }
  if (!granted) { histBody.textContent = 'History access is needed to enable this. You can turn it on anytime.'; return; }
  await chrome.runtime.sendMessage({ type: 'enableHistory', userId });
  renderHistory();
}

async function deleteHistory() {
  const userId = await getUserId();
  if (!userId) return;
  histBtn.disabled = true; histBtn.textContent = 'Deleting…';
  await chrome.runtime.sendMessage({ type: 'deleteHistory', userId });
  try { await chrome.permissions.remove({ permissions: ['history'] }); } catch { /* ignore */ }
  histBtn.disabled = false;
  renderHistory();
}

renderHistory();
