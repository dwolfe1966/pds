# Phase 3: Report Creation & Viewing - Testing Plan

**Date:** January 2025  
**Status:** Ready for Testing  
**Phase:** Report Creation & Viewing

---

## Overview

This document provides a comprehensive testing plan for Phase 3 features:
- Report creation from search results
- Report detail viewing
- Report list with pagination
- Payment flow integration
- Automatic report creation for logged-in users

---

## Prerequisites

### Environment Setup

1. **Start the proxy server:**
   ```bash
   npm run server
   ```
   Server should start on `http://localhost:3001`

2. **Start the React development server:**
   ```bash
   npm start
   ```
   App should start on `http://localhost:3000`

3. **Verify API Configuration:**
   - Check that `REACT_APP_USE_NEW_API=true` (or appropriate env var)
   - Verify proxy server is running and can reach ByteCrtrs API
   - Ensure captcha verification is working

### Test Data

**Test Search Queries:**
- Name: "Tim Chin" + State: "FL" (known to return results)
- Name: "Jeffrey Tinsley" + State: "CA" (known to return results)
- Phone: "8054320540" (if phone search is available)
- Email: Use a test email if email search is available

**Test Credentials:**
- Email: `member@test.com`
- Password: `password123`

---

## Manual Testing Plan

### Test Category 1: Report Creation from Search Results

#### Test 1.1: Create Report - Logged-In User (Automatic)
**Objective:** Verify that reports are automatically created when logged-in users view search result details.

**Steps:**
1. Log in as a member (`/login`)
2. Navigate to name search landing page (`/name/landing`)
3. Enter search: First Name: "Tim", Last Name: "Chin", State: "FL"
4. Click "Search"
5. Wait for results to load
6. Click on a result card to view details
7. Observe the preview page

**Expected Results:**
- ✅ Search executes successfully
- ✅ Results page displays with identities
- ✅ Clicking result navigates to preview page (`/search/{id}`)
- ✅ Preview page shows "Creating report..." or loading state
- ✅ Report is created automatically (check browser console for API call)
- ✅ Preview page shows "View Full Report" button (not "Sign Up")
- ✅ Clicking "View Full Report" navigates to `/people/{commerceContentId}`
- ✅ Full report page displays report data

**Verification:**
- Check browser console for `POST /api/idLookup/report/create` call
- Check that `commerceContentId` is returned in response
- Verify search context is stored in sessionStorage
- Check that report detail page loads with full data

**Test Data:**
- Search: "Tim Chin, FL"
- Expected: Report created with commerceContentId

---

#### Test 1.2: Create Report - Non-Logged-In User (After Payment)
**Objective:** Verify that reports are created after payment for non-logged-in users.

**Steps:**
1. Ensure you are logged out
2. Navigate to name search landing page (`/name/landing`)
3. Enter search: First Name: "Tim", Last Name: "Chin", State: "FL"
4. Click "Search"
5. Click on a result card
6. On preview page, click "Sign Up to View Full Report"
7. Fill out signup form (email, password, name)
8. Submit signup
9. On payment page, fill out payment form
10. Submit payment
11. Observe redirect

**Expected Results:**
- ✅ Signup completes successfully
- ✅ User is redirected to payment page
- ✅ Payment form displays selected person info
- ✅ After payment submission, report is created (check console)
- ✅ User is redirected to report detail page (`/people/{commerceContentId}`)
- ✅ Report detail page displays full report data

**Verification:**
- Check browser console for report creation API call after payment
- Verify commerceContentId is stored
- Confirm redirect uses commerceContentId, not extId

---

#### Test 1.3: Create Report - Direct Navigation (Member Page)
**Objective:** Verify that reports can be created when navigating directly to detail page with extId.

**Steps:**
1. Log in as a member
2. Perform a search and get results
3. Note the extId from a result (check sessionStorage or console)
4. Navigate directly to `/people/{extId}` (using extId, not commerceContentId)
5. Observe page behavior

