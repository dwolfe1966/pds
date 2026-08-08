// Service worker — browsing-history capture + sync, STRICTLY consent-gated (owner decision 2026-08-08:
// raw history to backend with upfront global consent + full delete). Capture only runs after the user
// grants the `history` permission (optional, requested from the popup) AND flips it on. The user can wipe
// everything (delete) any time. Nothing is captured until then. See extension/README.md.
importScripts('config.js');
const CFG = self.IDL_CONFIG;

// Register at top level (guarded) so the SW wakes on history events; the handler gates on the enabled flag.
try { if (chrome.history && chrome.history.onVisited) chrome.history.onVisited.addListener(handleVisit); } catch { /* history perm not granted yet */ }
chrome.runtime.onStartup.addListener(rehook);
chrome.runtime.onInstalled.addListener(rehook);

async function rehook() {
  try {
    const { idlHistoryOn } = await chrome.storage.local.get('idlHistoryOn');
    const granted = await chrome.permissions.contains({ permissions: ['history'] });
    if (idlHistoryOn && granted && chrome.history && chrome.history.onVisited && !chrome.history.onVisited.hasListener(handleVisit)) {
      chrome.history.onVisited.addListener(handleVisit);
    }
  } catch { /* ignore */ }
}

async function handleVisit(item) {
  try {
    const { idlHistoryOn, idlUserId } = await chrome.storage.local.get(['idlHistoryOn', 'idlUserId']);
    if (!idlHistoryOn || !idlUserId || !item || !item.url) return;
    await postVisits(idlUserId, [{ url: item.url, title: item.title, visitedAt: item.lastVisitTime }]);
  } catch { /* ignore */ }
}

async function postVisits(userId, visits, setConsent) {
  const body = { userId, visits, consentVersion: CFG.consentVersion };
  if (setConsent === true) body.setConsent = true;
  try {
    const res = await fetch(CFG.historyUrl, {
      method: 'POST', headers: { 'Content-Type': 'application/json', 'X-App-Key': CFG.appKey },
      body: JSON.stringify(body),
    });
    return res.ok;
  } catch { return false; }
}

// One-time backfill of PAST history when the user first turns it on (chunked).
async function backfill(userId) {
  try {
    if (!chrome.history) return;
    const items = await chrome.history.search({ text: '', startTime: 0, maxResults: 5000 });
    const visits = items.map((i) => ({ url: i.url, title: i.title, visitedAt: i.lastVisitTime }));
    for (let i = 0; i < visits.length; i += 500) await postVisits(userId, visits.slice(i, i + 500));
  } catch { /* ignore */ }
}

async function enableHistory(userId) {
  await chrome.storage.local.set({ idlHistoryOn: true, idlUserId: userId });
  await postVisits(userId, [], true); // record consent server-side
  try { if (chrome.history && !chrome.history.onVisited.hasListener(handleVisit)) chrome.history.onVisited.addListener(handleVisit); } catch { /* ignore */ }
  backfill(userId); // fire and forget
}

async function deleteHistory(userId) {
  await chrome.storage.local.set({ idlHistoryOn: false });
  try { if (chrome.history && chrome.history.onVisited.hasListener(handleVisit)) chrome.history.onVisited.removeListener(handleVisit); } catch { /* ignore */ }
  try { await fetch(`${CFG.historyUrl}?userId=${encodeURIComponent(userId)}`, { method: 'DELETE', headers: { 'X-App-Key': CFG.appKey } }); } catch { /* ignore */ }
}

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  (async () => {
    try {
      const stored = await chrome.storage.local.get('idlUserId');
      const uid = (msg && msg.userId) || stored.idlUserId;
      if (msg && msg.type === 'enableHistory' && uid) { await enableHistory(uid); sendResponse({ ok: true }); }
      else if (msg && msg.type === 'deleteHistory' && uid) { await deleteHistory(uid); sendResponse({ ok: true }); }
      else sendResponse({ ok: false, error: 'no_user_or_type' });
    } catch (e) { sendResponse({ ok: false, error: String((e && e.message) || e) }); }
  })();
  return true; // async response
});
