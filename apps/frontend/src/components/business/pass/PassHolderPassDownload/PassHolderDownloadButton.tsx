/**
 * PassHolderDownloadButton — platform-specific download CTAs for the
 * post-submit Pass download view.
 *
 * @module business/pass/PassHolderPassDownload/PassHolderDownloadButton
 *
 * 2026-10-19 — initial version. Rendered 3 stacked buttons (mobile)
 * or 1 wide button (desktop) depending on viewport.
 *
 * 2026-10-19 (V3 contract) — Accepted 3 separate URIs from Passcreator
 * V3 (`downloadPage` universal, `iPhoneUri` .pkpass, `androidUri`
 * Google Wallet / Passwallet deeplink). User-agent detection picked
 * which URI to surface as the primary CTA, with `downloadPage` as the
 * universal-secondary fallback.
 *
 * 2026-10-19 (v3-fix-cta-platform-icons) — Picked icon + label per UA
 * (Apple on iOS, Smartphone on Android, Download on desktop) via
 * `pickPrimaryCtaType()`. The secondary CTA always used `downloadPage`
 * with a generic Smartphone icon.
 *
 * 2026-10-19 (split-two-platform-buttons) — **breaking rewrite**.
 * Replaces the prior primary + secondary scheme with TWO always-rendered
 * platform-specific anchors (one for iOS, one for Android). Each
 * anchor uses its own native URI and falls back to `downloadPage`
 * only as a last resort. Users pick the right one for their device
 * rather than the component guessing via user-agent.
 *
 * Rationale:
 *   - Production UX bug: when only `downloadPage` was populated
 *     (e.g. older template that didn't push `iPhoneUri` /
 *     `androidUri` yet), BOTH the UA-keyed primary AND the
 *     `downloadPage`-fixed secondary collapsed to the same URL —
 *     the user couldn't tell which button did what.
 *   - Allowing the user to pick the platform explicitly means the
 *     component no longer needs `navigator.userAgent`, removing a
 *     hidden coupling between UX and SSR / mocked test environments
 *     (`jsdom`'s default UA is desktop).
 *
 * Visual feedback (2026-10-19 — press-scale + brightness):
 *   - `transition-all duration-150` — smooth color + transform
 *   - `hover:brightness-110` — subtle brighten on hover (over and
 *     above the primary/secondary background)
 *   - `active:scale-[0.97]` + `active:brightness-90` — tactile press
 *     feedback (tablets / touchscreen + keyboard)
 *   - `focus-visible:ring-2 focus-visible:ring-offset-2` — keyboard
 *     accessibility (Tab → focus shows ring; mouse-clicks don't
 *     trigger the ring because `focus-visible` is UA-aware)
 *
 * `isIOSUserAgent` / `isAndroidUserAgent` are kept as exported pure
 * helpers — they're no longer used inside this component, but stay
 * available for future tests / one-off device-detection elsewhere.
 */

import { useTranslation } from 'react-i18next';
import { Apple, Smartphone } from 'lucide-react';

/**
 * User-agent detection helper.
 *
 * Returns `true` for iPhone / iPad / iPod. iPad on iPadOS 13+
 * reports `Macintosh` and `Safari`; the `Mobile` + `Touch` (or
 * `MacIntel` w/o `Chrome`) heuristics catch it.
 */
export function isIOSUserAgent(userAgent: string): boolean {
  return (
    /iPad|iPhone|iPod/.test(userAgent) ||
    (/Macintosh/.test(userAgent) && /Mobile|Touch/.test(userAgent))
  );
}

/**
 * User-agent detection helper for Android phones + tablets.
 * `ChromeOS` shows up as Linux + `Chrome`, so we keep the Android
 * regex separate from "Linux + Chrome".
 */
export function isAndroidUserAgent(userAgent: string): boolean {
  return /Android/.test(userAgent);
}

