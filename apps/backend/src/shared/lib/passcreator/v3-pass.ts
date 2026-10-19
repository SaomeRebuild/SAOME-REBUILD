/**
 * Passcreator V3 per-pass runtime operations.
 *
 * @module shared/lib/passcreator/v3-pass
 */

import { BadGatewayError } from '../saomeError';
import { requireEnv } from './env';
import { passcreatorFetch } from './transport';
import {
  type PassIssueHolderData,
  type PassIssueResponse,
  type PassBackfillResponse,
  BARCODE_VALUE_PLACEHOLDERS,
} from './v3-pass-types';

/**
 * Normalize Passcreator's `barcodeValue` to either a real string or
 * `null`. Passcreator sends LITERAL placeholder strings ("no value
 * specified" / "no value given" / "no barcode" / "") when a template
 * has no barcode configured — those are not real barcodes and must
 * NOT be persisted as the per-pass barcode payload.
 *
 * Returns `null` for:
 *   - Any of the 4 `BARCODE_VALUE_PLACEHOLDERS` strings (case-sensitive
 *     exact match — Passcreator uses lowercase consistently).
 *   - Non-string input (defensive — V3 docs § Returned values says
 *     `barcodeValue` can be a string OR null; we accept null too).
 *
 * Returns the original string verbatim when it's a real barcode
 * (numeric strings like "3897897988979823497234").
 *
 * Used by BOTH branches of `extractPassIssueData` (V3 envelope +
 * legacy / test-double flat shape).
 */
function normalizeBarcodeValue(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  return BARCODE_VALUE_PLACEHOLDERS.has(raw) ? null : raw;
}

/**
 * Extract the per-pass issuance fields from a Passcreator V3 envelope.
 *
 * V3 response shape (success path, per docs § Returned values +
 * live capture 2026-10-19):
 *   {
 *     success: true,
 *     description: "Pass has been created.",
 *     errors: [],
 *     data: {
 *       identifier:      "abcdefeg-0dc5-447b-ac08-eff6462d883e",
 *       templateId:      "...",
 *       downloadPage:    "https://app.passcreator.com/p/...",
 *       iPhoneUri:       "https://app.passcreator.com/...pkpass",
 *       androidUri:      "https://pay.google.com/save/...",
 *       barcodeValue:    "3897897988979823497234" | "no value specified" | null,
 *       bundleId:        null,
 *       genericProperties: { ... }
 *     },
 *     statusCode: 200,
 *     count: 1
 *   }
 *
 * Per the 2026-10-17 live capture, `barcodeValue` is one of:
 *   - a real numeric string (when the template HAS a barcode)
 *   - "no value specified" / "no value given" (V3 sentinel placeholders
 *     when no barcode is configured — see `BARCODE_VALUE_PLACEHOLDERS`)
 *   - null (V3 docs § Returned values allow this; also the ?async=true
 *     behavior returns null even when the template HAS a barcode)
 *
 * The parser collapses both sentinel strings AND null to `null` via
 * `normalizeBarcodeValue()` (Q2 root-cause fix — production data
 * was previously storing the literal "no value specified" string).
 *
 * We accept BOTH the documented envelope shape AND the legacy / test-double
 * flat shape (where the per-pass fields sit at the top level). This
 * matches the same defensive pattern used in `extractTemplateId()` above.
 */
