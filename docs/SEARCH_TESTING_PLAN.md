# Search Testing Plan
**Date:** January 2025  
**Purpose:** Comprehensive testing of all search use cases before Phase 3

---

## Test Scenarios

### 1. Name Search (Sales Flow)

#### Test Case 1.1: Name Search with State
- **Route:** `/name/loader?firstName=Tim&lastName=Chin&state=FL`
- **Expected:**
  - ✅ Loader page shows progress
  - ✅ Search executes via new API
  - ✅ Results displayed on results page
  - ✅ Search context stored
  - ✅ State parameter passed correctly (uppercase: "FL")

#### Test Case 1.2: Name Search without State
- **Route:** `/name/loader?firstName=David&lastName=Wolfe`
- **Expected:**
  - ✅ Search executes successfully
  - ✅ Results displayed (may be broader without state filter)
  - ✅ No errors from missing state

#### Test Case 1.3: Name Search via Search Bar
- **Route:** `/name/landing` → Enter name → Submit
- **Expected:**
  - ✅ Redirects to loader page
  - ✅ Search parameters passed correctly
  - ✅ Results displayed

#### Test Case 1.4: Name Search via Query Parameter
- **Route:** `/search-results?q=Mary Berry&state=CA`
- **Expected:**
  - ✅ Parses query into firstName/lastName
  - ✅ Executes search
  - ✅ Results displayed

### 2. Phone Search

#### Test Case 2.1: Phone Search (10 digits)
- **Route:** `/phone/loader?phone=8054320540`
- **Expected:**
  - ✅ Loader page shows progress
  - ✅ Search executes with type: 'phone'
  - ✅ Results displayed
  - ✅ Search context stored

#### Test Case 2.2: Phone Search (formatted)
- **Route:** `/phone/loader?phone=(805)432-0540`
- **Expected:**
  - ✅ Phone number normalized
  - ✅ Search executes successfully

#### Test Case 2.3: Phone Search (with dashes)
- **Route:** `/phone/loader?phone=805-432-0540`
- **Expected:**
  - ✅ Phone number normalized
  - ✅ Search executes successfully

### 3. Email Search (If Implemented)

#### Test Case 3.1: Email Search
- **Route:** Test via API directly
- **Expected:**
  - ✅ Search executes with type: 'email'
  - ✅ Results displayed (if API supports)

### 4. Member Search Flow

#### Test Case 4.1: Member Name Search with State
- **Route:** `/member/search` → Enter name and state → Submit
- **Expected:**
  - ✅ Search executes
  - ✅ Results displayed
  - ✅ Search context stored
  - ✅ Authentication token included

#### Test Case 4.2: Member Name Search without State
- **Route:** `/member/search` → Enter name only → Submit
- **Expected:**
  - ✅ Search executes successfully
  - ✅ Results displayed

### 5. Edge Cases & Error Handling

#### Test Case 5.1: No Results Found
- **Search:** Very uncommon name or invalid data
- **Expected:**
  - ✅ No errors thrown
  - ✅ "No results found" message displayed
  - ✅ Empty results array handled gracefully

#### Test Case 5.2: Invalid State Code
- **Search:** Name with state="XX" (invalid)
- **Expected:**
  - ✅ Search executes (API may ignore invalid state)
  - ✅ No errors thrown
  - ✅ Results displayed (if any)

#### Test Case 5.3: Missing Required Fields
- **Search:** Only firstName, no lastName
- **Expected:**
  - ✅ Validation error displayed
  - ✅ Search not executed
  - ✅ User-friendly error message

#### Test Case 5.4: Empty Search
- **Search:** Empty form submission
- **Expected:**
  - ✅ Validation prevents submission
  - ✅ Error message displayed

#### Test Case 5.5: Special Characters in Name
- **Search:** Name with apostrophes, hyphens, etc.
- **Expected:**
  - ✅ Search executes successfully
  - ✅ Special characters handled correctly

### 6. Search Context Tracking

#### Test Case 6.1: Context Stored After Search
- **Action:** Perform a name search
- **Expected:**
  - ✅ `searchContextKey` stored in sessionStorage
  - ✅ `teaserInput` stored
  - ✅ `provider` stored
  - ✅ Context accessible via `getSearchContext()`

#### Test Case 6.2: Context Persists Across Navigation
- **Action:** Search → View Results → Navigate Away → Return
- **Expected:**
  - ✅ Context still available
  - ✅ Can be used for report creation

#### Test Case 6.3: Context Cleared on New Search
- **Action:** Perform search A → Perform search B
- **Expected:**
  - ✅ Context updated with search B data
  - ✅ Old context replaced

### 7. Response Handling

#### Test Case 7.1: Results Displayed Correctly
- **Expected:**
  - ✅ ResultCard components render
  - ✅ Names displayed correctly
  - ✅ Locations displayed
  - ✅ extId available for each result
  - ✅ Provider information available

#### Test Case 7.2: Pagination Information
- **Expected:**
  - ✅ Total count displayed (if available)
  - ✅ Pagination controls work (if implemented)
  - ✅ "Load More" functionality (if implemented)

#### Test Case 7.3: Response Structure
- **Expected:**
  - ✅ Response adapted correctly
  - ✅ `data` array contains results
  - ✅ `pagination` object present
  - ✅ `searchContext` object present

