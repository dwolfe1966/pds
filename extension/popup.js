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
