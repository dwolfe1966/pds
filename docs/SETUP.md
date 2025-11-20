# Quick Setup Guide

## Step-by-Step Setup

### 1. Install Dependencies

```bash
# Install frontend dependencies
npm install

# Install server dependencies
cd server
npm install
cd ..
```

Or use the npm script:
```bash
npm install
npm run install-server
```

### 2. Start the Application

**Option A: Run both together (recommended)**
```bash
npm run dev
```

**Option B: Run separately**

Terminal 1:
```bash
npm run server
```

Terminal 2:
```bash
npm start
```

### 3. Access the Application

- Frontend: http://localhost:3000
- API Server: http://localhost:3001
- API Base URL: http://localhost:3001/api/v1

### 4. Test Credentials

**Member Account:**
- Email: `member@test.com`
- Password: `password123`

**Admin Account:**
- Email: `admin@test.com`
- Password: `admin123`

## Troubleshooting

### Port Already in Use

If port 3000 or 3001 is already in use:

**Change frontend port:**
```bash
npm start -- --port 3002
```

**Change server port:**
```bash
PORT=3002 npm run server
```

### Module Not Found Errors

Make sure all dependencies are installed:
```bash
npm install
cd server && npm install && cd ..
```

### CORS Errors

The server is configured to allow requests from `http://localhost:3000`. If you're using a different port, update `server/index.js`:

```javascript
app.use(cors({
  origin: 'http://localhost:YOUR_PORT',
  credentials: true
}));
```

### API Connection Issues

1. Verify the server is running: Check http://localhost:3001/api/v1/search?firstName=John&lastName=Doe
2. Check browser console for CORS errors
3. Verify the API URL in `src/api.js` matches your server port

## Next Steps

1. Review `GO_FORWARD_PLAN.md` for development roadmap
2. Check `API_SPECIFICATION.md` for API documentation
3. Start integrating frontend pages with API endpoints

