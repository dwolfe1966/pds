import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getMappedIdentity, fetchMappedIdentity, updateRemovalProfile } from '../services/memberEnrichment';

const GREEN = '#0d5d2f';

/**
 * "Your details for removals" — DERIVED from the member's claimed record, not a fresh PII form. When they
 * claim their identity, enrichFromReport pulls their address history / DOB / phone off the record and stores
 * it server-side; this card just PRE-FILLS from that and asks them to confirm (and fix anything off). If
 * they haven't claimed yet, it routes them to do so instead of asking them to hand-type PII. SSN / ID are
 * never stored — brokers ask for those at their own site.
 */
const FIELDS = [
  { k: 'address', label: 'Current address', span: true },
  { k: 'prevAddress', label: 'Previous addresses', span: true },
  { k: 'dob', label: 'Date of birth' },
  { k: 'phone', label: 'Phone number' },
];

export default function IdentityDetailsCard() {
  const navigate = useNavigate();
  const [id, setId] = useState(() => getMappedIdentity() || {});
  const [form, setForm] = useState({ address: '', prevAddress: '', dob: '', phone: '' });
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);

  const hydrate = (src) => setForm({ address: src.address || '', prevAddress: src.prevAddress || '', dob: src.dob || '', phone: src.phone || '' });

  useEffect(() => {
    const cur = getMappedIdentity() || {}; setId(cur); hydrate(cur);
    fetchMappedIdentity().then((srv) => { if (srv) { setId(srv); hydrate(srv); } });
  }, []);

  const claimed = !!(id && (id.hasReport || id.confirmed || id.name));
  const fromRecord = !!(id && (id.address || id.dob || id.phone));

  const set = (k) => (e) => { setForm((f) => ({ ...f, [k]: e.target.value })); setSaved(false); };
  const save = async () => { setBusy(true); await updateRemovalProfile(form); setBusy(false); setSaved(true); setTimeout(() => setSaved(false), 3000); };

  // Not claimed → don't ask for PII; route them to claim, which pulls all of this automatically.
  if (!claimed) {
    return (
      <div style={card}>
        <div style={{ fontSize: 16, fontWeight: 800, color: '#111827' }}>Your details for removals</div>
        <p style={{ margin: '4px 0 12px', fontSize: 13, color: '#4b5563', lineHeight: 1.5 }}>
          Claim your identity and we’ll pull your address history, date of birth and phone straight from your
          record — so opt-outs pre-fill themselves. No forms to type.
        </p>
        <button type="button" onClick={() => navigate('/people-search')} style={btn}>Find & claim my identity →</button>
      </div>
    );
  }

  return (
    <div style={card}>
      <div style={{ fontSize: 16, fontWeight: 800, color: '#111827' }}>Your details for removals</div>
      <p style={{ margin: '4px 0 12px', fontSize: 13, color: '#4b5563', lineHeight: 1.5 }}>
        {fromRecord
          ? 'Pulled from your claimed record — confirm these (or fix anything off) and we’ll pre-fill every opt-out with them.'
          : 'Confirm the details we should use on your opt-out requests.'}{' '}
        <strong>We never store your SSN or ID</strong> — brokers ask for those on their own site.
      </p>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        {FIELDS.map((f) => (
          <label key={f.k} style={{ display: 'block', gridColumn: f.span ? '1 / -1' : 'auto' }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: '#374151' }}>{f.label}
              {id[f.k] ? <span style={{ marginLeft: 6, fontSize: 10.5, fontWeight: 700, color: GREEN }}>from your record</span> : null}
            </span>
            <input value={form[f.k]} onChange={set(f.k)}
              style={{ width: '100%', boxSizing: 'border-box', marginTop: 4, padding: '9px 11px', border: '1px solid #d1d5db', borderRadius: 8, fontSize: 14 }} />
          </label>
        ))}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 12 }}>
        <button type="button" onClick={save} disabled={busy} style={{ ...btn, opacity: busy ? 0.7 : 1 }}>
          {busy ? 'Saving…' : (fromRecord ? 'Confirm details' : 'Save details')}
        </button>
        {saved && <span style={{ fontSize: 13, fontWeight: 700, color: GREEN }}>✓ Saved to your account</span>}
      </div>
    </div>
  );
}

const card = { background: '#fff', border: '1px solid #d7ddd9', borderRadius: 14, padding: '18px 20px', marginBottom: 16 };
const btn = { background: GREEN, color: '#fff', border: 'none', borderRadius: 9, padding: '10px 20px', fontSize: 14, fontWeight: 800, cursor: 'pointer' };
