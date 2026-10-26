/**
 * Public DTOs for the pass-templates module.
 *
 * @module shared/contracts/passTemplates
 * @description Cross-package contract used by the public, no-auth endpoints
 * (`GET /api/pass-templates/:id/public`, `POST /api/pass-templates/:id/register`).
 *
 * Layer mapping (Rule 019 § 4.1):
 *   - Layer 1: packages/shared/types/passHolder.ts::PublicPassTemplate
 *   - Layer 2: this file (backend DTO mirror, no runtime cross-package dep)
 *   - Layer 3: db/templates.ts::PublicTemplateRow (DB row shape)
 *   - Layer 4: services/getPublicService.ts (service param types)
 *
 * Why this exists:
 *   - Backend MUST NOT directly import from `@saome/shared/types` in services
 *     (avoids dragging React / i18n deps into Worker bundle, and keeps the
 *     runtime contract decoupled).
 *   - This file is a hand-maintained mirror of `PublicPassTemplate`. The
 *     conformance test in `apps/backend/src/modules/pass-templates/tests/`
 *     pins the field set in place — drift triggers test failure.
 *
 * Decision log: runs/decisions/2026-09-29-pass-templates-public-endpoint.md
 *   § Decision 3 (tenant isolation: no tenant_id in public response).
 */

import type { CardLanguage, CardType } from '@saome/shared/schemas/card';
import type { Currency } from '@saome/shared/schemas/card';
import type {
  PublicGiftCardConfig,
  PublicMembershipTier,
} from '@saome/shared/types/passHolder';

/**
 * Public-safe subset of a card template.
 *
 * Explicitly EXCLUDES:
 *   - `tenant_id` (would leak multi-tenant isolation)
 *   - `status` (would leak draft/abandoned lifecycle)
 *   - `settings` (would leak internal fields like `barcodeType`, `currency`,
 *      `passValidDays`, etc. that have no use for an anonymous visitor)
 *   - `created_by` / `updated_by` (would leak operator identity)
 *   - `expires_at` (would leak retention policy)
 *
 * KEEP IN SYNC with packages/shared/types/passHolder.ts::PublicPassTemplate.
 */
export interface PublicPassTemplateDto {
  /** Template UUID. */
  id: string;
  /** Display name shown to the holder (e.g. "Café Rewards"). */
  name: string;
  /** Card design type — drives which extension fields render in the editor. */
  cardType: CardType;
  /** Logo text shown on the pass header (next to issuer logo). */
  logoText: string;
  /** Issuer name shown in the page subtitle. */
  issuerName: string;
  /**
   * Page language ('zh-TW' | 'en') — read from
   * `templates.settings->>'language'` (JSONB) and projected to the
   * frontend so it can `applyPageLanguage(language)` on template load.
   * Source of truth mirrors `languageSchema` in
   * `packages/shared/schemas/card/enums.ts`. Added 2026-10-01 per plan
   * `runs/decisions/2026-10-01-pass-holder-language.md` (decision pending).
   */
  language: CardLanguage;
  /** Optional absolute URL for the issuer logo. */
  issuerLogo?: string;
  /** Optional pass background color hex (e.g. `#0F0F23`). */
  backgroundColor?: string;
  /** Optional pass text color hex (e.g. `#F8FAFC`). */
  textColor?: string;
  /**
   * 2026-10-16 — paid-membership extension. Optional currency code
   * drives the simulated payment button (TWD → Ecpay, ZAR → Payfast).
   * Mirrors `settings->>'currency'` (JSONB) on the `public.templates`
   * row. Defaults to TWD when missing (legacy rows). Source of truth is
   * `Currency` in `packages/shared/schemas/card/enums.ts`.
   */
  currency?: Currency;
  /**
   * 2026-10-16 — paid-membership extension. When true, the public
   * pass-registration page renders the membership-tier picker +
   * simulated payment flow below the 4 pass-delivery fields. Mirrors
   * `settings->>'isPaid'` (JSONB).
   */
  isPaid?: boolean;
  /**
   * 2026-10-16 — paid-membership extension. List of membership tiers.
   * When `isPaid === true` AND `membershipTiers.length > 0` the page
   * surfaces a Radio Card list. Mirrors `settings->'membershipTiers'`
   * (JSONB); the service normalizes the free-form JSONB shape into the
   * typed `PublicMembershipTier[]` contract.
   */
  membershipTiers?: ReadonlyArray<PublicMembershipTier>;
  /**
   * 2026-10-23 — gift-card purchase configuration. Only emitted when
   * `cardType === 'gift_card'` AND the tenant configured a usable rate
   * (the service normalizes the free-form JSONB into a typed config and
   * returns `null` for a partial / corrupt row, in which case this field
   * is omitted entirely).
   *
   * Unlike `isPaid` / `membershipTiers`, this is NOT behind `is_paid`: a
   * gift card is not a "paid membership card", it merely requires a
   * purchase. `currency` is emitted alongside it so the public page can
   * resolve the payment provider (TWD → 綠界, ZAR → Payfast).
   *
   * Mirrors `packages/shared/types/passHolder.ts::PublicGiftCardConfig`.
   */
  giftCard?: PublicGiftCardConfig;
}

