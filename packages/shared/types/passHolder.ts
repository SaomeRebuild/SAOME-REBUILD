/**
 * Pass Holder Types — cross-package contract for the public "Get Pass" page.
 *
 * @module shared/types/passHolder
 *
 * Concept (per plan 2026-09-28):
 *   - "Pass Holder" (this file's subject) is the wallet-card end-user. They
 *     DO NOT log into SAOME; they only install a pass to their phone. The
 *     4 captured fields are pass-delivery / display data, NOT login
 *     credentials.
 *   - "SAOME Platform Member" (existing `member` schema) is a Dashboard
 *     user with email + password + tier + role. The two concepts are
 *     intentionally decoupled.
 *
 * Future backend writes should target the NEW table `public.pass_holders`
 * (id, template_id, name, phone_country_code, phone_number, birthday,
 * email, created_at, updated_at) — NOT `public.members`.
 */

import type { CardLanguage, CardType } from '../schemas/card';

/**
 * Public-safe subset of a card template. Excludes sensitive fields like
 * `tenant_id` / `status` that would leak tenant information to anonymous
 * visitors. Used by `GET /api/pass-templates/:id/public` (future) and the
 * mock service today.
 *
 * `language` (2026-10-01) drives the page i18n: when a visitor hits
 * `/pass/{templateId}` the frontend calls `applyPageLanguage(language)`
 * so the page renders in the template's chosen language regardless of
 * the visitor's browser locale or saved preferences. Source of truth is
 * `templates.settings->>'language'` (JSONB); mirrors `languageSchema`
 * in `packages/shared/schemas/card.ts`.
 */
export interface PublicPassTemplate {
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
   * Page language ('zh-TW' | 'en') — read from DB on template load and
   * applied via `applyPageLanguage(template.language)`. Mirrors
   * `languageSchema` in `packages/shared/schemas/card.ts`.
   */
  language: CardLanguage;
  /** Optional absolute URL for the issuer logo (mock: Unsplash / placeholder). */
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
export type PassHolderPhoneCountryCode = '+886' | '+27';

/**
 * Form payload for `POST /api/pass-templates/:id/register` (future) and
 * the mock service today.
 *
 * None of these fields are login credentials — they are pass-delivery /
 * display data written to `public.pass_holders` (NOT `public.members`).
 */
export interface PassHolderPayload {
  /** Holder name shown on the pass itself. */
  name: string;
  /** Phone country code (currently +886 or +27). */
  phoneCountryCode: PassHolderPhoneCountryCode;
  /** Phone number digits only, 6-15 chars per backend regex. */
  phoneNumber: string;
  /** ISO birthday YYYY-MM-DD; holder must be ≥ 13 years old. */
  birthday: string;
  /** Email used by Apple/Google Wallet to deliver the pass link. */
  email: string;
}

/**
 * Mock / future-backend service contract for the public pass-registration
 * flow. The interface is intentionally narrow — only two methods — so the
 * frontend can swap mock implementation for HTTP later with zero UI
 * changes.
 */
export interface PassHolderService {
  /**
   * Fetch a public-safe template view. Throws `NotFoundError` (i18n key
   * `passHolder.errors.templateNotFound`) if the template does not exist
   * or has been removed.
   */
  getTemplate(id: string): Promise<PublicPassTemplate>;

  /**
   * Register a Pass Holder against a template. Today this just logs the
   * payload and returns a fake id; future backend write goes to
   * `public.pass_holders`.
   */
  register(
    templateId: string,
    payload: PassHolderPayload,
  ): Promise<{ ok: true; passHolderId: string }>;
}