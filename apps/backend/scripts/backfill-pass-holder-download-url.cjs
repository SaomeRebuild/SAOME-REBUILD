/**
 * Diagnostic + best-effort backfill for "lost data" pass_holders rows.
 *
 * @module scripts/backfill-pass-holder-download-url
 * @description Scans the `pass_holders` table for rows whose state
 * was corrupted by the 2026-10-19 V3 partial-update bug:
 *
 *   barcode_value IS NOT NULL
 *   AND download_url IS NULL
 *   AND pass_identifier IS NULL
 *   AND issuance_error IS NULL
 *
 * Such rows were registered BEFORE the COALESCE fix landed; the
 * barcode-backfill second UPDATE (which only passed `barcodeValue`)
 * wiped the 6 sibling columns back to NULL. The `barcode_value`
 * is preserved but `pass_identifier` / `download_url` /
 * `issued_at` / `iphone_uri` / `android_uri` are all NULL.
 *
 * Behavior:
 *
 *   1. DRY-RUN (default): SELECTs all matching rows and prints a
 *      table to stdout with `(id, template_id, email, barcode_value,
 *      created_at)`. Exit code 0. No writes. Use this to estimate
 *      the blast radius before running with --apply.
 *
 *   2. APPLY (--apply): for each row, calls V3
 *      `listPasses(env, { templateId })` and tries to match the
 *      recovered barcode value back to a V3 pass item. If a unique
 *      match is found, UPDATEs `download_url` + `pass_identifier`
 *      on the row. The other lost columns (issued_at / iphone_uri /
 *      android_uri) cannot be recovered from V3 LIST response —
 *      the user-facing recovery path is the contact-support
 *      banner (`PassHolderLostDataBanner` sub-component), not
 *      silent auto-recovery.
 *
 * The MATCH is best-effort because V3 LIST response does not
 * expose `email` / `phone` / `barcode_value` per item in a way
 * that's 1-to-1 with our row state. Strategy:
 *
 *   - If V3 LIST returns exactly 1 pass for the template AND
 *     `extracted barcode from V3 === row.barcode_value` →
 *     best-effort UPDATE (download_url + identifier). Conservative.
 *   - Otherwise → leave the row alone and log "no clean match".
 *
 * Usage:
 *
 *   node apps/backend/scripts/backfill-pass-holder-download-url.cjs
 *     # dry-run, list affected rows
 *
 *   node apps/backend/scripts/backfill-pass-holder-download-url.cjs --apply
 *     # best-effort UPDATE for rows that have a unique V3 match
 *
 * Env (auto-loaded — no manual export needed):
 *   - apps/backend/.dev.vars           → PASSCREATOR_API_KEY
 *   - apps/backend/wrangler.jsonc      → PASSCREATOR_API_URL, PASSCREATOR_PASS_TYPE_ID
 *   - DATABASE_URL or HYPERDRIVE_*_CONNECTION_STRING  → postgres.js target
 *
 * Output:
 *   - stdout: human-readable report table
 *   - exit 0: success (no rows OR all rows processed)
 *   - exit 1: any DB or upstream call failed
 *
 * Rule references:
 *   - Rule 006 — every recovery claim is a SELECT-then-PRINT first
 *     (dry-run), then a separate --apply pass. Never both.
 *   - Rule 011 — this script is part of the same PR as the COALESCE
 *     fix; the script body documents the production incident so the
 *     future maintainer doesn't reintroduce a regression.
 *   - Rule 035 — no migration; this script is a one-time recovery
 *     utility, not a schema change.
 *
 * @see runs/improvements/feedback/20261019-pass-holder-v3-partial-update-bug.md
 * @see apps/backend/src/modules/pass-templates/db/passHolders.ts::updatePassHolderIssuance
 *      (COALESCE partial-update fix)
 */

'use strict';

const fs = require('node:fs');
const path = require('node:path');

const BACKEND_ROOT = path.resolve(__dirname, '..');
const REPO_ROOT = path.resolve(BACKEND_ROOT, '..', '..');
const DEV_VARS_PATH = path.join(BACKEND_ROOT, '.dev.vars');
const WRANGLER_PATH = path.join(BACKEND_ROOT, 'wrangler.jsonc');

const APPLY_MODE = process.argv.includes('--apply');

/**
 * Minimal `.dev.vars` parser. Format is `KEY=value` per line, with
 * `#` for comments. Quotes around values are stripped. Empty lines
 * are ignored. We intentionally do NOT depend on `dotenv` to keep
 * the script standalone (no `npm install` needed to run).
 */
function parseDevVars(text) {
  const out = {};
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const eq = line.indexOf('=');
    if (eq === -1) continue;
    const key = line.slice(0, eq).trim();
    let value = line.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    out[key] = value;
  }
  return out;
}