**Expected Results:**
- ✅ Page attempts to fetch report detail first
- ✅ If report doesn't exist, page creates report automatically
- ✅ Page displays loading state: "Creating report..."
- ✅ After creation, URL updates to use commerceContentId
- ✅ Report detail displays correctly

**Verification:**
- Check that URL changes from `/people/{extId}` to `/people/{commerceContentId}`
- Verify report is created only once (check API calls)
- Confirm report data displays correctly

---

### Test Category 2: Report Detail Viewing

#### Test 2.1: View Full Report - With commerceContentId
**Objective:** Verify that full reports can be viewed using commerceContentId.

**Steps:**
1. Log in as a member
2. Create a report (via Test 1.1)
3. Note the commerceContentId from the URL or console
4. Navigate directly to `/people/{commerceContentId}`
5. Observe report display

**Expected Results:**
- ✅ Page loads without creating a new report
- ✅ Report detail API call is made: `GET /api/idLookup/report/detail/{commerceContentId}`
- ✅ Full report data displays:
  - Primary identity information (name, age, location)
  - FullContact data (if available)
  - FamilyWatchdog data (if available)
  - All identities array
- ✅ No duplicate report creation

**Verification:**
- Check browser console for only one API call (getReportDetail)
- Verify all report sections display correctly
- Confirm data structure matches expected format

---

#### Test 2.2: View Report - Data Structure Validation
**Objective:** Verify that report data is correctly extracted and displayed.

**Steps:**
1. Create and view a report
2. Inspect the displayed data
3. Compare with raw API response (check console)

**Expected Results:**
- ✅ Name displays correctly from `nameList[0].data`
- ✅ Location displays from `addressList`
- ✅ Age range displays if available
- ✅ FullContact section displays if data exists
- ✅ FamilyWatchdog section displays if data exists
- ✅ All identities are listed correctly

**Verification:**
- Check browser console for raw API response
- Compare displayed data with raw response structure
- Verify data extraction logic works correctly

---

#### Test 2.3: View Report - Error Handling
**Objective:** Verify error handling when report doesn't exist or API fails.

**Steps:**
1. Log in as a member
2. Navigate to `/people/invalid-commerce-content-id`
3. Observe error handling

**Expected Results:**
- ✅ Page shows loading state initially
- ✅ Error message displays: "Report not found" or similar
- ✅ User-friendly error message (not technical error)
- ✅ Option to go back or search again

**Verification:**
- Check that error is caught and displayed gracefully
- Verify no console errors that break the app
- Confirm user can recover from error

---

### Test Category 3: Report List (Account Page)

#### Test 3.1: View Report List - First Page
**Objective:** Verify that user's reports are listed on Account page.

**Steps:**
1. Log in as a member
2. Create at least one report (via search flow)
3. Navigate to Account page (`/account` or `/member/account`)
4. Scroll to "Your Reports" section
5. Observe report list

**Expected Results:**
- ✅ "Your Reports" section displays
- ✅ Reports list shows created reports
- ✅ Each report shows:
  - Report name (from teaserInput)
  - Creation date
  - "View Report" button
- ✅ Reports are ordered (newest first, typically)

**Verification:**
- Check API call: `GET /api/idLookup/report/list`
- Verify report data displays correctly
- Confirm report names are readable

---

#### Test 3.2: Report List - Pagination
**Objective:** Verify that report list pagination works correctly.

**Steps:**
1. Log in as a member
2. Create multiple reports (at least 3-4)
3. Navigate to Account page
4. Scroll to reports section
5. If "Load More" button appears, click it
6. Observe additional reports loading

**Expected Results:**
- ✅ Initial reports load (first page)
- ✅ If more reports exist, "Load More" button appears
- ✅ Clicking "Load More" fetches next page
- ✅ New reports append to existing list
- ✅ Loading state shows while fetching
- ✅ Button updates to "Loading..." during fetch

