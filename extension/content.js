// Runs on every site (broad host access; the user can revoke per-site via Chrome). It stays QUIET unless
// there's something worth flagging: on a known broker it offers autofill for the opt-out form; on a social
// site or a page with an account form it shows a light identity tip; on ordinary pages it shows nothing.
// Honest — it states only what we KNOW (host in catalog / a form is present), never "your data is here".
// Everything is local; the member completes any CAPTCHA / email / phone confirmation themselves.
(function () {
  if (window.__idlPanelMounted) return;
  if (sessionStorage.getItem('idlPanelDismissed') === '1') return;

  const recipe = (window.IDL_matchRecipe && window.IDL_matchRecipe(location.host)) || null; // real broker match or null
  const cls = (window.IDL_classify && window.IDL_classify(location.host)) || { kind: 'other', name: location.host };
  const sig = pageSignals();
  const insight = (window.IDL_pageInsight && window.IDL_pageInsight(cls, sig)) || null;

  // Show nothing on ordinary pages (no broker, and nothing notable) — don't nag.
  if (!recipe && (!insight || insight.tone === 'muted')) return;
  window.__idlPanelMounted = true;

  let identity = {};
  try { chrome.storage.local.get('idlIdentity', (r) => { identity = (r && r.idlIdentity) || {}; mount(); }); }
  catch { mount(); }

  function pageSignals() {
    let hasPassword = false, hasEmailField = false;
    document.querySelectorAll('input').forEach((i) => {
      const t = (i.type || '').toLowerCase();
      if (t === 'password') hasPassword = true;
      const h = ((i.name || '') + (i.id || '') + (i.placeholder || '') + (i.autocomplete || '')).toLowerCase();
      if (t === 'email' || /e-?mail/.test(h)) hasEmailField = true;
    });
    return { hasPassword, hasEmailField };
  }

  // ── Autofill engine (broker forms) ──────────────────────────────────────────
  function setNativeValue(el, value) {
    const proto = el.tagName === 'TEXTAREA' ? HTMLTextAreaElement.prototype
      : el.tagName === 'SELECT' ? HTMLSelectElement.prototype : HTMLInputElement.prototype;
    const desc = Object.getOwnPropertyDescriptor(proto, 'value');
    if (desc && desc.set) desc.set.call(el, value); else el.value = value;
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
  }
  function names(id) {
    const parts = String(id.name || '').trim().split(/\s+/).filter(Boolean);
    return {
      firstName: id.firstName || parts[0] || '',
      lastName: id.lastName || (parts.length > 1 ? parts[parts.length - 1] : '') || '',
      fullName: id.name || [id.firstName, id.lastName].filter(Boolean).join(' '),
    };
  }
  function fieldHint(el) {
    const bits = [el.name, el.id, el.placeholder, el.getAttribute && el.getAttribute('aria-label'), el.getAttribute && el.getAttribute('autocomplete')];
    try { if (el.id) { const l = document.querySelector('label[for="' + CSS.escape(el.id) + '"]'); if (l) bits.push(l.textContent); } } catch { /* ignore */ }
    const p = el.closest && el.closest('label'); if (p) bits.push(p.textContent);
    return bits.filter(Boolean).join(' ').toLowerCase();
  }
  function matchers(id) {
    const n = names(id);
    return [
      { re: /e-?mail/, get: () => id.email },
      { re: /first.?name|fname|given/, get: () => n.firstName },
      { re: /last.?name|lname|surname|family/, get: () => n.lastName },
      { re: /zip|postal/, get: () => id.zip },
      { re: /city|town/, get: () => id.city },
      { re: /state|province|region/, get: () => id.state },
      { re: /street|address(?!.*email)|addr(?![a-z]*email)/, get: () => id.address },
      { re: /phone|mobile|\btel\b/, get: () => id.phone },
      { re: /full.?name|your.?name|(^|[^a-z])name([^a-z]|$)/, get: () => n.fullName },
    ];
  }
  function fillSelect(el, value) {
    const v = String(value || '').toLowerCase();
    for (const opt of el.options) { const t = (opt.value + ' ' + opt.textContent).toLowerCase(); if (v && t.includes(v)) { setNativeValue(el, opt.value); return true; } }
    return false;
  }
  function autofill() {
    const M = matchers(identity);
    let filled = 0;
    document.querySelectorAll('input, textarea, select').forEach((el) => {
      if (el.disabled || el.readOnly || el.offsetParent === null) return;
      const type = (el.type || '').toLowerCase();
      if (['hidden', 'password', 'submit', 'button', 'checkbox', 'radio', 'file', 'search'].includes(type)) return;
      if (el.value && el.tagName !== 'SELECT') return;
      const hint = fieldHint(el); if (!hint) return;
      const m = M.find((x) => x.re.test(hint)); if (!m) return;
      const value = (m.get() || '').toString(); if (!value) return;
      if (el.tagName === 'SELECT') { if (fillSelect(el, value)) filled++; } else { setNativeValue(el, value); filled++; }
    });
    return filled;
  }

  // ── Panel ───────────────────────────────────────────────────────────────────
  function mount() {
    const hasId = !!(identity && (identity.name || identity.firstName || identity.email));
    const wrap = document.createElement('div');
    wrap.id = 'idl-optout-panel';
    if (recipe) {
      wrap.innerHTML = `
        <div class="idl-hd"><span class="idl-logo">IDLookup</span><button class="idl-x" title="Hide">×</button></div>
        <div class="idl-title">Remove yourself from ${esc(recipe.name)}</div>
        ${recipe.verification ? `<div class="idl-meta">🔐 ${esc(recipe.verification)}</div>` : ''}
        ${recipe.note ? `<div class="idl-note">💡 ${esc(recipe.note)}</div>` : ''}
        ${hasId
          ? `<button class="idl-fill">Autofill my details</button>
             <div class="idl-status" aria-live="polite"></div>
             <div class="idl-hint">Then solve any CAPTCHA and click the confirmation email — those steps have to be you.</div>`
          : `<div class="idl-hint">Sign in at idlookup.ai to sync your details, or add them in the IDLookup extension.</div>`}`;
    } else {
      wrap.innerHTML = `
        <div class="idl-hd"><span class="idl-logo">IDLookup</span><button class="idl-x" title="Hide">×</button></div>
        <div class="idl-title">${esc(insight.title)}</div>
        <div class="idl-meta">${esc(insight.body)}</div>`;
    }
    document.body.appendChild(wrap);
    wrap.querySelector('.idl-x').addEventListener('click', () => { try { sessionStorage.setItem('idlPanelDismissed', '1'); } catch { /* ignore */ } wrap.remove(); });
    const fill = wrap.querySelector('.idl-fill');
    if (fill) fill.addEventListener('click', () => {
      const n = autofill();
      const s = wrap.querySelector('.idl-status');
      s.textContent = n ? `Filled ${n} field${n === 1 ? '' : 's'}. Review, then submit + verify.` : 'No matching fields here yet — the form may load after you find your listing.';
      s.className = 'idl-status ' + (n ? 'ok' : 'warn');
    });
  }
  function esc(s) { return String(s || '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])); }
})();
