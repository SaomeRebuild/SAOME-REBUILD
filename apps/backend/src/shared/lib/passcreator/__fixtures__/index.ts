/**
 * Shared test fixtures for the Passcreator client test files.
 *
 * @module shared/lib/passcreator/__fixtures__
 *
 * Phase 5 (2026-10-19) — extracted from the monolithic
 * `passcreator.test.ts` so the 7 per-source test files (env /
 * transport / errors / v2-template / v3-pass) can share:
 *   - `VALID_ENV` (env shape + valid credentials)
 *   - `makeBody()` / `makeResponse()` (V2 template body + fetch response mocks)
 *   - `fetchSpy` + `beforeEach`/`afterEach` (fetch global stub)
 *   - `REPO_ROOT` (for fixture file resolution)
 *   - `tryLoadFixture()` / `fixtureOrSkip()` (live V2/V3 captured fixtures)
 *   - `isV2ErrorEnvelope()` / `extractUpstreamErrorsLikeClient()` (envelope helpers)
 *   - `CapturedFixture` interface + V3-specific helpers (`makeHolder`,
 *     `makeV3SuccessBody`, `BACKFILL_IDENTIFIER` / `BACKFILL_BARCODE`,
 *     `makeV3GetSingleBody`, `makeV3ListFilteredBody`)
 *
 * Node.js `fs` / `node:path` are used here for fixture file resolution
 * (Strategy 2 fallback in `tryLoadFixture`). These are guarded by
 * try/catch in the workerd pool, so the imports themselves are safe
 * to live in a shared module even though workerd cannot read files.
 *
 * NOTE: This file is included by `tsconfig.json` (not a `.test.ts`),
 * so we add the Vite client types triple-slash directive to type
 * `import.meta.glob` (a Vite-specific API, not in the standard
 * `ImportMeta` interface).
 */

/// <reference types="vite/client" />

import { beforeEach, afterEach, vi } from 'vitest';
import * as fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import * as nodePath from 'node:path';

// ---------------------------------------------------------------------------
// REPO_ROOT
// ---------------------------------------------------------------------------

/**
 * Repository root, computed from this file's location so fixture
 * tests can resolve `fixtures/passcreator/v3/*.json` without
 * hard-coding absolute paths. Mirrors
 * `apps/backend/scripts/capture-passcreator-v3.cjs::REPO_ROOT`.
 *
 * Path math: from `apps/backend/src/shared/lib/passcreator/__fixtures__/`
 * to repo root = 6 levels of `../`.
 */
export const REPO_ROOT = nodePath.resolve(
  nodePath.dirname(fileURLToPath(import.meta.url)),
  '..',
  '..',
  '..',
  '..',
  '..',
  '..',
);

// ---------------------------------------------------------------------------
// VALID_ENV — minimal Passcreator env shape
// ---------------------------------------------------------------------------

/**
 * Minimal Passcreator env shape that the client reads via `requireEnv`.
 */
export const VALID_ENV = {
  PASSCREATOR_API_URL: 'https://app.passcreator.com',
  PASSCREATOR_API_KEY: 'test-key',
  PASSCREATOR_PASS_TYPE_ID: 'pass.saome.org.passcreator',
};

// ---------------------------------------------------------------------------
// makeBody — V2 template body factory
// ---------------------------------------------------------------------------

/**
 * Minimal V2 template body — fields unused by these tests are defaulted.
 *
 * Mirrors the real `PasscreatorTemplateBody` shape that
 * `passTemplateMapping.ts` produces (the required-field contract
 * Passcreator enforces — see `passcreator/v2-template-types.ts`):
 *   - `type: 'storeCard'`                  — required Passcreator field
 *   - `colors.*` with `#RRGGBB`             — required regex `^#([A-Fa-f0-9]{6}|...)`
 *   - `barcode.value` + `useAutoIdForValue` — user-requested defaults (2026-10-11)
 *   - `fields.*[].type`                    — required alongside `label` and `value`
 */
