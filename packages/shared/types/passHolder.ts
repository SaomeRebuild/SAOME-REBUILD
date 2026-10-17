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

import type { CardLanguage, CardType, Currency } from '../schemas/card';

/**
 * Public-safe membership tier snapshot (read-only view of the card's
 * `membershipTiers` field). Added 2026-10-16 with the paid-membership
 * registration flow. Used by `template.membershipTiers` on the public
 * pass-registration page so visitors can pick a tier + simulate payment.
 *
 * `monthlyCost` / `yearlyCost` are nullable so a tier can be
 * "free + monthly duration" (cost = 0 or null) or "yearly only"
 * (monthlyCost = null). The combination `null + null` is invalid and
 * rejected by the snapshot builder.
 */
export interface PublicMembershipTier {
  /** Display name, e.g. "Basic", "VIP", "Premium". */
  name: string;
  /** Reward description rows; rendered as a bullet list on the picker. */
  rewards: ReadonlyArray<{ label: string; value: string }>;
  /** Monthly cost in `template.currency`. null = "free" or "yearly only". */
  monthlyCost: number | null;
  /** Yearly cost in `template.currency`. null = "monthly only" or "free". */
  yearlyCost: number | null;
  /** Determines which cost field the picker surfaces in the UI. */
  durationType: 'monthly' | 'yearly';
}

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
 *
 * Paid-membership fields (2026-10-16):
 *   - `currency` — 'TWD' | 'ZAR'; defaults to TWD for legacy rows
 *   - `isPaid` — when true, render the membership-tier picker + simulated
 *     payment UI (Payfast for ZAR, Ecpay for TWD).
 *   - `membershipTiers` — when isPaid=true AND length > 0, the page
 *     surfaces a Radio Card list with the tier reward bullets.
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
  /**
   * Currency the membership tier is priced in. Drives the simulated
   * payment button choice (TWD → Ecpay, ZAR → Payfast). Default TWD
   * when the field is missing — see 023 migration `currency` backfill.
   */
  currency?: Currency;
  /**
   * When true, the public pass-registration page renders the
   * membership-tier picker + simulated payment flow below the 4
   * pass-delivery fields. Non-paid templates skip the section entirely.
   */
  isPaid?: boolean;
  /**
   * Membership tier list, only meaningful when `isPaid === true`. A
   * non-paid template with `membershipTiers` populated is treated as
   * non-paid (the picker is hidden regardless of the array contents).
   */
  membershipTiers?: ReadonlyArray<PublicMembershipTier>;
}

/**
 * Frozen snapshot of the selected tier at registration time. Persisted
 * in `public.pass_holders.membership_tier_snapshot` (JSONB) so the
 * receipt / dashboard can show the original price even if the
 * template's tier definition later changes. Index + name + cost
 * are all denormalized here to keep the snapshot self-contained.
 */
export interface MembershipTierSnapshot {
  /** 0-based index into the source `template.membershipTiers[]`. */
  index: number;
  /** Tier display name at registration time. */
  name: string;
  /** Duration type the holder subscribed to. */
  durationType: 'monthly' | 'yearly';
  /**
   * Currency amount actually paid. null when the tier is free
   * (e.g. promotional month, or monthlyCost/yearlyCost was null).
   */
  paidAmount: number | null;
  /** Currency of `paidAmount`. Mirrors `template.currency`. */
  currency: Currency;
}

/**
 * Phone country code. Per plan 2026-09-28 only two codes are supported
 * (Taiwan + South Africa). Extend when onboarding new regions.
 */
export type PassHolderPhoneCountryCode = '+886' | '+27';

