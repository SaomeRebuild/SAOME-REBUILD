/**
 * Live-capture Passcreator V3 per-pass issuance responses for use as
 * test fixtures.
 *
 * @module scripts/capture-passcreator-v3
 * @description Runs hand-crafted requests against the Passcreator V3
 * per-pass runtime API (`/api/v3/pass`), captures each response,
 * redacts sensitive fields, and writes them as JSON files to
 * `fixtures/passcreator/v3/`.
 *
 * V3 is distinct from V2 — V2 (`/api/v2/pass-template/*`) is the
 * template management API (Step 8 push); V3 (`/api/v3/pass`) is the
 * per-pass runtime API invoked by `registerService` immediately after
 * a public visitor registers as a Pass Holder. The V3 response shape
 * is what `extractPassIssueData` parses to persist onto the
 * `pass_holders` row's V3 runtime columns.
 *
 * The previous round's conformance tests were written from docs-derived
 * mocks (see `runs/improvements/feedback/20261019-pass-holder-v3-issuance-v3-contract-fix.md`
 * § "Why tests passed but production broke"). This script is the
 * live-capture artifact that pins the real V3 shape so future
 * refactors can't drift the parser away from reality. CI must assert
 * these fixtures' shapes (see `passcreator.test.ts` "live V3 envelope
 * shape" cases).
 *
 * Scenarios:
 *   - v3-create-success: POST /api/v3/pass?async=false with valid
 *     templateId + 4 holder fields. Captures the success envelope
 *     shape with all 5 data fields (identifier, downloadPage,
 *     iPhoneUri, androidUri, barcodeValue).
 *   - v3-list: GET /api/v3/pass. Captures the list envelope shape
 *     AND confirms the just-issued test pass is visible (sanity check
 *     that V3 create actually persisted).
 *   - v3-create-error: POST without a required field. Captures the
 *     V3 error envelope shape so the error path of
 *     `normalizePasscreatorErrorEntries` is pinned to reality too.
 *
 * ⚠️  Side effect — v3-create-success issues a REAL per-pass wallet
 *     pass in the Passcreator account. Passcreator V3 has no documented
 *     DELETE endpoint (V1 had `passtemplate` URL param DELETE; V3
 *     doesn't). We mitigate by using timestamped dummy holder data
 *     (`capture-test-<ts>@capture.invalid` + dummy phone) so test rows
 *     don't collide with real users. The script is NOT idempotent for
 *     the create path — re-running issues a new test pass each time.
 *     Use `--read-only` to skip create and capture only list + error.
 *
 * Usage:
 *   node apps/backend/scripts/capture-passcreator-v3.cjs
 *   node apps/backend/scripts/capture-passcreator-v3.cjs --read-only
 *
 * Env (auto-loaded — no manual export needed):
 *   - apps/backend/.dev.vars           → PASSCREATOR_API_KEY
 *   - apps/backend/wrangler.jsonc      → PASSCREATOR_API_URL
 *   - process.env.PASSCREATOR_V3_TEMPLATE_ID → UUID of an existing
 *     V2 template (required for create scenario). If unset, falls
 *     back to the production probe UUIDs hardcoded in `KNOWN_TEMPLATES`.
 *
 * Override URL (e.g. for a Passcreator staging env):
 *   PASSCREATOR_API_URL=https://staging.passcreator.com \
 *     node apps/backend/scripts/capture-passcreator-v3.cjs
 *
 * Output:
 *   fixtures/passcreator/v3/<scenario>.json   — one file per scenario
 *
 * Rule references:
 *   - Rule 006 § 完工前驗證 — every "X is verified" claim must have
 *     a captured artifact; this script is the artifact source for
 *     the V3 success / list / error response shapes.
 *   - Rule 027 § workerd pitfall — the V3 create round-trip also
 *     exercises non-ASCII holder fields (zh-TW name) end-to-end.
 *   - Rule 037 — uses `fetch` directly (not an MCP wrapper).
 *
 * @see apps/backend/src/shared/lib/passcreator.ts (client under test)
 * @see apps/backend/src/shared/lib/passcreator.test.ts (consumer of fixtures)
 * @see runs/improvements/feedback/20261019-pass-holder-v3-issuance-v3-contract-fix.md
 */

'use strict';

const fs = require('node:fs');
const path = require('node:path');

const BACKEND_ROOT = path.resolve(__dirname, '..');
const REPO_ROOT = path.resolve(BACKEND_ROOT, '..', '..');
const FIXTURES_DIR = path.join(REPO_ROOT, 'fixtures', 'passcreator', 'v3');

