import React, { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import api from '../../api';
import { useAuth } from '../../context/AuthContext';
import { getReportList } from '../../services/reportService';
import Skeleton from '../../components/Skeleton';
import styles from './AccountPage.module.css';

/**
 * Account and billing management page for members.
 */
const AccountPage = () => {
  const navigate = useNavigate();
  const { token, subscription, isPaid, refreshSubscription } = useAuth();
  const [reports, setReports] = useState([]);
  const [reportsLoading, setReportsLoading] = useState(true);
  const [reportsError, setReportsError] = useState('');
  const [lastReportId, setLastReportId] = useState(null);
  const [hasMoreReports, setHasMoreReports] = useState(false);
  const [error, setError] = useState('');
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [pdfDownloadingId, setPdfDownloadingId] = useState(null);

  useEffect(() => {
    if (!token) {
      setError('Not authenticated');
      return;
    }

    // Fetch reports list - errors are handled in fetchReports function
    fetchReports().catch(err => {
      // Ensure fetchReports errors don't cause unhandled promise rejection
      if (process.env.NODE_ENV === 'development') {
        console.warn('[AccountPage] fetchReports error caught in useEffect:', err);
      }
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

  const handleDownloadPdf = async (e, commerceContentId) => {
    e.stopPropagation();
    if (pdfDownloadingId) return;
    setPdfDownloadingId(commerceContentId);
    try {
      await api.downloadPdfReport(commerceContentId);
    } catch (err) {
      console.error('[AccountPage] PDF download failed:', err?.message);
    } finally {
      setPdfDownloadingId(null);
    }
  };

  const handleCancelConfirm = async () => {
    if (!token) {
      setError('Not authenticated');
      return;
    }
    setShowCancelModal(false);
    try {
      await api.delete('/subscription', { token });
      refreshSubscription();
      setError('');
    } catch (err) {
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
    <main className={styles.pageWrapper}>
      <h1 className={styles.pageTitle}>Account &amp; Billing</h1>

      {/* Cancel Confirmation Modal */}
      {showCancelModal && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000
        }}>
          <div style={{
            background: '#fff', borderRadius: '0.75rem', padding: '2rem',
            maxWidth: '420px', width: '90%', boxShadow: '0 20px 60px rgba(0,0,0,0.3)'
          }}>
            <h3 style={{ marginTop: 0, color: '#111827' }}>Cancel Subscription?</h3>
            <p style={{ color: '#6b7280', lineHeight: '1.6' }}>
              Your access will remain active until the end of your billing period. After that, you will lose access to all reports and member features.
            </p>
            <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end', marginTop: '1.5rem' }}>
              <button
                onClick={() => setShowCancelModal(false)}
                style={{ padding: '0.6rem 1.25rem', border: '1px solid #d1d5db', borderRadius: '0.375rem', background: '#fff', cursor: 'pointer' }}
              >
                Keep Subscription
              </button>
              <button
                onClick={handleCancelConfirm}
                style={{ padding: '0.6rem 1.25rem', background: '#dc2626', color: '#fff', border: 'none', borderRadius: '0.375rem', cursor: 'pointer' }}
              >
                Yes, Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Subscription Section */}
      <div className={styles.section}>
        <h2 className={styles.sectionTitle}>Subscription</h2>
        {error ? (
          <p className={styles.errorText}>{error}</p>
        ) : isPaid && subscription ? (
          <div>
            <div className={styles.planInfo}>
              <span><strong>Plan:</strong> {subscription.plan || 'Basic'}</span>
              <span className={`${styles.subscriptionBadge} ${styles.active}`}>Active</span>
              <span><strong>Renewal date:</strong> {subscription.renewalDate || 'N/A'}</span>
            </div>
            <button className={styles.cancelBtn} onClick={() => setShowCancelModal(true)}>
              Cancel Subscription
            </button>
          </div>
        ) : (
          <div>
            <p style={{ color: '#6b7280', marginBottom: '1rem' }}>You do not have an active subscription.</p>
            <Link
              to="/payment"
              style={{
                display: 'inline-block',
                padding: '0.75rem 1.5rem',
                background: '#0d5d2f',
                color: '#fff',
                borderRadius: '0.5rem',
                textDecoration: 'none',
                fontWeight: 600,
                fontSize: '0.9rem',
              }}
            >
              Upgrade to Pro — $29.99/month
            </Link>
          </div>
        )}
      </div>

      {/* Reports Section */}
      <div className={styles.section}>
        <h2 className={styles.sectionTitle}>Your Reports</h2>

        {reportsLoading && reports.length === 0 ? (
          <div>
            <Skeleton variant="card" height={72} style={{ marginBottom: '0.75rem' }} />
            <Skeleton variant="card" height={72} style={{ marginBottom: '0.75rem' }} />
            <Skeleton variant="card" height={72} style={{ marginBottom: '0.75rem' }} />
          </div>
        ) : reportsError ? (
          <p className={styles.errorText}>{reportsError}</p>
        ) : reports.length === 0 ? (
          <p className={styles.emptyState}>You haven't created any reports yet.</p>
        ) : (
          <>
            <ul className={styles.reportsList}>
              {reports.map((report, index) => {
                const reportInfo = getReportInfo(report);
                return (
                  <li
                    key={reportInfo.id || index}
                    className={styles.reportItem}
                    onClick={() => handleViewReport(reportInfo.id)}
                  >
                    <div>
                      <p className={styles.reportName}>{reportInfo.name}</p>
                      <p className={styles.reportDate}>
                        Created: {(() => {
                          try {
                            const date = new Date(reportInfo.createdAt);
                            if (isNaN(date.getTime())) return 'Unknown date';
                            return date.toLocaleDateString();
                          } catch (e) {
                            return 'Unknown date';
                          }
                        })()}
                      </p>
                    </div>
                    <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                      <button
                        className={styles.viewBtn}
                        onClick={(e) => {
                          e.stopPropagation();
                          handleViewReport(reportInfo.id);
                        }}
                      >
                        View Report
                      </button>
                      <button
                        className={styles.viewBtn}
                        style={{ background: 'transparent', color: '#0d5d2f', border: '1px solid #0d5d2f' }}
                        onClick={(e) => handleDownloadPdf(e, reportInfo.id)}
                        disabled={pdfDownloadingId === reportInfo.id}
                        title="Download PDF"
                      >
                        {pdfDownloadingId === reportInfo.id ? '…' : '↓ PDF'}
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>

            {hasMoreReports ? (
              <button
                className={styles.loadMoreBtn}
                onClick={handleLoadMoreReports}
                disabled={reportsLoading}
              >
                {reportsLoading ? 'Loading...' : 'Load More Reports'}
              </button>
            ) : (
              reports.length > 0 && (
                <p style={{ textAlign: 'center', color: '#9ca3af', fontSize: '0.875rem', marginTop: '1rem' }}>
                  All reports loaded
                </p>
              )
            )}
          </>
        )}
      </div>
    </main>
  );
};

export default AccountPage;