function extractPassIssueData(parsed: unknown): PassIssueResponse | null {
  if (typeof parsed !== 'object' || parsed === null) return null;
  const obj = parsed as Record<string, unknown>;

  // Preferred path: V3 envelope puts the per-pass runtime fields at
  // `data.{identifier, downloadPage, iPhoneUri, androidUri, barcodeValue}`.
  // The field is `downloadPage` (NOT `linkToPassPage` — that's V1's
  // single-link shape; V3 splits it into 3 URLs).
  const data = obj.data;
  if (typeof data === 'object' && data !== null) {
    const d = data as Record<string, unknown>;
    if (
      typeof d.identifier === 'string' &&
      typeof d.downloadPage === 'string' &&
      typeof d.iPhoneUri === 'string' &&
      typeof d.androidUri === 'string'
    ) {
      return {
        identifier: d.identifier,
        downloadPage: d.downloadPage,
        iPhoneUri: d.iPhoneUri,
        androidUri: d.androidUri,
        // Defensive normalize: collapse Passcreator's placeholder
        // strings ("no value specified" / "no value given" / "no
        // barcode" / "") AND `null` AND any non-string to `null`.
        // Real barcode values (numeric strings) pass through unchanged.
        barcodeValue: normalizeBarcodeValue(d.barcodeValue),
      };
    }
  }

  // Fallback: legacy / test-double flat shape. Accepts the V1
  // `linkToPassPage` shape AND the V3 `downloadPage` shape so the
  // wrapper keeps working with mocks / older fixtures.
  const legacyLink =
    (typeof obj.linkToPassPage === 'string' && obj.linkToPassPage) ||
    (typeof obj.downloadPage === 'string' && obj.downloadPage) ||
    null;
  if (typeof obj.identifier === 'string' && legacyLink !== null) {
    return {
      identifier: obj.identifier,
      downloadPage: legacyLink,
      // V3 split these into 2 URIs; legacy flat shape only has one.
      // We fall back to the same URL for both — frontend's user-agent
      // detection still works (Apple users go to downloadPage which
      // redirects to Wallet; Android users hit the same URL).
      iPhoneUri: legacyLink,
      androidUri: legacyLink,
      // Same defensive normalize applies to the legacy flat shape.
      barcodeValue: normalizeBarcodeValue(obj.barcodeValue),
    };
  }
  return null;
}

/**
 * Issue a per-pass wallet card via Passcreator V3.
 *
 * Invoked by `registerService` immediately after persisting a new
 * `pass_holders` row (or skipping for an existing row whose
 * `pass_identifier` is already populated — see Decision Log
 * § "Issue pass relation"). The returned object is the source of
 * truth for the row's V3 runtime columns.
 *
 * V3 contract (verified against
 * https://developer.passcreator.com/en/api/v3/pass § "Create a Pass",
 * captured 2026-10-19):
 *
 *   - URL:        POST https://app.passcreator.com/api/v3/pass?async=false
 *   - `async=false` URL param is REQUIRED — Passcreator defaults to
 *     `async=true`, which causes the V3 response to return success
 *     with `data.barcodeValue === null` even when the template has a
 *     barcode configured. The docs explicitly call this out:
 *       "If you need to see the actual barcodeValue in the JSON
 *        response body, you need to set async to false. Otherwise
 *        the system will not know it when the response is generated."
 *   - Body:        `{ data: { templateId, name, phone, birthday, email } }`
 *     The body MUST wrap all fields inside a `data` object. Additional
 *     template properties (like the 4 holder fields) go DIRECTLY
 *     inside `data` — NOT under an `additionalPropertyValues` wrapper
 *     (that field name does not exist on V3 create; V1 used it for
 *     the `passtemplate` URL param + zapierStyle=true approach).
 *   - Response:   `{ success, data: { identifier, downloadPage,
 *                    iPhoneUri, androidUri, barcodeValue, ... }, ... }`
 *
 * The function reuses the existing `passcreatorFetch` helper so the
 * 3-layer error envelope is identical to V2 surface:
 *   - network failure       → BadGatewayError kind='network'
 *   - 2xx non-JSON body     → BadGatewayError kind='invalid_response'
 *   - V2 error envelope     → BadGatewayError kind='upstream_rejected'
 *
 * @throws {BadGatewayError} when Passcreator returns an error, times
 *         out, or fails network. The error's `details.upstreamErrors`
 *         carries per-field reasons when the upstream envelope is
 *         parsed successfully (frontend banner can render "field N: reason M").
 *
 * @see runs/decisions/2026-10-19-pass-holder-v3-issuance.md
 * @see runs/improvements/feedback/20261019-pass-holder-v3-issuance-v3-contract-fix.md
 */
