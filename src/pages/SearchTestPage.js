/**
 * Search Test Page
 * 
 * Comprehensive testing page for all search use cases.
 * Tests name search, phone search, error handling, and context tracking.
 */

import React, { useState } from 'react';
import api from '../api';
import { getSearchContext, setSearchContext, clearSearchContext } from '../services/searchContext';
import ResultCard from '../components/ResultCard';

const SearchTestPage = () => {
  const [testResults, setTestResults] = useState([]);
  const [searchResults, setSearchResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchContext, setSearchContextState] = useState(null);

  // Test form state
  const [nameForm, setNameForm] = useState({ firstName: 'Tim', lastName: 'Chin', state: 'FL' });
  const [phoneForm, setPhoneForm] = useState({ phone: '8054320540' });
  const [emailForm, setEmailForm] = useState({ email: 'chin19691@gmail.com' });

  const addTestResult = (testName, status, message, details = {}) => {
    setTestResults(prev => [...prev, {
      testName,
      status, // 'pass', 'fail', 'warning'
      message,
      details,
      timestamp: new Date().toLocaleTimeString()
    }]);
  };

  const clearResults = () => {
    setTestResults([]);
    setSearchResults([]);
    setSearchContextState(null);
  };

  // Test 1: Name Search with State
  const testNameSearchWithState = async () => {
    setLoading(true);
    addTestResult('Name Search (with state)', 'info', 'Testing name search with state...');
    try {
      const response = await api.searchPeople({
        firstName: nameForm.firstName,
        lastName: nameForm.lastName,
        state: nameForm.state,
        type: 'name'
      });
      
      setSearchResults(response.data || []);
      setSearchContextState(response.searchContext || null);
      
      if (response.data && response.data.length > 0) {
        addTestResult('Name Search (with state)', 'pass', 
          `✓ Success: Found ${response.data.length} result(s)`, {
          resultsCount: response.data.length,
          hasContext: !!response.searchContext,
          pagination: response.pagination
        });
      } else {
        addTestResult('Name Search (with state)', 'warning', 
          '⚠ No results found (this may be expected)', {
          resultsCount: 0,
          hasContext: !!response.searchContext
        });
      }
    } catch (error) {
      addTestResult('Name Search (with state)', 'fail', 
        `✗ Failed: ${error.message}`, { error: error.message });
    } finally {
      setLoading(false);
    }
  };

  // Test 2: Name Search without State
  const testNameSearchWithoutState = async () => {
    setLoading(true);
    addTestResult('Name Search (no state)', 'info', 'Testing name search without state...');
    try {
      const response = await api.searchPeople({
        firstName: nameForm.firstName,
        lastName: nameForm.lastName,
        type: 'name'
      });
      
      setSearchResults(response.data || []);
      setSearchContextState(response.searchContext || null);
      
      if (response.data && response.data.length > 0) {
        addTestResult('Name Search (no state)', 'pass', 
          `✓ Success: Found ${response.data.length} result(s)`, {
          resultsCount: response.data.length,
          hasContext: !!response.searchContext
        });
      } else {
        addTestResult('Name Search (no state)', 'warning', 
          '⚠ No results found', { resultsCount: 0 });
      }
    } catch (error) {
      addTestResult('Name Search (no state)', 'fail', 
        `✗ Failed: ${error.message}`, { error: error.message });
    } finally {
      setLoading(false);
    }
  };

  // Test 3: Phone Search
  const testPhoneSearch = async () => {
    setLoading(true);
    addTestResult('Phone Search', 'info', 'Testing phone search...');
    try {
      const response = await api.searchPeople({
        phone: phoneForm.phone,
        type: 'phone'
      });
      
      setSearchResults(response.data || []);
      setSearchContextState(response.searchContext || null);
      
      if (response.data && response.data.length > 0) {
        addTestResult('Phone Search', 'pass', 
          `✓ Success: Found ${response.data.length} result(s)`, {
          resultsCount: response.data.length,
          hasContext: !!response.searchContext
        });
      } else {
        addTestResult('Phone Search', 'warning', 
          '⚠ No results found', { resultsCount: 0 });
      }
    } catch (error) {
      addTestResult('Phone Search', 'fail', 
        `✗ Failed: ${error.message}`, { error: error.message });
    } finally {
      setLoading(false);
    }
  };

  // Test 4: Email Search (if supported)
  const testEmailSearch = async () => {
    setLoading(true);
    addTestResult('Email Search', 'info', 'Testing email search...');
    try {
      const response = await api.searchPeople({
        email: emailForm.email,
        type: 'email'
      });
      
      setSearchResults(response.data || []);
      setSearchContextState(response.searchContext || null);
      
      if (response.data && response.data.length > 0) {
        addTestResult('Email Search', 'pass', 
          `✓ Success: Found ${response.data.length} result(s)`, {
          resultsCount: response.data.length,
          hasContext: !!response.searchContext
        });
      } else {
        addTestResult('Email Search', 'warning', 
          '⚠ No results found or email search not supported', { resultsCount: 0 });
      }
    } catch (error) {
      addTestResult('Email Search', 'fail', 
        `✗ Failed: ${error.message}`, { error: error.message });
    } finally {
      setLoading(false);
    }
  };

  // Test 5: Error Handling - Missing Required Fields
  const testErrorHandling = async () => {
    addTestResult('Error Handling', 'info', 'Testing error handling with invalid input...');
    try {
      await api.searchPeople({
        firstName: 'Test',
        // Missing lastName
        type: 'name'
      });
      addTestResult('Error Handling', 'fail', 
        '✗ Should have failed with missing lastName', {});
    } catch (error) {
      addTestResult('Error Handling', 'pass', 
        `✓ Correctly handled error: ${error.message}`, { error: error.message });
    }
  };

  // Test 6: Search Context Tracking
  const testContextTracking = () => {
    addTestResult('Context Tracking', 'info', 'Checking search context...');
    const context = getSearchContext();
    if (context) {
      addTestResult('Context Tracking', 'pass', 
        '✓ Search context found', {
        hasSearchContextKey: !!context.searchContextKey,
        hasTeaserInput: !!context.teaserInput,
        hasProvider: !!context.provider,
        context: context
      });
      setSearchContextState(context);
    } else {
      addTestResult('Context Tracking', 'warning', 
        '⚠ No search context found (perform a search first)', {});
    }
  };

  // Test 7: No Results Scenario
  const testNoResults = async () => {
    setLoading(true);
    addTestResult('No Results Test', 'info', 'Testing search with unlikely to return results...');
    try {
      const response = await api.searchPeople({
        firstName: 'Xyzabc',
        lastName: 'Qwerty',
        state: 'CA',
        type: 'name'
      });
      
      if (response.data && response.data.length === 0) {
        addTestResult('No Results Test', 'pass', 
          '✓ Correctly handled no results scenario', {
          resultsCount: 0,
          hasContext: !!response.searchContext
        });
      } else {
        addTestResult('No Results Test', 'warning', 
          `⚠ Unexpectedly found ${response.data.length} result(s)`, {
          resultsCount: response.data.length
        });
      }
    } catch (error) {
      addTestResult('No Results Test', 'fail', 
        `✗ Error: ${error.message}`, { error: error.message });
    } finally {
      setLoading(false);
    }
  };

  // Run All Tests
  const runAllTests = async () => {
    clearResults();
    addTestResult('Test Suite', 'info', 'Starting comprehensive search tests...');
    
    // Run tests sequentially
    await testNameSearchWithState();
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    await testNameSearchWithoutState();
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    await testPhoneSearch();
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    await testEmailSearch();
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    await testErrorHandling();
    await new Promise(resolve => setTimeout(resolve, 500));
    
    testContextTracking();
    await new Promise(resolve => setTimeout(resolve, 500));
    
    await testNoResults();
    
    addTestResult('Test Suite', 'info', 'All tests completed!');
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'pass': return '#10b981';
      case 'fail': return '#ef4444';
      case 'warning': return '#f59e0b';
      default: return '#6b7280';
    }
  };

  return (
    <main style={{ padding: '2rem', maxWidth: '1200px', margin: '0 auto' }}>
      <h1 style={{ color: '#0e123b', marginBottom: '1rem' }}>Search Testing Page</h1>
      <p style={{ color: '#666', marginBottom: '2rem' }}>
        Comprehensive testing for all search use cases. Test name search, phone search, 
        error handling, and context tracking.
      </p>

      {/* Test Controls */}
      <div style={{ 
        display: 'grid', 
        gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', 
        gap: '1rem',
        marginBottom: '2rem'
      }}>
        <button
          onClick={runAllTests}
          disabled={loading}
          style={{
            padding: '0.75rem 1.5rem',
            backgroundColor: '#0d5d2f',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: loading ? 'not-allowed' : 'pointer',
            fontSize: '1rem',
            fontWeight: '600'
          }}
        >
          {loading ? 'Running Tests...' : 'Run All Tests'}
        </button>
        <button
          onClick={clearResults}
          style={{
            padding: '0.75rem 1.5rem',
            backgroundColor: '#6b7280',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer',
            fontSize: '1rem'
          }}
        >
          Clear Results
        </button>
        <button
          onClick={testContextTracking}
          style={{
            padding: '0.75rem 1.5rem',
            backgroundColor: '#3b82f6',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer',
            fontSize: '1rem'
          }}
        >
          Check Context
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem' }}>
        {/* Left Column: Test Forms */}
        <div>
          <h2 style={{ color: '#0e123b', marginBottom: '1rem' }}>Test Forms</h2>

          {/* Name Search Form */}
          <div style={{ 
            padding: '1.5rem', 
            backgroundColor: '#f9fafb', 
            borderRadius: '8px',
            marginBottom: '1rem'
          }}>
            <h3 style={{ marginTop: 0, marginBottom: '1rem' }}>Name Search</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              <input
                type="text"
                placeholder="First Name"
                value={nameForm.firstName}
                onChange={(e) => setNameForm({ ...nameForm, firstName: e.target.value })}
                style={{ padding: '0.5rem', borderRadius: '4px', border: '1px solid #d1d5db' }}
              />
              <input
                type="text"
                placeholder="Last Name"
                value={nameForm.lastName}
                onChange={(e) => setNameForm({ ...nameForm, lastName: e.target.value })}
                style={{ padding: '0.5rem', borderRadius: '4px', border: '1px solid #d1d5db' }}
              />
              <input
                type="text"
                placeholder="State (e.g., FL, CA)"
                value={nameForm.state}
                onChange={(e) => setNameForm({ ...nameForm, state: e.target.value })}
                style={{ padding: '0.5rem', borderRadius: '4px', border: '1px solid #d1d5db' }}
              />
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button
                  onClick={testNameSearchWithState}
                  disabled={loading}
                  style={{
                    flex: 1,
                    padding: '0.5rem',
                    backgroundColor: '#0d5d2f',
                    color: 'white',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: loading ? 'not-allowed' : 'pointer'
                  }}
                >
                  Test (with state)
                </button>
                <button
                  onClick={testNameSearchWithoutState}
                  disabled={loading}
                  style={{
                    flex: 1,
                    padding: '0.5rem',
                    backgroundColor: '#3b82f6',
                    color: 'white',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: loading ? 'not-allowed' : 'pointer'
                  }}
                >
                  Test (no state)
                </button>
              </div>
            </div>
          </div>

          {/* Phone Search Form */}
          <div style={{ 
            padding: '1.5rem', 
            backgroundColor: '#f9fafb', 
            borderRadius: '8px',
            marginBottom: '1rem'
          }}>
            <h3 style={{ marginTop: 0, marginBottom: '1rem' }}>Phone Search</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              <input
                type="text"
                placeholder="Phone (e.g., 8054320540)"
                value={phoneForm.phone}
                onChange={(e) => setPhoneForm({ phone: e.target.value })}
                style={{ padding: '0.5rem', borderRadius: '4px', border: '1px solid #d1d5db' }}
              />
              <button
                onClick={testPhoneSearch}
                disabled={loading}
                style={{
                  padding: '0.5rem',
                  backgroundColor: '#0d5d2f',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: loading ? 'not-allowed' : 'pointer'
                }}
              >
                Test Phone Search
              </button>
            </div>
          </div>

          {/* Email Search Form */}
          <div style={{ 
            padding: '1.5rem', 
            backgroundColor: '#f9fafb', 
            borderRadius: '8px',
            marginBottom: '1rem'
          }}>
            <h3 style={{ marginTop: 0, marginBottom: '1rem' }}>Email Search</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              <input
                type="email"
                placeholder="Email address"
                value={emailForm.email}
                onChange={(e) => setEmailForm({ email: e.target.value })}
                style={{ padding: '0.5rem', borderRadius: '4px', border: '1px solid #d1d5db' }}
              />
              <button
                onClick={testEmailSearch}
                disabled={loading}
                style={{
                  padding: '0.5rem',
                  backgroundColor: '#0d5d2f',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: loading ? 'not-allowed' : 'pointer'
                }}
              >
                Test Email Search
              </button>
            </div>
          </div>

          {/* Additional Tests */}
          <div style={{ 
            padding: '1.5rem', 
            backgroundColor: '#f9fafb', 
            borderRadius: '8px'
          }}>
            <h3 style={{ marginTop: 0, marginBottom: '1rem' }}>Additional Tests</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <button
                onClick={testErrorHandling}
                disabled={loading}
                style={{
                  padding: '0.5rem',
                  backgroundColor: '#f59e0b',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: loading ? 'not-allowed' : 'pointer'
                }}
              >
                Test Error Handling
              </button>
              <button
                onClick={testNoResults}
                disabled={loading}
                style={{
                  padding: '0.5rem',
                  backgroundColor: '#f59e0b',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: loading ? 'not-allowed' : 'pointer'
                }}
              >
                Test No Results
              </button>
            </div>
          </div>
        </div>

        {/* Right Column: Test Results */}
        <div>
          <h2 style={{ color: '#0e123b', marginBottom: '1rem' }}>Test Results</h2>
          
          {/* Test Results List */}
          <div style={{ 
            maxHeight: '400px', 
            overflowY: 'auto',
            marginBottom: '2rem',
            border: '1px solid #e5e7eb',
            borderRadius: '8px',
            padding: '1rem'
          }}>
            {testResults.length === 0 ? (
              <p style={{ color: '#9ca3af', textAlign: 'center', padding: '2rem' }}>
                No tests run yet. Click "Run All Tests" to start.
              </p>
            ) : (
              testResults.map((result, index) => (
                <div
                  key={index}
                  style={{
                    padding: '0.75rem',
                    marginBottom: '0.5rem',
                    backgroundColor: '#ffffff',
                    borderLeft: `4px solid ${getStatusColor(result.status)}`,
                    borderRadius: '4px'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
                    <div>
                      <strong style={{ color: '#0e123b' }}>{result.testName}</strong>
                      <p style={{ margin: '0.25rem 0 0 0', color: '#6b7280', fontSize: '0.9rem' }}>
                        {result.message}
                      </p>
                      {result.details && Object.keys(result.details).length > 0 && (
                        <details style={{ marginTop: '0.5rem' }}>
                          <summary style={{ cursor: 'pointer', color: '#6b7280', fontSize: '0.85rem' }}>
                            Details
                          </summary>
                          <pre style={{ 
                            marginTop: '0.5rem', 
                            padding: '0.5rem', 
                            backgroundColor: '#f9fafb',
                            borderRadius: '4px',
                            fontSize: '0.8rem',
                            overflow: 'auto'
                          }}>
                            {JSON.stringify(result.details, null, 2)}
                          </pre>
                        </details>
                      )}
                    </div>
                    <span style={{ 
                      color: '#9ca3af', 
                      fontSize: '0.8rem',
                      whiteSpace: 'nowrap',
                      marginLeft: '1rem'
                    }}>
                      {result.timestamp}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Search Context Display */}
          {searchContext && (
            <div style={{ 
              padding: '1rem', 
              backgroundColor: '#eff6ff', 
              borderRadius: '8px',
              marginBottom: '2rem'
            }}>
              <h3 style={{ marginTop: 0, marginBottom: '0.5rem' }}>Search Context</h3>
              <pre style={{ 
                margin: 0, 
                fontSize: '0.85rem',
                overflow: 'auto'
              }}>
                {JSON.stringify(searchContext, null, 2)}
              </pre>
            </div>
          )}

          {/* Search Results */}
          {searchResults.length > 0 && (
            <div>
              <h3 style={{ marginBottom: '1rem' }}>
                Search Results ({searchResults.length})
              </h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                {searchResults.map((result, index) => (
                  <ResultCard key={result.id || result.extId || index} result={result} />
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </main>
  );
};

export default SearchTestPage;
