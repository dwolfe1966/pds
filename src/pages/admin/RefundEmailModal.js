import React, { useState, useEffect, useRef } from 'react';
import api from '../../api';

// ─── Inline styles (no CSS module dependency — works on any admin page) ──────

const overlay = {
  position: 'fixed',
  inset: 0,
  background: 'rgba(0,0,0,0.5)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  zIndex: 9998,
  animation: 'refundModalFadeIn 0.18s ease',
};

const card = {
  background: '#fff',
  borderRadius: '14px',
  padding: '28px 32px 24px',
  maxWidth: '520px',
  width: '92%',
  boxShadow: '0 12px 40px rgba(0,0,0,0.18)',
  position: 'relative',
  maxHeight: '90vh',
  overflowY: 'auto',
};

const closeX = {
  position: 'absolute',
  top: '14px',
  right: '18px',
  background: 'none',
  border: 'none',
  fontSize: '1.3rem',
  color: '#9ca3af',
  cursor: 'pointer',
  lineHeight: 1,
  padding: '4px',
};

const titleStyle = {
  fontSize: '1.15rem',
  fontWeight: 700,
  color: '#111827',
  margin: '0 0 4px',
};

const subtitleStyle = {
  fontSize: '0.82rem',
  color: '#6b7280',
  margin: '0 0 20px',
  lineHeight: 1.45,
};

const labelStyle = {
  display: 'block',
  fontSize: '0.8rem',
  fontWeight: 600,
  color: '#374151',
  marginBottom: '5px',
};

const fieldWrap = { marginBottom: '14px' };

const inputBase = {
  width: '100%',
  padding: '9px 12px',
  border: '1px solid #d1d5db',
  borderRadius: '7px',
  fontSize: '0.875rem',
  fontFamily: 'inherit',
  color: '#111827',
  boxSizing: 'border-box',
  outline: 'none',
  transition: 'border-color 0.15s, box-shadow 0.15s',
};

const inputReadOnly = {
  ...inputBase,
  background: '#f9fafb',
  color: '#6b7280',
  cursor: 'default',
};

const selectStyle = {
  ...inputBase,
  background: '#fff',
  cursor: 'pointer',
};

const textareaBase = {
  ...inputBase,
  resize: 'vertical',
  fontFamily: 'inherit',
};

const charCounter = (near) => ({
  textAlign: 'right',
  fontSize: '0.72rem',
  color: near ? '#dc2626' : '#9ca3af',
  marginTop: '3px',
});

const submitBtn = {
  width: '100%',
  padding: '12px',
  background: '#0d5d2f',
  color: '#fff',
  border: 'none',
  borderRadius: '8px',
  fontSize: '0.95rem',
  fontWeight: 700,
  cursor: 'pointer',
  marginTop: '6px',
  transition: 'background 0.15s',
};

const submitBtnDisabled = {
  ...submitBtn,
  opacity: 0.55,
  cursor: 'not-allowed',
};

const successBox = {
  textAlign: 'center',
  padding: '24px 0 8px',
};

const successIcon = {
  fontSize: '2.2rem',
  marginBottom: '10px',
};

const successMsg = {
  fontSize: '0.95rem',
  color: '#166534',
  fontWeight: 600,
  margin: '0 0 6px',
};

const successSub = {
  fontSize: '0.82rem',
  color: '#6b7280',
  margin: '0 0 20px',
};

const closeBtn = {
  padding: '10px 28px',
  background: '#f3f4f6',
  color: '#374151',
  border: '1px solid #e5e7eb',
  borderRadius: '8px',
  fontSize: '0.875rem',
  fontWeight: 600,
  cursor: 'pointer',
};

const errorBox = {
  background: '#fef2f2',
  color: '#991b1b',
  borderRadius: '8px',
  padding: '10px 14px',
  fontSize: '0.85rem',
  marginBottom: '12px',
};

const REASONS = [
  'Refund Request',
  'Chargeback Inquiry',
  'Billing Question',
  'Cancel & Refund',
  'Other',
];

// ─── Component ───────────────────────────────────────────────────────────────