export async function issuePass(
  env: unknown,
  passcreatorTemplateId: string,
  holder: PassIssueHolderData,
): Promise<PassIssueResponse> {
  const e = requireEnv(env);

  const result = await passcreatorFetch(e, '/api/v3/pass?async=false', {
    method: 'POST',
    body: {
      // V3 contract: every request body field lives inside a top-level
      // `data` object (docs § "The following properties of the `data`
      // object can/must be submitted in the request body").
      data: {
        templateId: passcreatorTemplateId,
        // 4 holder fields go DIRECTLY inside `data` — V3 does NOT
        // distinguish primary/secondary per template; Passcreator
        // routes the values to the V2 placeholder addresses defined
        // on the template's `additionalProperties[]` (or, for
        // membership-style templates, the `primaryFields[0].key`
        // configured as `memberName` by
        // `apps/backend/src/modules/pass-templates/services/passTemplateMapping.ts`
        // — v12-followup, 2026-10-12).
        //
        // v3-fix-2026-10-19: the SAOME template mapping emits
        // `memberName` as `primaryFields[0].key` for `membership_card`
        // (and as the `additionalProperties[]` entry for any
        // cardType that has a membership-style field slot). The
        // `{memberName}` placeholder in the template resolves
        // against THIS body field name — sending `name` previously
        // left `memberName:` empty in Passcreator's dashboard
        // because Passcreator couldn't match the body field to the
        // configured placeholder key. See
        // `apps/backend/src/modules/pass-templates/services/passTemplateMapping.ts::primaryFields`.
        memberName: holder.name,
        phone: holder.phone,
        birthday: holder.birthday,
        email: holder.email,
      },
    },
  });

  const parsed = extractPassIssueData(result);
  if (parsed === null) {
    throw new BadGatewayError({
      upstream: 'passcreator',
      upstreamBody: `issue response missing identifier+downloadPage (expected data.identifier+data.downloadPage per https://developer.passcreator.com/en/api/v3/pass): ${JSON.stringify(result)}`,
    });
  }
  return parsed;
}

/**
 * Unify Passcreator's 2-tier barcode extraction logic.
 *
 * For `useAutoIdForValue=true` templates, Passcreator splits the
 * barcode data across two fields:
 *   - `data.barcodeValue` — often a literal placeholder string
 *     ("no value specified" / "no value given" / "no barcode" / "")
 *     or absent entirely. NEVER the real value for auto-gen templates.
 *   - `data.generatedId` (single-pass GET, SINGULAR)
 *     `data.autoGeneratedId` (LIST, PLURAL)
 *     — Passcreator's auto-generated ID, which IS the per-pass
 *     barcode rendered on the wallet pass.
 *
 * This helper accepts BOTH field-name variants and the two-tier
 * data layout, collapsing to:
 *   - Real barcode string when EITHER `barcodeValue` (post-normalize)
 *     OR the auto-gen ID field is a non-empty, non-placeholder string.
 *   - `null` when ALL three fields are placeholders / absent.
 *
 * @param barcodeValue - the value at `data.barcodeValue` (may be absent / placeholder)
 * @param autoGenId    - the value at `data.generatedId` OR
 *                       `data.autoGeneratedId` (may be absent)
 * @returns            - the real barcode OR `null`
 *
 * 2026-10-18 — P0 #4 barcode backfill. Production was persisting
 * `barcode_value = NULL` when the real value was sitting right
 * there in Passcreator's auto-gen fields. This helper is the
 * single source of truth for the backfill normalization.
 */
function extractBackfillBarcodeValue(
  barcodeValue: unknown,
  autoGenId: unknown,
): string | null {
  // Tier 1: barcodeValue (post-placeholder-normalize)
  const fromBarcode = normalizeBarcodeValue(barcodeValue);
  if (fromBarcode !== null) return fromBarcode;

  // Tier 2: auto-generated ID (single-pass GET `generatedId` /
  // LIST `autoGeneratedId`). Passcreator's auto-gen IDs are
  // alphanumeric strings like "zbood1tvxrvl31kv9e6ad3ef2f71561"
  // — no placeholder variants observed in the 2026-10-18 capture,
  // but apply the same defensive normalize in case a future
  // Passcreator release introduces one.
  const fromAutoGen = normalizeBarcodeValue(autoGenId);
  return fromAutoGen;
}

