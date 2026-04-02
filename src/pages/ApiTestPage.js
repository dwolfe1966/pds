/**
 * API Test Page
 * 
 * Development page to test API wrapper loading and hybrid API architecture.
 * This page verifies:
 * 1. API wrapper library is loaded
 * 2. Wrapper can be initialized
 * 3. Hybrid router works
 * 4. Both new API and mock API can be called
 */

import React, { useState, useEffect } from 'react';
import apiWrapper from '../services/apiWrapper';
import { routeApiRequest } from '../services/apiRouter';
import api from '../api';

const ApiTestPage = () => {
  const [testResults, setTestResults] = useState({});
  const [loading, setLoading] = useState(false);
  const [logs, setLogs] = useState([]);

  const addLog = (message, type = 'info') => {
    const timestamp = new Date().toLocaleTimeString();
    setLogs(prev => [...prev, { timestamp, message, type }]);
    console.log(`[${timestamp}] ${message}`);
  };

  useEffect(() => {
    addLog('API Test Page loaded');
  }, []);

  // Test 1: Check if API wrapper library is loaded
  const testLibraryLoaded = () => {
    addLog('Test 1: Checking if API wrapper library is loaded...');
    const isLoaded = typeof window !== 'undefined' && window.ApiWrapper !== undefined;
    setTestResults(prev => ({ ...prev, libraryLoaded: isLoaded }));
    if (isLoaded) {
      addLog('✓ API wrapper library is loaded', 'success');
    } else {
      addLog('✗ API wrapper library is NOT loaded', 'error');
    }
    return isLoaded;
  };

  // Test 2: Test wrapper initialization
  const testWrapperInit = async () => {
    addLog('Test 2: Testing wrapper initialization...');
    try {
      const isAvailable = apiWrapper.isAvailable();
      setTestResults(prev => ({ ...prev, wrapperAvailable: isAvailable }));
      
      if (isAvailable) {
        await apiWrapper.initialize();
        setTestResults(prev => ({ ...prev, wrapperInitialized: true }));
        addLog('✓ Wrapper initialized successfully', 'success');
        return true;
      } else {
        addLog('✗ Wrapper not available', 'error');
        return false;
      }
    } catch (error) {
      addLog(`✗ Wrapper initialization failed: ${error.message}`, 'error');
      setTestResults(prev => ({ ...prev, wrapperInitialized: false, wrapperError: error.message }));
      return false;
    }
  };

  // Test 3: Test mock API call
  const testMockAPI = async () => {
    addLog('Test 3: Testing mock API call...');
    setLoading(true);
    try {
      // Test a simple GET request to mock API
      const response = await api.get('/search', {
        params: { firstName: 'John', lastName: 'Doe' }
      });
      setTestResults(prev => ({ ...prev, mockAPISuccess: true, mockAPIResponse: response }));
      addLog('✓ Mock API call successful', 'success');
      addLog(`  Response: ${JSON.stringify(response).substring(0, 100)}...`, 'info');
      return true;
    } catch (error) {
      addLog(`✗ Mock API call failed: ${error.message}`, 'error');
      setTestResults(prev => ({ ...prev, mockAPISuccess: false, mockAPIError: error.message }));
      return false;
    } finally {
      setLoading(false);
    }
  };

  // Test 4: Test new API call (if enabled)
  const testNewAPI = async () => {
    addLog('Test 4: Testing new API call...');
    setLoading(true);
    try {
      // Test teaser search with new API
      const response = await routeApiRequest('teaser-search', {
        type: 'name',
        fName: 'John',
        lName: 'Doe'
      });
      setTestResults(prev => ({ ...prev, newAPISuccess: true, newAPIResponse: response }));
      addLog('✓ New API call successful', 'success');
      addLog(`  Response: ${JSON.stringify(response).substring(0, 100)}...`, 'info');
      return true;
    } catch (error) {
      addLog(`✗ New API call failed: ${error.message}`, 'error');
      setTestResults(prev => ({ ...prev, newAPISuccess: false, newAPIError: error.message }));
      return false;
    } finally {
      setLoading(false);
    }
  };

  // Test 5: Test hybrid router
  const testHybridRouter = async () => {
    addLog('Test 5: Testing hybrid router...');
    setLoading(true);
    try {
      // This should route to mock API by default (new API disabled)
      const response = await api.searchPeople({
        firstName: 'John',
        lastName: 'Doe',
        type: 'name'
      });
      setTestResults(prev => ({ ...prev, hybridRouterSuccess: true, hybridRouterResponse: response }));
      addLog('✓ Hybrid router working', 'success');
      addLog(`  Response keys: ${Object.keys(response).join(', ')}`, 'info');
      return true;
    } catch (error) {
      addLog(`✗ Hybrid router failed: ${error.message}`, 'error');
      setTestResults(prev => ({ ...prev, hybridRouterSuccess: false, hybridRouterError: error.message }));
      return false;
    } finally {
      setLoading(false);
    }
  };

  // Run all tests
  const runAllTests = async () => {
    setTestResults({});
    setLogs([]);
    addLog('=== Starting API Tests ===', 'info');
    
    // Test 1: Library loaded
    const libLoaded = testLibraryLoaded();
    
    // Test 2: Wrapper init (only if library loaded)
    if (libLoaded) {
      await testWrapperInit();
    }
    
    // Test 3: Mock API
    await testMockAPI();
    
    // Test 4: New API (may fail if not enabled/available)
    await testNewAPI();
    
    // Test 5: Hybrid router
    await testHybridRouter();
    
    addLog('=== Tests Complete ===', 'info');
  };

  return (
    <div style={{ padding: '2rem', maxWidth: '1200px', margin: '0 auto' }}>
      <h1>API Integration Test Page</h1>
      <p style={{ color: '#666', marginBottom: '2rem' }}>
        This page tests the API wrapper library and hybrid API architecture.
      </p>

      <div style={{ marginBottom: '2rem' }}>
        <button
          onClick={runAllTests}
          disabled={loading}
          style={{
            padding: '0.75rem 1.5rem',
            fontSize: '1rem',
            backgroundColor: '#007bff',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: loading ? 'not-allowed' : 'pointer',
            opacity: loading ? 0.6 : 1
          }}
        >
          {loading ? 'Running Tests...' : 'Run All Tests'}
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem' }}>
        {/* Test Results */}
        <div>
          <h2>Test Results</h2>
          <div style={{ backgroundColor: '#f5f5f5', padding: '1rem', borderRadius: '4px' }}>
            <div style={{ marginBottom: '0.5rem' }}>
              <strong>Library Loaded:</strong>{' '}
              {testResults.libraryLoaded === true ? '✓' : testResults.libraryLoaded === false ? '✗' : 'Not tested'}
            </div>
            <div style={{ marginBottom: '0.5rem' }}>
              <strong>Wrapper Available:</strong>{' '}
              {testResults.wrapperAvailable === true ? '✓' : testResults.wrapperAvailable === false ? '✗' : 'Not tested'}
            </div>
            <div style={{ marginBottom: '0.5rem' }}>
              <strong>Wrapper Initialized:</strong>{' '}
              {testResults.wrapperInitialized === true ? '✓' : testResults.wrapperInitialized === false ? '✗' : 'Not tested'}
            </div>
            <div style={{ marginBottom: '0.5rem' }}>
              <strong>Mock API:</strong>{' '}
              {testResults.mockAPISuccess === true ? '✓' : testResults.mockAPISuccess === false ? '✗' : 'Not tested'}
            </div>
            <div style={{ marginBottom: '0.5rem' }}>
              <strong>New API:</strong>{' '}
              {testResults.newAPISuccess === true ? '✓' : testResults.newAPISuccess === false ? '✗' : 'Not tested'}
            </div>
            <div style={{ marginBottom: '0.5rem' }}>
              <strong>Hybrid Router:</strong>{' '}
              {testResults.hybridRouterSuccess === true ? '✓' : testResults.hybridRouterSuccess === false ? '✗' : 'Not tested'}
            </div>
          </div>

          {/* Environment Info */}
          <div style={{ marginTop: '2rem' }}>
            <h3>Environment Configuration</h3>
            <div style={{ backgroundColor: '#f5f5f5', padding: '1rem', borderRadius: '4px', fontSize: '0.9rem' }}>
              <div><strong>NEW_API_ENABLED:</strong> {process.env.REACT_APP_NEW_API_ENABLED || 'false'}</div>
              <div><strong>USE_MOCK_API:</strong> {process.env.REACT_APP_USE_MOCK_API || 'true'}</div>
              <div><strong>USE_NEW_API_SEARCH:</strong> {process.env.REACT_APP_USE_NEW_API_SEARCH || 'false'}</div>
              <div><strong>NEW_API_URL:</strong> {process.env.REACT_APP_NEW_API_URL || 'https://dev.www.bytecrtrs.com/api'}</div>
              <div><strong>MOCK_API_URL:</strong> {process.env.REACT_APP_API_URL || 'http://localhost:3001/api/v1'}</div>
            </div>
          </div>
        </div>

        {/* Logs */}
        <div>
          <h2>Test Logs</h2>
          <div
            style={{
              backgroundColor: '#1e1e1e',
              color: '#d4d4d4',
              padding: '1rem',
              borderRadius: '4px',
              fontFamily: 'monospace',
              fontSize: '0.85rem',
              maxHeight: '500px',
              overflowY: 'auto'
            }}
          >
            {logs.length === 0 ? (
              <div style={{ color: '#888' }}>No logs yet. Click "Run All Tests" to start.</div>
            ) : (
              logs.map((log, index) => (
                <div
                  key={index}
                  style={{
                    marginBottom: '0.25rem',
                    color:
                      log.type === 'success'
                        ? '#4ec9b0'
                        : log.type === 'error'
                        ? '#f48771'
                        : '#d4d4d4'
                  }}
                >
                  [{log.timestamp}] {log.message}
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Response Details */}
      {(testResults.mockAPIResponse || testResults.newAPIResponse || testResults.hybridRouterResponse) && (
        <div style={{ marginTop: '2rem' }}>
          <h2>Response Details</h2>
          <div style={{ backgroundColor: '#f5f5f5', padding: '1rem', borderRadius: '4px' }}>
            {testResults.mockAPIResponse && (
              <div style={{ marginBottom: '1rem' }}>
                <strong>Mock API Response:</strong>
                <pre style={{ backgroundColor: '#fff', padding: '0.5rem', borderRadius: '4px', overflow: 'auto' }}>
                  {JSON.stringify(testResults.mockAPIResponse, null, 2).substring(0, 500)}
                </pre>
              </div>
            )}
            {testResults.newAPIResponse && (
              <div style={{ marginBottom: '1rem' }}>
                <strong>New API Response:</strong>
                <pre style={{ backgroundColor: '#fff', padding: '0.5rem', borderRadius: '4px', overflow: 'auto' }}>
                  {JSON.stringify(testResults.newAPIResponse, null, 2).substring(0, 500)}
                </pre>
              </div>
            )}
            {testResults.hybridRouterResponse && (
              <div>
                <strong>Hybrid Router Response:</strong>
                <pre style={{ backgroundColor: '#fff', padding: '0.5rem', borderRadius: '4px', overflow: 'auto' }}>
                  {JSON.stringify(testResults.hybridRouterResponse, null, 2).substring(0, 500)}
                </pre>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default ApiTestPage;
