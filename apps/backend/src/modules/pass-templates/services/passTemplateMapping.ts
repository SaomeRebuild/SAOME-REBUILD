/**
 * Passcreator template body mapping — DB row → upstream request body.
 *
 * @module modules/pass-templates/services/passTemplateMapping
 * @description Pure function that converts a SAOME `TemplatesRow` into
 * the JSON body that the Passcreator V2 API expects for
 * `POST /api/v2/passes/templates` and `PUT /api/v2/passes/templates/:id`.
 *
 * Architecture (v4 plan):
 *   - This is a PURE function. No SQL, no fetch, no env reads. Caller
 *     passes `language` explicitly so the labels can be sourced from
 *     `@saome/shared/i18n/fieldLabels` (single source of truth).
 *   - The mapping module owns the *shape*; `passTemplateSync` owns the
 *     *transport* (create vs update, error handling). Keeping them split
 *     makes the shape unit-testable without HTTP mocks.
 *
 * What the mapping does:
 *   1. Projects SQL `templates.name` → Passcreator `name`.
 *   2. Projects SQL `templates.settings.logoText` (Step 2) → `name` if
 *      `name` is empty (Passcreator requires a non-empty `name`).
 *   3. Projects SQL `templates.settings.issuerName` (Step 2) →
 *      `organizationName` (Apple Wallet convention).
 *   4. Projects SQL `templates.settings.description` (Step 4) →
 *      `description`.
 *   5. Projects `settings.backgroundColor / textColor` (Step 3) → `colors`.
 *      Strip the leading `#` because Passcreator contract is bare 6-char hex.
 *   6. Projects `settings.barcodeType` (Step 2) → `barcode.format` enum.
 *   7. Builds `fields` (header / primary / secondary / back):
 *      - `headerFields` and `primaryFields` and `secondaryFields` use
 *        `settings.leftField` and `settings.rightField` (Step 3) with
 *        LABELS sourced from `getFieldLabelMap(language)`. Values are
 *        empty strings (deferred to per-pass runtime).
 *      - `backFields` use the user-authored `settings.backFields` array
 *        verbatim (label = user-typed string, value = user-typed string).
 *   8. Builds `images` from `settings.issuerLogo / iconImage` etc.
 *      When the value is a JSONB R2 key, we convert it to the public R2 URL.
 *
 * What the mapping does NOT do (deferred):
 *   - Pass issuance (the per-member pass object). That's a different
 *     flow: `POST /api/pass-templates/:id/issue-pass`. Out of scope for
 *     Step 8.
 *   - Real member-row data in `headerFields[].value` etc. Step 8 only
 *     pushes the *template*; per-pass values are filled in at issuance
 *     time.
 *   - Translation of `backFields[].label` to the user-locale string.
 *     Per design (2026-10-11), back fields are user input — they were
 *     authored in a specific locale and we don't second-guess them.
 *
 * Rule references:
 *   - Rule 000 Part C.2 — third-party mapping: pure function, no
 *     transport, fully unit-testable.
 *   - Rule 019 § 4.1 — `TemplateSettings` is the source of truth (Layer 3).
 *   - Rule 019 § D.3 — third-party API is a contract; mapping is the
 *     one place we serialize to that contract.
 *
 * @see runs/decisions/2026-10-11-step8-passcreator-push.md
 */

import type { Sql } from '@/shared/db/client';
import type { TemplatesRow } from '@/modules/cards/db/templates';
import type { PassLanguage } from '@saome/shared/i18n/fieldLabels';
import { getFieldLabel, getFieldLabelMap } from '@saome/shared/i18n/fieldLabels';
import type { PasscreatorTemplateBody } from '@/shared/lib/passcreator';

/**
 * Mapping options.
 *
 * `r2PublicUrl` is the env-derived base URL for the R2 bucket — used to
 * convert R2 keys (`{tenant_id}/{template_id}/logo.png`) to absolute
 * public URLs that Passcreator can fetch at template-creation time.
 *
 * `logoText` is the Step 2 logo text — separate from `templates.name`
 * (which is the Card Name). Passcreator's `name` field accepts either;
 * we prefer `name` and fall back to `logoText` so the deployed pass has
 * a sensible display title.
 */
export interface MapTemplateToPasscreatorArgs {
  template: TemplatesRow;
  language: PassLanguage;
  r2PublicUrl: string;
  /**
   * Optional env-derived pass type id override. Defaults to
   * `templates.settings.passTypeId` if the editor ever adds that field
   * (future); currently hard-coded to env-driven
   * `PASSCREATOR_PASS_TYPE_ID` so we ignore this. Reserved.
   */
  passTypeId?: string;
}

/**
 * Strip the leading `#` from a hex color (Passcreator contract uses
 * 6-char uppercase hex WITHOUT `#` — same as the Passcreator badge
 * upload endpoint, see Bug-8 PR-5).
 *
 * Defensive: handles missing/undefined input by returning an empty
 * string. Passcreator accepts empty colors and falls back to the
 * pass-type default.
 */