/**
 * Extract a backfill response from a V3 single-pass GET envelope.
 *
 * Single-pass GET envelope shape (live-captured 2026-10-18, see
 * `fixtures/passcreator/v3/v3-get-single.json`):
 *   {
 *     success: true,
 *     data: {
 *       identifier:      "5615a280-...",
 *       generatedId:     "zbood1tvxrvl31kv9e6ad3ef2f71561",  ← real barcode
 *       linkToPassPage:  "https://app.passcreator.com/en/p/...",
 *       // barcodeValue field is ABSENT for useAutoIdForValue=true templates
 *       // (NOT a placeholder string — Passcreator omits the field entirely)
 *       // ... plus many other fields irrelevant to backfill ...
 *     }
 *   }
 *
 * Returns `null` when `data.identifier` is missing — caller
 * surfaces as `BadGatewayError` so the registration flow can
 * gracefully skip backfill (the holder row keeps `barcode_value =
 * NULL` and the user can retry later).
 *
 * We deliberately accept MULTIPLE field-name variants for the
 * auto-gen ID:
 *   - `data.generatedId` (SINGULAR — V3 single-pass GET uses this)
 *   - `data.autoGeneratedId` (PLURAL — V3 LIST uses this; we accept
 *     it here too in case Passcreator normalizes the field name in
 *     a future release)
 *
 * `downloadPage` is mapped from `linkToPassPage` (the field name
 * V3 single-pass GET uses). V3-create's `downloadPage` field is
 * NOT present here — that field is exclusive to the create verb.
 */
function extractPassBackfillData(parsed: unknown): PassBackfillResponse | null {
  if (typeof parsed !== 'object' || parsed === null) return null;
  const obj = parsed as Record<string, unknown>;

  // Preferred path: V3 envelope puts the per-pass runtime fields
  // at `data.{identifier, linkToPassPage, generatedId}`.
  const data = obj.data;
  if (typeof data === 'object' && data !== null) {
    const d = data as Record<string, unknown>;
    if (typeof d.identifier === 'string' && typeof d.linkToPassPage === 'string') {
      // The auto-gen field name differs between single-pass GET
      // (`generatedId`, SINGULAR) and LIST (`autoGeneratedId`,
      // PLURAL). Accept both names; prefer the singular form when
      // both are present.
      const autoGenId = d.generatedId ?? d.autoGeneratedId;
      return {
        identifier: d.identifier,
        downloadPage: d.linkToPassPage,
        // iPhoneUri / androidUri may be absent on single-pass GET
        // (live capture didn't include them). Pass through null
        // when absent — the caller already has these from the
        // create-flow, so they're not strictly needed for backfill.
        iPhoneUri: typeof d.iPhoneUri === 'string' ? d.iPhoneUri : null,
        androidUri: typeof d.androidUri === 'string' ? d.androidUri : null,
        barcodeValue: extractBackfillBarcodeValue(d.barcodeValue, autoGenId),
      };
    }
  }
  return null;
}

/**
 * Get a single per-pass wallet pass from Passcreator by identifier.
 *
 * Used by the register service's backfill flow when a holder row has
 * no `pass_identifier` (new row, creation succeeded but save failed)
 * or when a holder has a `pass_identifier` but no runtime columns
 * (download URL, barcode). The returned `PassBackfillResponse` is
 * persisted to the holder row via `updatePassHolderIssuance`.
 *
 * V3 single-pass GET contract (live-captured 2026-10-18):
 *   GET https://app.passcreator.com/api/v3/pass/{identifier}
 *   → { success, data: { identifier, generatedId, linkToPassPage, ... } }
 *
 * @throws {BadGatewayError} when the response envelope is missing
 *         `data.identifier` or `data.linkToPassPage`, OR on any
 *         upstream network / HTTP failure. Callers may catch and
 *         skip backfill (the holder row keeps `barcode_value =
 *         NULL` and the user can retry later).
 */
