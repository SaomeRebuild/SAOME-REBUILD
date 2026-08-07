#!/usr/bin/env node
// Audit built dist/ for hardcoded config leaks.
// Exits non-zero if a forbidden URL/host is baked into production bundle
// or a required production helper signature is missing.
//
// Why: Bug-4c (localhost URL baked into prod bundle via `apiBaseUrl` default)
// and Bug-7a (hardcoded `Domain=.saome.org` cookie attribute) both shipped
// to production and only surfaced under HTTPS-origin browser fetch / cross-site
// request conditions that curl can't reproduce.
//
// Run via apps/frontend/package.json `build` script:
//   "build": "tsc -b && vite build && node scripts/audit-config-defaults.cjs"
//
// See:
//   - .cursor/rules/017-production-bundle-guard.mdc (URL-level audit)
//   - .cursor/rules/015-cloudflare-pages-deploy.mdc (deploy context)
//   - DEV/08-2026/0808-bug-7-trace.md (Bug-4c + Bug-7a root causes)
//   - DEV/08-2026/0808-dev.md (why this script exists)

const fs = require('node:fs');
const path = require('node:path');

const distDir = path.resolve(__dirname, '..', 'dist');

if (!fs.existsSync(distDir)) {
  console.error(`audit-config-defaults: dist/ not found at ${distDir}`);
  console.error('  Did you run `vite build` before this script?');
  process.exit(2);
}

// Forbidden substrings — must NEVER appear in production bundle.
// Bug-4c: `apiBaseUrl` default of `http://localhost:8787` baked into bundle.
// Bug-7a: hardcoded `Domain=.saome.org` cookie attribute leaks production
//         domain intent into dev / cross-site contexts.
//
// Note: `saome.org` *as a marketing contact email* (Footer / i18n) is fine —
// only the *cookie Domain attribute* and *URL literals* are leaks. We grep
// the cookie attribute (`Domain=.saome.org`) which is the precise Bug-7a
// signature, and skip the bare domain which would false-positive on display
// strings.
const FORBIDDEN = [
  'localhost:8787',
  'localhost:5173',
  '127.0.0.1:8787',
  '127.0.0.1:5173',
  'Domain=.saome.org',
];

// Required substrings — production helper signatures that MUST appear in the
// built bundle. Acts as a smoke check that the build actually wired up the
// production helpers instead of silently tree-shaking them out.
const REQUIRED = [
  'josh1989213.workers.dev', // production API origin (env-driven)
];

const FILE_EXT = /\.(js|css|html)$/;

function walk(dir) {
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walk(full));
    else if (entry.isFile()) out.push(full);
  }
  return out;
}

const files = walk(distDir).filter((f) => FILE_EXT.test(f));
if (files.length === 0) {
  console.error(`audit-config-defaults: no buildable files in ${distDir}`);
  process.exit(2);
}

let failed = false;

for (const file of files) {
  const text = fs.readFileSync(file, 'utf8');
  for (const needle of FORBIDDEN) {
    if (text.includes(needle)) {
      console.error(`FAIL: ${path.relative(process.cwd(), file)} contains forbidden "${needle}"`);
      failed = true;
    }
  }
}

const allText = files.map((f) => fs.readFileSync(f, 'utf8')).join('\n');
for (const needle of REQUIRED) {
  if (!allText.includes(needle)) {
    console.error(`FAIL: production bundle missing required "${needle}"`);
    failed = true;
  }
}

if (failed) {
  console.error('audit-config-defaults: FAIL — fix the leaks above before deploying');
  process.exit(1);
}

console.log(
  `audit-config-defaults: OK — scanned ${files.length} files in dist/, no hardcoded config leaks`,
);