**Verification:**
- Check API calls include `lastId` parameter for pagination
- Verify reports are appended (not replaced)
- Confirm pagination cursor works correctly

---

#### Test 3.3: Report List - Empty State
**Objective:** Verify empty state when user has no reports.

**Steps:**
1. Log in as a new user (or user with no reports)
2. Navigate to Account page
3. Scroll to "Your Reports" section

**Expected Results:**
- ✅ "Your Reports" section displays
- ✅ Message shows: "You haven't created any reports yet."
- ✅ No error messages
- ✅ No "Load More" button

**Verification:**
- Check API call returns empty array
- Verify empty state message displays
- Confirm no errors in console

---

#### Test 3.4: Report List - Click to View Report
**Objective:** Verify that clicking a report in the list navigates to detail page.

**Steps:**
1. Log in as a member
2. Navigate to Account page
3. Find a report in the list
4. Click "View Report" button or click the report card
5. Observe navigation

**Expected Results:**
- ✅ Clicking navigates to `/people/{commerceContentId}`
- ✅ Report detail page loads
- ✅ Full report data displays
- ✅ No new report is created (uses existing report)

**Verification:**
- Check URL uses commerceContentId
- Verify only getReportDetail API call is made (no createReport)
- Confirm report data displays correctly

---

### Test Category 4: Payment Flow Integration

#### Test 4.1: Payment → Report Creation → Redirect
**Objective:** Verify complete flow from payment to report viewing.

**Steps:**
1. Log out (if logged in)
2. Perform a search and select a result
3. Sign up with new account
4. Complete payment form
5. Submit payment
6. Observe redirect and report creation

**Expected Results:**
- ✅ Payment submission succeeds
- ✅ Report is created automatically after payment
- ✅ User is redirected to report detail page
- ✅ URL uses commerceContentId (not extId)
- ✅ Report displays correctly

**Verification:**
- Check console for report creation API call after payment
- Verify redirect URL is correct
- Confirm report data loads

---

#### Test 4.2: Payment - Report Creation Error Handling
**Objective:** Verify behavior when report creation fails after payment.

**Steps:**
1. Set up test scenario (may require API mocking or network throttling)
2. Complete payment flow
3. Simulate report creation failure
4. Observe error handling

**Expected Results:**
- ✅ Payment still succeeds
- ✅ Error is logged to console
- ✅ User is redirected (to dashboard or report page)
- ✅ Error message displays if report creation fails
- ✅ User can still access report later

**Verification:**
- Check error handling doesn't break payment flow
- Verify user can recover from error
- Confirm error messages are user-friendly

---

### Test Category 5: Search Context & State Management

#### Test 5.1: Search Context Persistence
**Objective:** Verify that search context persists through report creation flow.

**Steps:**
1. Perform a search
2. Check sessionStorage for search context
3. Create a report
4. Check sessionStorage again
5. Verify context is updated with commerceContentId

**Expected Results:**
- ✅ Search context stored in sessionStorage after search
- ✅ Context includes: searchContextKey, teaserInput, provider
- ✅ After report creation, context includes commerceContentId
- ✅ Context persists through navigation

**Verification:**
- Use browser DevTools to inspect sessionStorage
- Check `searchContext` key exists
- Verify all required fields are present

---

#### Test 5.2: Identity Context Storage
**Objective:** Verify that identity context is stored when clicking a result.

**Steps:**
1. Perform a search
2. Click on a result card
3. Check sessionStorage for identity context
4. Verify identity data is stored

**Expected Results:**
- ✅ Identity context stored in searchContext.identity
- ✅ Includes: extId, provider, fullName
- ✅ Raw identity data stored for report creation

**Verification:**
- Check sessionStorage structure
- Verify identity data is accessible
- Confirm data is used for report creation

---

### Test Category 6: Edge Cases & Error Scenarios

#### Test 6.1: Duplicate Report Creation Prevention
**Objective:** Verify that reports are not created multiple times for the same identity.