export function makeBody(overrides: Partial<{ name: string }> = {}) {
  return {
    passTypeId: VALID_ENV.PASSCREATOR_PASS_TYPE_ID,
    type: 'storeCard' as const,
    name: overrides.name ?? 'Café Rewards',
    description: 'desc',
    organizationName: 'Café Co.',
    colors: { backgroundColor: '#0F0F23', foregroundColor: '#F8FAFC' },
    barcode: {
      format: 'PKBarcodeFormatQR' as const,
      value: '',
      useAutoIdForValue: true,
    },
    images: {},
    fields: {
      headerFields: [],
      primaryFields: [],
      secondaryFields: [],
      backFields: [],
    },
  };
}

// ---------------------------------------------------------------------------
// makeResponse — fetch response mock factory
// ---------------------------------------------------------------------------

/**
 * Build a mocked fetch response that mirrors the parts of the Web
 * Response API that the client uses (status, ok, text, json).
 *
 * Tests usually need to assert against URL + method + headers — we
 * return both the fetch implementation AND a call-recorder spy so
 * each test can inspect what got sent.
 */
export function makeResponse({
  status = 200,
  body,
}: {
  status?: number;
  body?: string | object | null;
}) {
  const text = typeof body === 'string' ? body : body == null ? '' : JSON.stringify(body);
  return {
    status,
    ok: status >= 200 && status < 300,
    text: async () => text,
  };
}

// ---------------------------------------------------------------------------
// fetchSpy — global fetch stub (registered in beforeEach / afterEach)
// ---------------------------------------------------------------------------

/**
 * Module-level `vi.fn()` for the global fetch stub. Each test resets
 * it via `beforeEach` (sets a new spy) and `afterEach` (unstubs).
 *
 * Re-exported as `let fetchSpy` so callers can do
 * `fetchSpy.mockResolvedValueOnce(...)` directly.
 */
export let fetchSpy: ReturnType<typeof vi.fn>;

/** Setup: install a fresh fetch spy before each test. */
export function installFetchSpy() {
  fetchSpy = vi.fn();
  vi.stubGlobal('fetch', fetchSpy);
}

/** Teardown: restore real fetch and any other stubs. */
export function uninstallFetchSpy() {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
}

// Auto-register the lifecycle so importing this file in a test file
// is enough — no need to manually call installFetchSpy(). Tests that
// need a different fetch shape can still override via beforeEach().
beforeEach(() => {
  installFetchSpy();
});
afterEach(() => {
  uninstallFetchSpy();
});

// ---------------------------------------------------------------------------
// CapturedFixture — live-capture fixture shape (V2 + V3)
// ---------------------------------------------------------------------------

/**
 * Live-capture fixture shape produced by
 *   `apps/backend/scripts/capture-passcreator-errors.cjs` (V2) and
 *   `apps/backend/scripts/capture-passcreator-v3.cjs` (V3).
 *
 * Each fixture is a single JSON file under
 * `fixtures/passcreator/{scenario}.json` (V2) or
 * `fixtures/passcreator/v3/{scenario}.json` (V3) that pins the
 * real Passcreator envelope bytes.
 */
export interface CapturedFixture {
  scenario: string;
  description: string;
  capturedAt: string;
  apiUrl: string;
  request: { method: string; path: string; body: unknown };
  response: { status: number; ok: boolean; contentType: string | null; body: unknown };
}

// ---------------------------------------------------------------------------
// importFixturesGlob — Vite `import.meta.glob` based fixture loader
// ---------------------------------------------------------------------------

/**
 * Vite-specific glob: bundle every JSON file matching the path.
 * `eager: true` returns the parsed contents directly (no Promise).
 * The path is `../../../../../../fixtures/passcreator/*.json` from
 * this file (6 levels of `../` to climb out of
 * `apps/backend/src/shared/lib/passcreator/__fixtures__/` to the
 * repo root).
 *
 * We glob two path patterns so both top-level V2 fixtures
 * (`success-create.json` etc.) and V3 sub-folder fixtures
 * (`v3/v3-create-success.json` etc.) are bundled. The key
 * derivation below preserves the `v3/...` prefix so callers
 * use `tryLoadFixture('v3/v3-create-success')` to opt into a
 * V3 fixture without colliding with V2's `success-create`.
 */