/**
 * Per-pass runtime artifact returned by Passcreator V3
 * (`POST /api/v3/pass`) after a holder is registered against a template.
 *
 * All fields are optional because issuance can fail — the row in
 * `public.pass_holders` records `issuanceError` + keeps the holder's
 * registration intact, so the frontend can render a "重試簽發" banner
 * with the existing data.
 *
 * See `runs/decisions/2026-10-19-pass-holder-v3-issuance.md` for the
 * per-pass design (DB columns `pass_identifier` / `download_url` /
 * `barcode_value` / `issued_at` / `issuance_error`).
 *
 * 2026-10-19 — V3 keys per the developer.passcreator.com V3 docs:
 *   - `passIdentifier`  ← Passcreator `data.identifier`
 *   - `downloadPage`    ← Passcreator `data.downloadPage` (universal landing page)
 *   - `iPhoneUri`       ← Passcreator `data.iPhoneUri` (direct .pkpass)
 *   - `androidUri`      ← Passcreator `data.androidUri` (Google Pay deeplink)
 *   - `barcodeValue`    ← Passcreator `data.barcodeValue` (when present; null otherwise)
 *   - `issuedAt`        ← ISO 8601 timestamp (UTC) the backend persisted
 *   - `issuanceError`   ← i18n key when issuance failed (e.g. 'common.error.upstreamFailed');
 *                         when set, the other fields are typically absent.
 *
 * NOTE on field rename history:
 *   The pre-fix shape had `downloadUrl` mapped from V1's
 *   `data.linkToPassPage`. V3 docs (verified 2026-10-19) renamed this
 *   to `data.downloadPage` and split it into 3 URIs (the universal
 *   landing page + the .pkpass direct link + the Google Wallet deeplink).
 *   This rename was the root-cause fix for the "registration succeeds
 *   but no pass arrives" regression — see
 *   `runs/improvements/feedback/20261019-pass-holder-v3-issuance-v3-contract-fix.md`.
 *   Frontend does user-agent detection to pick which URI to surface
 *   as the download CTA.
 */
export interface PassHolderIssuance {
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
  /** ISO 8601, e.g. '2026-10-19T08:42:13.123Z'. */
  issuedAt?: string;
  /** i18n key the frontend should render in the error banner (when failed). */
  issuanceError?: string;
}

/**
 * Form payload for `POST /api/pass-templates/:id/register` (future) and
 * the mock service today.
 *
 * None of these fields are login credentials — they are pass-delivery /
 * display data written to `public.pass_holders` (NOT `public.members`).
 *
 * Paid-membership extension (2026-10-16):
 *   - `selectedTierIndex` / `membershipTierSnapshot` / `paymentProvider`
 *     / `paymentStatus` are required when `template.isPaid === true`; the
 *     frontend blocks submit until they are populated. The four
 *     pass-delivery fields stay the source of truth and remain required
 *     regardless of paid status.
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
  /**
   * 0-based index into the template's `membershipTiers` array. Required
   * when the template is a paid membership card. Frontend populates
   * this before submit; the backend may re-validate against the
   * template's actual tier list.
   */
  selectedTierIndex?: number;
  /**
   * Frozen snapshot of the selected tier. Required when isPaid — keeps
   * the persisted receipt consistent even if the template's tier
   * definition is later edited.
   */
  membershipTierSnapshot?: MembershipTierSnapshot;
  /**
   * Payment provider, populated after the simulated payment completes.
   * `payfast` for ZAR, `ecpay` for TWD. Real providers will arrive with
   * the Passcreator V3 backend integration; today this is a hint to
   * the backend that a simulated payment succeeded.
   */
  paymentProvider?: 'payfast' | 'ecpay';
  /**
   * Payment status.
   * - `'pending'`   — paid template, awaiting real gateway callback.
   * - `'completed'` — simulated (or real) payment succeeded; must be
   *                   paired with `paymentProvider` (zod enforces).
   * - `'failed'`    — real gateway declined (reserved for live integration).
   * - `'not_required'` — non-paid template (stamp card / free reward /
   *                   cashback / coupon / multipass / gift / free membership)
   *                   that has no payment concept at all. zod forbids
   *                   pairing this with `paymentProvider`.
   *
   * The 4-value enum replaces the previous 2-state ("pending" = ambiguous)
   * pattern where non-paid registrations polluted pending queries.
   * See runs/decisions/2026-10-18-payment-status-not-required-enum.md.
   */
  paymentStatus?: 'pending' | 'completed' | 'failed' | 'not_required';
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
   * Register a Pass Holder against a template. Backend persists the
   * payload to `public.pass_holders`, then immediately calls Passcreator
   * V3 `/api/v3/pass` to issue the holder's wallet pass. The
   * `issuance` field on the response carries the per-pass runtime
   * fields (`passIdentifier`, `downloadUrl`, `barcodeValue`,
   * `issuedAt`) when the upstream call succeeded, or `issuanceError`
   * (an i18n key) when it failed.
   *
   * 2026-10-19 — response shape widened from
   *   `{ ok: true; passHolderId: string }`
   * to
   *   `{ ok: true; passHolderId: string; issuance?: PassHolderIssuance }`
   * to surface the per-pass issuance result to the frontend (download
   * page). Issuance failure does NOT cause the HTTP response to fail —
   * the row is persisted either way; the frontend surfaces a retry
   * banner when `issuance.issuanceError` is set.
   */
  register(
    templateId: string,
    payload: PassHolderPayload,
  ): Promise<{
    ok: true;
    passHolderId: string;
    created: boolean;
    issuance?: PassHolderIssuance;
  }>;
}