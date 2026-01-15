import React, { useEffect, useState } from 'react';
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
  const { id } = useParams(); // This could be either extId (from search) or commerceContentId (from existing report)
  const navigate = useNavigate();
  const { token } = useAuth();
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [creatingReport, setCreatingReport] = useState(false);

  useEffect(() => {
    const fetchOrCreateReport = async () => {
      if (!id) {
        setError('Report ID is required');
        setLoading(false);
        return;
      }

      setLoading(true);
      setError('');

      try {
        // First, try to get report detail (assuming id is commerceContentId)
        try {
          const result = await getReportDetail(id);
          if (result.success && result.reportData) {
            setReport(result.reportData);
            setLoading(false);
            return;
          }
        } catch (detailError) {
          // If that fails, id might be an extId - try to create report
          if (process.env.NODE_ENV === 'development') {
            console.warn('Report detail not found, attempting to create report from extId:', id);
          }
        }

        // If report doesn't exist, try to create it from extId
        const identityContext = getIdentityContext();
        const searchContext = getSearchContext();
        
        if (identityContext && identityContext.extId === id) {
          // We have identity context, create report
          setCreatingReport(true);
          const createResult = await createReportForIdentity(id, identityContext);
          if (createResult.success && createResult.commerceContentId) {
            // Now fetch the report detail
            const detailResult = await getReportDetail(createResult.commerceContentId);
            if (detailResult.success && detailResult.reportData) {
              setReport(detailResult.reportData);
              // Update URL to use commerceContentId
              navigate(`/people/${createResult.commerceContentId}`, { replace: true });
            }
          }
        } else {
          // Try to get from sessionStorage (fallback for search results)
          const storedResult = sessionStorage.getItem(`result_${id}`);
          if (storedResult) {
            const personData = JSON.parse(storedResult);
            if (personData.extId) {
              setCreatingReport(true);
              const createResult = await createReportForIdentity(personData.extId, personData);
              if (createResult.success && createResult.commerceContentId) {
                const detailResult = await getReportDetail(createResult.commerceContentId);
                if (detailResult.success && detailResult.reportData) {
                  setReport(detailResult.reportData);
                  navigate(`/people/${createResult.commerceContentId}`, { replace: true });
                }
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

  // Extract report data from the new API response structure
  const extractReportData = (reportData) => {
    if (!reportData) return null;
    
    // The report structure from new API may have raws array with transient data
    const raws = reportData.raws || [];
    const identities = raws.find(r => r.transient?.identities)?.transient?.identities || [];
    const fullContact = raws.find(r => r.transient?.fullContact)?.transient?.fullContact;
    const familyWatchdog = raws.find(r => r.transient?.familyWatchdog)?.transient?.familyWatchdog;
    
    const primaryIdentity = identities[0] || {};
    const nameList = primaryIdentity.nameList || [];
    const addressList = primaryIdentity.addressList || [];
    
    return {
      fullName: nameList[0]?.data || 'Unknown',
      ageRange: primaryIdentity.ageRange || '',
      location: addressList.map(addr => {
        const parts = [];
        if (addr.city) parts.push(addr.city);
        if (addr.state) parts.push(addr.state);
        if (addr.zip) parts.push(addr.zip);
        return parts.join(', ');
      }).filter(Boolean).join('; ') || '',
      fullContact,
      familyWatchdog,
      identities,
      rawData: reportData
    };
  };

  const reportInfo = report ? extractReportData(report) : null;

  return (
    <main style={{ padding: '2rem', maxWidth: '1200px', margin: '0 auto' }}>
      <h1 style={{ color: '#0d5d2f', marginBottom: '1.5rem' }}>Report Details</h1>
      
      {loading && (
        <div style={{ textAlign: 'center', padding: '3rem' }}>
          {creatingReport ? (
            <p>Creating report... Please wait.</p>
          ) : (
            <p>Loading report...</p>
          )}
        </div>
      )}
      
      {error && (
        <div style={{
          padding: '1.5rem',
          backgroundColor: '#f8fafc',
          color: '#0f172a',
          borderRadius: '0.75rem',
          marginBottom: '1.5rem',
          border: '1px solid #e2e8f0'
        }}>
          <p style={{ margin: 0, fontWeight: 600 }}>We couldn’t load this report.</p>
          <p style={{ margin: '0.5rem 0 1rem', color: '#475569' }}>
            {error}
          </p>
          <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
            <button
              onClick={() => navigate('/people-search')}
              style={{ padding: '0.5rem 1rem', borderRadius: '6px', border: '1px solid #94a3b8', background: '#fff' }}
            >
              Back to Search
            </button>
            <button
              onClick={() => navigate('/dashboard')}
              style={{ padding: '0.5rem 1rem', borderRadius: '6px', border: '1px solid #0d5d2f', background: '#0d5d2f', color: '#fff' }}
            >
              Go to Dashboard
            </button>
          </div>
        </div>
      )}
      
      {reportInfo && (
        <div>
          <div style={{ 
            backgroundColor: '#f9fafb', 
            padding: '2rem', 
            borderRadius: '0.75rem',
            marginBottom: '2rem',
            border: '1px solid #e5e7eb'
          }}>
            <h2 style={{ color: '#0d5d2f', marginTop: 0, marginBottom: '1rem' }}>
              {reportInfo.fullName}
            </h2>
            {reportInfo.ageRange && (
              <p style={{ color: '#666', marginBottom: '0.5rem' }}>
                <strong>Age:</strong> {reportInfo.ageRange}
              </p>
            )}
            {reportInfo.location && (
              <p style={{ color: '#666', marginBottom: '0.5rem' }}>
                <strong>Location:</strong> {reportInfo.location}
              </p>
            )}
          </div>

          {/* Full Contact Information */}
          {reportInfo.fullContact && (
            <div style={{ 
              backgroundColor: '#fff', 
              padding: '2rem', 
              borderRadius: '0.75rem',
              marginBottom: '2rem',
              border: '1px solid #e5e7eb',
              boxShadow: '0 2px 4px rgba(0, 0, 0, 0.05)'
            }}>
              <h3 style={{ color: '#0d5d2f', marginTop: 0, marginBottom: '1rem' }}>
                Contact Information
              </h3>
              <pre style={{ 
                backgroundColor: '#f9fafb', 
                padding: '1rem', 
                borderRadius: '0.5rem',
                overflow: 'auto',
                fontSize: '0.875rem'
              }}>
                {JSON.stringify(reportInfo.fullContact, null, 2)}
              </pre>
            </div>
          )}

          {/* Family Watchdog Information */}
          {reportInfo.familyWatchdog && (
            <div style={{ 
              backgroundColor: '#fff', 
              padding: '2rem', 
              borderRadius: '0.75rem',
              marginBottom: '2rem',
              border: '1px solid #e5e7eb',
              boxShadow: '0 2px 4px rgba(0, 0, 0, 0.05)'
            }}>
              <h3 style={{ color: '#0d5d2f', marginTop: 0, marginBottom: '1rem' }}>
                Family Watchdog Information
              </h3>
              <pre style={{ 
                backgroundColor: '#f9fafb', 
                padding: '1rem', 
                borderRadius: '0.5rem',
                overflow: 'auto',
                fontSize: '0.875rem'
              }}>
                {JSON.stringify(reportInfo.familyWatchdog, null, 2)}
              </pre>
            </div>
          )}

          {/* All Identities */}
          {reportInfo.identities && reportInfo.identities.length > 0 && (
            <div style={{ 
              backgroundColor: '#fff', 
              padding: '2rem', 
              borderRadius: '0.75rem',
              marginBottom: '2rem',
              border: '1px solid #e5e7eb',
              boxShadow: '0 2px 4px rgba(0, 0, 0, 0.05)'
            }}>
              <h3 style={{ color: '#0d5d2f', marginTop: 0, marginBottom: '1rem' }}>
                All Identities ({reportInfo.identities.length})
              </h3>
              {reportInfo.identities.map((identity, index) => (
                <div key={index} style={{ 
                  padding: '1rem', 
                  backgroundColor: '#f9fafb', 
                  borderRadius: '0.5rem',
                  marginBottom: '1rem'
                }}>
                  <p><strong>Name:</strong> {identity.nameList?.[0]?.data || 'Unknown'}</p>
                  {identity.addressList && identity.addressList.length > 0 && (
                    <p><strong>Addresses:</strong> {identity.addressList.map(a => 
                      `${a.city || ''} ${a.state || ''} ${a.zip || ''}`.trim()
                    ).join(', ')}</p>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </main>
  );
};

export default SearchResultDetailPage;