**Steps:**
1. Log in as a member
2. Create a report for an identity
3. Navigate away and back to the same result
4. Try to view the report again
5. Observe behavior

**Expected Results:**
- ✅ System checks if report already exists
- ✅ If report exists, uses existing commerceContentId
- ✅ No duplicate report creation
- ✅ Report detail loads correctly

**Verification:**
- Check API calls - should not see multiple createReport calls
- Verify getExistingReportId() function works
- Confirm commerceContentId is reused

---

#### Test 6.2: Report Creation with Missing Search Context
**Objective:** Verify behavior when search context is missing.

**Steps:**
1. Clear sessionStorage
2. Try to create a report directly (via API or navigation)
3. Observe error handling

**Expected Results:**
- ✅ Error is handled gracefully
- ✅ User-friendly error message
- ✅ Option to perform search again
- ✅ No app crash

**Verification:**
- Check error handling in reportService
- Verify fallback behavior
- Confirm user can recover

---

#### Test 6.3: Network Error Handling
**Objective:** Verify behavior when API calls fail due to network issues.

**Steps:**
1. Start report creation
2. Disable network (or throttle network in DevTools)
3. Observe error handling

**Expected Results:**
- ✅ Loading state shows initially
- ✅ Error message displays when request fails
- ✅ User can retry
- ✅ No app crash

**Verification:**
- Test with network throttling
- Verify error messages are user-friendly
- Confirm retry mechanism works (if implemented)

---

#### Test 6.4: Invalid commerceContentId
**Objective:** Verify behavior when invalid commerceContentId is used.

**Steps:**
1. Log in as a member
2. Navigate to `/people/invalid-id-12345`
3. Observe error handling

**Expected Results:**
- ✅ Page attempts to load report
- ✅ API returns error (404 or similar)
- ✅ Error message displays
- ✅ User can navigate away

**Verification:**
- Check API error response handling
- Verify error message is clear
- Confirm no console errors break the app

---

## Automated Testing Suggestions

### Unit Tests (Recommended Setup)

**Note:** Testing framework needs to be set up first. Suggested stack:
- Jest (test runner)
- React Testing Library (component testing)
- @testing-library/jest-dom (DOM matchers)

#### Test File Structure
```
src/
├── services/
│   ├── reportService.test.js
│   └── searchContext.test.js
├── pages/
│   ├── member/
│   │   ├── SearchResultDetailPage.test.js
│   │   └── AccountPage.test.js
│   └── sales/
│       ├── SearchDetailPreviewPage.test.js
│       └── PaymentPage.test.js
└── __mocks__/
    └── api.js (mock API responses)
```

---

### Unit Test Examples

#### 1. reportService.test.js

