/**
 * Post-build script for admin app
 *
 * Deploy target: dev.admin.www.bytecrtrs.com/csr/
 * The BC-controlled domain serves /libs/api-wrapper/* and /libs/csr-wrapper/*
 * at the domain root (alongside, not under, the /csr/ app path), so the admin
 * app does NOT bundle the wrappers — both script tags get rewritten to
 * root-relative /libs/... paths the host already serves.
 *
 * 1. Rename admin.html → index.html (so it serves at /csr/)
 * 2. Rewrite both IIFE script srcs (api-wrapper, csr-wrapper) to root-relative /libs/*
 * 3. Strip type=module + importmap (BC server may serve .js as text/html)
 */

const fs   = require('fs');
const path = require('path');

const buildDir = path.resolve(__dirname, '../build-admin');

// Rename admin.html → index.html
const adminHtml = path.join(buildDir, 'admin.html');
const indexHtml = path.join(buildDir, 'index.html');
if (fs.existsSync(adminHtml)) {
  // Remove existing index.html if present
  if (fs.existsSync(indexHtml)) fs.unlinkSync(indexHtml);
  fs.renameSync(adminHtml, indexHtml);
  console.log('postbuild-admin: renamed admin.html → index.html');
}

// Patch index.html: replace absolute IIFE URLs with root-relative paths
if (fs.existsSync(indexHtml)) {
  let html = fs.readFileSync(indexHtml, 'utf8');
  const before = html;

  // api-wrapper: absolute dev URL → root-relative
  html = html.replace(
    /src=["']?https:\/\/dev\.www\.idlookup\.ai\/libs\/api-wrapper\/index\.iife\.js["']?/g,
    'src=/libs/api-wrapper/index.iife.js'
  );
  // csr-wrapper: absolute BC dev URL → root-relative (BC's domain serves it at root)
  html = html.replace(
    /src=["']?https:\/\/dev1\.dev\.www\.bytecrtrs\.com\/libs\/csr-wrapper\/index\.iife\.js["']?/g,
    'src=/libs/csr-wrapper/index.iife.js'
  );

  // Remove type="module" from script tags — BC server may serve .js with text/html MIME type
  // which browsers reject for module scripts but accept for classic scripts
  html = html.replace(/<script type=module /g, '<script ');

  // Remove importmap script tag — not needed for classic scripts and can cause issues
  html = html.replace(/<script type=importmap>.*?<\/script>/g, '');

  if (html !== before) {
    fs.writeFileSync(indexHtml, html);
    console.log('postbuild-admin: patched index.html (IIFE srcs, removed type=module)');
  } else {
    console.warn('postbuild-admin: no patches applied to index.html — check manually');
  }
}