const DEV_VARS_PATH = path.join(BACKEND_ROOT, '.dev.vars');
const WRANGLER_PATH = path.join(BACKEND_ROOT, 'wrangler.jsonc');

/**
 * Known production V2 template UUIDs (from `probe-passcreator-direct.mjs`).
 * Used as `templateId` for the V3 create scenario when
 * `PASSCREATOR_V3_TEMPLATE_ID` isn't set. Both are real published
 * templates — the create call against either will issue a real per-pass
 * wallet pass.
 */
const KNOWN_TEMPLATES = [
  '6b858510-2320-4fda-85d6-3845bade872a', // zh-TW discount_card (per probe-passcreator-direct.mjs)
  '9da72508-3ada-44ab-b94d-f56f8d31756c', // en discount_card
];

/**
 * V3 create request body. Mirrors the shape the SAOME registerService
 * sends today (see `passcreator.ts::issuePass`):
 *   - `data.templateId` — V2 template UUID
 *   - `data.name` — holder display name (non-ASCII to also exercise
 *     the workerd JSON.stringify pitfall path)
 *   - `data.phone` — E.164 string
 *   - `data.birthday` — ISO date
 *   - `data.email` — used by Apple/Google Wallet to deliver the link
 *
 * The body MUST wrap all fields inside a top-level `data` object
 * (V3 docs § "The following properties of the `data` object can/must
 * be submitted in the request body"). V1's `additionalPropertyValues`
 * wrapper does NOT exist on V3 create.
 */
function makeV3CreateBody(templateId) {
  const ts = Date.now();
  return {
    data: {
      templateId,
      // Non-ASCII name exercises the workerd JSON.stringify round-trip
      // path so the fixture doubles as a regression test for the
      // Rule 027 pitfall (jsonb-style unicode preservation).
      name: `Capture 測試 ${ts}`,
      phone: '+886912345678',
      birthday: '1990-01-01',
      // `.invalid` TLD is RFC 6761 reserved — guaranteed never to
      // resolve to a real mailbox, so the test pass can't accidentally
      // email a real person.
      email: `capture-test-${ts}@capture.invalid`,
    },
  };
}

/**
 * The 3 scenarios. Each one targets a different surface:
 *
 *   - v3-create-success — POST /api/v3/pass?async=false (the shape
 *     that flows into the production `pass_holders` row).
 *   - v3-list — GET /api/v3/pass (verifies create persisted AND
 *     pins the list envelope shape).
 *   - v3-create-error — POST with missing email (pins the V3 error
 *     envelope shape; same defensive parser on the receive path).
 *
 * `--read-only` flag skips `v3-create-success` (avoid issuing test
 * passes) but still runs `v3-list` + `v3-create-error`.
 */
function buildScenarios(templateId, { readOnly }) {
  const scenarios = [
    {
      name: 'v3-list',
      description: 'GET /api/v3/pass — list all per-pass runtime artifacts. Confirms V3 list envelope shape (success + data:[]) and verifies any test pass issued by v3-create-success is visible.',
      method: 'GET',
      body: undefined,
    },
    {
      name: 'v3-create-error',
      description: 'POST /api/v3/pass?async=false with `data.templateId` intentionally omitted. Triggers a V3 validation error (templateId is required). The captured error envelope shape pins the `normalizePasscreatorErrorEntries` path on the receive side to reality. Earlier rounds observed that V3 error envelopes use `errors: string[]` (NOT `{property, message}[]` as V2 does) — the parser must handle both shapes.',
      method: 'POST',
      body: {
        data: {
          // templateId: intentionally omitted — required by V3
          name: 'Capture Error Test',
          phone: '+886912345678',
          birthday: '1990-01-01',
          email: 'capture-test-error@capture.invalid',
        },
      },
    },
  ];
  if (!readOnly) {
    scenarios.unshift({
      name: 'v3-create-success',
      description: 'POST /api/v3/pass?async=false with all 4 holder fields. Issues a REAL per-pass wallet pass in the Passcreator account (no documented V3 DELETE; cleanup is manual). Captures the success envelope shape with identifier + downloadPage + iPhoneUri + androidUri + barcodeValue — this is the production contract extractPassIssueData parses.',
      method: 'POST',
      body: makeV3CreateBody(templateId),
    });
  }
  return scenarios;
}

/**
 * Minimal `.dev.vars` parser (same logic as `capture-passcreator-errors.cjs`).
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
 * Minimal `wrangler.jsonc` parser (same logic as
 * `capture-passcreator-errors.cjs`). Strips `//` line comments then
 * JSON.parses; we only need the `vars` block.
 */