export async function getPassByIdentifier(
  env: unknown,
  identifier: string,
): Promise<PassBackfillResponse> {
  const e = requireEnv(env);
  const result = await passcreatorFetch(
    e,
    `/api/v3/pass/${encodeURIComponent(identifier)}`,
    { method: 'GET' },
  );
  const parsed = extractPassBackfillData(result);
  if (parsed === null) {
    throw new BadGatewayError({
      upstream: 'passcreator',
      upstreamBody: `single-pass GET response missing identifier+linkToPassPage (expected data.identifier+data.linkToPassPage per https://developer.passcreator.com/en/api/v3/pass): ${JSON.stringify(result)}`,
    });
  }
  return parsed;
}

/**
 * List per-pass wallet passes for a template, filtered by identifier.
 *
 * FALLBACK backfill path. Used when `getPassByIdentifier` is
 * unavailable (network race, Passcreator contract drift, etc.).
 * Returns the matched pass(es) filtered by `identifier` — for the
 * backfill use case, the caller passes the just-issued identifier
 * and gets back a 0-or-1-element array.
 *
 * V3 LIST contract (live-captured 2026-10-18):
 *   GET https://app.passcreator.com/api/v3/pass?templateId={id}&identifier={id}
 *   → { success, data: [{ identifier, linkToPassPage, autoGeneratedId, ... }] }
 *
 * V3 LIST envelope puts the items at `data[]` (NOT `data{}`). The
 * single-pass GET uses `data{}` — these are two distinct envelope
 * shapes. We only iterate `data[]` here.
 *
 * @throws {BadGatewayError} on upstream network / HTTP failure.
 */
export async function listPasses(
  env: unknown,
  options: { templateId: string; identifier?: string },
): Promise<PassBackfillResponse[]> {
  const e = requireEnv(env);

  // Build the query string. Passcreator's V3 LIST accepts
  // `templateId` and `identifier` as query parameters; both are
  // URL-encoded to be safe against special characters in
  // Passcreator's UUIDs.
  const params = new URLSearchParams();
  params.set('templateId', options.templateId);
  if (options.identifier !== undefined) {
    params.set('identifier', options.identifier);
  }
  const path = `/api/v3/pass?${params.toString()}`;

  const result = await passcreatorFetch(e, path, { method: 'GET' });

  if (typeof result !== 'object' || result === null) return [];
  const obj = result as Record<string, unknown>;

  // V3 LIST envelope puts the items at `data[]` (NOT `data{}`).
  // The single-pass GET uses `data{}` — these are two distinct
  // envelope shapes. We only iterate `data[]` here.
  const data = obj.data;
  if (!Array.isArray(data)) return [];

  // Optional filter: when `options.identifier` is provided, only
  // return the matching item. Passcreator's `?identifier=` filter
  // is server-side, but we ALSO client-filter for robustness
  // against Passcreator returning extra rows in some cases
  // (observed during the 2026-10-18 probe — `data[]` was paginated
  // and contained 100 of 221 passes, not all of which matched).
  const out: PassBackfillResponse[] = [];
  for (const rawItem of data) {
    if (typeof rawItem !== 'object' || rawItem === null) continue;
    const item = rawItem as Record<string, unknown>;
    if (typeof item.identifier !== 'string') continue;
    if (typeof item.linkToPassPage !== 'string') continue;
    if (
      options.identifier !== undefined &&
      item.identifier !== options.identifier
    ) {
      continue;
    }
    const autoGenId = item.generatedId ?? item.autoGeneratedId;
    out.push({
      identifier: item.identifier,
      downloadPage: item.linkToPassPage,
      iPhoneUri: typeof item.iPhoneUri === 'string' ? item.iPhoneUri : null,
      androidUri: typeof item.androidUri === 'string' ? item.androidUri : null,
      barcodeValue: extractBackfillBarcodeValue(item.barcodeValue, autoGenId),
    });
  }
  return out;
}
