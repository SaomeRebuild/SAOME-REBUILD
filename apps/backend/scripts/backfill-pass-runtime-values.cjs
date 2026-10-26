/**
 * Pass runtime value BACKFILL — operator script.
 *
 * @module scripts/backfill-pass-runtime-values
 * @description Gives pre-existing pass holders the runtime value state
 * they were missing when the event ledger shipped (migration 028).
 *
 * TWO MODES, NEVER BOTH
 *
 *   1. DRY-RUN (default) — SELECTs the holders that need a backfill
 *      and prints a report. Exit 0. NO WRITES.
 *
 *   2. APPLY (`--apply`) — writes one `registered` event + the derived
 *      snapshot per holder. Prints a summary. NO Passcreator calls —
 *      syncing the wallet passes is a separate, explicitly verified
 *      step (see the runbook below).
 *
 * WHY A SCRIPT AND NOT AN HTTP ENDPOINT
 *
 * A one-off data repair does not belong in the public API surface: it
 * needs DB credentials the Worker holds but the browser must never
 * see, and it is a single occurrence, not a recurring operation. The
 * same pattern is used by `backfill-pass-holder-download-url.cjs`.
 *
 * THE DERIVATION IS SHARED (not re-implemented here)
 *
 * The script is a thin shell over
 * `apps/backend/src/modules/pass-templates/services/passValueBackfill.ts`,
 * which in turn calls `ensureRegistrationRuntimeState` — the SAME
 * service the live registration flow calls. A backfilled holder's
 * snapshot is therefore byte-identical to what a fresh registration
 * would have produced. The script deliberately does NOT re-derive
 * anything: a second implementation here could silently disagree
 * with the live path.
 *
 * IDEMPOTENCE
 *
 * Every holder's opening event carries the idempotency key
 * `registered:{holderId}`, enforced by the ledger's UNIQUE
 * constraint. Running this script twice is safe — the second run
 * reports every holder as `duplicate` and writes nothing new.
 *
 * NO PASSCREATOR PATCH
 *
 * The apply step writes the ledger + the snapshot ONLY. It does not
 * touch production wallet passes. Pushing the values to Passcreator
 * is deliberately a separate, manual, one-pass-at-a-time operation:
 *
 *   1. Run this script in dry-run mode; review the report.
 *   2. Run it with `--apply`; confirm `applied` matches the report.
 *   3. Pick ONE controlled pass (a test holder you can see in the
 *      Wallet app) and PATCH it manually via
 *      `syncValuesToPasscreator`; verify the Wallet shows the value
 *      AND that a GET read-back returns it.
 *   4. ONLY THEN consider a batch re-push.
 *
 * Skipping step 3 is how production wallet data gets corrupted.
 *
 * Env (auto-loaded — no manual export needed):
 *   - apps/backend/.dev.vars           → PASSCREATOR_API_KEY etc.
 *   - apps/backend/wrangler.jsonc      → PASSCREATOR_API_URL etc.
 *   - DATABASE_URL or HYPERDRIVE_*_CONNECTION_STRING → postgres.js target
 *
 * Usage:
 *   node apps/backend/scripts/backfill-pass-runtime-values.cjs
 *     # dry-run — print the report, change nothing
 *
 *   node apps/backend/scripts/backfill-pass-runtime-values.cjs --apply
 *     # write one registered event + snapshot per holder
 *
 * Rule references:
 *   - Rule 006 § verification — dry-run before apply.
 *   - Rule 035 § 4 — a migration that has NOT been applied must not
 *     be committed; this script's DB work is a DATA repair, not DDL.
 *
 * @see apps/backend/src/modules/pass-templates/services/passValueBackfill.ts
 * @see apps/backend/src/modules/pass-templates/services/passRegistrationService.ts
 * @see runs/decisions/2026-10-24-pass-runtime-value-model.md
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
 * are ignored. We intentionally do NOT depend on `dotenv` to keep the
 * script standalone.
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
 * Resolve a postgres connection string.
 *
 * Accepts (in order):
 *   1. process.env.DATABASE_URL
 *   2. process.env.WRANGLER_HYPERDRIVE_LOCAL_CONNECTION_STRING_HYPERDRIVE
 *      (the workerd pool workers var set by wrangler dev / vitest)
 *   3. parsed wrangler.jsonc::vars.DATABASE_URL (dev convenience)
 *   4. .dev.vars DATABASE_URL
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
 * Load the TypeScript service module.
 *
 * The service is written in TypeScript (it shares the shared schema +
 * calculator with the live registration flow), so the script needs a
 * TS-aware loader. `vite-node` ships with the repo's Vite dependency
 * tree, so no new dependency is required.
 */
