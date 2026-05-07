#!/usr/bin/env node
/**
 * Serves the production build (build/) on localhost:3000 with /api/* proxied
 * to the BC dev host. Use only for local manual testing of the prod bundle.
 *
 *   node scripts/serve-prod.js
 *
 * Override host:  BC_HOST=dev.www.idlookup.ai node scripts/serve-prod.js
 */
const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');
const { URL } = require('url');

const PORT = parseInt(process.env.PORT || '3000', 10);
const BC_HOST = process.env.BC_HOST || 'dev.www.idlookup.ai';
const BUILD_DIR = path.resolve(__dirname, '..', 'build');

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
  delete headers['accept-encoding']; // simpler — let the upstream decide

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
      // Strip cookies' Domain attribute so the browser keeps them on localhost.
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
  // Strip query, decode, normalize.
  const urlPath = decodeURIComponent(req.url.split('?')[0]);
  let filePath = path.join(BUILD_DIR, urlPath);
  // Prevent path traversal.
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
  if (req.url.startsWith('/api/') || req.url === '/api') {
    return proxyToBc(req, res);
  }
  serveStatic(req, res);
});

server.listen(PORT, () => {
  console.log(`Serving build/ on http://localhost:${PORT}`);
  console.log(`Proxying /api/* → https://${BC_HOST}`);
  console.log('(set BC_HOST=... to override the upstream)');
});
