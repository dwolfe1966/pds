import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../api';
import { useAuth } from '../../context/AuthContext';
import { getReportList } from '../../services/reportService';

/**
 * Account and billing management page for members.
 */
const AccountPage = () => {
  const navigate = useNavigate();
  const { token } = useAuth();
  const [subscription, setSubscription] = useState(null);
  const [reports, setReports] = useState([]);
  const [reportsLoading, setReportsLoading] = useState(true);
  const [reportsError, setReportsError] = useState('');
  const [lastReportId, setLastReportId] = useState(null);
  const [hasMoreReports, setHasMoreReports] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchData = async () => {
      if (!token) {
        setLoading(false);
        setError('Not authenticated');
        return;
      }

      // Fetch subscription - wrap in promise to ensure errors are caught
      try {
        if (process.env.NODE_ENV === 'development') {
          console.log('[AccountPage] Fetching subscription with token:', token ? 'present' : 'missing');
        }
        const data = await api.get('/subscription', { token }).catch(err => {
          // Handle error here to prevent unhandled promise rejection
          if (process.env.NODE_ENV === 'development') {
            console.warn('[AccountPage] Subscription API error:', {
              message: err?.message,
              status: err?.status,
              statusText: err?.statusText,
              data: err?.data
            });
          }
          throw err; // Re-throw to be caught by outer catch
        });
        if (data) {
          setSubscription(data);
          setError(''); // Clear any previous errors
        } else {
          setSubscription(null);
        }
      } catch (err) {
        // Silently handle errors - don't log to console.error to avoid React error overlay
        if (process.env.NODE_ENV === 'development') {
          console.warn('[AccountPage] Failed to fetch subscription:', {
            message: err?.message,
            status: err?.status,
            statusText: err?.statusText,
            data: err?.data
          });
        }
        const errorMessage = err?.message || err?.data?.error?.message || err?.statusText || 'Failed to load subscription';
        setError(errorMessage);
        // Set subscription to null so UI shows appropriate message
        setSubscription(null);
      } finally {
        setLoading(false);
      }
      
      // Fetch reports list - errors are handled in fetchReports function
      if (token) {
        fetchReports().catch(err => {
          // Ensure fetchReports errors don't cause unhandled promise rejection
          if (process.env.NODE_ENV === 'development') {
            console.warn('[AccountPage] fetchReports error caught in useEffect:', err);
          }
        });
      }
    };
    
    // Wrap in try-catch to ensure no unhandled errors
    fetchData().catch(err => {
      console.warn('[AccountPage] Unhandled error in fetchData:', err);
      setLoading(false);
      setError('An unexpected error occurred');
    });
  }, [token]);

  const fetchReports = async (lastId = null) => {
    if (!token) {
      setReportsLoading(false);
      setReportsError('Not authenticated');
      return;
    }

    setReportsLoading(true);
    setReportsError('');
    try {
      if (process.env.NODE_ENV === 'development') {
        console.log('[AccountPage] Fetching reports with token:', token ? 'present' : 'missing');
      }
      const result = await getReportList({ lastId, token });
      if (result && result.success) {
        if (lastId) {
          // Append to existing reports (pagination)
          setReports(prev => [...prev, ...(result.reports || [])]);
        } else {
          // First page
          setReports(result.reports || []);
        }
        setLastReportId(result.pagination?.lastId || null);
        setHasMoreReports(result.pagination?.hasMore || false);
      } else {
        console.warn('[AccountPage] Report list returned unsuccessful result:', result);
        setReportsError('Failed to load reports');
      }
    } catch (err) {
      // Use console.warn instead of console.error to avoid React error overlay
      if (process.env.NODE_ENV === 'development') {
        console.warn('[AccountPage] Failed to fetch reports:', {
          message: err?.message,
          status: err?.status,
          statusText: err?.statusText,
          data: err?.data
        });
      }
      const errorMessage = err?.message || err?.data?.error?.message || 'Failed to load reports';
      setReportsError(errorMessage);
      // Don't clear existing reports on error, just show the error message
    } finally {
      setReportsLoading(false);
    }
  };

  const handleLoadMoreReports = () => {
    if (lastReportId && !reportsLoading) {
      fetchReports(lastReportId);
    }
  };

  const handleViewReport = (commerceContentId) => {
    navigate(`/people/${commerceContentId}`);
  };

  const handleCancel = async () => {
    if (!token) {
      setError('Not authenticated');
      return;
    }

    if (!window.confirm('Are you sure you want to cancel your subscription?')) {
      return;
    }

    try {
      await api.delete('/subscription', { token });
      setSubscription(null);
      setError(''); // Clear any errors
    } catch (err) {
      console.error('[AccountPage] Failed to cancel subscription:', err);
      const errorMessage = err?.message || err?.data?.error?.message || 'Failed to cancel subscription';
      setError(errorMessage);
    }
  };

  // Extract report info from report data
  const getReportInfo = (report) => {
    try {
      // Report structure from API may vary
      const commerceContent = report?.commerceContent || report || {};
      const teaserInput = report?.data?.teaserInput || report?.teaserInput;
      const createdAt = report?.createdAt || report?.created_at || new Date().toISOString();
      
      // Try to extract name from teaserInput or report data
      let reportName = 'Report';
      if (teaserInput) {
        if (typeof teaserInput === 'string') {
          reportName = teaserInput;
        } else if (teaserInput?.fName && teaserInput?.lName) {
          reportName = `${teaserInput.fName} ${teaserInput.lName}`;
        } else if (teaserInput?.name) {
          reportName = teaserInput.name;
        }
      }
      
      // Extract ID safely
      const id = commerceContent?._id || commerceContent?.id || report?._id || report?.id || `report-${Date.now()}`;
      
      return {
        id,
        name: reportName,
        createdAt,
        teaserInput
      };
    } catch (err) {
      console.error('[AccountPage] Error extracting report info:', err, report);
      // Return safe defaults
      return {
        id: `report-${Date.now()}`,
        name: 'Report',
        createdAt: new Date().toISOString(),
        teaserInput: null
      };
    }
  };

  return (
    <main style={{ padding: '2rem', maxWidth: '1200px', margin: '0 auto' }}>
      <h1 style={{ color: '#0d5d2f', marginBottom: '2rem' }}>Account & Billing</h1>
      
      {/* Subscription Section */}
      <div style={{ 
        backgroundColor: '#f9fafb', 
        padding: '2rem', 
        borderRadius: '0.75rem',
        marginBottom: '2rem',
        border: '1px solid #e5e7eb'
      }}>
        <h2 style={{ color: '#0d5d2f', marginTop: 0, marginBottom: '1rem' }}>Subscription</h2>
        {loading ? (
          <p>Loading subscription…</p>
        ) : error ? (
          <p style={{ color: '#c00' }}>{error}</p>
        ) : subscription ? (
          <div>
            <p><strong>Plan:</strong> {subscription.plan || 'Basic'}</p>
            <p><strong>Renewal date:</strong> {subscription.renewalDate || 'N/A'}</p>
            <button 
              onClick={handleCancel}
              style={{
                marginTop: '1rem',
                padding: '0.75rem 1.5rem',
                backgroundColor: '#dc2626',
                color: '#fff',
                border: 'none',
                borderRadius: '0.5rem',
                cursor: 'pointer',
                fontSize: '1rem'
              }}
            >
              Cancel Subscription
            </button>
          </div>
        ) : (
          <p>You do not have an active subscription.</p>
        )}
      </div>

      {/* Reports Section */}
      <div style={{ 
        backgroundColor: '#f9fafb', 
        padding: '2rem', 
        borderRadius: '0.75rem',
        border: '1px solid #e5e7eb'
      }}>
        <h2 style={{ color: '#0d5d2f', marginTop: 0, marginBottom: '1.5rem' }}>Your Reports</h2>
        
        {reportsLoading && reports.length === 0 ? (
          <p>Loading reports…</p>
        ) : reportsError ? (
          <p style={{ color: '#c00' }}>{reportsError}</p>
        ) : reports.length === 0 ? (
          <p style={{ color: '#6b7280' }}>You haven't created any reports yet.</p>
        ) : (
          <>
            <div style={{ display: 'grid', gap: '1rem', marginBottom: '1.5rem' }}>
              {reports.map((report, index) => {
                const reportInfo = getReportInfo(report);
                return (
                  <div 
                    key={reportInfo.id || index}
                    style={{
                      backgroundColor: '#fff',
                      padding: '1.5rem',
                      borderRadius: '0.5rem',
                      border: '1px solid #e5e7eb',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      cursor: 'pointer',
                      transition: 'all 0.2s ease'
                    }}
                    onClick={() => handleViewReport(reportInfo.id)}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.borderColor = '#0d5d2f';
                      e.currentTarget.style.boxShadow = '0 2px 4px rgba(0, 0, 0, 0.1)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.borderColor = '#e5e7eb';
                      e.currentTarget.style.boxShadow = 'none';
                    }}
                  >
                    <div>
                      <h3 style={{ 
                        color: '#0d5d2f', 
                        margin: '0 0 0.5rem 0',
                        fontSize: '1.125rem'
                      }}>
                        {reportInfo.name}
                      </h3>
                      <p style={{ color: '#6b7280', margin: 0, fontSize: '0.875rem' }}>
                        Created: {(() => {
                          try {
                            const date = new Date(reportInfo.createdAt);
                            if (isNaN(date.getTime())) {
                              return 'Unknown date';
                            }
                            return date.toLocaleDateString();
                          } catch (e) {
                            return 'Unknown date';
                          }
                        })()}
                      </p>
                    </div>
                    <button
                      style={{
                        padding: '0.5rem 1rem',
                        backgroundColor: '#0d5d2f',
                        color: '#fff',
                        border: 'none',
                        borderRadius: '0.375rem',
                        cursor: 'pointer',
                        fontSize: '0.875rem',
                        fontWeight: 500
                      }}
                      onClick={(e) => {
                        e.stopPropagation();
                        handleViewReport(reportInfo.id);
                      }}
                    >
                      View Report
                    </button>
                  </div>
                );
              })}
            </div>
            
            {hasMoreReports && (
              <button
                onClick={handleLoadMoreReports}
                disabled={reportsLoading}
                style={{
                  width: '100%',
                  padding: '0.75rem',
                  backgroundColor: reportsLoading ? '#9ca3af' : '#0d5d2f',
                  color: '#fff',
                  border: 'none',
                  borderRadius: '0.5rem',
                  cursor: reportsLoading ? 'not-allowed' : 'pointer',
                  fontSize: '1rem',
                  fontWeight: 500
                }}
              >
                {reportsLoading ? 'Loading...' : 'Load More Reports'}
              </button>
            )}
          </>
        )}
      </div>
    </main>
  );
};

export default AccountPage;