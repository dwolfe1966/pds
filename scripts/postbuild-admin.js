/**
 * Post-build script for admin app
 * 1. Copies public/libs/ → build-admin/libs/ (IIFE served at root-relative /libs/...)
 * 2. Replaces the absolute IIFE script src in build-admin/admin.html with root-relative path
 * 3. Renames admin.html → index.html (so it serves at /)
 */

const fs   = require('fs');
const path = require('path');

function copyDir(src, dst) {
  if (!fs.existsSync(dst)) fs.mkdirSync(dst, { recursive: true });
  for (const f of fs.readdirSync(src)) {
    const s = path.join(src, f);
    const d = path.join(dst, f);
    fs.statSync(s).isDirectory() ? copyDir(s, d) : fs.copyFileSync(s, d);
  }
}

const buildDir = path.resolve(__dirname, '../build-admin');

// Copy libs
const srcLibs = path.resolve(__dirname, '../public/libs');
const dstLibs = path.join(buildDir, 'libs');
if (fs.existsSync(srcLibs)) {
  copyDir(srcLibs, dstLibs);
  console.log('postbuild-admin: copied public/libs → build-admin/libs');
} else {
  console.warn('postbuild-admin: public/libs not found, skipping copy');
}

// Rename admin.html → index.html
const adminHtml = path.join(buildDir, 'admin.html');
const indexHtml = path.join(buildDir, 'index.html');
if (fs.existsSync(adminHtml)) {
  // Remove existing index.html if present
  if (fs.existsSync(indexHtml)) fs.unlinkSync(indexHtml);
  fs.renameSync(adminHtml, indexHtml);
  console.log('postbuild-admin: renamed admin.html → index.html');
}

// Patch index.html: replace absolute IIFE URL with root-relative path
if (fs.existsSync(indexHtml)) {
  let html = fs.readFileSync(indexHtml, 'utf8');
  const before = html;
  html = html.replace(
    /src=["']?https:\/\/dev\.www\.idlookup\.ai\/libs\/api-wrapper\/index\.iife\.js["']?/g,
    'src=/admin/libs/api-wrapper/index.iife.js'
  );
  // Remove type="module" from script tags — BC server may serve .js with text/html MIME type
  // which browsers reject for module scripts but accept for classic scripts
  html = html.replace(/<script type=module /g, '<script ');

  // Remove importmap script tag — not needed for classic scripts and can cause issues
  html = html.replace(/<script type=importmap>.*?<\/script>/g, '');

  if (html !== before) {
    fs.writeFileSync(indexHtml, html);
    console.log('postbuild-admin: patched index.html (IIFE src, removed type=module)');
  } else {
    console.warn('postbuild-admin: no patches applied to index.html — check manually');
  }
}
