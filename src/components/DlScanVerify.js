import React, { useState } from 'react';

const GREEN = '#0d5d2f';
const norm = (s) => String(s || '').toLowerCase().replace(/[^a-z]/g, '');

/**
 * OPTIONAL, NON-BLOCKING driver's-license verification (research Phase 0). The member uploads a still
 * photo of the BACK of their license; we decode the PDF417 barcode + parse AAMVA fields ENTIRELY IN THE
 * BROWSER, match the name against the mapped record, and hand the caller only a pass/fail — we never
 * upload the image, and never persist the DL number, address, or raw barcode payload (per the research
 * doc's PII guidance: a people-search product holding ID PII would raise our own breach blast-radius).
 *
 * Caveat this does NOT do: prove the document is authentic or that a live person presented it. It's a
 * step up from "click to claim" (name match + friction), not KYC-grade proof. The heavy PDF417 decoder
 * is lazy-loaded so it never touches the main bundle unless a member actually scans.
 */
export default function DlScanVerify({ recordName, onVerified, onCancel }) {
  const [status, setStatus] = useState('idle'); // idle | reading | matched | mismatch | unreadable
  const [detail, setDetail] = useState('');

  const handleFile = async (e) => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    setStatus('reading');
    setDetail('');
    let url;
    try {
      const [zxing, aamva] = await Promise.all([import('@zxing/library'), import('aamva-parser')]);
      const { BrowserPDF417Reader } = zxing;
      url = URL.createObjectURL(file);
      let raw;
      try {
        raw = (await new BrowserPDF417Reader().decodeFromImageUrl(url)).getText();
      } catch {
        setStatus('unreadable');
        setDetail("We couldn't read the barcode. Take a clear, well-lit photo of the BACK of your license (the barcode side), filling the frame.");
        return;
      }
      const parseFn = aamva.Parse || aamva.parse || (aamva.default && (aamva.default.Parse || aamva.default.parse));
      let lic = null;
      try { lic = parseFn ? parseFn(raw) : null; } catch { lic = null; }
      if (!lic || (!lic.firstName && !lic.lastName)) {
        setStatus('unreadable');
        setDetail("That barcode didn't contain readable license data. Try a clearer photo of the back.");
        return;
      }
      // Match on BOTH names (normalized) appearing in the mapped record's name. No PII is stored or sent.
      const recN = norm(recordName);
      const ln = norm(lic.lastName);
      const fn = norm(lic.firstName);
      if (ln && fn && recN.includes(ln) && recN.includes(fn)) {
        setStatus('matched');
        if (onVerified) onVerified();
      } else {
        setStatus('mismatch');
        const idName = [lic.firstName, lic.lastName].filter(Boolean).join(' ');
        setDetail(`The name on this ID${idName ? ` (${idName})` : ''} doesn't match this record. You can still continue — ID verification is optional.`);
      }
    } catch {
      setStatus('unreadable');
      setDetail("Something went wrong reading your ID. You can skip this — it's optional.");
    } finally {
      if (url) { try { URL.revokeObjectURL(url); } catch { /* noop */ } }
      e.target.value = '';
    }
  };

  return (
    <div style={{ border: '1px solid #d7ddd9', borderRadius: 12, padding: '16px 18px', background: '#fff' }}>
      <div style={{ fontSize: 15, fontWeight: 800, color: '#111827' }}>
        🛡️ Verify with your driver's license <span style={{ fontWeight: 600, color: '#9ca3af', fontSize: 12 }}>(optional)</span>
      </div>
      <p style={{ margin: '6px 0 12px', fontSize: 13, color: '#4b5563', lineHeight: 1.5 }}>
        Upload a photo of the <strong>back</strong> of your license. We read the barcode <strong>in your browser</strong> to
        match your name — we never upload or store your ID.
      </p>
      {status === 'matched' ? (
        <div style={{ fontSize: 14, fontWeight: 800, color: GREEN }}>🛡️ ID verified — thanks!</div>
      ) : (
        <>
          <label style={{ display: 'inline-block', background: GREEN, color: '#fff', borderRadius: 8, padding: '10px 18px', fontSize: 14, fontWeight: 800, cursor: status === 'reading' ? 'wait' : 'pointer' }}>
            {status === 'reading' ? 'Reading…' : 'Upload license photo'}
            <input type="file" accept="image/*" capture="environment" onChange={handleFile} disabled={status === 'reading'} style={{ display: 'none' }} />
          </label>
          {onCancel && (
            <button type="button" onClick={onCancel} style={{ marginLeft: 12, background: 'none', border: 'none', color: '#6b7280', fontSize: 13, cursor: 'pointer', textDecoration: 'underline' }}>
              Not now
            </button>
          )}
          {detail && (
            <p style={{ margin: '10px 0 0', fontSize: 12.5, color: status === 'mismatch' ? '#b45309' : '#b91c1c', lineHeight: 1.5 }}>{detail}</p>
          )}
        </>
      )}
    </div>
  );
}
