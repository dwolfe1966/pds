import React, { useState } from 'react';
import { INFO, haveInfo, getPlaybook, buildRequestEmail, CAPTURABLE } from '../services/optOutPlaybook';
import { updateMappedIdentity } from '../services/memberEnrichment';

const GREEN = '#0d5d2f';

/**
 * OptOutGuide — the "prepare & pre-fill" experience for a single provider (friction ladder rungs 1–2).
 * Replaces a raw opt-out link with: what this ACHIEVES, what info you'll need (checked against what we
 * already hold), the steps + the verification hurdle you'll hit, the timeline, and a PRE-WRITTEN request
 * built from the member's identity. onProceed() marks the node opt-out-requested (same as the old link).
 */
export default function OptOutGuide({ item, identity, onClose, onProceed }) {
  const pb = getPlaybook(item);
  const [id, setId] = useState(identity || {}); // local so inline captures update the checklist + prefill live
  const have = haveInfo(id);
  const [copied, setCopied] = useState('');
  const [editing, setEditing] = useState(null);
  const [draft, setDraft] = useState('');
  const email = pb.prefill === 'ccpa_email' ? buildRequestEmail(id, item, pb) : null;

  const copy = (text, tag) => {
    try { navigator.clipboard.writeText(text); setCopied(tag); setTimeout(() => setCopied(''), 1800); } catch { /* ignore */ }
  };
  // Save a captured field once → identity (prefills this + every future request).
  const saveField = (k) => { const v = draft.trim(); if (!v) return; updateMappedIdentity({ [k]: v }); setId((p) => ({ ...p, [k]: v })); setEditing(null); setDraft(''); };

  const idLine = [id.name, [id.city, id.state].filter(Boolean).join(', '), id.address].filter(Boolean).join(' · ');
  const mailto = email && email.to
    ? `mailto:${email.to}?subject=${encodeURIComponent(email.subject)}&body=${encodeURIComponent(email.body)}`
    : null;

  const proceed = () => { if (onProceed) onProceed(item); };

  return (
    <div role="dialog" aria-modal="true" onClick={onClose}
      style={{ position: 'fixed', inset: 0, zIndex: 10000, background: 'rgba(17,24,39,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1.25rem' }}>
      <div onClick={(e) => e.stopPropagation()}
        style={{ background: '#fff', borderRadius: 16, maxWidth: 560, width: '100%', maxHeight: '88vh', overflowY: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,0.3)' }}>
        {/* Header */}
        <div style={{ padding: '18px 22px', borderBottom: '1px solid #eef2f0', position: 'sticky', top: 0, background: '#fff', borderRadius: '16px 16px 0 0' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
            <div>
              <div style={{ fontSize: 17, fontWeight: 800, color: '#111827' }}>Remove yourself from {item.name}</div>
              <div style={{ fontSize: 13, color: '#4b5563', marginTop: 3, lineHeight: 1.5 }}>{pb.achieves}</div>
            </div>
            <button type="button" onClick={onClose} aria-label="Close" style={{ flexShrink: 0, border: 'none', background: 'none', fontSize: 22, color: '#9ca3af', cursor: 'pointer', lineHeight: 1 }}>×</button>
          </div>
        </div>

        <div style={{ padding: '18px 22px', display: 'flex', flexDirection: 'column', gap: 18 }}>
          {pb.note && (
            <div style={{ fontSize: 12.5, color: '#1e3a8a', background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 10, padding: '9px 12px' }}>💡 {pb.note}</div>
          )}

          {/* What you'll need */}
          {pb.needs && pb.needs.length > 0 && (
            <section>
              <div style={{ fontSize: 12.5, fontWeight: 800, color: '#374151', textTransform: 'uppercase', letterSpacing: '0.03em', marginBottom: 8 }}>What you'll need</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {pb.needs.map((k) => {
                  const got = have[k];
                  const canAdd = !got && CAPTURABLE[k];
                  return (
                    <div key={k} style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13.5 }}>
                        <span aria-hidden="true" style={{ color: got ? GREEN : '#9ca3af', fontWeight: 800 }}>{got ? '✓' : '○'}</span>
                        <span style={{ color: got ? '#6b7280' : '#111827', flex: 1 }}>{INFO[k] || k}{got && k !== 'name' && k !== 'email' ? `: ${id[k]}` : ''}</span>
                        {got && <span style={{ fontSize: 11, color: GREEN, fontWeight: 700 }}>we have this</span>}
                        {canAdd && editing !== k && <button type="button" onClick={() => { setEditing(k); setDraft(''); }} style={addBtn}>＋ Add</button>}
                        {!got && k === 'ssn' && <span style={{ fontSize: 11, color: '#9ca3af' }}>have it ready — we don’t store this</span>}
                      </div>
                      {canAdd && editing === k && (
                        <div style={{ display: 'flex', gap: 6, paddingLeft: 22 }}>
                          <input autoFocus type={CAPTURABLE[k]} value={draft} onChange={(e) => setDraft(e.target.value)}
                            onKeyDown={(e) => { if (e.key === 'Enter') saveField(k); }}
                            placeholder={INFO[k]} style={{ flex: 1, fontSize: 13, padding: '7px 10px', border: '1px solid #d1d5db', borderRadius: 8 }} />
                          <button type="button" onClick={() => saveField(k)} style={{ ...btnPrimary, padding: '7px 14px' }}>Save</button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </section>
          )}

          {/* Pre-written request (email tier) */}
          {email && (
            <section>
              <div style={{ fontSize: 12.5, fontWeight: 800, color: '#374151', textTransform: 'uppercase', letterSpacing: '0.03em', marginBottom: 8 }}>Your request — ready to send</div>
              {email.to
                ? <div style={{ fontSize: 12.5, color: '#374151', marginBottom: 6 }}><strong>To:</strong> {email.to}</div>
                : <div style={{ fontSize: 12, color: '#92400e', marginBottom: 6 }}>Send to their privacy address (on their privacy page).</div>}
              <div style={{ fontSize: 12.5, color: '#374151', marginBottom: 6 }}><strong>Subject:</strong> {email.subject}</div>
              <pre style={{ margin: 0, whiteSpace: 'pre-wrap', fontFamily: 'inherit', fontSize: 12.5, color: '#111827', background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: 10, padding: '11px 13px', maxHeight: 200, overflowY: 'auto' }}>{email.body}</pre>
              <div style={{ display: 'flex', gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
                <button type="button" onClick={() => copy(email.body, 'email')} style={btnGhost}>{copied === 'email' ? '✓ Copied' : 'Copy request'}</button>
                {mailto && <a href={mailto} onClick={proceed} style={btnPrimary}>Open in email →</a>}
              </div>
            </section>
          )}

          {/* Prefill values (form tier) */}
          {pb.prefill === 'form_values' && idLine && (
            <section>
              <div style={{ fontSize: 12.5, fontWeight: 800, color: '#374151', textTransform: 'uppercase', letterSpacing: '0.03em', marginBottom: 8 }}>Details to paste into their form</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ flex: 1, fontSize: 13, color: '#111827', background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: 8, padding: '8px 11px' }}>{idLine}</span>
                <button type="button" onClick={() => copy(idLine, 'vals')} style={btnGhost}>{copied === 'vals' ? '✓' : 'Copy'}</button>
              </div>
            </section>
          )}

          {/* Steps */}
          {pb.steps && pb.steps.length > 0 && (
            <section>
              <div style={{ fontSize: 12.5, fontWeight: 800, color: '#374151', textTransform: 'uppercase', letterSpacing: '0.03em', marginBottom: 8 }}>How it works</div>
              <ol style={{ margin: 0, paddingLeft: 18, display: 'flex', flexDirection: 'column', gap: 6 }}>
                {pb.steps.map((s, i) => <li key={i} style={{ fontSize: 13.5, color: '#374151', lineHeight: 1.5 }}>{s}</li>)}
              </ol>
            </section>
          )}

          {/* Verification + timeline */}
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            {pb.verification && <span style={metaChip}>🔐 {pb.verification}</span>}
            {pb.timeline && <span style={metaChip}>⏱ {pb.timeline}</span>}
          </div>
        </div>

        {/* Footer action */}
        <div style={{ padding: '14px 22px', borderTop: '1px solid #eef2f0', display: 'flex', justifyContent: 'flex-end', gap: 10, position: 'sticky', bottom: 0, background: '#fff', borderRadius: '0 0 16px 16px' }}>
          <button type="button" onClick={onClose} style={btnGhost}>Close</button>
          {item.url
            ? <a href={item.url} target="_blank" rel="noopener noreferrer" onClick={proceed} style={btnPrimary}>Open {item.name} →</a>
            : (!email && <span style={{ fontSize: 12.5, color: '#6b7280', alignSelf: 'center' }}>Follow the steps above.</span>)}
        </div>
      </div>
    </div>
  );
}

const btnPrimary = { flexShrink: 0, background: GREEN, color: '#fff', border: 'none', borderRadius: 9, padding: '9px 16px', fontSize: 13.5, fontWeight: 800, textDecoration: 'none', cursor: 'pointer' };
const btnGhost = { flexShrink: 0, background: '#fff', color: '#374151', border: '1px solid #d1d5db', borderRadius: 9, padding: '9px 14px', fontSize: 13, fontWeight: 700, cursor: 'pointer' };
const metaChip = { fontSize: 12, color: '#4b5563', background: '#f3f4f6', borderRadius: 999, padding: '5px 11px' };
const addBtn = { flexShrink: 0, background: '#f0fdf4', color: GREEN, border: '1px solid #bbf7d0', borderRadius: 999, padding: '2px 10px', fontSize: 11.5, fontWeight: 800, cursor: 'pointer' };
