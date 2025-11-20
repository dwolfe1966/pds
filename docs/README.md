# IDLookup.AI - React Front-End Application

A React-based front-end application for IDLookup.AI, a service that helps users find public information about people and monitor when others search for them.

**Note:** This is a static React application that can be deployed to any static hosting service (Netlify, Vercel, AWS S3, etc.). The mock API server included is for **development only** - the production API will be built by another department.

## Project Structure

```
idlookup-app-updated/
├── src/
│   ├── api.js                 # API client helper
│   ├── App.js                 # Main app component with routing
│   ├── index.js              # Entry point
│   ├── components/           # Reusable UI components
│   ├── context/              # React context providers (Auth)
│   └── pages/                # Page components
│       ├── sales/            # Public/sales pages
│       ├── member/           # Member-only pages
│       └── admin/             # Admin-only pages
├── server/                   # Mock API server
│   ├── index.js              # Express server
│   ├── middleware/           # Auth middleware
│   └── seed.js               # Seed data generator
├── public/                   # Static files
└── package.json              # Dependencies and scripts
```

## Prerequisites

- Node.js (v14 or higher)
- npm or yarn

## Installation

1. **Install frontend dependencies:**
   ```bash
   npm install
   ```

2. **Install server dependencies:**
   ```bash
   cd server
   npm install
   cd ..
   ```

   Or use the npm script:
   ```bash
   npm run install-server
   ```

## Running the Application

### Option 1: Run Frontend and Backend Separately

**Terminal 1 - Start the mock API server:**
```bash
npm run server
```
The API server will start on `http://localhost:3001`

**Terminal 2 - Start the React frontend:**
```bash
npm start
```
The frontend will start on `http://localhost:3000`

### Option 2: Run Both Together (Recommended)

If you have `concurrently` installed:
```bash
npm install -g concurrently
npm run dev
```

Or install it locally:
```bash
npm install --save-dev concurrently
npm run dev
```

## Mock API Server (Development Only)

**Important:** The mock API server is for **local development and testing only**. In production, the React app will connect to the API built by the backend department.

The mock API server provides:
- All endpoints specified in `API_SPECIFICATION.md`
- JWT-based authentication
- Comprehensive seed data for testing
- In-memory data storage (resets on server restart)

**For Production:** Configure the API URL via environment variable `REACT_APP_API_URL` pointing to the production API endpoint.

### Seed Data

The server automatically loads seed data including:
- 22 users (1 admin, 1 test member, 20 additional members)
- 100 people records for searching
- 200 search history entries
- Alerts, notifications, subscriptions, invoices
- Admin data (sessions, purchases, data removal requests)

### Test Credentials

**Member Account:**
- Email: `member@test.com`
- Password: `password123`

**Admin Account:**
- Email: `admin@test.com`
- Password: `admin123`

## API Endpoints

All API endpoints are documented in `API_SPECIFICATION.md`. The base URL is:
- Development: `http://localhost:3001/api/v1`
- Production: Set via `REACT_APP_API_URL` environment variable

## Key Features

### Authentication
- JWT-based authentication
- Token refresh mechanism
- Role-based access control (member, admin, cs-rep)

### User Roles
1. **Sales/Public**: Unauthenticated users can search and view previews
2. **Member**: Authenticated users with full access to:
   - People search
   - Profile management
   - Alerts
   - Who is searching for me
   - Subscription management
3. **Admin**: Administrative access to:
   - User management
   - Analytics
   - Data removal requests
   - CS rep management

### Pages

#### Sales Pages (Public)
- `/` - Home page
- `/about` - About page
- `/contact` - Contact page
- `/search` - Search landing page
- `/search-results` - Public search results
- `/search/:id` - Search result preview
- `/signup` - Sign up page
- `/login` - Login page
- `/payment` - Payment page

