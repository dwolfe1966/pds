# Name Search Flow Documentation

This document describes the name search user flow that mimics the privaterecords.net flow with IDLookup design and styling.

## Flow Overview

The name search flow consists of 4 main pages:

1. **Landing Page** (`/name/landing`) - Entry point for name searches
2. **Loader Page** (`/name/loader`) - Shows loading state while performing search
3. **Search Results Page** (`/name/search-result`) - Displays search results
4. **Signup Page** (`/name/signup` or `/signup`) - User registration

## Page Details

### 1. Name Search Landing Page (`/name/landing`)

**File:** `src/pages/sales/NameSearchLandingPage.js`

**Purpose:** Entry point where users enter first name, last name, and optional ZIP code.

**Features:**
- Clean, centered form layout
- First name and last name fields (required)
- ZIP code field (optional)
- "Search Now" button
- Information section explaining what users can find
- IDLookup brand colors (#0e123b)

**User Action:** User fills in the form and clicks "Search Now"

**Navigation:** Redirects to `/name/loader` with search parameters

---

### 2. Name Search Loader Page (`/name/loader`)

**File:** `src/pages/sales/NameSearchLoaderPage.js`

**Purpose:** Shows loading animation while performing the search, then automatically redirects to results.

**Features:**
- Animated loading spinner
- Progress bar (0-100%)
- Status messages ("Initializing search...", "Searching our database...", "Search complete!")
- Displays search query being processed
- IDLookup brand styling

**User Action:** User waits while search is performed (automatic)

**Navigation:** 
- On success: Redirects to `/name/search-result` with results stored in sessionStorage
- On error: Redirects to `/name/search-result?error=true`

**Technical Details:**
- Uses `api.searchPublic()` to perform the search
- Stores results in `sessionStorage` as `nameSearchResults`
- Results format: `{ results: [...], query: { firstName, lastName, zip } }`

---

### 3. Search Results Page (`/name/search-result`)

**File:** `src/pages/sales/SearchResultsPage.js`

**Purpose:** Displays search results with ability to click on individual results.

**Features:**
- Shows search query at the top
- Search bar for new searches
- Result cards with person information
- Loading state while fetching
- Error handling
- "No results found" message
- IDLookup styling with hover effects

**User Action:** User clicks on a result card or "View Full Report" button

**Navigation:** 
- Clicking a result: Navigates to `/search/:id` (preview page)
- Results are stored in sessionStorage for preview page

**Technical Details:**
- First checks `sessionStorage` for results from loader page
- Falls back to query parameters for legacy flow
- Uses `ResultCard` component to display each result

---

### 4. Search Detail Preview Page (`/search/:id`)

**File:** `src/pages/sales/SearchDetailPreviewPage.js`

**Purpose:** Shows a preview/teaser of the full report and encourages signup.

**Features:**
- Displays person's basic information (name, location, age)
- Preview section showing what's available
- Locked sections (contact details, addresses, etc.) marked with 🔒
- Call-to-action section with signup button
- "What's Included" information section
- Back to results link
- IDLookup brand colors and styling

**User Action:** User clicks "Sign Up to View Full Report" or "Log In"

**Navigation:**
- Sign Up: Navigates to `/signup?selected=:id&personName=...&personLocation=...&personAge=...`
- Log In: Navigates to `/login`

**Technical Details:**
- Retrieves person data from `sessionStorage` using `result_${id}` key
- Passes person information to signup page via URL parameters

---

### 5. Signup Page (`/signup`)

**File:** `src/pages/sales/SignupPage.js`

**Purpose:** User registration with optional teaser for selected person.

**Features:**
- Registration form (full name, ZIP, email, password)
- Teaser block when coming from search result (shows person info and benefits)
- Success message
- Error handling
- IDLookup styling

**User Action:** User fills in form and submits

**Navigation:**
- On success: Redirects to `/payment` after 2 seconds
- Stores selected person ID in sessionStorage for payment page

**Technical Details:**
- Uses `api.signup()` to create account
- Sets token and user in AuthContext
- If coming from search result, shows teaser with person information

---

## Complete User Journey

1. **User lands on** `/name/landing`
   - Enters first name, last name, optional ZIP
   - Clicks "Search Now"

2. **Redirected to** `/name/loader`
   - Sees loading animation and progress
   - Search is performed automatically
   - Results stored in sessionStorage

3. **Redirected to** `/name/search-result`
   - Sees list of matching results
   - Clicks on a result or "View Full Report" button

4. **Lands on** `/search/:id` (preview page)
   - Sees preview/teaser of the report
   - Sees locked sections that require signup
   - Clicks "Sign Up to View Full Report"

5. **Redirected to** `/signup`
   - Sees teaser with person information
   - Fills in registration form
   - Submits form

6. **Redirected to** `/payment`
   - Completes purchase to view full report

---

## Routing Configuration

Routes are configured in `src/App.js`:

```javascript
// Name search flow (mimics privaterecords.net)
<Route path="/name/landing" element={<NameSearchLandingPage />} />
<Route path="/name/loader" element={<NameSearchLoaderPage />} />
<Route path="/name/search-result" element={<SalesSearchResultsPage />} />
<Route path="/name/signup" element={<SignupPage />} />

// Legacy routes (still supported)
<Route path="/search-results" element={<SalesSearchResultsPage />} />
<Route path="/search/:id" element={<SearchDetailPreviewPage />} />
<Route path="/signup" element={<SignupPage />} />
```

---

## Data Flow

### SessionStorage Keys Used:

1. `nameSearchResults` - Stores search results from loader page
   - Format: `{ results: [...], query: { firstName, lastName, zip } }`
   - Set by: `NameSearchLoaderPage`
   - Read by: `SalesSearchResultsPage`
   - Cleared by: `SalesSearchResultsPage` after reading

2. `result_${id}` - Stores individual result data for preview page
   - Format: `{ id, fullName, location, ageRange, ... }`
   - Set by: `ResultCard` component
   - Read by: `SearchDetailPreviewPage`

3. `selectedPersonId` - Stores selected person ID for payment page
   - Set by: `SignupPage`
   - Read by: `PaymentPage` (if implemented)

---

## Styling Guidelines

All pages use IDLookup brand colors and styling:

- **Primary Color:** `#0e123b` (dark blue)
- **Background:** `#fff` (white)
- **Secondary Background:** `#f5f5f5` (light gray)
- **Text Color:** `#666` (gray)
- **Error Color:** `#c00` (red)
- **Border Radius:** `4px` or `8px`
- **Font:** System fonts

---

## Testing the Flow

### Test Credentials:
- Member: `member@test.com` / `password123`
- Admin: `admin@test.com` / `admin123`

### Test Search Terms (Guaranteed Results):
- `John Smith` (ZIP: 10001)
- `Jane Johnson` (ZIP: 90210)
- `Michael Williams` (ZIP: 60601)

### Testing Steps:

1. Navigate to `http://localhost:3000/name/landing`
2. Enter a test name (e.g., "John Smith")
3. Optionally enter ZIP code
4. Click "Search Now"
5. Wait for loader page to complete
6. Review search results
7. Click on a result
8. View preview page
9. Click "Sign Up to View Full Report"
10. Complete signup form
11. Verify redirect to payment page

---

## API Endpoints Used

- `GET /api/v1/search` - Public search endpoint
  - Parameters: `firstName`, `lastName`, `zip` (optional)
  - Returns: `{ data: [...], pagination: {...} }`

- `POST /api/v1/signup` - User registration
  - Body: `{ fullName, zip, email, password }`
  - Returns: `{ user: {...}, accessToken, refreshToken }`

---

## Future Enhancements

- [ ] Add phone number search flow (similar structure)
- [ ] Add email search flow
- [ ] Add address search flow
- [ ] Improve error handling and user feedback
- [ ] Add analytics tracking
- [ ] Add A/B testing capabilities
- [ ] Optimize loading states
- [ ] Add skeleton loaders

---

## Notes

- The flow is designed to be conversion-optimized
- Preview page acts as a "paywall" to encourage signups
- SessionStorage is used to maintain state across page navigations
- All pages are responsive and mobile-friendly
- The design matches IDLookup brand guidelines

