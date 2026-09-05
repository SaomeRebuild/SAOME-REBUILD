#!/usr/bin/env node
/**
 * check-migrations-applied.cjs
 *
 * Build-time + CI conformance check for Rule 035 (migration apply pipeline).
 * Walks `supabase/migrations/*.sql` and verifies every filename is registered
 * in `supabase/migrations/.applied-migrations.json`. Fails the build / CI
 * if any local migration has not been recorded as applied.
 *
 * Why this check exists:
 *   The 2026-08-22 CardBuilder incident: a migration file was added to the
 *   repository but never applied to production. The backend crashed with 500
 *   because it referenced columns that did not exist on the live DB. We
 *   formalized "MCP apply then commit" discipline into `frontend/025-vibe-
 *   coding-l2-checklist.mdc` § 5, but lacked an automated CI guard to catch
 *   the case where discipline slips or an MCP timeout is papered over.
 *
 * Run:
 *   node apps/backend/scripts/check-migrations-applied.cjs
 *
 * Wire into apps/backend/package.json scripts:
 *   "check:migrations": "node scripts/check-migrations-applied.cjs",
 *   "prebuild": "npm run check:migrations && npm run build",
 *
 * Exit codes:
 *   0 — every local migration is registered as applied
 *   1 — drift detected (migration file present without registry entry)
 *   2 — registry file missing or malformed
 *
 * @see .cursor/rules/035-migration-apply-pipeline.mdc
 * @see runs/improvements/feedback/20260822-migration-apply-pipeline.md
 * @see .cursor/rules/frontend/025-vibe-coding-l2-checklist.mdc § 5
 */

const fs = require('node:fs');
const path = require('node:path');

const REPO_ROOT = path.resolve(__dirname, '..', '..', '..');
const MIGRATIONS_DIR = path.join(REPO_ROOT, 'supabase', 'migrations');
const REGISTRY_FILE = path.join(MIGRATIONS_DIR, '.applied-migrations.json');

function listMigrationFiles(dir) {
  if (!fs.existsSync(dir)) {
    console.error(`FAIL: migrations directory not found at ${dir}`);
    process.exit(2);
  }
  return fs
    .readdirSync(dir, { withFileTypes: true })
    .filter(
      (entry) =>
        entry.isFile() &&
        entry.name.endsWith('.sql') &&
        !entry.name.startsWith('.'),
    )
    .map((entry) => entry.name)
    .sort();
}

function readRegistry(file) {
  if (!fs.existsSync(file)) {
    console.error(`FAIL: registry file missing at ${file}`);
    console.error('  This is the source-of-truth record of which migrations');
    console.error('  have been applied to production. Every migration file');
    console.error('  in supabase/migrations/ should have a matching entry');
    console.error('  (added by the agent right after saome_supabase MCP');
    console.error('  `apply_migration` succeeds).');
    process.exit(2);
  }
  let parsed;
  try {
    parsed = JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (err) {
    console.error(`FAIL: registry file is not valid JSON: ${err.message}`);
    process.exit(2);
  }
  if (!Array.isArray(parsed.applied)) {
    console.error('FAIL: registry file must contain an "applied" array.');
    process.exit(2);
  }
  // Validate each entry shape.
  for (const entry of parsed.applied) {
    if (
      typeof entry.filename !== 'string' ||
      typeof entry.applied_at !== 'string' ||
      typeof entry.applied_by !== 'string'
    ) {
      console.error(`FAIL: registry entry missing required fields: ${JSON.stringify(entry)}`);
      console.error('  Required: filename, applied_at, applied_by');
      process.exit(2);
    }
  }
  return parsed;
}

/**
 * Detect duplicate filenames inside a single migration file (rare but possible
 * if Windows + case-insensitive filesystem duped a file). Treat as fatal.
 */
function detectDuplicateBasenames(filenames) {
  const seen = new Map();
  const dupes = [];
  for (const f of filenames) {
    const lower = f.toLowerCase();
    if (seen.has(lower)) dupes.push([seen.get(lower), f]);
    else seen.set(lower, f);
  }
  return dupes;
}

/**
 * Sanity-check that filenames follow the convention:
 *   YYYYMMDD[optional HHMMSS]_NNN[_<name>].sql
 * Loose regex: at least 8-digit date prefix and an extension of `.sql`.
 */
function detectBadFilenames(filenames) {
  const pattern = /^\d{8}/;
  return filenames.filter((f) => !pattern.test(f));
}

function main() {
  const filenames = listMigrationFiles(MIGRATIONS_DIR);
  if (filenames.length === 0) {
    console.error('FAIL: no migration files found.');
    process.exit(2);
  }

  const dupes = detectDuplicateBasenames(filenames);
  if (dupes.length > 0) {
    console.error('FAIL: duplicate migration filenames detected:');
    for (const [a, b] of dupes) {
      console.error(`  - ${a} vs ${b}`);
    }
    process.exit(1);
  }

  const bad = detectBadFilenames(filenames);
  if (bad.length > 0) {
    console.error('FAIL: migrations with non-conforming filenames:');
    for (const b of bad) console.error(`  - ${b}`);
    console.error('  Convention: YYYYMMDD[_HHMMSS]_NNN_<name>.sql');
    process.exit(1);
  }

  const registry = readRegistry(REGISTRY_FILE);
  const registered = new Set(registry.applied.map((e) => e.filename));

  const missing = filenames.filter((f) => !registered.has(f));
  const orphaned = [...registered].filter((r) => !filenames.includes(r));

  if (missing.length === 0 && orphaned.length === 0) {
    console.log(`OK: ${filenames.length} migrations registered as applied.`);
    console.log(`  ${filenames.join(', ')}`);
    process.exit(0);
  }

  if (missing.length > 0) {
    console.error(
      `FAIL: ${missing.length} migration file(s) have NO registry entry —`,
    );
    console.error('  these have not been recorded as applied to production.');
    console.error('  Action: invoke saome_supabase MCP apply_migration, then');
    console.error('  add an entry to .applied-migrations.json.');
    console.error('');
    for (const f of missing) console.error(`  - ${f}`);
  }
  if (orphaned.length > 0) {
    console.error(
      `FAIL: ${orphaned.length} registry entry(ies) reference a missing file:`,
    );
    console.error('  the file was deleted from the repo but the registry');
    console.error('  still records it. Clean up the registry.');
    console.error('');
    for (const o of orphaned) console.error(`  - ${o}`);
  }
  if (missing.length > 0 || orphaned.length > 0) {
    console.error('');
    console.error('See .cursor/rules/035-migration-apply-pipeline.mdc');
    process.exit(1);
  }
}

main();