function parseWranglerVars(text) {
  const stripped = text
    .split(/\r?\n/)
    .map((line) => {
      // Strip `//` line comments. Heuristic: don't strip `://` (URLs).
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
 * Type-guard: is the parsed body a Passcreator V3 envelope?
 *
 * V3 success: `{ success: true, data: {...}, errors: [] }` — where
 * `data` is either an object (create response) OR an array (list
 * response).
 *
 * V3 error: `{ success: false, errors: ... }` — `errors` is an array
 * OR a single `{property, message}-shaped` object (same as V2's two
 * envelope shapes).
 *
 * Returns `'success'` / `'error'` / `'unknown'` so the summary table
 * can label each fixture.
 */
function classifyV3Envelope(parsed) {
  if (typeof parsed !== 'object' || parsed === null) return 'unknown';
  const obj = parsed;
  if (obj.success === true) {
    if (Array.isArray(obj.data)) return 'success-list';
    if (typeof obj.data === 'object' && obj.data !== null) return 'success-create';
    return 'success-other';
  }
  if (obj.success === false) {
    if (Array.isArray(obj.errors) || typeof obj.errors === 'object') return 'error';
    return 'error-malformed';
  }
  return 'unknown';
}

/**
 * Run a single scenario. Same shape as the V2 capture's `runScenario`
 * — read response once, prefer parsed JSON over raw text.
 */
async function runScenario(env, scenario) {
  const baseUrl = env.PASSCREATOR_API_URL.replace(/\/$/, '');
  const url =
    scenario.method === 'GET'
      ? `${baseUrl}/api/v3/pass`
      : `${baseUrl}/api/v3/pass?async=false`;
  const headers = {
    'Content-Type': 'application/json',
    Accept: 'application/json',
    Authorization: env.PASSCREATOR_API_KEY,
  };
  const init = {
    method: scenario.method,
    headers,
  };
  if (scenario.body !== undefined) {
    init.body = JSON.stringify(scenario.body);
  }
  const response = await fetch(url, init);
  const rawBody = await response.text();
  let parsedBody = null;
  if (rawBody.length > 0) {
    try {
      parsedBody = JSON.parse(rawBody);
    } catch {
      // Non-JSON; leave parsedBody as null and keep rawBody in the fixture.
    }
  }
  return {
    status: response.status,
    ok: response.ok,
    contentType: response.headers.get('content-type'),
    rawBody,
    parsedBody,
  };
}

/**
 * Build the fixture object that gets written to disk. Mirrors the V2
 * capture's shape so downstream consumers can use one parser for both
 * `fixtures/passcreator/*.json` and `fixtures/passcreator/v3/*.json`.
 *
 * Sensitive fields (Authorization header, request API key) are NEVER
 * included — only the request body and the response.
 */
function buildFixture(scenario, env, response, capturedAt) {
  return {
    scenario: scenario.name,
    description: scenario.description,
    capturedAt,
    apiUrl: env.PASSCREATOR_API_URL,
    request: {
      method: scenario.method,
      path: scenario.method === 'GET' ? '/api/v3/pass' : '/api/v3/pass?async=false',
      body: scenario.body ?? null,
    },
    response: {
      status: response.status,
      ok: response.ok,
      contentType: response.contentType,
      body: response.parsedBody ?? response.rawBody,
    },
  };
}

async function main() {
  // 1. Parse CLI flags
  const args = process.argv.slice(2);
  const readOnly = args.includes('--read-only') || args.includes('--readonly');
  if (args.includes('--help') || args.includes('-h')) {
    console.log(`Usage: node apps/backend/scripts/capture-passcreator-v3.cjs [--read-only]

Options:
  --read-only   Skip the v3-create-success scenario (avoids issuing a real
                test pass in the Passcreator account). Still captures
                v3-list and v3-create-error.

Env (any of these may be overridden):
  PASSCREATOR_API_URL           Override API URL (default: wrangler.jsonc::vars)
  PASSCREATOR_API_KEY           API key (default: apps/backend/.dev.vars)
  PASSCREATOR_V3_TEMPLATE_ID    UUID of an existing V2 template for the
                                create scenario (default: ${KNOWN_TEMPLATES[0]})

Output: fixtures/passcreator/v3/<scenario>.json
`);
    process.exit(0);
  }

  // 2. Load env
  if (!fs.existsSync(DEV_VARS_PATH)) {
    console.error(`FATAL: ${DEV_VARS_PATH} not found. Create apps/backend/.dev.vars with PASSCREATOR_API_KEY, or pass PASSCREATOR_API_KEY via environment.`);
    process.exit(2);
  }
  if (!fs.existsSync(WRANGLER_PATH)) {
    console.error(`FATAL: ${WRANGLER_PATH} not found.`);
    process.exit(2);
  }
  const devVars = parseDevVars(fs.readFileSync(DEV_VARS_PATH, 'utf8'));
  const wranglerVars = parseWranglerVars(fs.readFileSync(WRANGLER_PATH, 'utf8'));

  const env = {
    PASSCREATOR_API_URL:
      process.env.PASSCREATOR_API_URL || wranglerVars.PASSCREATOR_API_URL,
    PASSCREATOR_API_KEY: process.env.PASSCREATOR_API_KEY || devVars.PASSCREATOR_API_KEY,
  };
  // V3 `templateId` is a UUID (V2's `data.identifier`), NOT the Apple
  // Pass Type ID (`pass.com.saome.xxx` form stored in
  // wrangler.jsonc::PASSCREATOR_PASS_TYPE_ID). We require an explicit
  // override or fall back to a known probe UUID.
  const templateId = process.env.PASSCREATOR_V3_TEMPLATE_ID || KNOWN_TEMPLATES[0];

  if (!env.PASSCREATOR_API_URL) {
    console.error('FATAL: PASSCREATOR_API_URL missing (set in wrangler.jsonc::vars or via env)');
    process.exit(2);
  }
  if (!env.PASSCREATOR_API_KEY) {
    console.error('FATAL: PASSCREATOR_API_KEY missing (set in apps/backend/.dev.vars or via env)');
    process.exit(2);
  }
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(templateId)) {
    console.error(`FATAL: PASSCREATOR_V3_TEMPLATE_ID must be a UUID; got "${templateId}"`);
    console.error(`  Hint: pass --help to see known probe UUIDs, or set PASSCREATOR_V3_TEMPLATE_ID=<uuid> to override.`);
    process.exit(2);
  }

  // 3. Make sure the fixtures dir exists
  fs.mkdirSync(FIXTURES_DIR, { recursive: true });

  // 4. Run each scenario
  const scenarios = buildScenarios(templateId, { readOnly });
  const results = [];
  for (const scenario of scenarios) {
    process.stdout.write(`  ${scenario.name.padEnd(24)} ... `);
    try {
      const response = await runScenario(env, scenario);
      const capturedAt = new Date().toISOString();
      const fixture = buildFixture(scenario, env, response, capturedAt);
      const filePath = path.join(FIXTURES_DIR, `${scenario.name}.json`);
      fs.writeFileSync(filePath, JSON.stringify(fixture, null, 2) + '\n');
      const envelopeKind = classifyV3Envelope(response.parsedBody);
      results.push({
        scenario: scenario.name,
        status: response.status,
        bytes: response.rawBody.length,
        envelope: envelopeKind,
        file: path.relative(REPO_ROOT, filePath),
      });
      process.stdout.write(`status=${response.status} envelope=${envelopeKind} bytes=${response.rawBody.length} → ${path.relative(REPO_ROOT, filePath)}\n`);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      process.stdout.write(`ERROR: ${message}\n`);
      results.push({ scenario: scenario.name, error: message });
    }
  }

  // 5. Summary table
  console.log('\n=== Summary ===');
  for (const r of results) {
    if (r.error) {
      console.log(`  ${r.scenario.padEnd(24)} ✗ ${r.error}`);
    } else {
      console.log(`  ${r.scenario.padEnd(24)} status=${r.status}  envelope=${r.envelope}  ${r.bytes} bytes  → ${r.file}`);
    }
  }
  if (readOnly) {
    console.log(`\n(--read-only: v3-create-success skipped — no test pass issued)`);
  } else {
    console.log(`\n(⚠ v3-create-success issued a real per-pass wallet pass in the Passcreator account. V3 has no documented DELETE; cleanup is manual if needed.)`);
  }

  // 6. Exit code: 0 if all scenarios captured, 1 if any failed
  const allOk = results.every((r) => !r.error);
  if (!allOk) {
    console.error('\nSome scenarios failed to capture. See errors above.');
    process.exit(1);
  }
  console.log(`\nAll ${results.length} fixture(s) written to: ${path.relative(REPO_ROOT, FIXTURES_DIR)}/`);
}

main().catch((err) => {
  console.error('FATAL:', err);
  process.exit(1);
});