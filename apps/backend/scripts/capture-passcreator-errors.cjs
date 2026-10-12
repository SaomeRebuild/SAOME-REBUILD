/**
 * Live-capture Passcreator V2 error responses for use as test fixtures.
 *
 * @module scripts/capture-passcreator-errors
 * @description Runs 4 hand-crafted failing requests against the
 * Passcreator V2 API, captures each response, redacts any sensitive
 * fields, and writes them as JSON files to `fixtures/passcreator/`.
 *
 * The captured fixtures pin the real V2 envelope shape so future
 * changes to `passcreator.ts` (the client) or Passcreator's API can
 * be caught by vitest asserting the fixture shape didn't drift.
 *
 * Usage:
 *   node apps/backend/scripts/capture-passcreator-errors.cjs
 *
 * Env (auto-loaded — no manual export needed):
 *   - apps/backend/.dev.vars           → PASSCREATOR_API_KEY
 *   - apps/backend/wrangler.jsonc      → PASSCREATOR_API_URL, PASSCREATOR_PASS_TYPE_ID
 *
 * Override URL (e.g. for a Passcreator staging env):
 *   PASSCREATOR_API_URL=https://staging.passcreator.com \
 *     node apps/backend/scripts/capture-passcreator-errors.cjs
 *
 * Output:
 *   fixtures/passcreator/<scenario>.json   — one file per scenario
 *
 * Rule references:
 *   - Rule 006 § 完工前驗證 — every "X is verified" claim must have
 *     a captured artifact; this script is the artifact source for
 *     the V2 errors[] extraction path.
 *   - Rule 037 — uses `fetch` directly (not an MCP wrapper).
 *
 * @see apps/backend/src/shared/lib/passcreator.ts (client under test)
 * @see apps/backend/src/shared/lib/passcreator.test.ts (consumer of fixtures)
 */

'use strict';

const fs = require('node:fs');
const path = require('node:path');

const BACKEND_ROOT = path.resolve(__dirname, '..');
const REPO_ROOT = path.resolve(BACKEND_ROOT, '..', '..');
const FIXTURES_DIR = path.join(REPO_ROOT, 'fixtures', 'passcreator');

const DEV_VARS_PATH = path.join(BACKEND_ROOT, '.dev.vars');
const WRANGLER_PATH = path.join(BACKEND_ROOT, 'wrangler.jsonc');

/**
 * Minimal valid template body, used as the baseline that the 4
 * scenarios modify. Mirrors the shape expected by
 * `PasscreatorTemplateBody` in `passcreator.ts`.
 */
function makeBaselineBody(passTypeId) {
  // Baseline MUST itself be valid so the only failure mode we
  // observe is the one each scenario intentionally introduces.
  // Earlier versions omitted `type` and used bare hex (no `#`),
  // which made Passcreator fail with a multi-field schema error
  // before any scenario-specific check had a chance to run. The
  // 2026-10-11 v6 fix added:
  //   - `type` field (Passcreator requires it — was causing the
  //     production incident this script was originally written
  //     for).
  //   - `#RRGGBB` color format (Passcreator regex requires `#` —
  //     `stripHexHash` had been silently stripping it).
  //   - `barcode.value` + `useAutoIdForValue` (user-requested
  //     defaults, 2026-10-11).
  //   - `fields.*[].type` (Passcreator validates `type` + `label`
  //     + `value` together; maps CardFieldKey → PasscreatorFieldType
  //     — `headerFields[0]` is `balance`/`number`, `primaryFields`
  //     and `secondaryFields` are placeholder `text`).
  //   - `images.icon` set to a real downloadable PNG so Passcreator
  //     can validate the URL (Passcreator validates the URL itself
  //     by attempting to download it). An empty `images: {}` is
  //     rejected by Passcreator as "Array value found, but an object
  //     is required" (verified 2026-10-11).
  return {
    passTypeId,
    type: 'storeCard',
    name: 'Capture Test',
    description: 'A test pass for live error response capture',
    organizationName: 'Capture Org',
    colors: { backgroundColor: '#0F0F23', foregroundColor: '#F8FAFC' },
    barcode: {
      format: 'PKBarcodeFormatQR',
      value: '',
      useAutoIdForValue: true,
    },
    images: {
      icon: 'https://www.gstatic.com/webp/gallery/1.png',
    },
    fields: {
      headerFields: [
        { key: 'balance', type: 'number', label: '餘額', value: '' },
      ],
      primaryFields: [
        { key: 'phone', type: 'text', label: '電話', value: '' },
      ],
      secondaryFields: [
        { key: 'email', type: 'text', label: 'E-mail', value: '' },
      ],
      backFields: [
        { key: '', type: 'text', label: '客服電話', value: '+886-2-1234-5678' },
      ],
    },
  };
}

