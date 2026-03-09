import React, { useEffect, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../../api';
import { useAuth } from '../../context/AuthContext';
import { getReportDetail, createReportForIdentity, getExistingReportId } from '../../services/reportService';
import { getIdentityContext, getSearchContext } from '../../services/searchContext';

/**
 * Shows a detailed report for a selected person.
 * Uses commerceContentId to fetch full report from new API.
 * If report doesn't exist, creates it first.
 */
const SearchResultDetailPage = () => {
  const { id } = useParams(); // extId (from search) or commerceContentId (from existing report)
  const navigate = useNavigate();
  const { token } = useAuth();
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [creatingReport, setCreatingReport] = useState(false);
  const lastTrackedRef = useRef(null);

  useEffect(() => {
    const fetchOrCreateReport = async () => {
      if (!id || id === 'undefined' || id === 'null') {
        setError('Report ID is required');
        setLoading(false);
        return;
      }

      setLoading(true);
      setError('');

      try {
        // Check sessionStorage cache first (populated when report was just created)
        // This avoids a redundant API call when navigating directly from a create step
        try {
          const cached = sessionStorage.getItem(`report_cache_${id}`);
          if (cached) {
            const parsed = JSON.parse(cached);
            // Only use cache if it has identities — otherwise fall through to getReportDetail
            if (parsed.success && parsed.identities?.length > 0) {
              setReport(parsed);
              setLoading(false);
              return;
            }
          }
        } catch (e) {
          // Cache miss or parse error — fall through to API call
        }

        // Try to get report detail via API (id should be commerceContentId)
        try {
          const result = await getReportDetail(id);
          if (result.success) {
            setReport(result);
            setLoading(false);
            return;
          }
        } catch (detailError) {
          if (process.env.NODE_ENV === 'development') {
            console.warn('Report detail not found, attempting to create report from extId:', id);
          }
        }

        // If report doesn't exist, try to create it from extId
        const identityContext = getIdentityContext();

        if (identityContext && identityContext.extId === id) {
          setCreatingReport(true);
          const createResult = await createReportForIdentity(id, identityContext);
          if (createResult.success && createResult.commerceContentId) {
            // Use the create result directly — it already contains the full report data
            setReport(createResult);
            navigate(`/people/${createResult.commerceContentId}`, { replace: true });
          }
        } else {
          const storedResult = sessionStorage.getItem(`result_${id}`);
          if (storedResult) {
            const personData = JSON.parse(storedResult);
            if (personData.extId) {
              setCreatingReport(true);
              const createResult = await createReportForIdentity(personData.extId, personData);
              if (createResult.success && createResult.commerceContentId) {
                setReport(createResult);
                navigate(`/people/${createResult.commerceContentId}`, { replace: true });
              }
            } else {
              setError('We could not load this report right now. Please try again later.');
            }
          } else {
            setError('We could not load this report right now. Please try again later.');
          }
        }
      } catch (err) {
        if (process.env.NODE_ENV === 'development') {
          console.warn('Error fetching/creating report:', err);
        }
        setError('We could not load this report right now. Please try again later.');
      } finally {
        setLoading(false);
        setCreatingReport(false);
      }
    };

    if (token) {
      fetchOrCreateReport();
    } else {
      setError('Please log in to view reports');
      setLoading(false);
    }
  }, [id, token, navigate]);

  useEffect(() => {
    if (!token || !id) return;
    if (lastTrackedRef.current === id) return;
    lastTrackedRef.current = id;

    const identityContext = getIdentityContext();
    const targetType = identityContext?.extId === id ? 'person' : 'report';

    api.post('/profile-views', {
      body: { targetId: id, targetType, source: 'member-report' },
      token
    }).catch((err) => {
      if (process.env.NODE_ENV === 'development') {
        console.warn('[SearchResultDetailPage] Failed to record profile view:', err?.message || err);
      }
    });
  }, [id, token]);

  // Extract display data from the rich result returned by reportService
  const extractReportData = (result) => {
    if (!result) return null;

    // Rich structure from updated reportService: { identities, fullContact, familyWatchdog, raws, ... }
    const identities =
      result.identities ||
      result.raws?.find((r) => r.transient?.identities)?.transient?.identities ||
      [];
    const fullContact =
      result.fullContact ||
      result.raws?.find((r) => r.transient?.fullContact)?.transient?.fullContact ||
      null;
    const familyWatchdog =
      result.familyWatchdog ||
      result.raws?.find((r) => r.transient?.familyWatchdog)?.transient?.familyWatchdog ||
      null;

    const primaryIdentity = identities[0] || {};
    const nameList = primaryIdentity.nameList || [];
    const addressList = primaryIdentity.addressList || [];

    return {
      fullName: nameList[0]?.data || 'Unknown',
      ageRange: primaryIdentity.ageRange || '',
      location: addressList
        .map((addr) => {
          const parts = [];
          if (addr.city) parts.push(addr.city);
          if (addr.state) parts.push(addr.state);
          if (addr.zip) parts.push(addr.zip);
          return parts.join(', ');
        })
        .filter(Boolean)
        .join('; ') || '',
      fullContact,
      familyWatchdog,
      identities,
    };
  };

  const reportInfo = report ? extractReportData(report) : null;

  const cardStyle = {
    backgroundColor: '#fff',
    padding: '2rem',
    borderRadius: '0.75rem',
    marginBottom: '2rem',
    border: '1px solid #e5e7eb',
    boxShadow: '0 2px 4px rgba(0,0,0,0.05)',
  };

  const sectionHeadStyle = {
    color: '#0d5d2f',
    marginTop: 0,
    marginBottom: '1rem',
    fontSize: '1.125rem',
    fontWeight: 600,
  };

  const labelStyle = { color: '#6b7280', fontSize: '0.8125rem', marginBottom: '0.25rem' };
  const valueStyle = { color: '#111827', fontSize: '0.9375rem', marginBottom: '0.75rem' };

  return (
    <main style={{ padding: '2rem', maxWidth: '1200px', margin: '0 auto' }}>
      <h1 style={{ color: '#0d5d2f', marginBottom: '1.5rem' }}>Report Details</h1>

      {loading && (
        <div style={{ textAlign: 'center', padding: '3rem' }}>
          <p>{creatingReport ? 'Creating report… Please wait.' : 'Loading report…'}</p>
        </div>
      )}

      {error && (
        <div style={{
          padding: '1.5rem',
          backgroundColor: '#f8fafc',
          color: '#0f172a',
          borderRadius: '0.75rem',
          marginBottom: '1.5rem',
          border: '1px solid #e2e8f0',
        }}>
          <p style={{ margin: 0, fontWeight: 600 }}>We couldn't load this report.</p>
          <p style={{ margin: '0.5rem 0 1rem', color: '#475569' }}>{error}</p>
          <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
            <button
              onClick={() => navigate('/people-search')}
              style={{ padding: '0.5rem 1rem', borderRadius: '6px', border: '1px solid #94a3b8', background: '#fff', cursor: 'pointer' }}
            >
              Back to Search
            </button>
            <button
              onClick={() => navigate('/dashboard')}
              style={{ padding: '0.5rem 1rem', borderRadius: '6px', border: '1px solid #0d5d2f', background: '#0d5d2f', color: '#fff', cursor: 'pointer' }}
            >
              Go to Dashboard
            </button>
          </div>
        </div>
      )}

      {reportInfo && (
        <div>
          {/* Identity Summary */}
          <div style={{ ...cardStyle, backgroundColor: '#f9fafb' }}>
            <h2 style={{ color: '#0d5d2f', marginTop: 0, marginBottom: '1rem' }}>
              {reportInfo.fullName}
            </h2>
            {reportInfo.ageRange && (
              <p style={{ color: '#666', marginBottom: '0.5rem' }}>
                <strong>Age:</strong> {reportInfo.ageRange}
              </p>
            )}
            {reportInfo.location && (
              <p style={{ color: '#666', marginBottom: 0 }}>
                <strong>Location:</strong> {reportInfo.location}
              </p>
            )}
          </div>

          {/* Contact Information (FullContact) */}
          {reportInfo.fullContact && (
            <div style={cardStyle}>
              <h3 style={sectionHeadStyle}>Contact Information</h3>
              <FullContactSection data={reportInfo.fullContact} labelStyle={labelStyle} valueStyle={valueStyle} />
            </div>
          )}

          {/* Sex Offender / Family Watchdog */}
          {reportInfo.familyWatchdog && (
            <div style={cardStyle}>
              <h3 style={sectionHeadStyle}>Family Watchdog</h3>
              <FamilyWatchdogSection data={reportInfo.familyWatchdog} labelStyle={labelStyle} valueStyle={valueStyle} />
            </div>
          )}

          {/* All Associated Identities */}
          {reportInfo.identities && reportInfo.identities.length > 1 && (
            <div style={cardStyle}>
              <h3 style={sectionHeadStyle}>
                Associated Identities ({reportInfo.identities.length})
              </h3>
              {reportInfo.identities.map((identity, index) => (
                <IdentityCard key={index} identity={identity} index={index} />
              ))}
            </div>
          )}
        </div>
      )}
    </main>
  );
};

/* ─── Sub-components ─────────────────────────────────────────────────── */

const FullContactSection = ({ data, labelStyle, valueStyle }) => {
  if (!data) return null;

  const phones = data.phones || data.phoneNumbers || [];
  const emails = data.emails || data.emailAddresses || [];
  const addresses = data.addresses || [];
  const relatives = data.relatives || data.associates || [];
  const socialProfiles = data.socialProfiles || data.social || [];

  const pillStyle = {
    display: 'inline-block',
    backgroundColor: '#f0fdf4',
    border: '1px solid #bbf7d0',
    borderRadius: '99px',
    padding: '0.25rem 0.75rem',
    fontSize: '0.875rem',
    color: '#15803d',
    marginRight: '0.5rem',
    marginBottom: '0.5rem',
  };

  return (
    <div>
      {phones.length > 0 && (
        <div style={{ marginBottom: '1.25rem' }}>
          <p style={labelStyle}>Phone Numbers</p>
          <div>
            {phones.map((p, i) => (
              <span key={i} style={pillStyle}>
                {formatPhone(p.number || p.value || p)} {p.type ? `(${p.type})` : ''}
              </span>
            ))}
          </div>
        </div>
      )}

      {emails.length > 0 && (
        <div style={{ marginBottom: '1.25rem' }}>
          <p style={labelStyle}>Email Addresses</p>
          <div>
            {emails.map((e, i) => (
              <span key={i} style={{ ...pillStyle, backgroundColor: '#eff6ff', borderColor: '#bfdbfe', color: '#1d4ed8' }}>
                {e.address || e.value || e}
              </span>
            ))}
          </div>
        </div>
      )}

      {addresses.length > 0 && (
        <div style={{ marginBottom: '1.25rem' }}>
          <p style={labelStyle}>Addresses</p>
          {addresses.map((addr, i) => (
            <p key={i} style={{ ...valueStyle, marginBottom: '0.375rem' }}>
              {[addr.street, addr.city, addr.state, addr.zip].filter(Boolean).join(', ')}
            </p>
          ))}
        </div>
      )}

      {relatives.length > 0 && (
        <div style={{ marginBottom: '1.25rem' }}>
          <p style={labelStyle}>Relatives / Associates</p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
            {relatives.map((rel, i) => (
              <span key={i} style={{ ...pillStyle, backgroundColor: '#faf5ff', borderColor: '#e9d5ff', color: '#7e22ce' }}>
                {rel.name || rel.fullName || rel} {rel.relationship ? `— ${rel.relationship}` : ''}
              </span>
            ))}
          </div>
        </div>
      )}

      {socialProfiles.length > 0 && (
        <div>
          <p style={labelStyle}>Social Profiles</p>
          <div>
            {socialProfiles.map((sp, i) => (
              <span key={i} style={{ ...pillStyle, backgroundColor: '#fff7ed', borderColor: '#fed7aa', color: '#c2410c' }}>
                {sp.network || sp.type}: {sp.url || sp.username || sp.id || sp}
              </span>
            ))}
          </div>
        </div>
      )}

      {phones.length === 0 && emails.length === 0 && addresses.length === 0 && relatives.length === 0 && (
        <p style={{ color: '#9ca3af', fontSize: '0.875rem' }}>No contact details available.</p>
      )}
    </div>
  );
};

const FamilyWatchdogSection = ({ data, labelStyle, valueStyle }) => {
  if (!data) return null;

  const offenders = data.offenders || (Array.isArray(data) ? data : []);

  if (offenders.length === 0) {
    return (
      <div style={{
        padding: '1rem',
        backgroundColor: '#f0fdf4',
        borderRadius: '0.5rem',
        border: '1px solid #bbf7d0',
        display: 'flex',
        alignItems: 'center',
        gap: '0.5rem',
      }}>
        <span style={{ fontSize: '1.25rem' }}>✓</span>
        <p style={{ margin: 0, color: '#15803d', fontWeight: 500 }}>
          No registered sex offenders found near this address.
        </p>
      </div>
    );
  }

  return (
    <div>
      <div style={{
        padding: '0.75rem 1rem',
        backgroundColor: '#fff7ed',
        borderRadius: '0.5rem',
        border: '1px solid #fed7aa',
        marginBottom: '1rem',
      }}>
        <p style={{ margin: 0, color: '#c2410c', fontWeight: 500 }}>
          {offenders.length} registered sex offender{offenders.length !== 1 ? 's' : ''} found nearby.
        </p>
      </div>

      {offenders.map((offender, i) => (
        <div key={i} style={{
          padding: '1rem',
          backgroundColor: '#fafafa',
          borderRadius: '0.5rem',
          border: '1px solid #e5e7eb',
          marginBottom: '0.75rem',
        }}>
          <p style={{ ...valueStyle, fontWeight: 600, marginBottom: '0.375rem' }}>
            {offender.name || offender.fullName || 'Unknown'}
          </p>
          {offender.distance && (
            <p style={labelStyle}>Distance: <span style={{ color: '#374151' }}>{offender.distance}</span></p>
          )}
          {offender.offenseDescription && (
            <p style={labelStyle}>Offense: <span style={{ color: '#374151' }}>{offender.offenseDescription}</span></p>
          )}
          {offender.address && (
            <p style={labelStyle}>
              Address:{' '}
              <span style={{ color: '#374151' }}>
                {[
                  offender.address.street,
                  offender.address.city,
                  offender.address.state,
                  offender.address.zip,
                ].filter(Boolean).join(', ')}
              </span>
            </p>
          )}
        </div>
      ))}
    </div>
  );
};

const IdentityCard = ({ identity, index }) => {
  const nameList = identity.nameList || [];
  const addressList = identity.addressList || [];
  const phoneList = identity.phoneList || [];

  return (
    <div style={{
      padding: '1rem',
      backgroundColor: '#f9fafb',
      borderRadius: '0.5rem',
      marginBottom: '0.75rem',
      border: '1px solid #e5e7eb',
    }}>
      <p style={{ fontWeight: 600, marginBottom: '0.375rem', color: '#111827' }}>
        {nameList[0]?.data || 'Unknown'}
      </p>
      {addressList.length > 0 && (
        <p style={{ color: '#6b7280', fontSize: '0.875rem', marginBottom: '0.25rem' }}>
          {addressList.slice(0, 2).map((a) =>
            [a.city, a.state, a.zip].filter(Boolean).join(', ')
          ).join(' • ')}
        </p>
      )}
      {phoneList.length > 0 && (
        <p style={{ color: '#6b7280', fontSize: '0.875rem', marginBottom: 0 }}>
          {phoneList.slice(0, 2).map((p) => formatPhone(p.number || p.value || p)).join(' • ')}
        </p>
      )}
    </div>
  );
};

function formatPhone(raw) {
  if (!raw) return '';
  const digits = String(raw).replace(/\D/g, '');
  if (digits.length === 10) {
    return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
  }
  if (digits.length === 11 && digits[0] === '1') {
    return `+1 (${digits.slice(1, 4)}) ${digits.slice(4, 7)}-${digits.slice(7)}`;
  }
  return raw;
}

export default SearchResultDetailPage;