function stripHexHash(value: string | undefined | null): string {
  if (!value) return '';
  return value.replace(/^#/, '').toUpperCase();
}

/**
 * Convert an R2 key (e.g. `{tenant_id}/{template_id}/logo.png`) to a
 * public URL the Passcreator API can fetch. When the input is already
 * an absolute URL (legacy / pre-R2 migration), return it as-is.
 *
 * Returns empty string when the key is empty — Passcreator accepts
 * missing image fields and falls back to the pass-type default logo.
 */
function r2KeyToPublicUrl(key: string | undefined | null, r2PublicUrl: string): string {
  if (!key) return '';
  if (/^https?:\/\//i.test(key)) return key;
  // Strip leading slash; concat with r2PublicUrl.
  const base = r2PublicUrl.replace(/\/$/, '');
  const path = key.replace(/^\//, '');
  return `${base}/${path}`;
}

/**
 * Map a `barcodeType` value (Step 2) to the Passcreator `PKBarcodeFormat*`
 * enum. The schema constrains `barcodeType` to `'qr_code' | 'pdf_417'`,
 * so the exhaustive switch is type-safe.
 *
 * Defaults to `PKBarcodeFormatQR` for unknown values — safer than
 * throwing because the editor's zod validation prevents unknowns in
 * production, but a corrupted row from a legacy migration could surface.
 */
function mapBarcodeFormat(barcodeType: TemplatesRow['settings']['barcodeType']): 'PKBarcodeFormatQR' | 'PKBarcodeFormatPDF417' {
  switch (barcodeType) {
    case 'pdf_417':
      return 'PKBarcodeFormatPDF417';
    case 'qr_code':
    case undefined:
    case null:
    default:
      return 'PKBarcodeFormatQR';
  }
}

/**
 * Build the `fields` block for a single side of the pass.
 *
 * Each `headerField` / `primaryField` / `secondaryField` has shape:
 *   { key: CardFieldKey, label: string (localized), value: '' }
 *
 * The `value` is left empty for the template — at issuance time the
 * per-pass code reads the member row and injects the real value.
 * `backFields` use user-typed `label` (not the localized label) and
 * `value` from `settings.backFields[*]`.
 *
 * `cardType` is threaded through so `getFieldLabel` can apply the
 * memberLevel cardType-aware override (see `fieldLabels.ts` for the
 * full rationale). Without it, a stamp_card's `memberLevel` slot
 * would push 「會員等級」 (zh-TW) / "Member Level" (en) to Passcreator
 * even though the editor renders 「獎勵」 / "Reward" in the same
 * slot — silent drift between editor preview and deployed pass.
 */
function buildFieldRows(args: {
  fieldKey: TemplatesRow['settings']['leftField'] | TemplatesRow['settings']['rightField'];
  language: PassLanguage;
  cardType: TemplatesRow['card_type'];
  value: string;
}): { key: string; label: string; value: string } {
  const label = args.fieldKey
    ? getFieldLabel(args.fieldKey, args.language, args.cardType)
    : '';
  return {
    key: args.fieldKey ?? '',
    label: label ?? '',
    value: args.value,
  };
}

/**
 * Map a SAOME `TemplatesRow` to a `PasscreatorTemplateBody`.
 *
 * Pure function — no SQL, no fetch, no env. The caller supplies
 * everything we need to build the upstream body. This makes the
 * mapping unit-testable without HTTP mocks (see
 * `passTemplateMapping.test.ts`).
 *
 * Defensive: when an optional field is missing, we send an empty
 * string (Passcreator accepts empty values and falls back to pass-type
 * defaults). When a required field is missing, we DO throw — better
 * to surface the data integrity issue than to silently corrupt the
 * Passcreator template.
 */
export function mapTemplateToPasscreator(args: MapTemplateToPasscreatorArgs): PasscreatorTemplateBody {
  const { template, language, r2PublicUrl } = args;
  const s = template.settings ?? ({} as TemplatesRow['settings']);

  // Passcreator's `name` is required. Prefer templates.name (Card Name),
  // fall back to settings.logoText, then to a generic default.
  const name = (template.name && template.name.trim()) || s.logoText || 'Untitled Card';

  // headerField / primaryField / secondaryField — driven by Step 3 leftField/rightField.
  // We populate BOTH slots with the left and right field keys, leaving
  // values empty (the per-pass runtime injects real member-row values).
  //
  // We use the per-key `getFieldLabel(key, language, cardType)` call
  // (not the bulk `getFieldLabelMap`) so the `memberLevel` cardType-aware
  // override is applied — see `fieldLabels.ts` for the rationale. The
  // bulk map is still re-exported below for downstream consumers.
  const headerFields = s.leftField
    ? [{ key: s.leftField, label: getFieldLabel(s.leftField, language, template.card_type) ?? '', value: '' }]
    : [];
  const primaryFields = s.rightField
    ? [{ key: s.rightField, label: getFieldLabel(s.rightField, language, template.card_type) ?? '', value: '' }]
    : [];
  // secondaryFields are intentionally empty for v1 — PassKit supports
  // them but the editor doesn't author them yet. Empty array is fine
  // (Passcreator ignores empty fields).
  const secondaryFields: Array<{ key: string; label: string; value: string }> = [];

  // backFields — user-authored label/value pairs from Step 4. The
  // label is the USER's typed string (in the locale they typed it),
  // not the localized CardFieldKey label.
  const backFields = (s.backFields ?? []).map((row) => ({
    key: '',
    label: row.label,
    value: row.value,
  }));

  return {
    passTypeId: args.passTypeId ?? 'pass.saome.org.passcreator',
    name,
    description: s.description ?? '',
    organizationName: s.issuerName ?? '',
    colors: {
      backgroundColor: stripHexHash(s.backgroundColor),
      foregroundColor: stripHexHash(s.textColor),
    },
    barcode: {
      format: mapBarcodeFormat(s.barcodeType),
    },
    images: {
      icon: r2KeyToPublicUrl(s.iconImage, r2PublicUrl),
      logo: r2KeyToPublicUrl(s.issuerLogo, r2PublicUrl),
      strip: r2KeyToPublicUrl(s.backgroundImage, r2PublicUrl),
    },
    fields: {
      headerFields,
      primaryFields,
      secondaryFields,
      backFields,
    },
  };
}

/**
 * Build a `Record<CardFieldKey, string>` from the labels in a given
 * language. Re-exports the shared helper so this module's surface is
 * self-contained for downstream consumers.
 */
export { getFieldLabelMap };
