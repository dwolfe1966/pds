/**
 * Copies .env.admin.local → .env.local so Parcel picks up admin-specific
 * env vars (proxy-bc URL, bytecrtrs API domain) for the admin dev server.
 *
 * Run before `parcel public/admin.html`.
 * The consumer app's `npm start` uses .env (not .env.local), so this
 * doesn't interfere — but if both run simultaneously you should start
 * the consumer app first (it won't read .env.local unless it exists at launch).
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
