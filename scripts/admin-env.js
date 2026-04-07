/**
 * Copies .env.admin.local → .env.local so Parcel picks up admin-specific
 * env vars for the admin dev server.
 *
 * IMPORTANT: .env.local overrides .env for ALL Parcel processes.
 * This script registers a cleanup handler to delete .env.local on exit
 * so the consumer app isn't affected.
 */
const fs = require('fs');
const path = require('path');

const src = path.resolve(__dirname, '../.env.admin.local');
const dst = path.resolve(__dirname, '../.env.local');

if (!fs.existsSync(src)) {
  console.error('admin-env: .env.admin.local not found — admin dev server will use default .env');
  process.exit(0);
}

fs.copyFileSync(src, dst);
console.log('admin-env: copied .env.admin.local → .env.local');
console.log('admin-env: NOTE — .env.local will be auto-deleted when the admin server stops.');
console.log('admin-env: If it persists, delete it manually: rm .env.local');

// Clean up on process exit so the consumer app isn't affected
function cleanup() {
  try {
    if (fs.existsSync(dst)) {
      fs.unlinkSync(dst);
      console.log('\nadmin-env: cleaned up .env.local');
    }
  } catch { /* ignore */ }
}
process.on('exit', cleanup);
process.on('SIGINT', () => { cleanup(); process.exit(0); });
process.on('SIGTERM', () => { cleanup(); process.exit(0); });