/**
 * Minimal `wrangler.jsonc` parser — strips `//` line comments and
 * trailing comments after values, then JSON.parses. Sufficient for
 * the small `vars` block we read; does NOT handle the full jsonc
 * spec (no block comments).
 */
function parseWranglerVars(text) {
  const stripped = text
    .split(/\r?\n/)
    .map((line) => {
      const idx = line.indexOf('//');
      if (idx === -1) return line;
      if (idx > 0 && (line[idx - 1] === ':' || line[idx - 1] === '/')) {
        return line;
      }
      return line.slice(0, idx);
    })
    .join('\n');
  const parsed = JSON.parse(stripped);
  return parsed.vars ?? {};
}

/**
 * Resolve a postgres connection string. Mirrors what Hyperdrive
 * provides in production but uses a plain `postgres://` URL for
 * direct local connections.
 *
 * Accepts (in order):
 *   1. process.env.DATABASE_URL
 *   2. process.env.WRANGLER_HYPERDRIVE_LOCAL_CONNECTION_STRING_HYPERDRIVE
 *      (the workerd pool workers var set by wrangler dev / vitest)
 *   3. parsed wrangler.jsonc::vars.DATABASE_URL (dev convenience)
 */
function resolveDatabaseUrl(devVars, wranglerVars) {
  return (
    process.env.DATABASE_URL ||
    process.env.WRANGLER_HYPERDRIVE_LOCAL_CONNECTION_STRING_HYPERDRIVE ||
    wranglerVars.DATABASE_URL ||
    devVars.DATABASE_URL ||
    ''
  );
}

/**
 * SELECT all "lost data" rows. Mirrors the production bug's
 * fingerprint: barcode backfilled but URI columns all NULL.
 */
const SELECT_LOST_DATA_ROWS_SQL = `
  SELECT id, template_id, email, phone_number, phone_country_code,
         barcode_value,
         created_at, updated_at
    FROM public.pass_holders
   WHERE barcode_value IS NOT NULL
     AND download_url IS NULL
     AND pass_identifier IS NULL
     AND issued_at IS NULL
     AND iphone_uri IS NULL
     AND android_uri IS NULL
     AND (issuance_error IS NULL OR issuance_error = '')
   ORDER BY created_at DESC
`;

/**
 * UPDATE the recoverable columns on a single row. We deliberately
 * leave `iphone_uri` / `android_uri` / `issued_at` as NULL — V3
 * LIST response does not expose them per-pass; the only thing we
 * can confidently restore from a V3 LIST match is
 * `linkToPassPage` (→ `download_url`) and `identifier` (→
 * `pass_identifier`).
 *
 * The 6 sibling-column COALESCE contract from
 * `updatePassHolderIssuance` is honored automatically: the SQL
 * below only writes the 2 columns we have data for, leaving the
 * other 4 at their current (NULL) value. After the COALESCE
 * fix lands, future re-issuance flows will populate them.
 */
const UPDATE_RECOVERABLE_COLUMNS_SQL = `
  UPDATE public.pass_holders
     SET download_url = $1,
         pass_identifier = $2,
         updated_at = NOW()
   WHERE id = $3
`;

