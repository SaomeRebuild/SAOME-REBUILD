/**
 * Passcreator V3 per-pass types + shared field types.
 *
 * @module shared/lib/passcreator/v3-pass-types
 *
 * `PasscreatorFieldType` is shared between V2 template bodies and V3
 * per-pass operations — defined here so both v2-template-types.ts and
 * v3-pass.ts import from a single source.
 */

export type PasscreatorFieldType =
  | 'text'
  | 'date'
  | 'number'
  | 'currency'
  | 'barcode';

/**
 * Placeholder strings Passcreator returns in `data.barcodeValue`
 * when a template has NO barcode configured. Live V3 capture
 * (2026-10-17, runs/improvements/feedback/20261018-passcreator-v3-capture.md)
 * confirmed at least 2 of these in the wild:
 *
 *   - "no value specified"  — V3 CREATE response (Q2 root cause:
 *                             production `pass_holders.barcode_value`
 *                             was literally this string instead of NULL)
 *   - "no value given"      — V3 LIST response (per item, no barcode)
 *
 * Two more are observed in Passcreator error messages / docs:
 *
 *   - "no barcode"
 *   - "" (empty string)
 *
 * Any of these in `data.barcodeValue` is normalized to `null` by
 * `normalizeBarcodeValue()` so the SAOME DB stores `barcode_value =
 * NULL` instead of a Passcreator-internal sentinel value as if it
 * were a real barcode. If Passcreator introduces a NEW placeholder
 * string in a future release, add it here AND extend the conformance
 * tests in `passcreator.test.ts > "barcodeValue defensive normalize"`.
 */
export const BARCODE_VALUE_PLACEHOLDERS: ReadonlySet<string> = new Set([
  'no value given',
  'no value specified',
  'no barcode',
  '',
]);

/**
 * Per-pass issuance holder payload.
 *
 * Mirrors `packages/shared/types/passHolder.ts::PassHolderPayload`
 * (the source of truth — Rule 019 § 4.1 Layer 1). Only the four
 * fields V3 needs are typed here; tier / payment metadata is
 * persisted on the SAOME side but never sent upstream.
 */
export interface PassIssueHolderData {
  /**
   * Holder name shown on the pass.
   *
   * Mapped to `data.memberName` on the V3 wire (NOT `data.name`) —
   * the SAOME template mapping emits `memberName` as
   * `primaryFields[0].key` for `membership_card` and as the
   * `additionalProperties[]` entry for any cardType that has a
   * membership-style field slot. Passcreator resolves the
   * `{memberName}` placeholder against this body field name, so
   * sending `name` here would leave `memberName:` empty in the
   * rendered pass.
   *
   * See `apps/backend/src/modules/pass-templates/services/passTemplateMapping.ts::primaryFields`
   * (v12-followup, 2026-10-12) and the v3-fix-2026-10-19
   * conformance tests in `passcreator.test.ts`.
   */
  name: string;
  /** E.164 phone number: country code + digits (e.g. `+886912345678`). */
  phone: string;
  /** ISO birthday YYYY-MM-DD (already validated ≥ 13 years). */
  birthday: string;
  /** Email used by Apple/Google Wallet to deliver the pass link. */
  email: string;
}

/**
 * V3 per-pass runtime artifact — the normalized response shape.
 *
 * Layer 2 of 4 per Rule 019 § 4.1 (mirrors the Layer 1
 * `PassHolderIssuanceDto` in `shared/contracts/passTemplates.ts`):
 *
 * Real V3 response shape (verified against
 * https://developer.passcreator.com/en/api/v3/pass § "Create a Pass" →
 * "Returned values", captured 2026-10-19):
 *   data: {
 *     identifier:      "<per-pass UUID>",                    // ← per-pass id
 *     downloadPage:    "https://app.passcreator.com/p/<id>",  // ← universal landing page
 *                                                               //    (device-sniffs Apple vs Google)
 *     iPhoneUri:       "https://app.passcreator.com/<file>.pkpass", // ← direct .pkpass link
 *     androidUri:      "https://pay.google.com/save/<...>",   // ← Google Wallet deeplink
 *     barcodeValue:    "<string|null>",
 *     bundleId:        "<string|null>",
 *     genericProperties: { ... },
 *   }
 *
 * V1 used `linkToPassPage` (a single universal link). V3 splits it
 * into `downloadPage` (universal landing page with device sniffing),
 * `iPhoneUri` (direct .pkpass for Apple Wallet / Passwallet), and
 * `androidUri` (Google Pay / Passwallet deeplink). The frontend uses
 * user-agent detection to pick which URL to surface as the download CTA.
 *
 * `firstDownloadedAt` / `expirationDate` are NOT surfaced today —
 * retention / expiry tracking is a separate subsystem.
 */
