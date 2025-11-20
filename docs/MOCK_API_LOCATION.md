# Mock API Location

## Where is the Mock API Code?

The mock API server code is located in the **`server/`** directory:

```
server/
├── index.js          # Main Express server with all API endpoints
├── middleware/
│   └── auth.js      # JWT authentication middleware
├── seed.js          # Seed data generator
└── package.json     # Server dependencies
```

## Main Files

### `server/index.js`
This is the main API server file containing:
- Express app setup
- All API endpoints (authentication, search, member endpoints, admin endpoints)
- CORS configuration
- Error handling
- Server startup

### `server/middleware/auth.js`
Contains:
- `authenticateToken` - JWT token verification middleware
- `requireRole` - Role-based access control middleware

### `server/seed.js`
Contains:
- Seed data generation functions
- Creates test users, people records, searches, alerts, etc.
- Called on server startup to populate in-memory data store

## How to Run

```bash
# Start the mock API server
cd server
node index.js

# Or from root directory
npm run server
```

## API Base URL

- **Development**: `http://localhost:3001/api/v1`
- **Health Check**: `http://localhost:3001/api/v1/health`

## Important Notes

- The mock API is **development only** - not included in production builds
- Data is stored **in-memory** - resets when server restarts
- All endpoints are documented in `API_SPECIFICATION.md`
- Seed data is automatically loaded on server startup