async function loadBackfillModule() {
  const { createServer } = await import('vite');
  const server = await createServer({
    configFile: false,
    root: BACKEND_ROOT,
    server: { middlewareMode: true },
    appType: 'custom',
    resolve: {
      alias: [
        {
          find: '@saome/shared/schemas/passValues',
          replacement: path.resolve(
            REPO_ROOT,
            'packages/shared/schemas/passValues.ts',
          ),
        },
        {
          find: '@saome/shared/logic/passExpiry',
          replacement: path.resolve(REPO_ROOT, 'packages/shared/logic/passExpiry.ts'),
        },
        {
          find: '@saome/shared/logic/passValueCalculator',
          replacement: path.resolve(
            REPO_ROOT,
            'packages/shared/logic/passValueCalculator.ts',
          ),
        },
        {
          find: '@saome/shared/logic/passFieldFormatter',
          replacement: path.resolve(
            REPO_ROOT,
            'packages/shared/logic/passFieldFormatter.ts',
          ),
        },
        {
          find: '@saome/shared/schemas/card',
          replacement: path.resolve(REPO_ROOT, 'packages/shared/schemas/card/index.ts'),
        },
        {
          find: '@saome/shared/constants/card-fields',
          replacement: path.resolve(
            REPO_ROOT,
            'packages/shared/constants/card-fields.ts',
          ),
        },
        {
          find: '@saome/shared/constants/headerSlots',
          replacement: path.resolve(
            REPO_ROOT,
            'packages/shared/constants/headerSlots.ts',
          ),
        },
        { find: '@', replacement: path.resolve(BACKEND_ROOT, 'src') },
      ],
    },
  });
  try {
    const mod = await server.ssrLoadModule(
      path.resolve(
        BACKEND_ROOT,
        'src/modules/pass-templates/services/passValueBackfill.ts',
      ),
    );
    return mod;
  } finally {
    await server.close();
  }
}

async function main() {
  // 1. Load env
  const devVars = fs.existsSync(DEV_VARS_PATH)
    ? parseDevVars(fs.readFileSync(DEV_VARS_PATH, 'utf8'))
    : {};
  const wranglerVars = fs.existsSync(WRANGLER_PATH)
    ? parseWranglerVars(fs.readFileSync(WRANGLER_PATH, 'utf8'))
    : {};

  const dbUrl = resolveDatabaseUrl(devVars, wranglerVars);
  if (!dbUrl) {
    console.error(
      'FATAL: no DATABASE_URL. Set DATABASE_URL or ' +
        'WRANGLER_HYPERDRIVE_LOCAL_CONNECTION_STRING_HYPERDRIVE before running.',
    );
    process.exit(2);
  }

  // 2. Connect + load the TS service module.
  const postgres = require('postgres');
  const sql = postgres(dbUrl, { prepare: false, max: 5 });

  let backfill;
  try {
    backfill = await loadBackfillModule();
  } catch (err) {
    console.error('FATAL: could not load the backfill service module:', err);
    await sql.end();
    process.exit(2);
  }

  // 3. DRY-RUN report (also printed in APPLY mode, BEFORE the writes,
  //    so the operator always sees what is about to change).
  const plan = await backfill.planPassRuntimeValueBackfill(sql);

  console.log(
    `Pass runtime value backfill — ${APPLY_MODE ? 'APPLY mode' : 'DRY-RUN mode'}` +
      `${APPLY_MODE ? '' : ' (pass --apply to write)'}`,
  );
  console.log(
    `${plan.length} holder(s) would receive a 'registered' event + a derived snapshot.`,
  );
  console.log('');

  if (plan.length > 0) {
    console.log(
      '  ' +
        [
          'pass_holder_id'.padEnd(38),
          'card_type'.padEnd(18),
          'gift_points'.padEnd(13),
          'expiry_date'.padEnd(13),
          'email'.padEnd(28),
        ].join(' '),
    );
    for (const entry of plan) {
      console.log(
        '  ' +
          [
            String(entry.passHolderId).padEnd(38),
            String(entry.cardType ?? '(none)').padEnd(18),
            String(entry.giftPoints).padEnd(13),
            String(entry.expiryDate ?? '(never)').padEnd(13),
            String(entry.email).slice(0, 28).padEnd(28),
          ].join(' '),
      );
    }
    console.log('');
  }

  if (!APPLY_MODE) {
    console.log('Dry-run only — nothing was written.');
    console.log('To apply:');
    console.log(`  node ${path.relative(REPO_ROOT, __filename)} --apply`);
    console.log('');
    console.log(
      'NOTE: the apply step writes the ledger + snapshot ONLY. It does NOT ' +
        'push values to Passcreator. Sync the wallet passes one at a time ' +
        'and verify the read-back before any batch re-push.',
    );
    await sql.end();
    process.exit(0);
  }

  // 4. APPLY mode.
  console.log('APPLY mode: writing the registered event + snapshot per holder…');
  const result = await backfill.backfillPassRuntimeValues(sql);

  console.log('');
  console.log(
    `Summary: applied=${result.applied} skipped=${result.skipped} errors=${result.errors.length}`,
  );
  for (const err of result.errors) {
    console.error(`  [${err.passHolderId}] ${err.message}`);
  }
  console.log('');
  console.log(
    'Next: pick ONE controlled pass, PATCH it via syncValuesToPasscreator, ' +
      'and verify the Wallet + a GET read-back BEFORE any batch re-push.',
  );

  await sql.end();
  process.exit(result.errors.length > 0 ? 1 : 0);
}

main().catch(async (err) => {
  console.error('FATAL:', err);
  process.exit(1);
});