#### Member Pages (Authenticated)
- `/dashboard` - Member dashboard
- `/profile` - Profile management
- `/people-search` - Advanced search
- `/people-results` - Search results
- `/people/:id` - Full person report
- `/who-is-searching` - Who searched for me
- `/alerts` - Alert management
- `/account` - Account and billing
- `/settings` - Settings and security
- `/logout` - Logout

#### Admin Pages (Admin Only)
- `/admin/users` - User management
- `/admin/users/:id` - User details
- `/admin/sessions` - Session management
- `/admin/purchases` - Purchase management
- `/admin/purchases/:id` - Purchase details
- `/admin/data-removal` - Data removal requests
- `/admin/analytics` - Analytics dashboard
- `/admin/cs-reps` - CS rep management

## Development

### Environment Variables

Create a `.env` file in the root directory:

```env
REACT_APP_API_URL=http://localhost:3001/api/v1
```

For the server, you can set:
```env
PORT=3001
JWT_SECRET=your-secret-key-change-in-production
JWT_REFRESH_SECRET=your-refresh-secret-key-change-in-production
```

### Building for Production

```bash
npm run build
```

This creates an optimized production build in the `build/` directory. The build is a **static site** that can be deployed to:
- Netlify
- Vercel
- AWS S3 + CloudFront
- GitHub Pages
- Any static hosting service

**Production Configuration:**
1. Set the production API URL before building:
   ```bash
   REACT_APP_API_URL=https://api.idlookup.ai/api/v1 npm run build
   ```
2. Or create a `.env.production` file:
   ```
   REACT_APP_API_URL=https://api.idlookup.ai/api/v1
   ```
3. Deploy the `build/` directory to your hosting service

## Project Status

### Completed
- ✅ Project structure and routing
- ✅ Authentication context
- ✅ API client setup
- ✅ Mock API server with all endpoints
- ✅ Seed data generation
- ✅ Page components (basic structure)

### In Progress
- 🔄 Frontend API integration
- 🔄 Form validation
- 🔄 Error handling
- 🔄 Loading states

### Planned
- ⏳ UI/UX enhancements
- ⏳ Responsive design
- ⏳ Testing
- ⏳ Production deployment

## Documentation

- `GO_FORWARD_PLAN.md` - Development roadmap and plan
- `API_SPECIFICATION.md` - Complete API documentation (for backend team)
- `DEPLOYMENT.md` - Static site deployment guide
- `SETUP.md` - Quick setup instructions
- `spec.txt` - Original project specification

## Deployment Architecture

```
┌─────────────────────────────────────┐
│   Static React App (This Repo)      │
│   - Built with Parcel               │
│   - Deployed as static files        │
│   - Hosted on Netlify/Vercel/etc.   │
└──────────────┬──────────────────────┘
               │
               │ HTTP/HTTPS
               │ API Calls
               │
┌──────────────▼──────────────────────┐
│   Backend API (Other Department)    │
│   - REST API                         │
│   - JWT Authentication               │
│   - Database                         │
└─────────────────────────────────────┘
```

**Key Points:**
- React app is **completely static** - no server-side code
- Mock API (`server/`) is **development only** - not included in production build
- Production API URL configured via `REACT_APP_API_URL` environment variable
- Build output (`build/`) contains only HTML, CSS, and JavaScript files

## Troubleshooting

### API Connection Issues
- Ensure the mock API server is running on port 3001
- Check that CORS is enabled (should be automatic)
- Verify the API URL in `src/api.js` or `.env` file

### Authentication Issues
- Clear browser localStorage/sessionStorage
- Check that tokens are being set correctly
- Verify JWT_SECRET matches between client and server

### Port Conflicts
- Change the frontend port: `npm start -- --port 3002`
- Change the server port: Set `PORT=3002` environment variable

## Contributing

1. Review the go-forward plan in `GO_FORWARD_PLAN.md`
2. Check the API specification in `API_SPECIFICATION.md`
3. Follow the existing code structure
4. Test with the mock API server before integration

## License

Private project - All rights reserved