```javascript
import { 
  createReport, 
  getReportDetail, 
  getReportList,
  getExistingReportId 
} from './reportService';
import api from '../api';

jest.mock('../api');

describe('reportService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    sessionStorage.clear();
  });

  describe('createReport', () => {
    it('should create a report with extId and search context', async () => {
      const mockResponse = {
        commerceContentId: 'test-commerce-id-123',
        reportData: { success: true }
      };
      
      api.createReport.mockResolvedValue(mockResponse);
      
      const result = await createReport('ext-123', {
        searchContext: {
          searchContextKey: 'test-key',
          teaserInput: { fName: 'Tim', lName: 'Chin' }
        }
      });
      
      expect(api.createReport).toHaveBeenCalledWith({
        type: 'extId',
        extId: 'ext-123',
        searchContextKey: 'test-key',
        teaserInput: { fName: 'Tim', lName: 'Chin' }
      });
      
      expect(result.success).toBe(true);
      expect(result.commerceContentId).toBe('test-commerce-id-123');
    });

    it('should handle missing search context gracefully', async () => {
      api.createReport.mockResolvedValue({
        commerceContentId: 'test-id'
      });
      
      const result = await createReport('ext-123');
      
      expect(api.createReport).toHaveBeenCalledWith({
        type: 'extId',
        extId: 'ext-123'
      });
      
      expect(result.success).toBe(true);
    });

    it('should throw error when API call fails', async () => {
      api.createReport.mockRejectedValue(new Error('API Error'));
      
      await expect(createReport('ext-123')).rejects.toThrow('API Error');
    });
  });

  describe('getReportDetail', () => {
    it('should fetch report detail by commerceContentId', async () => {
      const mockReport = { id: 'test-id', data: 'test-data' };
      api.getReportDetail.mockResolvedValue({ reportData: mockReport });
      
      const result = await getReportDetail('commerce-id-123');
      
      expect(api.getReportDetail).toHaveBeenCalledWith('commerce-id-123');
      expect(result.success).toBe(true);
      expect(result.reportData).toEqual(mockReport);
    });
  });

  describe('getReportList', () => {
    it('should fetch report list without pagination', async () => {
      const mockReports = [{ id: '1' }, { id: '2' }];
      api.getReportList.mockResolvedValue({ data: mockReports });
      
      const result = await getReportList();
      
      expect(api.getReportList).toHaveBeenCalledWith({});
      expect(result.reports).toEqual(mockReports);
    });

    it('should fetch report list with pagination', async () => {
      const mockReports = [{ id: '3' }];
      api.getReportList.mockResolvedValue({ 
        data: mockReports,
        pagination: { hasMore: false }
      });
      
      const result = await getReportList({ lastId: 'last-id-123' });
      
      expect(api.getReportList).toHaveBeenCalledWith({ lastId: 'last-id-123' });
      expect(result.reports).toEqual(mockReports);
    });
  });

  describe('getExistingReportId', () => {
    it('should return commerceContentId if report exists', () => {
      const context = {
        identity: {
          extId: 'ext-123',
          commerceContentId: 'commerce-id-123'
        }
      };
      sessionStorage.setItem('searchContext', JSON.stringify(context));
      
      const result = getExistingReportId('ext-123');
      
      expect(result).toBe('commerce-id-123');
    });

    it('should return null if report does not exist', () => {
      const result = getExistingReportId('ext-123');
      expect(result).toBeNull();
    });
  });
});
```

---

#### 2. SearchResultDetailPage.test.js

```javascript
import { render, screen, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import SearchResultDetailPage from './SearchResultDetailPage';
import { getReportDetail, createReportForIdentity } from '../../services/reportService';
import { useAuth } from '../../context/AuthContext';

jest.mock('../../services/reportService');
jest.mock('../../context/AuthContext');

describe('SearchResultDetailPage', () => {
  const mockNavigate = jest.fn();
  
  beforeEach(() => {
    jest.clearAllMocks();
    sessionStorage.clear();
    useAuth.mockReturnValue({ token: 'test-token' });
    
    // Mock useNavigate
    jest.mock('react-router-dom', () => ({
      ...jest.requireActual('react-router-dom'),
      useNavigate: () => mockNavigate,
      useParams: () => ({ id: 'test-id' })
    }));
  });

  it('should fetch and display report detail', async () => {
    const mockReport = {
      raws: [{
        transient: {
          identities: [{
            nameList: [{ data: 'John Doe' }],
            addressList: [{ city: 'New York', state: 'NY' }]
          }]
        }
      }]
    };
    
    getReportDetail.mockResolvedValue({
      success: true,
      reportData: mockReport
    });
    
    render(
      <BrowserRouter>
        <SearchResultDetailPage />
      </BrowserRouter>
    );
    
    await waitFor(() => {
      expect(screen.getByText('John Doe')).toBeInTheDocument();
    });
    
    expect(getReportDetail).toHaveBeenCalledWith('test-id');
  });

  it('should create report if detail fetch fails', async () => {
    getReportDetail.mockRejectedValue(new Error('Not found'));
    
    const mockIdentity = { extId: 'test-id', fullName: 'John Doe' };
    sessionStorage.setItem('searchContext', JSON.stringify({
      identity: mockIdentity
    }));
    
    createReportForIdentity.mockResolvedValue({
      success: true,
      commerceContentId: 'new-commerce-id'
    });
    
    getReportDetail.mockResolvedValue({
      success: true,
      reportData: { raws: [] }
    });
    
    render(
      <BrowserRouter>
        <SearchResultDetailPage />
      </BrowserRouter>
    );
    
    await waitFor(() => {
      expect(createReportForIdentity).toHaveBeenCalled();
    });
  });

  it('should display error message when report fetch fails', async () => {
    getReportDetail.mockRejectedValue(new Error('API Error'));
    
    render(
      <BrowserRouter>
        <SearchResultDetailPage />
      </BrowserRouter>
    );
    
    await waitFor(() => {
      expect(screen.getByText(/error/i)).toBeInTheDocument();
    });
  });
});
```