/**
 * The 4 scenarios we capture. Each mutates the baseline body or
 * auth header to provoke a specific failure mode.
 */
function buildScenarios(passTypeId) {
  return [
    {
      name: 'empty-body',
      description: 'POST {} — every required field missing. Triggers the multi-field V2 errors[] envelope.',
      method: 'POST',
      body: {},
    },
    {
      name: 'invalid-pass-type-id',
      description: 'POST with a passTypeId not registered in Passcreator. Triggers a per-field "unknown reference" error.',
      method: 'POST',
      body: { ...makeBaselineBody(passTypeId), passTypeId: 'invalid-xxx-not-a-real-id-12345' },
    },
    {
      name: 'bad-token',
      description: 'POST with Authorization: Bearer wrong-key. Triggers 401 — may or may not be a V2 envelope depending on Passcreator\'s auth flow.',
      method: 'POST',
      body: makeBaselineBody(passTypeId),
      overrideAuth: 'Bearer wrong-key-capture-test',
    },
    {
      name: 'wrong-format-field',
      description: 'POST with colors as a string instead of {backgroundColor, foregroundColor}. Triggers a V2 type-mismatch error.',
      method: 'POST',
      body: { ...makeBaselineBody(passTypeId), colors: 'this should be an object' },
    },
  ];
}

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
      // Strip `//` line comments. Heuristic: don't strip `://` (URLs).
      const idx = line.indexOf('//');
      if (idx === -1) return line;
      // Check the char before: if it's `:` or `/`, it's part of a URL or protocol.
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
 * Type-guard: is the parsed body a Passcreator V2 error envelope?
 * Mirrors the logic in `passcreator.ts::isPasscreatorErrorEnvelope`
 * so we can label each fixture for the summary table.
 */
function isV2ErrorEnvelope(parsed) {
  if (typeof parsed !== 'object' || parsed === null) return false;
  return parsed.success === false && Array.isArray(parsed.errors);
}

/**
 * Run a single scenario and return the captured response.
 * Errors at the network level (DNS, TLS, abort) are propagated
 * so the caller can label the fixture as "transport failure".
 */