### 8. API Integration

#### Test Case 8.1: New API Used When Enabled
- **Environment:** `REACT_APP_USE_NEW_API_SEARCH=true`
- **Expected:**
  - ✅ Console shows "[API Router] teaser-search: useNewAPI: true"
  - ✅ Request goes through proxy
  - ✅ Captcha flow works (412 → verify → retry)

#### Test Case 8.2: Mock API Fallback
- **Environment:** `REACT_APP_USE_NEW_API_SEARCH=false` OR CORS error
- **Expected:**
  - ✅ Falls back to mock API
  - ✅ Results still displayed
  - ✅ No errors thrown

#### Test Case 8.3: CORS Error Handling
- **Expected:**
  - ✅ Console shows CORS error (expected)
  - ✅ Automatic fallback to mock API
  - ✅ User sees results (from mock API)
  - ✅ No user-facing error

### 9. Performance & UX

#### Test Case 9.1: Loading States
- **Expected:**
  - ✅ Loader page shows progress
  - ✅ Loading indicators visible
  - ✅ Smooth transitions

#### Test Case 9.2: Error Messages
- **Expected:**
  - ✅ User-friendly error messages
  - ✅ No technical jargon
  - ✅ Clear next steps

#### Test Case 9.3: Response Time
- **Expected:**
  - ✅ Search completes within reasonable time
  - ✅ No excessive delays
  - ✅ Progress feedback during wait

---

## Test Data

### Known Good Test Cases (Should Return Results)

1. **Name Search:**
   - First: "Tim", Last: "Chin", State: "FL"
   - First: "David", Last: "Wolfe", State: "CA"
   - First: "Mary", Last: "Berry", State: "CA"

2. **Phone Search:**
   - Phone: "8054320540"
   - Phone: "(805) 432-0540"
   - Phone: "805-432-0540"

### Edge Case Test Data

1. **No Results Expected:**
   - First: "Xyzabc", Last: "Qwerty", State: "CA"
   - Very uncommon name combinations

2. **Special Characters:**
   - First: "O'Brien", Last: "Smith-Johnson"
   - Names with apostrophes and hyphens

3. **Invalid Data:**
   - Empty fields
   - Only first name
   - Invalid state codes

---

## Test Checklist

### Name Search Tests
- [ ] Name with state (FL)
- [ ] Name with state (CA)
- [ ] Name without state
- [ ] Name via search bar
- [ ] Name via query parameter
- [ ] Member name search with state
- [ ] Member name search without state

### Phone Search Tests
- [ ] Phone (10 digits)
- [ ] Phone (formatted with parentheses)
- [ ] Phone (formatted with dashes)
- [ ] Phone via phone search landing page

### Error Handling Tests
- [ ] No results found
- [ ] Invalid state
- [ ] Missing required fields
- [ ] Empty search
- [ ] Special characters

### Context Tracking Tests
- [ ] Context stored after search
- [ ] Context persists across navigation
- [ ] Context updated on new search

### Response Handling Tests
- [ ] Results displayed correctly
- [ ] Pagination information present
- [ ] Response structure correct

### API Integration Tests
- [ ] New API used when enabled
- [ ] Mock API fallback works
- [ ] CORS error handling

### Performance Tests
- [ ] Loading states work
- [ ] Error messages user-friendly
- [ ] Response time acceptable

---

## How to Test

### Option 1: Manual Testing via UI
1. Navigate to search pages
2. Enter test data
3. Verify results
4. Check browser console for logs
5. Check sessionStorage for search context

### Option 2: Use Test Page
1. Navigate to `/search-test` (if created)
2. Use test form to run all scenarios
3. Review results and logs

### Option 3: Browser Console Testing
```javascript
// Test name search
await api.searchPeople({
  firstName: 'Tim',
  lastName: 'Chin',
  state: 'FL',
  type: 'name'
});

// Test phone search
await api.searchPeople({
  phone: '8054320540',
  type: 'phone'
});

// Check search context
import { getSearchContext } from './services/searchContext';
console.log(getSearchContext());
```

---

## Expected Results Summary

### ✅ Success Criteria
- All search types work (name, phone)
- Results display correctly
- Search context stored
- Error handling works
- Fallback to mock API works
- No console errors (except expected CORS warnings)

### ❌ Failure Indicators
- Search doesn't execute
- Results don't display
- Errors thrown
- Context not stored
- API routing fails
- User sees technical errors

---

## Test Results Template

```
Test Date: __________
Tester: __________

Name Search:
- [ ] With state: PASS / FAIL
- [ ] Without state: PASS / FAIL
- [ ] Via search bar: PASS / FAIL

Phone Search:
- [ ] 10 digits: PASS / FAIL
- [ ] Formatted: PASS / FAIL

Error Handling:
- [ ] No results: PASS / FAIL
- [ ] Invalid input: PASS / FAIL

Context Tracking:
- [ ] Stored: PASS / FAIL
- [ ] Persists: PASS / FAIL

API Integration:
- [ ] New API: PASS / FAIL
- [ ] Fallback: PASS / FAIL

Issues Found:
1. __________
2. __________
3. __________
```

---

**Next Steps After Testing:**
1. Document any issues found
2. Fix critical bugs
3. Verify all tests pass
4. Proceed to Phase 3 (Report Creation)