export function importFixturesGlob(): Record<string, CapturedFixture> {
  try {
    const modules = import.meta.glob<CapturedFixture>(
      [
        '../../../../../../fixtures/passcreator/*.json',
        '../../../../../../fixtures/passcreator/v3/*.json',
      ],
      { eager: true },
    );
    const out: Record<string, CapturedFixture> = {};
    for (const path of Object.keys(modules)) {
      const mod = modules[path];
      // V3 sub-folder: key includes the `v3/` prefix so it doesn't
      // collide with V2 top-level filenames.
      const m3 = path.match(/\/v3\/([^/]+)\.json$/);
      if (m3) {
        out[`v3/${m3[1]}`] = mod;
        continue;
      }
      // V2 top-level: key is the basename only.
      const m2 = path.match(/\/([^/]+)\.json$/);
      if (m2) out[m2[1]] = mod;
    }
    return out;
  } catch {
    return {};
  }
}

// ---------------------------------------------------------------------------
// FIXTURES_DIR_CANDIDATES — runtime fallback path list
// ---------------------------------------------------------------------------

/**
 * Candidate directories for runtime fixture reads (`fs.readFileSync`).
 *
 * `import.meta.url` resolves differently depending on the vitest pool:
 *   - `npx vitest run <absolute-path>` (workerd pool direct): `__dirname`
 *     is the test file's directory → 6 levels of `../` lands at the repo root.
 *   - `npm test` (workspace pool with wrangler config): the workerd isolate
 *     resolves `__dirname` to a `/C:/...` (forward-slash prefixed) path.
 *
 * The capture script writes to `<repo-root>/fixtures/passcreator/`.
 *
 * IMPORTANT: `@cloudflare/vitest-pool-workers` runs the suite inside
 * workerd, which does NOT implement `fs.readFileSync` (throws
 * "readFileSync() is not yet implemented in Workers"). The
 * `tryLoadFixture()` helper below falls back to the static
 * `import.meta.glob` strategy under workerd.
 */
const __filename = fileURLToPath(import.meta.url);
const __dirname = nodePath.dirname(__filename);

export const FIXTURES_DIR_CANDIDATES: string[] = (() => {
  const candidates: string[] = [];
  candidates.push(nodePath.resolve(__dirname, '../../../../../../fixtures/passcreator'));
  candidates.push(nodePath.resolve(__dirname, '../../../../fixtures/passcreator'));
  let cursor = process.cwd();
  for (let i = 0; i < 8; i++) {
    candidates.push(nodePath.join(cursor, 'fixtures', 'passcreator'));
    const parent = nodePath.dirname(cursor);
    if (parent === cursor) break;
    cursor = parent;
  }
  return candidates;
})();

// ---------------------------------------------------------------------------
// tryLoadFixture — load a CapturedFixture by scenario name
// ---------------------------------------------------------------------------

const STATIC_FIXTURES = importFixturesGlob();

/**
 * Load a `CapturedFixture` by scenario name (e.g. 'success-create' or
 * 'v3/v3-create-success'). Returns `null` if the fixture file is
 * absent (capture script has not been run yet — tests should use
 * `fixtureOrSkip` to register as `it.skip` in that case).
 *
 * Two strategies, in order:
 *   1. Static import via Vite `import.meta.glob` — works inside
 *      workerd because the JSON is bundled at build time.
 *   2. Runtime read via `fs` — works under `npx vitest run` (Node)
 *      but NOT under the workspace `npm test` (workerd pool).
 */
export function tryLoadFixture(scenario: string): CapturedFixture | null {
  const fromGlob = STATIC_FIXTURES[scenario];
  if (fromGlob) return fromGlob;
  for (const dir of FIXTURES_DIR_CANDIDATES) {
    const filePath = nodePath.join(dir, `${scenario}.json`);
    try {
      const text = fs.readFileSync(filePath, 'utf8');
      return JSON.parse(text) as CapturedFixture;
    } catch {
      // Try the next candidate.
    }
  }
  return null;
}

// ---------------------------------------------------------------------------
// isV2ErrorEnvelope / extractUpstreamErrorsLikeClient — envelope helpers
// ---------------------------------------------------------------------------

/**
 * Type-guard for the V2 error envelope shape.
 *
 * Passcreator V2 returns a JSON error envelope on 4xx/5xx with a
 * structured `errors[]` array (or, in some scenarios, a singular
 * `errors: { property, message }` object). This guard recognizes
 * both shapes.
 */