---

#### 3. AccountPage.test.js

```javascript
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import AccountPage from './AccountPage';
import { getReportList } from '../../services/reportService';
import api from '../../api';

jest.mock('../../services/reportService');
jest.mock('../../api');
jest.mock('../../context/AuthContext', () => ({
  useAuth: () => ({ token: 'test-token' })
}));

describe('AccountPage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    api.get.mockResolvedValue({ plan: 'basic' });
  });

  it('should display report list', async () => {
    const mockReports = [
      {
        commerceContent: { _id: 'id-1' },
        data: { teaserInput: { fName: 'John', lName: 'Doe' } },
        createdAt: '2025-01-01'
      }
    ];
    
    getReportList.mockResolvedValue({
      success: true,
      reports: mockReports,
      pagination: { hasMore: false }
    });
    
    render(
      <BrowserRouter>
        <AccountPage />
      </BrowserRouter>
    );
    
    await waitFor(() => {
      expect(screen.getByText(/John Doe/i)).toBeInTheDocument();
    });
  });

  it('should load more reports on pagination', async () => {
    const initialReports = [{ commerceContent: { _id: 'id-1' } }];
    const moreReports = [{ commerceContent: { _id: 'id-2' } }];
    
    getReportList
      .mockResolvedValueOnce({
        success: true,
        reports: initialReports,
        pagination: { hasMore: true, lastId: 'id-1' }
      })
      .mockResolvedValueOnce({
        success: true,
        reports: moreReports,
        pagination: { hasMore: false }
      });
    
    render(
      <BrowserRouter>
        <AccountPage />
      </BrowserRouter>
    );
    
    await waitFor(() => {
      expect(screen.getByText('Load More Reports')).toBeInTheDocument();
    });
    
    fireEvent.click(screen.getByText('Load More Reports'));
    
    await waitFor(() => {
      expect(getReportList).toHaveBeenCalledTimes(2);
      expect(getReportList).toHaveBeenLastCalledWith({ lastId: 'id-1' });
    });
  });

  it('should display empty state when no reports', async () => {
    getReportList.mockResolvedValue({
      success: true,
      reports: [],
      pagination: { hasMore: false }
    });
    
    render(
      <BrowserRouter>
        <AccountPage />
      </BrowserRouter>
    );
    
    await waitFor(() => {
      expect(screen.getByText(/haven't created any reports/i)).toBeInTheDocument();
    });
  });
});
```

---

### Integration Test Examples

#### API Integration Test (using Jest + Supertest or similar)

```javascript
// tests/integration/reportFlow.test.js
describe('Report Creation Flow Integration', () => {
  it('should create report and fetch detail', async () => {
    // 1. Perform search
    const searchResponse = await api.searchPeople({
      firstName: 'Tim',
      lastName: 'Chin',
      state: 'FL'
    });
    
    expect(searchResponse.data.length).toBeGreaterThan(0);
    const identity = searchResponse.data[0];
    
    // 2. Create report
    const createResponse = await createReport(identity.extId, {
      searchContext: searchResponse.searchContext
    });
    
    expect(createResponse.success).toBe(true);
    expect(createResponse.commerceContentId).toBeDefined();
    
    // 3. Fetch report detail
    const detailResponse = await getReportDetail(createResponse.commerceContentId);
    
    expect(detailResponse.success).toBe(true);
    expect(detailResponse.reportData).toBeDefined();
  });
});
```

