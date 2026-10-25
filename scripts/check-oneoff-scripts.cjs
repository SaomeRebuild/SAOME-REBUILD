#!/usr/bin/env node
/**
 * check-oneoff-scripts.cjs
 *
 * CI conformance check for Rule 040 (file write tool precedence).
 *
 * Rule 040 establishes a strict tool precedence for authoring files:
 *   new file        -> Cursor `Write` tool
 *   existing file   -> Cursor `Read` + `StrReplace`
 *   mechanical bulk -> Node/Python script ONLY when the same pattern is
 *                      applied to 3+ files, and the script lives in the OS
 *                      temp directory and is deleted right after use.
 *
 * The side effect of a loose rule is that one-off repair/probe scripts
 * accumulate inside the repository. Observed damage before this gate:
 *   - scripts/fix-powershell-encoding-corruption.cjs  (tracked one-off)
 *   - scripts/fix-missing-paren.cjs                    (tracked one-off)
 *   - scripts/fix-corrupted-regex-broader.cjs          (tracked one-off)
 *   - scripts/.repair-hyperdrive/  (1,001 files / 1.4 MB in one session)
 *   - vite-alias-probe.tmp.mjs       (untracked, repo root)
 *   - apps/backend/src/__probe_sql.ts (orphan probe inside src/, broke build)
 *
 * This script fails CI when any of those patterns reappears.
 *
 * Run:
 *   node scripts/check-oneoff-scripts.cjs
 *
 * Wire into root package.json scripts:
 *   "check:oneoff": "node scripts/check-oneoff-scripts.cjs"
 *
 * Exit codes:
 *   0 - no one-off script/probe artifacts found
 *   1 - violation detected (one-off script, probe file, or scratch artifact)
 *   2 - check could not run (missing directory or unreadable path)
 *
 * @see .cursor/rules/040-file-write-tool-precedence.mdc
 * @see runs/improvements/feedback/20261026-node-script-bias-root-cause.md
 */

const fs = require('node:fs');
const path = require('node:path');

const REPO_ROOT = path.resolve(__dirname, '..');
const SCRIPTS_DIR = path.join(REPO_ROOT, 'scripts');

/**
 * Permanent scripts allowed to live under scripts/.
 * Everything else must stay out of the repository (Rule 040).
 */
const ALLOWED_SCRIPT_FILES = new Set([
  'dev-restart.cmd',
  'dev-restart.ps1',
  'health-check.ps1',
  // This gate itself is a permanent CI tool, not a one-off.
  'check-oneoff-scripts.cjs',
]);

/** Source trees where a probe/scratch file breaks builds or typecheck. */
const SOURCE_ROOTS = [
  path.join('apps', 'backend', 'src'),
  path.join('apps', 'frontend', 'src'),
  path.join('packages', 'shared'),
];

/** Extensions that make a file under scripts/ a candidate violation. */
const SCRIPT_EXTENSIONS = ['.cjs', '.mjs', '.ts'];

/**
 * Repo-root scratch artifacts.
 * - *.tmp.mjs / *.tmp.cjs  : throwaway probe scripts
 * - vite-*-probe.*        : Vite alias investigation leftovers
 */
const ROOT_SCRATCH_PATTERNS = [
  /\.tmp\.(mjs|cjs)$/,
  /^vite-.*-probe\./,
];

function isProbeFileName(name) {
  if (name.startsWith('__probe_')) return true;
  return name.endsWith('.ts') && name.includes('probe');
}

function listFilesRecursive(dir, out = []) {
  let entries;
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return out;
  }
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      listFilesRecursive(full, out);
    } else if (entry.isFile()) {
      out.push(full);
    }
  }
  return out;
}

function toRepoRelative(absolute) {
  return path.relative(REPO_ROOT, absolute).split(path.sep).join('/');
}

function collectViolations() {
  const violations = [];

  // Check 1: scripts/ may only contain whitelisted permanent tools.
  if (!fs.existsSync(SCRIPTS_DIR)) {
    console.error(`FAIL: scripts directory not found at ${SCRIPTS_DIR}`);
    process.exit(2);
  }
  for (const entry of fs.readdirSync(SCRIPTS_DIR, { withFileTypes: true })) {
    if (!entry.isFile()) continue;
    const ext = path.extname(entry.name);
    if (!SCRIPT_EXTENSIONS.includes(ext)) continue;
    if (ALLOWED_SCRIPT_FILES.has(entry.name)) continue;
    violations.push({
      file: toRepoRelative(path.join(SCRIPTS_DIR, entry.name)),
      reason: `one-off ${ext} script under scripts/ (Rule 040 forbids committing these)`,
    });
  }

  // Check 2: no probe/scratch files inside source trees.
  for (const relativeRoot of SOURCE_ROOTS) {
    const absoluteRoot = path.join(REPO_ROOT, relativeRoot);
    if (!fs.existsSync(absoluteRoot)) continue;
    for (const file of listFilesRecursive(absoluteRoot)) {
      const name = path.basename(file);
      if (isProbeFileName(name)) {
        violations.push({
          file: toRepoRelative(file),
          reason: 'probe/scratch file inside a source tree (breaks build and typecheck)',
        });
      }
    }
  }

  // Check 3: no scratch artifacts at the repo root.
  for (const entry of fs.readdirSync(REPO_ROOT, { withFileTypes: true })) {
    if (!entry.isFile()) continue;
    if (ROOT_SCRATCH_PATTERNS.some((pattern) => pattern.test(entry.name))) {
      violations.push({
        file: entry.name,
        reason: 'scratch/probe artifact at the repo root',
      });
    }
  }

  return violations;
}

function main() {
  const violations = collectViolations();

  if (violations.length === 0) {
    console.log('OK: no one-off scripts, probe files, or scratch artifacts found.');
    console.log(`  Allowed permanent scripts: ${[...ALLOWED_SCRIPT_FILES].join(', ')}`);
    process.exit(0);
  }

  console.error(`FAIL: ${violations.length} one-off script artifact(s) detected:`);
  console.error('');
  for (const violation of violations) {
    console.error(`  - ${violation.file}`);
    console.error(`      ${violation.reason}`);
  }
  console.error('');
  console.error('Action: remove these files, or move throwaway scripts to the OS');
  console.error('temp directory and delete them after use. Permanent tooling');
  console.error('belongs under scripts/ only if it is added to the allowlist in');
  console.error('scripts/check-oneoff-scripts.cjs.');
  console.error('');
  console.error('See .cursor/rules/040-file-write-tool-precedence.mdc');
  process.exit(1);
}

main();
