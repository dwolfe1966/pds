import React, { useState, useEffect } from 'react';
import { getMappedIdentity, fetchMappedIdentity, updateRemovalProfile } from '../services/memberEnrichment';

const GREEN = '#0d5d2f';

/**
 * The ONE place a member adds the extra details removals need (street address, prior addresses, DOB, phone)
 * — mapped once here and stored SERVER-SIDE (member_enrichment.attributes). The opt-out guide + browser
 * extension only READ this; they never re-capture it inline. SSN / ID are never stored — brokers ask for
 * those at their own site.
 */
const FIELDS = [
  { k: 'address', label: 'Current street address', ph: '123 Main St, Springfield, IL 62704' },
  { k: 'prevAddress', label: 'Previous addresses', ph: 'Any prior addresses (comma-separated)' },
  { k: 'dob', label: 'Date of birth', ph: 'MM/DD/YYYY' },
  { k: 'phone', label: 'Phone number', ph: '(555) 555-0100' },
];

export default function IdentityDetailsCard() {
  const [form, setForm] = useState({ address: '', prevAddress: '', dob: '', phone: '' });
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const id = getMappedIdentity() || {};
    setForm((f) => ({ ...f, address: id.address || '', prevAddress: id.prevAddress || '', dob: id.dob || '', phone: id.phone || '' }));
    // Pull the authoritative server copy, then re-hydrate the form.
    fetchMappedIdentity().then((id2) => { if (id2) setForm((f) => ({ address: id2.address || f.address, prevAddress: id2.prevAddress || f.prevAddress, dob: id2.dob || f.dob, phone: id2.phone || f.phone })); });
  }, []);

  const set = (k) => (e) => { setForm((f) => ({ ...f, [k]: e.target.value })); setSaved(false); };
  const save = async () => { setBusy(true); await updateRemovalProfile(form); setBusy(false); setSaved(true); setTimeout(() => setSaved(false), 3000); };

  return (
    <div style={{ background: '#fff', border: '1px solid #d7ddd9', borderRadius: 14, padding: '18px 20px', marginBottom: 16 }}>
      <div style={{ fontSize: 16, fontWeight: 800, color: '#111827' }}>Details for removals</div>
      <p style={{ margin: '4px 0 12px', fontSize: 13, color: '#4b5563', lineHeight: 1.5 }}>
        Add these once and we’ll pre-fill every opt-out request — here, and in the browser extension.
        <strong> We never store your SSN or ID</strong> — brokers ask for those on their own site.
      </p>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        {FIELDS.map((f) => (
          <label key={f.k} style={{ display: 'block', gridColumn: f.k === 'address' || f.k === 'prevAddress' ? '1 / -1' : 'auto' }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: '#374151' }}>{f.label}</span>
            <input value={form[f.k]} onChange={set(f.k)} placeholder={f.ph}
              style={{ width: '100%', boxSizing: 'border-box', marginTop: 4, padding: '9px 11px', border: '1px solid #d1d5db', borderRadius: 8, fontSize: 14 }} />
          </label>
        ))}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 12 }}>
        <button type="button" onClick={save} disabled={busy}
          style={{ background: GREEN, color: '#fff', border: 'none', borderRadius: 9, padding: '10px 20px', fontSize: 14, fontWeight: 800, cursor: busy ? 'default' : 'pointer', opacity: busy ? 0.7 : 1 }}>
          {busy ? 'Saving…' : 'Save details'}
        </button>
        {saved && <span style={{ fontSize: 13, fontWeight: 700, color: GREEN }}>✓ Saved to your account</span>}
      </div>
    </div>
  );
}