---

## Test Execution Checklist

### Pre-Testing Setup
- [ ] Proxy server running on port 3001
- [ ] React app running on port 3000
- [ ] API configuration correct
- [ ] Test credentials available
- [ ] Browser DevTools open (Console, Network tabs)

### Manual Testing Execution
- [ ] Test 1.1: Report Creation - Logged-In User
- [ ] Test 1.2: Report Creation - After Payment
- [ ] Test 1.3: Report Creation - Direct Navigation
- [ ] Test 2.1: View Full Report
- [ ] Test 2.2: Data Structure Validation
- [ ] Test 2.3: Error Handling
- [ ] Test 3.1: Report List - First Page
- [ ] Test 3.2: Report List - Pagination
- [ ] Test 3.3: Report List - Empty State
- [ ] Test 3.4: Report List - Click to View
- [ ] Test 4.1: Payment → Report Creation
- [ ] Test 4.2: Payment Error Handling
- [ ] Test 5.1: Search Context Persistence
- [ ] Test 5.2: Identity Context Storage
- [ ] Test 6.1: Duplicate Prevention
- [ ] Test 6.2: Missing Context Handling
- [ ] Test 6.3: Network Error Handling
- [ ] Test 6.4: Invalid ID Handling

### Automated Testing (When Framework is Set Up)
- [ ] Install testing dependencies (Jest, React Testing Library)
- [ ] Configure Jest
- [ ] Write reportService unit tests
- [ ] Write component unit tests
- [ ] Write integration tests
- [ ] Set up CI/CD test execution
- [ ] Achieve >80% test coverage

---

## Test Results Template

```
Test Date: __________
Tester: __________
Environment: Development / Staging / Production
Browser: Chrome / Firefox / Safari / Edge

=== Report Creation Tests ===
Test 1.1 (Logged-In Auto-Create): PASS / FAIL
  Notes: __________
  
Test 1.2 (After Payment): PASS / FAIL
  Notes: __________
  
Test 1.3 (Direct Navigation): PASS / FAIL
  Notes: __________

=== Report Detail Tests ===
Test 2.1 (View Full Report): PASS / FAIL
  Notes: __________
  
Test 2.2 (Data Structure): PASS / FAIL
  Notes: __________
  
Test 2.3 (Error Handling): PASS / FAIL
  Notes: __________

=== Report List Tests ===
Test 3.1 (First Page): PASS / FAIL
  Notes: __________
  
Test 3.2 (Pagination): PASS / FAIL
  Notes: __________
  
Test 3.3 (Empty State): PASS / FAIL
  Notes: __________
  
Test 3.4 (Click to View): PASS / FAIL
  Notes: __________

=== Payment Integration Tests ===
Test 4.1 (Payment Flow): PASS / FAIL
  Notes: __________
  
Test 4.2 (Error Handling): PASS / FAIL
  Notes: __________

=== Context Management Tests ===
Test 5.1 (Context Persistence): PASS / FAIL
  Notes: __________
  
Test 5.2 (Identity Storage): PASS / FAIL
  Notes: __________

=== Edge Cases ===
Test 6.1 (Duplicate Prevention): PASS / FAIL
  Notes: __________
  
Test 6.2 (Missing Context): PASS / FAIL
  Notes: __________
  
Test 6.3 (Network Errors): PASS / FAIL
  Notes: __________
  
Test 6.4 (Invalid ID): PASS / FAIL
  Notes: __________

=== Issues Found ===
1. __________
   Severity: Critical / High / Medium / Low
   Status: Open / Fixed / Deferred
   
2. __________
   Severity: Critical / High / Medium / Low
   Status: Open / Fixed / Deferred

=== Overall Assessment ===
Phase 3 Status: ✅ Ready for Production / ⚠️ Needs Fixes / ❌ Blocked

Blockers: __________
Recommendations: __________
```