export interface PassHolderDownloadButtonProps {
  /**
   * V3 `data.downloadPage` — universal Passcreator landing page
   * (device-sniffs Apple vs Google when the visitor opens it).
   * Used as the last-resort fallback for each platform button.
   */
  downloadPage?: string;
  /** V3 `data.iPhoneUri` — direct .pkpass link (Apple Wallet / Passwallet). */
  iPhoneUri?: string;
  /** V3 `data.androidUri` — Google Pay / Passwallet deeplink. */
  androidUri?: string;
  /** Template UUID — used for the `data-testid` only. */
  templateId: string;
}

/**
 * Resolves the iOS button's href.
 *
 * Returns `null` when neither `iPhoneUri` nor the `downloadPage`
 * fallback is available — caller should hide the iOS button.
 */
function pickIosHref(
  issuance: Pick<PassHolderDownloadButtonProps, 'iPhoneUri' | 'downloadPage'>,
): string | null {
  return issuance.iPhoneUri ?? issuance.downloadPage ?? null;
}

/**
 * Resolves the Android button's href.
 *
 * Returns `null` when neither `androidUri` nor the `downloadPage`
 * fallback is available — caller should hide the Android button.
 */
function pickAndroidHref(
  issuance: Pick<PassHolderDownloadButtonProps, 'androidUri' | 'downloadPage'>,
): string | null {
  return issuance.androidUri ?? issuance.downloadPage ?? null;
}

export function PassHolderDownloadButton({
  downloadPage,
  iPhoneUri,
  androidUri,
  templateId,
}: PassHolderDownloadButtonProps) {
  const { t } = useTranslation('passHolder');

  const iosHref = pickIosHref({ iPhoneUri, downloadPage });
  const androidHref = pickAndroidHref({ androidUri, downloadPage });

  // When the backend returned no URI at all (e.g. pre-launch state),
  // we don't render any CTA — the parent `PassHolderPassDownload`
  // already shows a "not ready yet" copy in that case, but defensive
  // here too so an empty container never breaks the layout.
  if (!iosHref && !androidHref) {
    return null;
  }

  return (
    <div
      className="flex flex-col gap-3 md:flex-row"
      data-testid="pass-holder-download-buttons"
    >
      {/* iOS CTA — native URI, falls back to downloadPage. Hidden
          entirely when neither URI exists. Press-scale + brightness
          visual feedback (see header docblock for the design). */}
      {iosHref ? (
        <a
          href={iosHref}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex h-12 min-w-[44px] flex-1 items-center justify-center gap-2 rounded-md px-4 text-base font-medium transition-all duration-150 hover:brightness-110 focus-visible:ring-2 focus-visible:ring-offset-2 active:scale-[0.97] active:brightness-90"
          style={{
            backgroundColor: 'var(--color-primary)',
            color: 'var(--color-primary-foreground)',
          }}
          data-testid={`pass-holder-download-cta-ios-${templateId}`}
        >
          <Apple size={20} aria-hidden="true" />
          <span>{t('download.forIos')}</span>
        </a>
      ) : null}

      {/* Android CTA — native URI, falls back to downloadPage. Hidden
          entirely when neither URI exists. Press-scale + brightness
          visual feedback mirrors the iOS button for symmetric rhythm. */}
      {androidHref ? (
        <a
          href={androidHref}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex h-12 min-w-[44px] flex-1 items-center justify-center gap-2 rounded-md px-4 text-base font-medium transition-all duration-150 hover:brightness-110 focus-visible:ring-2 focus-visible:ring-offset-2 active:scale-[0.97] active:brightness-90"
          style={{
            backgroundColor: 'var(--color-primary)',
            color: 'var(--color-primary-foreground)',
          }}
          data-testid={`pass-holder-download-cta-android-${templateId}`}
        >
          <Smartphone size={20} aria-hidden="true" />
          <span>{t('download.forAndroid')}</span>
        </a>
      ) : null}
    </div>
  );
}
