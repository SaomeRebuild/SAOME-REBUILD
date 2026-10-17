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
import type { PublicMembershipTier } from '@saome/shared/types/passHolder';

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
   * `packages/shared/schemas/card.ts`. Added 2026-10-01 per plan
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
   * `Currency` in `packages/shared/schemas/card.ts`.
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
  /** 'pending' (default) | 'completed' | 'failed'. */
  paymentStatus?: 'pending' | 'completed' | 'failed';
}

/**
 * Response body for `POST /api/pass-templates/:id/register`.
 *
 * The endpoint is idempotent on (template_id, email): re-registering the
 * same email against the same template returns the existing passHolderId.
 * See `pass_holders_template_email_unique` UNIQUE constraint.
 */
export interface PassHolderRegisterResponseDto {
  ok: true;
  /** UUID of the (existing or newly created) pass_holders row. */
  passHolderId: string;
  /** True if a new row was inserted; false if an existing row was returned. */
  created: boolean;
}

/**
 * Response body for `GET /api/pass-templates/:id/public`.
 */
export interface PublicPassTemplateResponseDto {
  template: PublicPassTemplateDto;
}