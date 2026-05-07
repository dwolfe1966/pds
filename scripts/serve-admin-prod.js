#!/usr/bin/env node
/**
 * Serves the production admin build (build-admin/) on http://localhost:3004/csr/
 * with /api/* and /libs/* proxied to the BC admin dev host. Mirrors the
 * production deploy layout (dev.admin.www.bytecrtrs.com/csr/) so we can
 * exercise the prod admin bundle locally without pushing to BC.
 *
 *   npm run build:admin
 *   node scripts/serve-admin-prod.js
 *
 * Override the upstream:
 *   BC_HOST=dev.gwhubadmin.www.bytecrtrs.com node scripts/serve-admin-prod.js
 *   PORT=3030 node scripts/serve-admin-prod.js
 *
 * The admin bundle uses --public-url /csr/, so all asset paths look like
 * /csr/public.xxxx.js — this server mounts build-admin/ at /csr/ and falls
 * back to build-admin/index.html for unknown /csr/* paths (SPA routing).
 *
 * /libs/* (the wrappers) and /api/* are proxied server-side to BC because the
 * deploy host serves them at the domain root, not under /csr/.
 */
const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');
const { URL } = require('url');

const PORT = parseInt(process.env.PORT || '3004', 10);
const BC_HOST = process.env.BC_HOST || 'dev.admin.www.bytecrtrs.com';
const BUILD_DIR = path.resolve(__dirname, '..', 'build-admin');
const APP_PREFIX = '/csr';

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.map': 'application/json; charset=utf-8',
};

function proxyToBc(req, res) {
  const target = new URL(`https://${BC_HOST}${req.url}`);
  const headers = { ...req.headers, host: BC_HOST };
  delete headers['accept-encoding'];

  const upstream = https.request(
    {
      hostname: target.hostname,
      port: 443,
      path: target.pathname + target.search,
      method: req.method,
      headers,
    },
    (upstreamRes) => {
      const passthroughHeaders = { ...upstreamRes.headers };
      if (passthroughHeaders['set-cookie']) {
        passthroughHeaders['set-cookie'] = passthroughHeaders['set-cookie'].map((c) =>
          c.replace(/;\s*Domain=[^;]+/i, '').replace(/;\s*Secure/i, '')
        );
      }
      res.writeHead(upstreamRes.statusCode || 502, passthroughHeaders);
      upstreamRes.pipe(res);
    }
  );
  upstream.on('error', (err) => {
    console.error(`[proxy] ${req.method} ${req.url} → ${BC_HOST}: ${err.message}`);
    if (!res.headersSent) res.writeHead(502, { 'content-type': 'text/plain' });
    res.end(`Proxy error: ${err.message}`);
  });
  req.pipe(upstream);
}

function serveStatic(req, res) {
  // Strip /csr prefix; everything else maps directly into build-admin/
  let urlPath = decodeURIComponent(req.url.split('?')[0]);
  if (urlPath.startsWith(APP_PREFIX)) {
    urlPath = urlPath.slice(APP_PREFIX.length) || '/';
  }
  let filePath = path.join(BUILD_DIR, urlPath);
  if (!filePath.startsWith(BUILD_DIR)) {
    res.writeHead(403);
    return res.end('Forbidden');
  }
  fs.stat(filePath, (err, stat) => {
    if (!err && stat.isDirectory()) {
      filePath = path.join(filePath, 'index.html');
      fs.stat(filePath, (e2, s2) => (e2 || !s2.isFile() ? spaFallback() : send(filePath)));
      return;
    }
    if (err || !stat.isFile()) return spaFallback();
    send(filePath);
  });

  function spaFallback() {
    const idx = path.join(BUILD_DIR, 'index.html');
    fs.stat(idx, (err) => {
      if (err) {
        res.writeHead(404);
        return res.end('Not found');
      }
      send(idx);
    });
  }
  function send(p) {
    const ext = path.extname(p).toLowerCase();
    res.writeHead(200, { 'content-type': MIME[ext] || 'application/octet-stream' });
    fs.createReadStream(p).pipe(res);
  }
}

const server = http.createServer((req, res) => {
  // Convenience redirect — landing on / sends you to /csr/ where the app lives.
  if (req.url === '/' || req.url === '') {
    res.writeHead(302, { location: `${APP_PREFIX}/` });
    return res.end();
  }
  // /api/* and /libs/* go upstream to BC (admin endpoints + IIFE wrappers).
  if (req.url.startsWith('/api/') || req.url === '/api' ||
      req.url.startsWith('/libs/')) {
    return proxyToBc(req, res);
  }
  // Everything else (in particular /csr/*) is served from build-admin/.
  serveStatic(req, res);
});

server.listen(PORT, () => {
  console.log(`Serving build-admin/ at http://localhost:${PORT}${APP_PREFIX}/`);
  console.log(`Proxying /api/* and /libs/* → https://${BC_HOST}`);
  console.log('(set BC_HOST=... to override the upstream, PORT=... to change the port)');
});
