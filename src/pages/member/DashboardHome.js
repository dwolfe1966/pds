import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import api from '../../api';
import { getReportList } from '../../services/reportService';

/**
 * Pro Dashboard for members.
 * Shows activity metrics, recent activity, quick actions, and feature highlights.
 * Matches the production dashboard design.
 */
const DashboardHome = () => {
  const navigate = useNavigate();
  const { user, token } = useAuth();
  const [metrics, setMetrics] = useState({
    searches: null,
    alerts: null,
    profileViews: null,
    reports: null
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchMetrics = async () => {
      if (!token) {
        setLoading(false);
        return;
      }

      try {
        // Fetch reports count
        try {
          if (!token) {
            console.warn('[Dashboard] No token available for report list request');
            setMetrics(prev => ({ ...prev, reports: 0 }));
          } else {
            console.log('[Dashboard] Fetching reports with token:', token ? 'present' : 'missing');
            const reportResult = await getReportList({ token });
            if (reportResult && reportResult.success) {
              setMetrics(prev => ({ ...prev, reports: reportResult.reports?.length || 0 }));
            } else {
              console.warn('[Dashboard] Report list request returned unsuccessful result:', reportResult);
              setMetrics(prev => ({ ...prev, reports: 0 }));
            }
          }
        } catch (err) {
          // More defensive error handling
          const errorMessage = err?.message || err?.toString() || 'Unknown error';
          const errorStatus = err?.status || err?.statusCode || 'N/A';
          const errorData = err?.data || err?.response?.data || null;
          
          console.error('[Dashboard] Failed to fetch reports:', errorMessage);
          console.error('[Dashboard] Error status:', errorStatus);
          if (errorData) {
            console.error('[Dashboard] Error data:', errorData);
          }
          if (err?.stack) {
            console.error('[Dashboard] Error stack:', err.stack);
          }
          
          setMetrics(prev => ({ ...prev, reports: 0 }));
        }

        // Fetch alerts count (if API available)
        try {
          const alertsData = await api.get('/alerts', { token });
          if (alertsData?.data) {
            setMetrics(prev => ({ ...prev, alerts: alertsData.data?.length || 0 }));
          }
        } catch (err) {
          // Alerts API may not be available yet or user not authenticated
          console.error('Failed to fetch alerts:', err);
          setMetrics(prev => ({ ...prev, alerts: 0 }));
        }

        // For now, use placeholder values for searches and profile views
        // These would come from actual API endpoints when available
        setMetrics(prev => ({
          ...prev,
          searches: 0,
          profileViews: 0
        }));
      } catch (err) {
        console.error('Failed to fetch dashboard metrics:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchMetrics();
  }, [token]);

  return (
    <main style={{ 
      padding: '2rem', 
      maxWidth: '1400px', 
      margin: '0 auto',
      backgroundColor: '#f9fafb',
      minHeight: '80vh'
    }}>
      {/* Dashboard Title */}
      <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
        <h1 style={{ 
          color: '#0d5d2f', 
          fontSize: '2.5rem',
          fontWeight: 700,
          marginBottom: '0.5rem'
        }}>
          Pro Dashboard
        </h1>
        <p style={{ 
          color: '#6b7280', 
          fontSize: '1.125rem'
        }}>
          Welcome to your IDLookup Pro dashboard
        </p>
      </div>

      {/* Pro Member Status Banner */}
      <div style={{
        backgroundColor: '#f0fdf4',
        border: '1px solid #86efac',
        borderRadius: '0.75rem',
        padding: '1.5rem',
        marginBottom: '2rem',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <div style={{
            width: '40px',
            height: '40px',
            borderRadius: '50%',
            backgroundColor: '#0d5d2f',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#fff',
            fontSize: '1.25rem'
          }}>
            ⭐
          </div>
          <div>
            <h3 style={{ 
              color: '#166534', 
              margin: 0,
              marginBottom: '0.25rem',
              fontSize: '1.25rem',
              fontWeight: 600
            }}>
              Pro Member
            </h3>
            <p style={{ 
              color: '#166534', 
              margin: 0,
              fontSize: '0.875rem'
            }}>
              You have full access to all Pro features including unlimited searches, detailed reports, and advanced analytics
            </p>
          </div>
        </div>
        <button style={{
          padding: '0.5rem 1.5rem',
          backgroundColor: '#0d5d2f',
          color: '#fff',
          border: 'none',
          borderRadius: '0.5rem',
          fontWeight: 600,
          cursor: 'pointer'
        }}>
          Active
        </button>
      </div>

      {/* Activity Metrics Cards */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
        gap: '1.5rem',
        marginBottom: '2rem'
      }}>
        <div style={{
          backgroundColor: '#fff',
          padding: '1.5rem',
          borderRadius: '0.75rem',
          border: '1px solid #e5e7eb',
          boxShadow: '0 2px 4px rgba(0, 0, 0, 0.05)'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: '0.5rem' }}>
            <h3 style={{ 
              color: '#6b7280', 
              fontSize: '0.875rem',
              fontWeight: 500,
              margin: 0
            }}>
              Searches This Month
            </h3>
            <span style={{ color: '#9ca3af', fontSize: '0.75rem' }}>⋯</span>
          </div>
          <p style={{ 
            color: '#0d5d2f', 
            fontSize: '2rem',
            fontWeight: 700,
            margin: 0
          }}>
            {loading ? '...' : metrics.searches !== null ? metrics.searches : '0'}
          </p>
        </div>

        <div style={{
          backgroundColor: '#fff',
          padding: '1.5rem',
          borderRadius: '0.75rem',
          border: '1px solid #e5e7eb',
          boxShadow: '0 2px 4px rgba(0, 0, 0, 0.05)'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: '0.5rem' }}>
            <h3 style={{ 
              color: '#6b7280', 
              fontSize: '0.875rem',
              fontWeight: 500,
              margin: 0
            }}>
              Active Alerts
            </h3>
            <span style={{ color: '#9ca3af', fontSize: '0.75rem' }}>⋯</span>
          </div>
          <p style={{ 
            color: '#0d5d2f', 
            fontSize: '2rem',
            fontWeight: 700,
            margin: 0
          }}>
            {loading ? '...' : metrics.alerts !== null ? metrics.alerts : '0'}
          </p>
        </div>

        <div style={{
          backgroundColor: '#fff',
          padding: '1.5rem',
          borderRadius: '0.75rem',
          border: '1px solid #e5e7eb',
          boxShadow: '0 2px 4px rgba(0, 0, 0, 0.05)'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: '0.5rem' }}>
            <h3 style={{ 
              color: '#6b7280', 
              fontSize: '0.875rem',
              fontWeight: 500,
              margin: 0
            }}>
              Profile Views
            </h3>
            <span style={{ color: '#9ca3af', fontSize: '0.75rem' }}>⋯</span>
          </div>
          <p style={{ 
            color: '#0d5d2f', 
            fontSize: '2rem',
            fontWeight: 700,
            margin: 0
          }}>
            {loading ? '...' : metrics.profileViews !== null ? metrics.profileViews : '0'}
          </p>
        </div>

        <div style={{
          backgroundColor: '#fff',
          padding: '1.5rem',
          borderRadius: '0.75rem',
          border: '1px solid #e5e7eb',
          boxShadow: '0 2px 4px rgba(0, 0, 0, 0.05)'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: '0.5rem' }}>
            <h3 style={{ 
              color: '#6b7280', 
              fontSize: '0.875rem',
              fontWeight: 500,
              margin: 0
            }}>
              Reports Generated
            </h3>
            <span style={{ color: '#9ca3af', fontSize: '0.75rem' }}>⋯</span>
          </div>
          <p style={{ 
            color: '#0d5d2f', 
            fontSize: '2rem',
            fontWeight: 700,
            margin: 0
          }}>
            {loading ? '...' : metrics.reports !== null ? metrics.reports : '0'}
          </p>
        </div>
      </div>

      {/* Recent Activity and Quick Actions */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        gap: '1.5rem',
        marginBottom: '2rem'
      }}>
        {/* Recent Activity */}
        <div style={{
          backgroundColor: '#fff',
          padding: '1.5rem',
          borderRadius: '0.75rem',
          border: '1px solid #e5e7eb',
          boxShadow: '0 2px 4px rgba(0, 0, 0, 0.05)'
        }}>
          <h2 style={{ 
            color: '#0d5d2f', 
            marginTop: 0,
            marginBottom: '1rem',
            fontSize: '1.25rem',
            fontWeight: 600
          }}>
            Recent Activity
          </h2>
          <p style={{ color: '#6b7280', margin: 0 }}>
            Loading recent activity...
          </p>
        </div>

        {/* Quick Actions */}
        <div style={{
          backgroundColor: '#fff',
          padding: '1.5rem',
          borderRadius: '0.75rem',
          border: '1px solid #e5e7eb',
          boxShadow: '0 2px 4px rgba(0, 0, 0, 0.05)'
        }}>
          <h2 style={{ 
            color: '#0d5d2f', 
            marginTop: 0,
            marginBottom: '1rem',
            fontSize: '1.25rem',
            fontWeight: 600
          }}>
            Quick Actions
          </h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            <button
              onClick={() => navigate('/people-search')}
              style={{
                padding: '0.75rem 1rem',
                backgroundColor: '#0d5d2f',
                color: '#fff',
                border: 'none',
                borderRadius: '0.5rem',
                fontSize: '1rem',
                fontWeight: 500,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                transition: 'all 0.2s ease'
              }}
              onMouseEnter={(e) => {
                e.target.style.backgroundColor = '#1a7a4a';
              }}
              onMouseLeave={(e) => {
                e.target.style.backgroundColor = '#0d5d2f';
              }}
            >
              <span>🔍</span>
              Advanced Search
            </button>
            <button
              onClick={() => navigate('/alerts')}
              style={{
                padding: '0.75rem 1rem',
                backgroundColor: '#3b82f6',
                color: '#fff',
                border: 'none',
                borderRadius: '0.5rem',
                fontSize: '1rem',
                fontWeight: 500,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                transition: 'all 0.2s ease'
              }}
              onMouseEnter={(e) => {
                e.target.style.backgroundColor = '#2563eb';
              }}
              onMouseLeave={(e) => {
                e.target.style.backgroundColor = '#3b82f6';
              }}
            >
              <span>🔔</span>
              Manage Alerts
            </button>
            <button
              onClick={() => navigate('/account')}
              style={{
                padding: '0.75rem 1rem',
                backgroundColor: '#8b5cf6',
                color: '#fff',
                border: 'none',
                borderRadius: '0.5rem',
                fontSize: '1rem',
                fontWeight: 500,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                transition: 'all 0.2s ease'
              }}
              onMouseEnter={(e) => {
                e.target.style.backgroundColor = '#7c3aed';
              }}
              onMouseLeave={(e) => {
                e.target.style.backgroundColor = '#8b5cf6';
              }}
            >
              <span>📊</span>
              Analytics Dashboard
            </button>
          </div>
        </div>
      </div>

      {/* Feature Highlight Cards */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
        gap: '1.5rem'
      }}>
        {/* Advanced Analytics Card */}
        <div style={{
          backgroundColor: '#eff6ff',
          border: '1px solid #bfdbfe',
          borderRadius: '0.75rem',
          padding: '2rem'
        }}>
          <div style={{
            fontSize: '2.5rem',
            marginBottom: '1rem'
          }}>
            📄
          </div>
          <h3 style={{
            color: '#0d5d2f',
            marginTop: 0,
            marginBottom: '0.75rem',
            fontSize: '1.25rem',
            fontWeight: 600
          }}>
            Advanced Analytics
          </h3>
          <p style={{
            color: '#374151',
            margin: 0,
            lineHeight: 1.6
          }}>
            Detailed insights into search patterns, trending names, and user behavior analytics.
          </p>
        </div>

        {/* Unlimited Searches Card */}
        <div style={{
          backgroundColor: '#f0fdf4',
          border: '1px solid #86efac',
          borderRadius: '0.75rem',
          padding: '2rem'
        }}>
          <div style={{
            fontSize: '2.5rem',
            marginBottom: '1rem'
          }}>
            🔍
          </div>
          <h3 style={{
            color: '#0d5d2f',
            marginTop: 0,
            marginBottom: '0.75rem',
            fontSize: '1.25rem',
            fontWeight: 600
          }}>
            Unlimited Searches
          </h3>
          <p style={{
            color: '#374151',
            margin: 0,
            lineHeight: 1.6
          }}>
            No limits on searches with full access to phone numbers, emails, and addresses.
          </p>
        </div>

        {/* Priority Support Card */}
        <div style={{
          backgroundColor: '#fefce8',
          border: '1px solid #fde047',
          borderRadius: '0.75rem',
          padding: '2rem'
        }}>
          <div style={{
            fontSize: '2.5rem',
            marginBottom: '1rem'
          }}>
            🚀
          </div>
          <h3 style={{
            color: '#0d5d2f',
            marginTop: 0,
            marginBottom: '0.75rem',
            fontSize: '1.25rem',
            fontWeight: 600
          }}>
            Priority Support
          </h3>
          <p style={{
            color: '#374151',
            margin: 0,
            lineHeight: 1.6
          }}>
            Get priority customer support with faster response times and dedicated assistance.
          </p>
        </div>
      </div>
    </main>
  );
};

export default DashboardHome;