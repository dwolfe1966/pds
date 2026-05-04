/**
 * Build script for admin app.
 *
 * Uses Node to invoke Parcel so that Git Bash on Windows doesn't mangle
 * the --public-url /csr/ path into a local file path.
 */
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');

// 1. Copy .env.admin → .env.production.local so Parcel picks up admin env vars
const src = path.join(root, '.env.admin');
const dst = path.join(root, '.env.production.local');
fs.copyFileSync(src, dst);
console.log('build-admin: copied .env.admin → .env.production.local');

try {
  // 2. Run Parcel build with --public-url /csr/
  //    MSYS_NO_PATHCONV prevents Git Bash from converting /csr/ to C:/Program Files/Git/csr/
  execSync('npx parcel build public/admin.html --dist-dir build-admin --public-url /csr/', {
    cwd: root,
    stdio: 'inherit',
    env: { ...process.env, MSYS_NO_PATHCONV: '1' },
  });
} catch (e) {
  // Parcel on Windows sometimes exits with non-zero even on success; check if output exists
  const outFile = path.join(root, 'build-admin', 'admin.html');
  if (!fs.existsSync(outFile)) {
    console.error('build-admin: Parcel build failed — no output produced');
    process.exit(1);
  }
  console.log('build-admin: Parcel exited with warnings but output was produced');
} finally {
  // 3. Clean up .env.production.local
  try { fs.unlinkSync(dst); } catch (e) {}
  console.log('build-admin: cleaned up .env.production.local');
}

// 4. Run postbuild
require('./postbuild-admin.js');