export interface PassIssueResponse {
  /** Per-pass UUID issued by Passcreator. */
  identifier: string;
  /**
   * Universal landing page URL (Apple Safari → redirects to Wallet;
   * Android Chrome → opens Google Wallet).
   * Source: V3 `data.downloadPage`.
   */
  downloadPage: string;
  /**
   * Direct .pkpass link for Apple Wallet / Passwallet. Frontend can
   * surface this as the "Add to Apple Wallet" CTA on Apple devices.
   * Source: V3 `data.iPhoneUri`.
   */
  iPhoneUri: string;
  /**
   * Direct Google Pay / Passwallet deeplink. Frontend can surface
   * this as the "Save to Android" CTA on Android devices.
   * Source: V3 `data.androidUri`.
   */
  androidUri: string;
  /**
   * Barcode payload rendered on the pass (string or null when no
   * barcode configured). Source: V3 `data.barcodeValue`.
   */
  barcodeValue: string | null;
}

/**
 * Backfill response shape for a single per-pass wallet pass.
 *
 * Returned by `getPassByIdentifier` and (per array entry) by
 * `listPasses`. The 5 fields mirror the `PassIssueResponse` shape
 * so the registerService can persist them via the same UPDATE path
 * as the create-flow (`updatePassHolderIssuance`).
 *
 * `barcodeValue` semantics differ from the create-flow:
 *   - `issuePass` returns `barcodeValue` verbatim from V3 (often a
 *     placeholder like "no value specified" → normalized to null).
 *   - `getPassByIdentifier` / `listPasses` go one level deeper: when
 *     `barcodeValue` is a placeholder OR absent, the helper falls
 *     back to `generatedId` (single-pass GET) or `autoGeneratedId`
 *     (LIST). For templates with `useAutoIdForValue=true`, this
 *     field IS the real per-pass barcode rendered on the wallet
 *     pass. See `extractBackfillBarcodeValue` for the unified
 *     extraction logic.
 *
 * `downloadPage` (single-pass GET and LIST both return the V1
 * field name `linkToPassPage` rather than V3-create's `downloadPage`)
 * is mapped to `downloadPage` here for consistency with
 * `PassIssueResponse`. The frontend uses `pickDownloadUri()` to
 * pick the right URI based on user-agent.
 */
export interface PassBackfillResponse {
  /** Per-pass UUID — matches `data.identifier`. */
  identifier: string;
  /**
   * Universal landing page URL. Source: V3 single-pass GET
   * `data.linkToPassPage` / V3 LIST `data[].linkToPassPage`. Both
   * endpoints use the V1 field name (NOT V3-create's
   * `downloadPage`).
   */
  downloadPage: string;
  /** iPhoneUri (Apple Wallet / Passwallet). May be null on single-pass GET. */
  iPhoneUri: string | null;
  /** androidUri (Google Pay / Passwallet). May be null on single-pass GET. */
  androidUri: string | null;
  /**
   * Real per-pass barcode payload. Returns `null` for templates
   * without a barcode config. For templates with
   * `useAutoIdForValue=true`, this is the `generatedId` /
   * `autoGeneratedId` (Passcreator's auto-generated ID).
   */
  barcodeValue: string | null;
}
