#!/usr/bin/env node

import { readdir, readFile } from 'node:fs/promises';
import { join, relative } from 'node:path';

const root = new URL('..', import.meta.url).pathname;
const scanRoots = ['app', 'lib'];
const skipDirs = new Set(['api', 'email', 'node_modules', '.next']);
const fileRe = /\.(js|mjs)$/;

const forbidden = [
  { re: /\bprivate\s+(search|people\s+search|lookup|report|results?)\b/i, label: 'private search/report claim' },
  { re: /\bconfidential\s+(search|people\s+search|lookup|report|results?)\b/i, label: 'confidential search/report claim' },
  { re: /\banonymous\s+(search|people\s+search|lookup|report|results?)\b/i, label: 'anonymous search/report claim' },
  { re: /\bsecret\s+(search|people\s+search|lookup|report|results?)\b/i, label: 'secret search/report claim' },
  { re: /\bno\s+one\s+will\s+know\b/i, label: 'no-one-will-know claim' },
  { re: /\b100%\s+(accurate|complete|private|confidential|anonymous)\b/i, label: 'absolute guarantee claim' },
  { re: /\bguaranteed\s+(accurate|complete|private|confidential|anonymous)\b/i, label: 'guarantee claim' },
];

function stripComments(source) {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:])\/\/.*$/gm, '$1');
}

async function walk(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    if (entry.isDirectory()) {
      if (skipDirs.has(entry.name)) continue;
      files.push(...await walk(join(dir, entry.name)));
    } else if (fileRe.test(entry.name)) {
      files.push(join(dir, entry.name));
    }
  }
  return files;
}

const files = [];
for (const dir of scanRoots) files.push(...await walk(join(root, dir)));

const findings = [];
for (const file of files) {
  const text = stripComments(await readFile(file, 'utf8'));
  const lines = text.split(/\r?\n/);
  for (let i = 0; i < lines.length; i++) {
    for (const rule of forbidden) {
      if (rule.re.test(lines[i])) {
        findings.push({
          file: relative(root, file),
          line: i + 1,
          label: rule.label,
          text: lines[i].trim().slice(0, 180),
        });
      }
    }
  }
}

if (findings.length) {
  console.error(`SEO claims audit failed: ${findings.length} flagged ${findings.length === 1 ? 'claim' : 'claims'}`);
  for (const f of findings) console.error(`- ${f.file}:${f.line} ${f.label}: ${f.text}`);
  process.exit(1);
}

console.log(`SEO claims audit passed (${files.length} files scanned).`);