/**
 * Phone country code. Per plan 2026-09-28 only two codes are supported
 * (Taiwan + South Africa). Extend when onboarding new regions.
 */
export type PassHolderPhoneCountryCodeDto = '+886' | '+27';

/**
 * Form payload for `POST /api/pass-templates/:id/register`.
 *
 * Mirrors `packages/shared/types/passHolder.ts::PassHolderPayload`. The
 * 4 pass-delivery fields stay required; the 5 paid-membership fields are
 * optional (only present when the template is a paid membership card).
 * `currency` defaults to TWD in the DB layer (migration 023 backfill).
 */
export interface PassHolderRegisterPayloadDto {
  /** Holder name shown on the pass itself. */
  name: string;
  /** Phone country code (currently +886 or +27). */
  phoneCountryCode: PassHolderPhoneCountryCodeDto;
  /** Phone number digits only, 6-15 chars per backend regex. */
  phoneNumber: string;
  /** ISO birthday YYYY-MM-DD; holder must be ≥ 13 years old. */
  birthday: string;
  /** Email used by Apple/Google Wallet to deliver the pass link. */
  email: string;
  // ================================================================
  // 2026-10-16 — paid-membership extension (Rule 019 § 4.1 quad-binding)
  // ================================================================
  /** 0-based index into the template's `membershipTiers[]`. */
  selectedTierIndex?: number;
  /** Frozen snapshot of the selected tier (JSONB-safe). */
  membershipTierSnapshot?: unknown;
  /** 'payfast' (ZAR) | 'ecpay' (TWD). */
  paymentProvider?: 'payfast' | 'ecpay';
  /**
   * 'pending' (default) | 'completed' | 'failed' | 'not_required'.
   */
  paymentStatus?: 'pending' | 'completed' | 'failed' | 'not_required';
  /**
   * 2026-10-23 — gift-card extension. Points the customer purchased.
   * Required when the template is a `gift_card`; the backend re-derives
   * the currency amount from the template's own `giftCard*` settings and
   * NEVER trusts a client-supplied price (see
   * `runs/decisions/2026-10-23-gift-card-paid-registration.md`).
   *
   * Optional for every other card type — a stamp / reward / membership
   * holder has no purchased points.
   */
  purchasedPoints?: number;
}

/**
 * Response body for `POST /api/pass-templates/:id/register`.
 *
 * The endpoint is idempotent on (template_id, email): re-registering the
 * same email against the same template returns the existing passHolderId.
 * See `pass_holders_template_email_unique` UNIQUE constraint.
 *
 * 2026-10-19 — `issuance` field added for the V3 per-pass runtime
 * integration (`POST /api/v3/pass`). When `issuance` is omitted, the
 * holder row was persisted but the Passcreator call was not attempted
 * (e.g. test mocks); when `issuance.issuanceError` is set, the call
 * failed and `downloadUrl` / `barcodeValue` may be absent. See
 * `runs/decisions/2026-10-19-pass-holder-v3-issuance.md`.
 */