const RefundEmailModal = ({ userId, userEmail, userName, userPhone, orderId, amount, onClose }) => {
  const [reason, setReason] = useState('');
  const [description, setDescription] = useState('');
  const [agentNotes, setAgentNotes] = useState('');
  const [orderIdField, setOrderIdField] = useState(orderId || '');
  const [amountField, setAmountField] = useState(amount != null ? String(amount) : '');
  // Editable when the order carries no customer email (e.g. a Failed $0 order) —
  // a permanently-greyed empty field left CSRs unable to file the request
  // (bug list 7/2 #12). Read-only when prefilled, as before.
  const [emailField, setEmailField] = useState(userEmail || '');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const cardRef = useRef(null);

  // Close on Escape
  useEffect(() => {
    const handler = (e) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onClose]);

  const handleOverlayClick = () => onClose();
  const handleCardClick = (e) => e.stopPropagation();

  const canSubmit = reason && description.trim().length > 0 && !sending;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!canSubmit) return;

    // Build the formatted message
    const lines = [];
    lines.push(`BILLING ACTION REQUEST`);
    lines.push(`======================`);
    lines.push(`Reason: ${reason}`);
    if (orderIdField.trim()) lines.push(`Order ID: ${orderIdField.trim()}`);
    if (amountField.trim()) lines.push(`Amount: $${amountField.trim()}`);
    lines.push(`Customer Email: ${emailField.trim() || 'N/A'}`);
    lines.push('');
    lines.push(`Description:`);
    lines.push(description.trim());
    if (agentNotes.trim()) {
      lines.push('');
      lines.push(`--- INTERNAL AGENT NOTES (not visible to customer) ---`);
      lines.push(agentNotes.trim());
    }

    const formattedMessage = lines.join('\n');
    const subject = `[Finance] ${reason}`;

    setSending(true);
    setError('');
    try {
      await api.adminCreateCsrMail({
        targetUserId: userId,
        subject,
        message: formattedMessage,
        contentType: 'text/plain',
        // Required by the new BC two-step flow (F8): the underlying
        // implementation creates a contactMessage on the user's behalf
        // then replies to it. BC's create endpoint needs name/email/
        // phone/orderId; phone gets the 212-555-0100 sentinel if blank.
        userName,
        userEmail: emailField.trim() || userEmail,
        userPhone,
        orderId,
      });
      setSuccess(true);
    } catch (err) {
      setError(err?.message || 'Failed to send request. Please try again.');
    } finally {
      setSending(false);
    }
  };

  return (
    <>
      {/* Inject keyframe animation */}
      <style>{`
        @keyframes refundModalFadeIn {
          from { opacity: 0; }
          to   { opacity: 1; }
        }
      `}</style>

      <div style={overlay} onClick={handleOverlayClick}>
        <div style={card} ref={cardRef} onClick={handleCardClick}>
          <button style={closeX} onClick={onClose} title="Close" aria-label="Close">&times;</button>

          {success ? (
            <div style={successBox}>
              <div style={successIcon}>&#10003;</div>
              <p style={successMsg}>Request sent.</p>
              <p style={successSub}>Finance will respond within 1 business day.</p>
              <button style={closeBtn} onClick={onClose}>Close</button>
            </div>
          ) : (
            <form onSubmit={handleSubmit}>
              <h2 style={titleStyle}>Request Billing Action</h2>
              <p style={subtitleStyle}>
                Send a billing request to the finance team. They typically respond within 1 business day.
              </p>

              {error && <div style={errorBox}>{error}</div>}

              {/* Reason */}
              <div style={fieldWrap}>
                <label style={labelStyle}>
                  Reason <span style={{ color: '#dc2626' }}>*</span>
                </label>
                <select
                  style={selectStyle}
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  required
                >
                  <option value="" disabled>Select a reason...</option>
                  {REASONS.map((r) => (
                    <option key={r} value={r}>{r}</option>
                  ))}
                </select>
              </div>

              {/* Customer Email — read-only when prefilled from the user record;
                  editable when the order has none (Failed $0 orders). */}
              <div style={fieldWrap}>
                <label style={labelStyle}>Customer Email</label>
                <input
                  style={userEmail ? inputReadOnly : inputBase}
                  type="email"
                  value={emailField}
                  onChange={(e) => setEmailField(e.target.value)}
                  readOnly={!!userEmail}
                  placeholder={userEmail ? undefined : 'customer@email.com'}
                />
              </div>

              {/* Order ID */}
              <div style={fieldWrap}>
                <label style={labelStyle}>Order ID</label>
                <input
                  style={inputBase}
                  type="text"
                  value={orderIdField}
                  onChange={(e) => setOrderIdField(e.target.value)}
                  placeholder="Optional"
                />
              </div>

              {/* Amount */}
              <div style={fieldWrap}>
                <label style={labelStyle}>Amount ($)</label>
                <input
                  style={inputBase}
                  type="number"
                  min="0"
                  step="0.01"
                  value={amountField}
                  onChange={(e) => setAmountField(e.target.value)}
                  placeholder="Optional"
                />
              </div>

              {/* Description */}
              <div style={fieldWrap}>
                <label style={labelStyle}>
                  Description <span style={{ color: '#dc2626' }}>*</span>
                </label>
                <textarea
                  style={{ ...textareaBase, minHeight: '72px' }}
                  rows={3}
                  maxLength={250}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Describe the billing issue..."
                  required
                />
                <div style={charCounter(description.length >= 240)}>
                  {description.length} / 250 characters
                </div>
              </div>

              {/* Agent Notes */}
              <div style={fieldWrap}>
                <label style={labelStyle}>Agent Notes <span style={{ color: '#9ca3af', fontWeight: 400 }}>(internal only)</span></label>
                <textarea
                  style={{ ...textareaBase, minHeight: '52px' }}
                  rows={2}
                  maxLength={400}
                  value={agentNotes}
                  onChange={(e) => setAgentNotes(e.target.value)}
                  placeholder="Optional internal notes..."
                />
                <div style={charCounter(agentNotes.length >= 380)}>
                  {agentNotes.length} / 400 characters
                </div>
              </div>

              <button
                type="submit"
                style={canSubmit ? submitBtn : submitBtnDisabled}
                disabled={!canSubmit}
                onMouseEnter={(e) => { if (canSubmit) e.target.style.background = '#0a4b26'; }}
                onMouseLeave={(e) => { if (canSubmit) e.target.style.background = '#0d5d2f'; }}
              >
                {sending ? 'Sending...' : 'Send Request'}
              </button>
            </form>
          )}
        </div>
      </div>
    </>
  );
};

export default RefundEmailModal;