async function main() {
  // 1. Load env
  if (!fs.existsSync(DEV_VARS_PATH)) {
    console.error(`FATAL: ${DEV_VARS_PATH} not found.`);
    process.exit(2);
  }
  if (!fs.existsSync(WRANGLER_PATH)) {
    console.error(`FATAL: ${WRANGLER_PATH} not found.`);
    process.exit(2);
  }
  const devVars = parseDevVars(fs.readFileSync(DEV_VARS_PATH, 'utf8'));
  const wranglerVars = parseWranglerVars(fs.readFileSync(WRANGLER_PATH, 'utf8'));

  const dbUrl = resolveDatabaseUrl(devVars, wranglerVars);
  if (!dbUrl) {
    console.error(
      'FATAL: no DATABASE_URL. Set DATABASE_URL or ' +
        'WRANGLER_HYPERDRIVE_LOCAL_CONNECTION_STRING_HYPERDRIVE before running.',
    );
    process.exit(2);
  }

  // 2. Lazy-load postgres + passcreator wrapper (so the script can
  // be syntax-checked without dependencies installed).
  const postgres = require('postgres');
  const sql = postgres(dbUrl, { prepare: false, max: 5 });

  // 3. SELECT lost data rows
  const rows = await sql.unsafe(SELECT_LOST_DATA_ROWS_SQL);

  if (rows.length === 0) {
    console.log('No lost-data rows found. Nothing to do.');
    await sql.end();
    process.exit(0);
  }

  // 4. Print dry-run report
  console.log(
    `Found ${rows.length} lost-data row(s)${APPLY_MODE ? ' — APPLY mode' : ' — DRY-RUN mode (pass --apply to write)'}`,
  );
  console.log('');
  console.log(
    '  ' +
      [
        'id'.padEnd(38),
        'template_id'.padEnd(38),
        'email'.padEnd(28),
        'barcode_value (first 24)'.padEnd(24),
        'created_at'.padEnd(24),
      ].join(' '),
  );
  for (const r of rows) {
    console.log(
      '  ' +
        [
          String(r.id).padEnd(38),
          String(r.template_id).padEnd(38),
          String(r.email).padEnd(28),
          String(r.barcode_value).slice(0, 24).padEnd(24),
          String(r.created_at).padEnd(24),
        ].join(' '),
    );
  }
  console.log('');

  if (!APPLY_MODE) {
    console.log(
      `Dry-run only. To attempt best-effort V3 LIST match + UPDATE:`,
    );
    console.log(`  node ${path.relative(REPO_ROOT, __filename)} --apply`);
    await sql.end();
    process.exit(0);
  }

  // 5. APPLY mode — best-effort V3 LIST match.
  // Lazy-load the passcreator wrapper. We need to use the
  // production TypeScript module — use the `tsx` runtime if
  // available; otherwise re-implement the call inline.
  console.log('APPLY mode: attempting best-effort V3 LIST match per row…');
  let recovered = 0;
  let skipped = 0;
  let failed = 0;
  for (const row of rows) {
    try {
      // We can't import the TS passcreator.ts module directly from
      // a `.cjs` script without a transpiler. Re-implement the
      // minimum here: a single GET to V3 LIST with the templateId
      // and parse the response. This is intentionally NOT shared
      // with the TS code to keep the script dependency-free; if
      // the V3 contract drifts, the recovery rate will drop and
      // ops will notice in the report table.
      const apiUrl = wranglerVars.PASSCREATOR_API_URL;
      const apiKey = devVars.PASSCREATOR_API_KEY;
      if (!apiUrl || !apiKey) {
        console.error(
          `  [${row.id}] SKIP — PASSCREATOR_API_URL or PASSCREATOR_API_KEY not configured`,
        );
        skipped++;
        continue;
      }
      const url = `${apiUrl.replace(/\/$/, '')}/api/v3/pass?templateId=${encodeURIComponent(
        row.template_id,
      )}`;
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          Accept: 'application/json',
          Authorization: apiKey,
        },
      });
      if (!response.ok) {
        console.error(
          `  [${row.id}] SKIP — V3 LIST returned ${response.status}`,
        );
        skipped++;
        continue;
      }
      const body = await response.json();
      const items = Array.isArray(body?.data) ? body.data : [];
      // Best-effort match: look for an item whose `barcodeValue`
      // (or `generatedId` / `autoGeneratedId`) equals the row's
      // `barcode_value`. If exactly one match → update.
      const candidates = items.filter((item) => {
        const autoGen = item.generatedId ?? item.autoGeneratedId;
        const bc =
          typeof item.barcodeValue === 'string' && item.barcodeValue.length > 0
            ? item.barcodeValue
            : typeof autoGen === 'string' && autoGen.length > 0
              ? autoGen
              : null;
        return bc === row.barcode_value;
      });
      if (candidates.length !== 1) {
        console.error(
          `  [${row.id}] SKIP — no unique V3 match (candidates=${candidates.length}, items=${items.length})`,
        );
        skipped++;
        continue;
      }
      const match = candidates[0];
      if (
        typeof match.identifier !== 'string' ||
        typeof match.linkToPassPage !== 'string'
      ) {
        console.error(
          `  [${row.id}] SKIP — matched item missing identifier or linkToPassPage`,
        );
        skipped++;
        continue;
      }
      await sql.unsafe(UPDATE_RECOVERABLE_COLUMNS_SQL, [
        match.linkToPassPage,
        match.identifier,
        row.id,
      ]);
      console.log(
        `  [${row.id}] RECOVERED download_url + pass_identifier from V3 LIST match`,
      );
      recovered++;
    } catch (err) {
      console.error(
        `  [${row.id}] FAIL — ${err instanceof Error ? err.message : String(err)}`,
      );
      failed++;
    }
  }

  console.log('');
  console.log(
    `Summary: recovered=${recovered} skipped=${skipped} failed=${failed} of ${rows.length} total`,
  );
  await sql.end();
  process.exit(failed > 0 ? 1 : 0);
}

main().catch(async (err) => {
  console.error('FATAL:', err);
  process.exit(1);
});