export interface PassHolderRegisterResponseDto {
  ok: true;
  /** UUID of the (existing or newly created) pass_holders row. */
  passHolderId: string;
  /** True if a new row was inserted; false if an existing row was returned. */
  created: boolean;
  /**
   * Optional per-pass runtime artifact. Backend attempts to issue the
   * pass via Passcreator V3 immediately after registering the holder;
   * the response includes this field when the attempt completed
   * (success OR failure with i18n key). Frontend uses `downloadUrl`
   * for the .pkpass CTA + `barcodeValue` for in-page display; when
   * `issuanceError` is set, render a retry banner.
   */
  issuance?: PassHolderIssuanceDto;
}

/**
 * Per-pass runtime artifact returned by Passcreator V3.
 *
 * Mirrors `packages/shared/types/passHolder.ts::PassHolderIssuance`.
 * All fields optional because issuance can fail mid-call (network,
 * upstream timeout, etc.); the holder row stays persisted either way.
 *
 * Layer 2 of 4 per Rule 019 § 4.1:
 *   - Layer 1: packages/shared/types/passHolder.ts::PassHolderIssuance
 *   - Layer 2: this interface (backend DTO mirror)
 *   - Layer 3: db/passHolders.ts::PassHolderRow (DB row shape)
 *   - Layer 4: services/registerService.ts (assembled inside the service)
 *
 * 2026-10-19 — V3 keys per the developer.passcreator.com V3 docs:
 *   - passIdentifier  ← V3 `data.identifier`
 *   - downloadPage    ← V3 `data.downloadPage` (universal landing page)
 *   - iPhoneUri       ← V3 `data.iPhoneUri` (direct .pkpass for Apple Wallet)
 *   - androidUri      ← V3 `data.androidUri` (Google Pay deeplink)
 *   - barcodeValue    ← V3 `data.barcodeValue` (nullable when absent OR
 *                       when the request was sent without `?async=false`)
 *   - issuedAt        ← ISO 8601 UTC (e.g. `2026-10-19T08:42:13.123Z`)
 *   - issuanceError   ← i18n key when failed (e.g. `common.error.upstreamFailed`)
 *
 * NOTE on field name history:
 *   The pre-fix shape had `downloadUrl` mapped from V1's
 *   `data.linkToPassPage`. V3 docs (verified 2026-10-19) return
 *   `data.downloadPage` as the universal landing page; the .pkpass
 *   direct link is `data.iPhoneUri` (new in V3). This contract
 *   rename was the root-cause fix for the "registration succeeds but
 *   no pass arrives" regression — see
 *   `runs/improvements/feedback/20261019-pass-holder-v3-issuance-v3-contract-fix.md`.
 */
export interface PassHolderIssuanceDto {
  passIdentifier?: string;
  /**
   * Universal Passcreator landing page URL (Apple Safari → opens
   * Wallet; Android Chrome → opens Google Wallet). This is the
   * safest single link to surface when the frontend doesn't do
   * user-agent detection.
   */
  downloadPage?: string;
  /** Direct .pkpass link for Apple Wallet / Passwallet (iOS users). */
  iPhoneUri?: string;
  /** Google Pay / Passwallet deeplink (Android users). */
  androidUri?: string;
  barcodeValue?: string | null;
  /** ISO 8601 timestamp (UTC); e.g. `2026-10-19T08:42:13.123Z`. */
  issuedAt?: string;
  /** i18n key the frontend should render in the error banner. */
  issuanceError?: string;
}

/**
 * Response body for `GET /api/pass-templates/:id/public`.
 */
export interface PublicPassTemplateResponseDto {
  template: PublicPassTemplateDto;
}