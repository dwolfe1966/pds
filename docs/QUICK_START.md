# Quick Start - Running Locally

## Important: Use the Dev Server

**DO NOT** open `dist/index.html` or `build/index.html` directly in your browser. These are build artifacts with absolute paths that won't work when opened directly.

## Steps to Run

### 1. Clean any previous builds (if you have issues)
```bash
# Windows PowerShell
Remove-Item -Recurse -Force dist -ErrorAction SilentlyContinue
Remove-Item -Recurse -Force .parcel-cache -ErrorAction SilentlyContinue
Remove-Item -Recurse -Force build -ErrorAction SilentlyContinue

# Or on Mac/Linux
rm -rf dist .parcel-cache build
```

### 2. Install dependencies (if not already done)
```bash
npm install
```

### 3. Start the development server
```bash
npm start
```

This will:
- Start Parcel dev server on http://localhost:3000
- Automatically inject scripts and handle hot reloading
- Open your browser to the correct URL

### 4. (Optional) Start the mock API server
In a separate terminal:
```bash
npm run server
```

Or run both together:
```bash
npm run dev
```

## Troubleshooting

### "Script not found" or blank page
- Make sure you're using `npm start` (dev server), not opening HTML files directly
- Check that port 3000 is not in use
- Clear browser cache
- Delete `dist/` and `.parcel-cache/` folders and restart

### Port already in use
```bash
npm start -- --port 3001
```

### Parcel not working
- Delete `node_modules` and `.parcel-cache`
- Run `npm install` again
- Try `npm start` again

## What's Happening

- **Development**: `npm start` runs Parcel dev server which handles everything automatically
- **Production**: `npm run build` creates static files in `build/` directory for deployment
- **Never**: Open `dist/` or `build/` HTML files directly in browser during development

