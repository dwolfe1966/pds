import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import api from '../../api';

/**
 * Payment capture page shown after signup.
 * Collects payment details and subscribes the user to a plan.
 */
const PaymentPage = () => {
  const navigate = useNavigate();
  const { token } = useAuth();
  const [form, setForm] = useState({ cardNumber: '', expiry: '', cvv: '', billingZip: '' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [selectedPerson, setSelectedPerson] = useState(null);
  const [selectedPersonId, setSelectedPersonId] = useState(null);

  // Get selected person info from sessionStorage
  useEffect(() => {
    const personId = sessionStorage.getItem('selectedPersonId');
    if (personId) {
      setSelectedPersonId(personId);
      const storedResult = sessionStorage.getItem(`result_${personId}`);
      if (storedResult) {
        setSelectedPerson(JSON.parse(storedResult));
      }
    }
  }, []);

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      // In a real implementation, you would obtain a payment token from a PCI‑compliant service
      // For now, we'll use the subscription endpoint
      await api.updateSubscription({ plan: 'basic', paymentToken: 'tok_demo' });
      setSuccess(true);
      
      // Redirect to person detail page after payment
      if (selectedPersonId) {
        setTimeout(() => {
          navigate(`/people/${selectedPersonId}`);
        }, 2000);
      } else {
        setTimeout(() => {
          navigate('/dashboard');
        }, 2000);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <main style={{ padding: '2rem', maxWidth: '600px', margin: '0 auto' }}>
      <h1 style={{ color: '#0e123b', marginBottom: '1rem' }}>Complete Your Purchase</h1>
      
      {selectedPerson && (
        <div style={{ 
          padding: '1.5rem', 
          backgroundColor: '#f0f7ff', 
          border: '2px solid #0d5d2f',
          borderRadius: '8px', 
          marginBottom: '2rem' 
        }}>
          <h2 style={{ color: '#0e123b', marginTop: 0, marginBottom: '0.5rem', fontSize: '1.2rem' }}>
            Unlock Full Report for {selectedPerson.fullName}
          </h2>
          <p style={{ color: '#666', margin: 0, lineHeight: '1.6' }}>
            Complete your payment to access the complete report including contact information, 
            addresses, relatives, and more.
          </p>
        </div>
      )}

      {success ? (
        <div style={{ padding: '2rem', backgroundColor: '#e8f5e9', borderRadius: '4px', textAlign: 'center' }}>
          <h2 style={{ color: '#0e123b', marginBottom: '1rem' }}>Payment Successful!</h2>
          <p style={{ color: '#666', lineHeight: '1.6', marginBottom: '1rem' }}>
            Your membership has been activated. Redirecting to your report...
          </p>
        </div>
      ) : (
        <div>
          <div style={{ marginBottom: '1.5rem', padding: '1rem', backgroundColor: '#f5f5f5', borderRadius: '4px' }}>
            <h3 style={{ color: '#0e123b', marginTop: 0, marginBottom: '0.5rem' }}>Membership Plan</h3>
            <p style={{ margin: 0, color: '#666' }}>
              <strong>Basic Plan:</strong> $29.99/month - Full access to all reports and search features
            </p>
          </div>

          <form onSubmit={handleSubmit}>
            <h3 style={{ color: '#0e123b', marginBottom: '1rem' }}>Payment Information</h3>
            
            <div style={{ marginBottom: '1.5rem' }}>
              <label style={{ display: 'block', marginBottom: '0.5rem', color: '#333', fontWeight: 'bold' }}>
                Card Number *
              </label>
              <input
                type="text"
                name="cardNumber"
                value={form.cardNumber}
                onChange={handleChange}
                required
                placeholder="1234 5678 9012 3456"
                maxLength="19"
                style={{ width: '100%', padding: '0.75rem', fontSize: '1rem', border: '1px solid #ccc', borderRadius: '4px' }}
              />
            </div>
            
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1.5rem' }}>
              <div>
                <label style={{ display: 'block', marginBottom: '0.5rem', color: '#333', fontWeight: 'bold' }}>
                  Expiry *
                </label>
                <input
                  type="text"
                  name="expiry"
                  value={form.expiry}
                  onChange={handleChange}
                  required
                  placeholder="MM/YY"
                  maxLength="5"
                  style={{ width: '100%', padding: '0.75rem', fontSize: '1rem', border: '1px solid #ccc', borderRadius: '4px' }}
                />
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: '0.5rem', color: '#333', fontWeight: 'bold' }}>
                  CVV *
                </label>
                <input
                  type="text"
                  name="cvv"
                  value={form.cvv}
                  onChange={handleChange}
                  required
                  placeholder="123"
                  maxLength="4"
                  style={{ width: '100%', padding: '0.75rem', fontSize: '1rem', border: '1px solid #ccc', borderRadius: '4px' }}
                />
              </div>
            </div>
            
            <div style={{ marginBottom: '1.5rem' }}>
              <label style={{ display: 'block', marginBottom: '0.5rem', color: '#333', fontWeight: 'bold' }}>
                Billing ZIP Code *
              </label>
              <input
                type="text"
                name="billingZip"
                value={form.billingZip}
                onChange={handleChange}
                required
                placeholder="12345"
                maxLength="10"
                style={{ width: '100%', padding: '0.75rem', fontSize: '1rem', border: '1px solid #ccc', borderRadius: '4px' }}
              />
            </div>
            
            {error && (
              <div style={{ padding: '1rem', backgroundColor: '#fee', color: '#c00', borderRadius: '4px', marginBottom: '1rem' }}>
                <p style={{ margin: 0 }}>{error}</p>
              </div>
            )}
            
            <button
              type="submit"
              disabled={loading}
              style={{
                width: '100%',
                padding: '0.75rem',
                backgroundColor: loading ? '#999' : '#0d5d2f',
                color: '#fff',
                border: 'none',
                borderRadius: '4px',
                cursor: loading ? 'not-allowed' : 'pointer',
                fontSize: '1rem',
                fontWeight: 'bold'
              }}
            >
              {loading ? 'Processing Payment…' : 'Complete Purchase'}
            </button>
            
            <p style={{ marginTop: '1rem', textAlign: 'center', color: '#666', fontSize: '0.9rem' }}>
              Your payment is secure and encrypted. You can cancel your subscription at any time.
            </p>
          </form>
        </div>
      )}
    </main>
  );
};

export default PaymentPage;