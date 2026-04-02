/**
 * Post-build script
 * 1. Copies public/libs/ → build/libs/ (IIFE served at root-relative /libs/...)
 * 2. Replaces the absolute IIFE script src in build/index.html with a root-relative path
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

// Copy libs
const srcLibs = path.resolve(__dirname, '../public/libs');
const dstLibs = path.resolve(__dirname, '../build/libs');
if (fs.existsSync(srcLibs)) {
  copyDir(srcLibs, dstLibs);
  console.log('postbuild: copied public/libs → build/libs');
} else {
  console.warn('postbuild: public/libs not found, skipping copy');
}

// Patch index.html: replace absolute IIFE URL with root-relative path
const htmlPath = path.resolve(__dirname, '../build/index.html');
if (fs.existsSync(htmlPath)) {
  let html = fs.readFileSync(htmlPath, 'utf8');
  const before = html;
  html = html.replace(
    /src=["']?https:\/\/dev\.www\.idlookup\.ai\/libs\/api-wrapper\/index\.iife\.js["']?/g,
    'src=/libs/api-wrapper/index.iife.js'
  );
  if (html !== before) {
    fs.writeFileSync(htmlPath, html);
    console.log('postbuild: updated index.html IIFE src → /libs/api-wrapper/index.iife.js');
  } else {
    console.warn('postbuild: IIFE src pattern not found in index.html — check manually');
  }
}