export function isV2ErrorEnvelope(parsed: unknown): boolean {
  if (typeof parsed !== 'object' || parsed === null) return false;
  const obj = parsed as Record<string, unknown>;
  if (obj.success !== false) return false;
  const errors = obj.errors;
  // V2 envelope has either `errors: [{...}]` (array) or
  // `errors: { property, message }` (singular object — verified
  // 2026-10-11 in the `invalid-pass-type-id` scenario).
  if (Array.isArray(errors)) return true;
  if (typeof errors === 'object' && errors !== null) {
    const e = errors as Record<string, unknown>;
    if (typeof e.property === 'string' && typeof e.message === 'string') return true;
  }
  return false;
}

/**
 * Mirror of the client-side `extractUpstreamErrors` helper. Used by
 * the live-fixture conformance tests to assert the same extraction
 * logic the production code uses.
 */
export function extractUpstreamErrorsLikeClient(
  parsed: unknown,
): Array<{ property: string; message: string }> {
  if (!isV2ErrorEnvelope(parsed)) return [];
  const errors = (parsed as { errors: unknown }).errors;
  if (Array.isArray(errors)) {
    return errors.flatMap((entry): Array<{ property: string; message: string }> => {
      if (typeof entry !== 'object' || entry === null) return [];
      const e = entry as Record<string, unknown>;
      if (typeof e.property !== 'string' || typeof e.message !== 'string') return [];
      return [{ property: e.property, message: e.message }];
    });
  }
  // Singular-object case
  if (typeof errors === 'object' && errors !== null) {
    const e = errors as Record<string, unknown>;
    if (typeof e.property === 'string' && typeof e.message === 'string') {
      return [{ property: e.property, message: e.message }];
    }
  }
  return [];
}

/**
 * Module-level helper used by both the success-fixture describe
 * (added 2026-10-12 for the id-parse regression) and the error-fixture
 * describe (added 2026-10-11 for the envelope-shape capture). Each
 * returns the captured `CapturedFixture | null` so callers can pick
 * `it` or `it.skip` based on whether the fixture exists.
 */
export const fixtureOrSkip = (scenario: string) => tryLoadFixture(scenario);

// ---------------------------------------------------------------------------
// V3 per-pass fixtures
// ---------------------------------------------------------------------------

/**
 * V3 minimal holder payload — matches the 4 fields pushed directly
 * into the `data` object (NOT into `additionalPropertyValues`).
 *
 * 2026-10-27 — `memberLevel` is a 5th OPTIONAL holder field: the
 * membership tier NAME. It is omitted from the body entirely when
 * the holder has no tier (a non-membership card), so a legacy call
 * site produces exactly the pre-2026-10-27 body.
 */
export function makeHolder(
  overrides: Partial<{
    name: string;
    phone: string;
    birthday: string;
    email: string;
    memberLevel: string;
  }> = {},
) {
  return {
    name: overrides.name ?? '王小明',
    phone: overrides.phone ?? '+886912345678',
    birthday: overrides.birthday ?? '1990-01-15',
    email: overrides.email ?? 'wang@example.com',
    ...(overrides.memberLevel !== undefined
      ? { memberLevel: overrides.memberLevel }
      : {}),
  };
}

/**
 * V3 success envelope — matches the documented shape from V3 docs
 * (Create a Pass → Returned values section). The real V3 response
 * has `downloadPage` (universal Passcreator landing page that
 * device-sniffs Apple vs Google), `iPhoneUri` (direct .pkpass),
 * `androidUri` (Google Pay / Passwallet deeplink), and `barcodeValue`.
 * V1 used `linkToPassPage` (deprecated on V3).
 */
export function makeV3SuccessBody(overrides: Partial<{
  identifier: string;
  downloadPage: string;
  iPhoneUri: string;
  androidUri: string;
  barcodeValue: string | null;
}> = {}) {
  return {
    success: true,
    description: 'Pass has been created.',
    errors: [],
    data: {
      identifier: overrides.identifier ?? 'a0f629e6-6533-40cb-90b8-ef9093bfbb26',
      templateId: 'pc-tpl-123',
      downloadPage:
        overrides.downloadPage ?? 'https://app.passcreator.com/p/a8976234876af9sdhk',
      iPhoneUri:
        overrides.iPhoneUri ?? 'https://app.passcreator.com/linkToPassFile.pkpass',
      androidUri:
        overrides.androidUri ?? 'https://pay.google.com/save/linkToGoogleWalletPassUri',
      barcodeValue:
        'barcodeValue' in overrides
          ? overrides.barcodeValue
          : '3897897988979823497234',
      bundleId: null,
      genericProperties: {},
    },
    statusCode: 200,
    count: 1,
  };
}

