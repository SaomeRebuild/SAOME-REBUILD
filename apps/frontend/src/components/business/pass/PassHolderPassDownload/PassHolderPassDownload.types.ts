/**
 * PassHolderPassDownload prop types.
 *
 * @module business/pass/PassHolderPassDownload/PassHolderPassDownload.types
 *
 * Mirrors the Layer 1 `PassHolderIssuance` contract in
 * `packages/shared/types/passHolder.ts`. Re-declared locally so the
 * frontend bundle doesn't pull in `@saome/shared/types` for one
 * prop shape (Rule 023 § shared package — keep web-only types in
 * the frontend; only schemas / business contracts live in shared/).
 *
 * 2026-10-19 — added with the V3 per-pass runtime integration.
 * 2026-10-19 (later) — renamed `downloadUrl` → `downloadPage` + added
 * `iPhoneUri` / `androidUri` to match Passcreator V3 docs. The fix
 * was the root-cause for the "registration succeeds but no pass
 * arrives" regression — see
 * `runs/improvements/feedback/20261019-pass-holder-v3-issuance-v3-contract-fix.md`.
 */

import type { PublicPassTemplate } from '@saome/shared/types/passHolder';

/**
 * Per-pass runtime artifact returned by Passcreator V3 (frontend view).
 *
 * Optional fields because the backend never throws on V3 failure — it
 * persists the holder row and writes `issuanceError` instead. The
 * frontend therefore sees three success-path URI fields (downloadPage /
 * iPhoneUri / androidUri) + barcodeValue + issuedAt, OR a single
 * `issuanceError` i18n key, never both populated. The component does
 * user-agent detection to pick which URI to surface as the download CTA.
 *
 * URI precedence (frontend logic): iPhoneUri for iOS, androidUri for
 * Android, downloadPage as universal fallback. The backend persists only
 * `downloadPage` to the DB (single column) — `iPhoneUri` / `androidUri` are
 * returned in the response payload only and don't have their own DB
 * columns. Storing all 3 would require 2 new columns (future hardening).
 */
export interface PassHolderIssuanceView {
  passIdentifier?: string;
  /**
   * Universal Passcreator landing page URL (Apple Safari → opens
   * Wallet; Android Chrome → opens Google Wallet). The safest single
   * link when user-agent detection is unavailable.
   * Source: V3 `data.downloadPage`.
   */
  downloadPage?: string;
  /**
   * Direct .pkpass link for Apple Wallet / Passwallet (iOS users).
   * Frontend surfaces this as the "Add to Apple Wallet" CTA when
   * the user-agent indicates iOS.
   * Source: V3 `data.iPhoneUri`.
   */
  iPhoneUri?: string;
  /**
   * Direct Google Pay / Passwallet deeplink (Android users).
   * Frontend surfaces this as the "Save to Google Wallet" CTA when
   * the user-agent indicates Android.
   * Source: V3 `data.androidUri`.
   */
  androidUri?: string;
  barcodeValue?: string | null;
  /** ISO 8601 UTC, e.g. '2026-10-19T08:42:13.123Z'. */
  issuedAt?: string;
  /** i18n key when issuance failed (e.g. 'passHolder.errors.upstreamFailed'). */
  issuanceError?: string;
}

export interface PassHolderPassDownloadProps {
  /** Template context for the post-submit view (issuer name, branding). */
  template: PublicPassTemplate;
  /**
   * Per-pass runtime artifact. Pass `undefined` when the backend
   * response omitted the `issuance` field (e.g. template not yet
   * pushed to Passcreator — known pre-launch state, not an error).
   */
  issuance?: PassHolderIssuanceView;
  /**
   * Retry handler. When provided, the error banner surfaces a
   * "重試簽發" button that calls this. The parent (PassHolderRegistration)
   * wires it to re-call `passHolderService.register(...)`.
   */
  onRetry?: () => void;
}