async function runScenario(env, scenario) {
  const url = `${env.PASSCREATOR_API_URL.replace(/\/$/, '')}/api/v2/pass-template`;
  const headers = {
    'Content-Type': 'application/json',
    Accept: 'application/json',
    Authorization:
      // V2 scheme: raw API key (no `Bearer` prefix). The `bad-token`
      // scenario deliberately sends a wrong raw key — keep it as-is.
      scenario.overrideAuth !== undefined
        ? scenario.overrideAuth
        : env.PASSCREATOR_API_KEY,
  };
  const response = await fetch(url, {
    method: scenario.method,
    headers,
    body: JSON.stringify(scenario.body),
  });
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
 * Build the fixture object that gets written to disk. We keep:
 *   - The request (method + URL + body) so the fixture is self-documenting.
 *   - The response status + content-type + body.
 *
 * We strip:
 *   - Any header that might leak credentials (only `content-type` is kept).
 *   - The actual API key (never written, even though we never include it).
 */
function buildFixture(scenario, env, response, capturedAt) {
  return {
    scenario: scenario.name,
    description: scenario.description,
    capturedAt,
    apiUrl: env.PASSCREATOR_API_URL,
    request: {
      method: scenario.method,
      path: '/api/v2/pass-template',
      body: scenario.body,
    },
    response: {
      status: response.status,
      ok: response.ok,
      contentType: response.contentType,
      // Prefer the parsed body (keeps the JSON readable) but fall
      // back to the raw text when Passcreator returned non-JSON
      // (e.g. a CDN 530 HTML page).
      body: response.parsedBody ?? response.rawBody,
    },
  };
}

async function main() {
  // 1. Load env
  if (!fs.existsSync(DEV_VARS_PATH)) {
    console.error(`FATAL: ${DEV_VARS_PATH} not found. Create apps/backend/.dev.vars with PASSCREATOR_API_KEY.`);
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
    PASSCREATOR_API_KEY: devVars.PASSCREATOR_API_KEY,
    PASSCREATOR_PASS_TYPE_ID: wranglerVars.PASSCREATOR_PASS_TYPE_ID,
  };
  if (!env.PASSCREATOR_API_URL || !env.PASSCREATOR_API_KEY || !env.PASSCREATOR_PASS_TYPE_ID) {
    console.error('FATAL: missing one of PASSCREATOR_API_URL / PASSCREATOR_API_KEY / PASSCREATOR_PASS_TYPE_ID');
    console.error('  API_URL from wrangler.jsonc:', wranglerVars.PASSCREATOR_API_URL);
    console.error('  API_KEY from .dev.vars:', devVars.PASSCREATOR_API_KEY ? '(set)' : '(missing)');
    console.error('  PASS_TYPE_ID from wrangler.jsonc:', wranglerVars.PASSCREATOR_PASS_TYPE_ID);
    process.exit(2);
  }

  // 2. Make sure the fixtures dir exists
  fs.mkdirSync(FIXTURES_DIR, { recursive: true });

  // 3. Run each scenario
  const scenarios = buildScenarios(env.PASSCREATOR_PASS_TYPE_ID);
  const results = [];
  for (const scenario of scenarios) {
    process.stdout.write(`  ${scenario.name.padEnd(24)} ... `);
    try {
      const response = await runScenario(env, scenario);
      const capturedAt = new Date().toISOString();
      const fixture = buildFixture(scenario, env, response, capturedAt);
      const filePath = path.join(FIXTURES_DIR, `${scenario.name}.json`);
      fs.writeFileSync(filePath, JSON.stringify(fixture, null, 2) + '\n');
      results.push({
        scenario: scenario.name,
        status: response.status,
        bytes: response.rawBody.length,
        v2Envelope: isV2ErrorEnvelope(response.parsedBody),
        file: path.relative(REPO_ROOT, filePath),
      });
      process.stdout.write(`status=${response.status} v2=${isV2ErrorEnvelope(response.parsedBody)} bytes=${response.rawBody.length} → ${path.relative(REPO_ROOT, filePath)}\n`);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      process.stdout.write(`ERROR: ${message}\n`);
      results.push({ scenario: scenario.name, error: message });
    }
  }

  // 4. Summary table
  console.log('\n=== Summary ===');
  for (const r of results) {
    if (r.error) {
      console.log(`  ${r.scenario.padEnd(24)} ✗ ${r.error}`);
    } else {
      const tag = r.v2Envelope ? 'V2 envelope' : 'non-V2';
      console.log(`  ${r.scenario.padEnd(24)} status=${r.status}  ${tag}  ${r.bytes} bytes  → ${r.file}`);
    }
  }

  // 5. Exit code: 0 if all 4 captured, 1 if any failed
  const allOk = results.every((r) => !r.error);
  if (!allOk) {
    console.error('\nSome scenarios failed to capture. See errors above.');
    process.exit(1);
  }
  console.log(`\nAll 4 fixtures written to: ${path.relative(REPO_ROOT, FIXTURES_DIR)}/`);
}

main().catch((err) => {
  console.error('FATAL:', err);
  process.exit(1);
});