---

## Browser Console Testing Commands

For quick testing via browser console:

```javascript
// Test report creation
import('./services/reportService.js').then(module => {
  const { createReport } = module;
  createReport('ext-123', {
    searchContext: {
      searchContextKey: 'test-key',
      teaserInput: { fName: 'Tim', lName: 'Chin' }
    }
  }).then(result => console.log('Report created:', result));
});

// Test report detail
import('./services/reportService.js').then(module => {
  const { getReportDetail } = module;
  getReportDetail('commerce-content-id-123').then(result => 
    console.log('Report detail:', result)
  );
});

// Test report list
import('./services/reportService.js').then(module => {
  const { getReportList } = module;
  getReportList().then(result => console.log('Report list:', result));
});

// Check search context
import('./services/searchContext.js').then(module => {
  const { getSearchContext } = module;
  console.log('Search context:', getSearchContext());
});
```

---

## Performance Testing

### Metrics to Monitor

1. **Report Creation Time**
   - Target: < 3 seconds
   - Measure: Time from API call to report display

2. **Report Detail Load Time**
   - Target: < 2 seconds
   - Measure: Time from navigation to data display

3. **Report List Load Time**
   - Target: < 1.5 seconds
   - Measure: Time from page load to list display

4. **API Response Times**
   - Monitor: Network tab in DevTools
   - Check: Each API call duration

### Performance Test Steps

1. Open browser DevTools → Network tab
2. Enable throttling (Slow 3G or Fast 3G)
3. Execute test flows
4. Record timing metrics
5. Compare against targets

---

## Security Testing

### Areas to Test

1. **Authorization**
   - [ ] Users can only view their own reports
   - [ ] Report IDs cannot be guessed/accessed by other users
   - [ ] API calls include proper authentication

2. **Data Validation**
   - [ ] Invalid commerceContentId is rejected
   - [ ] Malformed search context is handled
   - [ ] XSS prevention in displayed data

3. **Session Management**
   - [ ] Search context cleared on logout
   - [ ] Reports not accessible after logout
   - [ ] Session timeout handling

---

## Success Criteria

### ✅ Phase 3 is Ready for Production When:

1. **All Manual Tests Pass**
   - At least 90% of test cases pass
   - Critical flows (payment → report) work 100%

2. **Error Handling Works**
   - All error scenarios handled gracefully
   - User-friendly error messages
   - No app crashes

3. **Performance Acceptable**
   - Report creation < 3 seconds
   - Report detail load < 2 seconds
   - No significant performance degradation

4. **Data Integrity**
   - Reports created correctly
   - Data displays accurately
   - No data loss or corruption

5. **User Experience**
   - Flows are intuitive
   - Loading states clear
   - Error recovery possible

---

## Next Steps After Testing

1. **Document Issues**
   - Create issue tickets for failures
   - Prioritize by severity
   - Assign to developers

2. **Fix Critical Issues**
   - Address blockers first
   - Fix high-severity bugs
   - Test fixes

3. **Retest**
   - Re-run failed tests
   - Verify fixes work
   - Update test results

4. **Automated Test Setup** (Future)
   - Set up testing framework
   - Write unit tests
   - Set up CI/CD

---

## Resources

- **API Documentation:** `docs/new-api/new-api.md`
- **Integration Plan:** `docs/NEW_API_INTEGRATION_PLAN.md`
- **Search Testing Plan:** `docs/SEARCH_TESTING_PLAN.md`
- **Deployment Guide:** `docs/DEPLOYMENT_NEW_API.md`

---

**Document Version:** 1.0  
**Last Updated:** January 2025  
**Status:** Ready for Testing