// ---------------------------------------------------------------------------
// V3 GET/LIST backfill fixtures
// ---------------------------------------------------------------------------

export const BACKFILL_IDENTIFIER = '5615a280-fac3-4d64-a4ea-34d8b5d7b0ee';
export const BACKFILL_BARCODE = 'zbood1tvxrvl31kv9e6ad3ef2f71561';

/**
 * Single-pass GET success envelope — mirrors the real V3 response
 * shape captured 2026-10-18 against the ILJOI holder. Note:
 * - `data.generatedId` is SINGULAR (only the single-pass GET uses
 *   this name — LIST uses `autoGeneratedId` PLURAL).
 * - `data.barcodeValue` is ABSENT (not a placeholder — Passcreator
 *   simply omits the field when useAutoIdForValue=true).
 * - `data.linkToPassPage` is present (the universal landing page).
 */
export function makeV3GetSingleBody(overrides: {
  identifier?: string;
  generatedId?: string | null;
  linkToPassPage?: string;
} = {}) {
  return {
    statusCode: 200,
    success: true,
    description: 'Success',
    errors: [],
    count: 1,
    responseMetaData: null,
    data: {
      identifier: overrides.identifier ?? BACKFILL_IDENTIFIER,
      templateId: '22d0d89d-9a5e-4b7d-9aae-3259312f8849',
      generatedId: overrides.generatedId ?? BACKFILL_BARCODE,
      linkToPassPage:
        overrides.linkToPassPage ?? 'https://app.passcreator.com/en/p/y6zcwu9qty1ml6ad3ef2f714f7',
      qrCodeImage: 'https://app.passcreator.com/qr/no%20value%20given',
      name: 'not good',
      type: 'storeCard',
      // CRITICAL: barcodeValue is intentionally ABSENT here. The
      // production behavior is "field omitted entirely" — not a
      // placeholder string. The backfill helper MUST tolerate both
      // shapes (absent + placeholder).
    },
  };
}

/**
 * LIST filter success envelope — mirrors the real V3 response shape
 * captured 2026-10-18 against the ILJOI holder. Note:
 * - `data[]` is an ARRAY (paginated).
 * - Each item has `autoGeneratedId` PLURAL (not `generatedId`).
 * - `barcodeValue: "no value given"` is the LITERAL placeholder
 *   string (per `BARCODE_VALUE_PLACEHOLDERS`).
 */
export function makeV3ListFilteredBody(overrides: {
  identifier?: string;
  autoGeneratedId?: string;
  barcodeValue?: string | null;
} = {}) {
  return {
    statusCode: 200,
    success: true,
    description: 'Success',
    errors: [],
    count: 100,
    responseMetaData: { resultsTotal: 225, resultsThisPage: 100 },
    page: {
      next: 'https://app.passcreator.com/api/v3/pass/?pageSize=100&startUid=abc&startCreatedOnTimestamp=1772563198000',
    },
    data: [
      {
        identifier: overrides.identifier ?? BACKFILL_IDENTIFIER,
        autoGeneratedId: overrides.autoGeneratedId ?? BACKFILL_BARCODE,
        voided: false,
        notYetValid: false,
        templateId: '22d0d89d-9a5e-4b7d-9aae-3259312f8849',
        templateName: 'not good',
        linkToPassPage: 'https://app.passcreator.com/en/p/y6zcwu9qty1ml6ad3ef2f714f7',
        barcodeValue: overrides.barcodeValue ?? 'no value given',
        bundleId: null,
      },
      // Second item (different identifier) — confirms the helper
      // filters by `identifier` AND that other items are ignored.
      {
        identifier: '755fd7d7-ed6b-4150-859c-ac642b483b17',
        autoGeneratedId: 's7m9ho6nlc6ft0356v6ad3e4611c0db',
        barcodeValue: 'no value given',
      },
    ],
  };
}
