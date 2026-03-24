/**
 * DEV-ONLY: Establish a ByteCrtrs authenticated session for the current user.
 *
 * ByteCrtrs report endpoints (createReport, getReport, reportList) require an
 * authenticated paid session that is normally established via billing.signup +
 * billing.sale during the signup/payment flow.
 *
 * For development, existing mock users (e.g. member@test.com) never went through
 * that flow, so this button lets you establish a BC session with one click using
 * the hardcoded BC test card so you can test report creation without a fresh signup.
 *
 * NEVER rendered in production (process.env.NODE_ENV check).
 */
import React, { useState } from 'react';
import api from '../api';
import apiWrapper from '../services/apiWrapper';

const TEST_CARD = {
  pan: '4111111111111111',
  expYear: '30',
  expMonth: '12',
  cvv: '123',
};

const TEST_ADDRESS = {
  firstName: 'Dev',
  lastName: 'Tester',
  street1: '123 main',
  zip: '10001',
  bogusFields: {
    firstName: false, lastName: false,
    street1: true, street2: true, city: true, state: true,
    zip: false, country: true,
  },
};

const DevBCSession = ({ user }) => {
  const [status, setStatus] = useState('idle'); // idle | loading | success | error
  const [message, setMessage] = useState('');

  if (process.env.NODE_ENV !== 'development') return null;

  const handleActivate = async () => {
    setStatus('loading');
    setMessage('');
    try {
      const nameParts = (user?.fullName || user?.email || 'Dev Tester').trim().split(/\s+/);
      const firstName = nameParts[0] || 'Dev';
      const lastName = nameParts.slice(1).join(' ') || 'Tester';
      const email = user?.email || 'dev@test.com';

      // Step 1: Register user in BC (non-fatal if already registered)
      try {
        await api.billingSignup({
          userInfo: { email, firstName, lastName, optin: true },
        });
      } catch (signupErr) {
        console.warn('[DevBCSession] billingSignup failed (may already exist):', signupErr?.message);
      }

      // Step 1b: Inspect BC shape/config to debug commerce offer availability
      try {
        const shapeResult = await apiWrapper.getShapeCompiled();
        console.log('[DevBCSession] shapeCompiled:', JSON.stringify(shapeResult, null, 2));
        console.log('[DevBCSession] brand name:', shapeResult?.getShComp?.('comp.brand.name'));
      } catch (shapeErr) {
        console.warn('[DevBCSession] getShapeCompiled failed:', shapeErr?.message);
      }

      // Step 2: Process test payment → establishes BC authenticated session
      await api.billingSale({
        userInfo: { email, firstName, lastName, optin: true },
        billings: [{
          billingType: 'creditCard',
          creditCard: TEST_CARD,
          billingAddress: { ...TEST_ADDRESS, firstName, lastName },
        }],
        commerceOfferKeys: [{ key: 'comp.offer.signup.main', target: 'main', options: {} }],
        sequenceOption: {
          thinMatch: false,
          thinMatchDataProviderDown: false,
          thinMatchTooManyResults: false,
          thinMatchNoResults: false,
          thinMatchGeographic: false,
        },
      });

      setStatus('success');
      setMessage('BC session activated! Report endpoints should now work. Refresh search results and try again.');
    } catch (err) {
      setStatus('error');
      setMessage(err?.message || 'Failed to activate BC session.');
      console.error('[DevBCSession] Error:', err);
    }
  };

  const boxStyle = {
    margin: '1rem 0',
    padding: '0.75rem 1rem',
    border: `2px dashed ${status === 'success' ? '#0d5d2f' : status === 'error' ? '#c00' : '#999'}`,
    borderRadius: '6px',
    backgroundColor: status === 'success' ? '#e8f5e9' : status === 'error' ? '#fee' : '#fffde7',
    display: 'flex',
    alignItems: 'center',
    gap: '1rem',
    flexWrap: 'wrap',
  };

  return (
    <div style={boxStyle} role="region" aria-label="Dev tools">
      <span style={{ fontSize: '0.8rem', color: '#666', fontWeight: 'bold' }}>
        🛠 DEV
      </span>
      <span style={{ fontSize: '0.85rem', color: '#444', flex: 1 }}>
        {status === 'success'
          ? `✅ ${message}`
          : status === 'error'
          ? `❌ ${message}`
          : 'No BC session → report endpoints return 403. Click to authenticate with a test card.'}
      </span>
      {status !== 'success' && (
        <button
          onClick={handleActivate}
          disabled={status === 'loading'}
          style={{
            padding: '0.4rem 0.9rem',
            backgroundColor: status === 'loading' ? '#999' : '#0e123b',
            color: '#fff',
            border: 'none',
            borderRadius: '4px',
            cursor: status === 'loading' ? 'not-allowed' : 'pointer',
            fontSize: '0.85rem',
            whiteSpace: 'nowrap',
          }}
        >
          {status === 'loading' ? 'Activating…' : 'Activate BC Session'}
        </button>
      )}
    </div>
  );
};

export default DevBCSession;
