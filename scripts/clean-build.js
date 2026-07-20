/**
 * Pre-build clean. Parcel does NOT clean its --dist-dir, so every build piles new hashed assets
 * (public.<hash>.js/css, chunks, leaflet PNGs) on top of the old ones — 266 stale public.*.js had
 * accumulated in build/ by 2026-07-20. Wiping the dir before each build guarantees the output contains
 * ONLY the current build's assets. Parcel recreates the dir; postbuild re-copies libs/ + patches index.html.
 *
 * Cross-platform (Mac + Windows) via fs.rmSync. Usage: node scripts/clean-build.js [dir=build]
 */
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const target = path.resolve(root, process.argv[2] || 'build');

// Safety: only ever remove a build*/ dir INSIDE the repo (never something outside, never the repo root).
const rel = path.relative(root, target);
if (rel.startsWith('..') || path.isAbsolute(rel) || !/^build/.test(rel)) {
  console.error(`clean-build: refusing to remove "${target}" (must be a build*/ dir inside the repo)`);
  process.exit(1);
}

try {
  if (fs.existsSync(target)) {
    fs.rmSync(target, { recursive: true, force: true });
    console.log(`clean-build: removed ${rel}/ (fresh build — no stale hashed assets)`);
  } else {
    console.log(`clean-build: ${rel}/ not present, nothing to clean`);
  }
} catch (e) {
  console.warn(`clean-build: could not remove ${rel}/: ${e.message}`);
}
