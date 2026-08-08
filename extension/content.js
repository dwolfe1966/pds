// Runs on a known broker page. Shows a small IDLookup panel that (1) tells the user exactly what removal
// here achieves + the verification hurdle they'll hit, and (2) autofills the opt-out form from the details
// synced from their IDLookup account. HEURISTIC autofill (match fields by attribute/label patterns) so it
// works across most opt-out forms without per-broker selectors; recipes add step guidance + overrides.
// The user completes any CAPTCHA / email / phone confirmation themselves — that's why this beats a
// headless bot. Nothing is sent anywhere; identity lives in the browser's extension storage only.
(function () {
  if (window.__idlPanelMounted) return;
  const recipe = (window.IDL_matchRecipe && window.IDL_matchRecipe(location.host)) || { name: location.host };
  window.__idlPanelMounted = true;

  let identity = {};
  try { chrome.storage.local.get('idlIdentity', (r) => { identity = (r && r.idlIdentity) || {}; mount(); }); }
  catch { mount(); }

  // ── Autofill engine ────────────────────────────────────────────────────────
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
  // Ordered: specific before generic (first/last before "name"); each returns the value or ''.
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
    for (const opt of el.options) {
      const t = (opt.value + ' ' + opt.textContent).toLowerCase();
      if (t.includes(v) && v) { setNativeValue(el, opt.value); return true; }
    }
    return false;
  }
  function autofill() {
    const M = matchers(identity);
    let filled = 0;
    const fields = document.querySelectorAll('input, textarea, select');
    for (const el of fields) {
      if (el.disabled || el.readOnly || el.offsetParent === null) continue;
      const type = (el.type || '').toLowerCase();
      if (['hidden', 'password', 'submit', 'button', 'checkbox', 'radio', 'file', 'search'].includes(type)) continue;
      if (el.value && el.tagName !== 'SELECT') continue; // don't clobber what the user already typed
      const hint = fieldHint(el);
      if (!hint) continue;
      const m = M.find((x) => x.re.test(hint));
      if (!m) continue;
      const value = (m.get() || '').toString();
      if (!value) continue;
      if (el.tagName === 'SELECT') { if (fillSelect(el, value)) filled++; }
      else { setNativeValue(el, value); filled++; }
    }
    return filled;
  }

  // ── Panel ────────────────────────────────────────────────────────────────
  function mount() {
    if (sessionStorage.getItem('idlPanelDismissed') === '1') return;
    const hasId = !!(identity && (identity.name || identity.firstName || identity.email));
    const wrap = document.createElement('div');
    wrap.id = 'idl-optout-panel';
    wrap.innerHTML = `
      <div class="idl-hd">
        <span class="idl-logo">IDLookup</span>
        <button class="idl-x" title="Hide">×</button>
      </div>
      <div class="idl-title">Remove yourself from ${escapeHtml(recipe.name)}</div>
      ${recipe.verification ? `<div class="idl-meta">🔐 ${escapeHtml(recipe.verification)}</div>` : ''}
      ${recipe.note ? `<div class="idl-note">💡 ${escapeHtml(recipe.note)}</div>` : ''}
      ${hasId
        ? `<button class="idl-fill">Autofill my details</button>
           <div class="idl-status" aria-live="polite"></div>
           <div class="idl-hint">Then solve any CAPTCHA and click the confirmation email — those steps have to be you.</div>`
        : `<div class="idl-hint">Sign in at idlookup.ai to sync your details, or add them in the IDLookup extension.</div>`}
    `;
    document.body.appendChild(wrap);
    wrap.querySelector('.idl-x').addEventListener('click', () => { try { sessionStorage.setItem('idlPanelDismissed', '1'); } catch { /* ignore */ } wrap.remove(); });
    const fill = wrap.querySelector('.idl-fill');
    if (fill) fill.addEventListener('click', () => {
      const n = autofill();
      const s = wrap.querySelector('.idl-status');
      s.textContent = n ? `Filled ${n} field${n === 1 ? '' : 's'}. Review, then submit + verify.` : 'No matching fields found on this page — the form may load after you find your listing.';
      s.className = 'idl-status ' + (n ? 'ok' : 'warn');
    });
  }
  function escapeHtml(s) { return String(s || '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])); }
})();
