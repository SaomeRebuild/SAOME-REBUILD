#!/usr/bin/env node
// Audit lockfile for cross-platform native binding metadata.
// Exits non-zero if any required Linux/darwin binding entry is missing.
//
// Why: npm 11.0–11.2 had a pruning bug (npm/cli#4828 #7961 #8320, fixed in 11.3.0)
// that strips non-current-platform optionalDependencies from lockfile metadata.
// A lockfile generated on Windows will then fail `npm ci` on Linux runners.
// Always run: rm -rf node_modules && rm package-lock.json && npm install --include=optional
// See: .cursor/rules/006-verification.mdc, .cursor/rules/015-cloudflare-pages-deploy.mdc

const path = require('path');

const LOCKFILE_PATHS = [
  path.resolve(__dirname, '..', '..', '..', 'package-lock.json'),
  path.resolve(__dirname, '..', '..', 'package-lock.json'),
];

function findLockfile() {
  const fs = require('fs');
  for (const p of LOCKFILE_PATHS) {
    if (fs.existsSync(p)) return p;
  }
  console.error('audit-lockfile-bindings: package-lock.json not found at:');
  for (const p of LOCKFILE_PATHS) console.error('  ' + p);
  process.exit(2);
}

const REQUIRED_BINDINGS = [
  '@oxlint/binding-linux-x64-gnu',
  '@rollup/rollup-linux-x64-gnu',
  '@rolldown/binding-linux-x64-gnu',
  '@tailwindcss/oxide-linux-x64-gnu',
  '@esbuild/linux-x64',
  '@cloudflare/workerd-linux-64',
  '@oxlint/binding-linux-x64-musl',
  '@tailwindcss/oxide-linux-x64-musl',
  // Note (2026-07-28):
  //   - esbuild 0.28+ merged gnu+musl into a single `linux-x64` binding
  //     (auto-detects libc at install time). The separate `-musl` entry no
  //     longer exists in its optionalDependencies.
  //   - @cloudflare/workerd does not publish a `linux-x64-musl` binding.
  //     Cloudflare Pages uses glibc (gnu) runtime; musl is not in scope.
];

function main() {
  const lockfilePath = findLockfile();
  const lock = require(lockfilePath);
  const packages = lock.packages || {};

  const missing = REQUIRED_BINDINGS.filter(
    (n) => !packages['node_modules/' + n]
  );

  if (missing.length) {
    console.error('Missing native bindings in lockfile:');
    for (const n of missing) console.error('  - ' + n);
    console.error('');
    console.error('Fix:');
    console.error('  rm -rf node_modules package-lock.json');
    console.error('  npm install --include=optional --no-audit --no-fund');
    console.error('  node scripts/audit-lockfile-bindings.cjs');
    process.exit(1);
  }

  console.log(
    'OK: all ' + REQUIRED_BINDINGS.length + ' critical native bindings present in lockfile'
  );
}

main();
