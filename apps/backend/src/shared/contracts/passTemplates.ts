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

import type { CardType } from '@saome/shared/schemas/card';

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
  /** Optional absolute URL for the issuer logo. */
  issuerLogo?: string;
  /** Optional pass background color hex (e.g. `#0F0F23`). */
  backgroundColor?: string;
  /** Optional pass text color hex (e.g. `#F8FAFC`). */
  textColor?: string;
}

/**
 * Phone country code. Per plan 2026-09-28 only two codes are supported
 * (Taiwan + South Africa). Extend when onboarding new regions.
 */
export type PassHolderPhoneCountryCodeDto = '+886' | '+27';

/**
 * Form payload for `POST /api/pass-templates/:id/register`.
 *
 * Mirrors `packages/shared/types/passHolder.ts::PassHolderPayload`.
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