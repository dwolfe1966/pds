# Phase 3 Testing - Quick Checklist

**Quick reference for manual testing**

---

## Pre-Testing Setup

- [ ] Proxy server running (`npm run server`)
- [ ] React app running (`npm start`)
- [ ] Browser DevTools open (Console + Network tabs)
- [ ] Test credentials ready (member@test.com / password123)
- [ ] Test search data ready (Tim Chin, FL)

---

## Critical Path Tests (Must Pass)

### ✅ Happy Path: Logged-In User
1. [ ] Login → Search → Click Result → Report Created → View Report
   - Time: _____ seconds
   - Issues: __________

### ✅ Happy Path: New User Signup
2. [ ] Search → Click Result → Signup → Payment → Report Created → View Report
   - Time: _____ seconds
   - Issues: __________

### ✅ Report List
3. [ ] Login → Account Page → View Reports → Click Report → View Detail
   - Time: _____ seconds
   - Issues: __________

---

## Quick Test Scenarios

### Report Creation
- [ ] Auto-create for logged-in user: PASS / FAIL
- [ ] Create after payment: PASS / FAIL
- [ ] Create from direct navigation: PASS / FAIL
- [ ] Duplicate prevention works: PASS / FAIL

### Report Viewing
- [ ] View with commerceContentId: PASS / FAIL
- [ ] View with extId (creates report): PASS / FAIL
- [ ] Data displays correctly: PASS / FAIL
- [ ] Error handling works: PASS / FAIL

### Report List
- [ ] List displays: PASS / FAIL
- [ ] Pagination works: PASS / FAIL
- [ ] Empty state shows: PASS / FAIL
- [ ] Click to view works: PASS / FAIL

### Payment Flow
- [ ] Payment → Report creation: PASS / FAIL
- [ ] Redirect to report: PASS / FAIL
- [ ] Error handling: PASS / FAIL

---

## Browser Console Commands

```javascript
// Check search context
JSON.parse(sessionStorage.getItem('searchContext'))

// Check if report exists
import('./services/reportService.js').then(m => 
  m.getExistingReportId('ext-123')
)

// Create report manually
import('./services/reportService.js').then(m => 
  m.createReport('ext-123', { searchContext: {...} })
)
```

---

## Common Issues to Check

- [ ] CORS errors in console
- [ ] 412 errors (captcha issues)
- [ ] 400 errors (missing parameters)
- [ ] Network timeouts
- [ ] SessionStorage not persisting
- [ ] Wrong API endpoint called
- [ ] Missing commerceContentId
- [ ] Duplicate report creation

---

## Performance Checks

- Report creation: < 3 seconds ✅ / ❌
- Report detail load: < 2 seconds ✅ / ❌
- Report list load: < 1.5 seconds ✅ / ❌

---

## Notes

Date: __________  
Tester: __________  
Environment: __________  

Issues Found:
1. __________
2. __________
3. __________
