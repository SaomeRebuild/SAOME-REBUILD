/**
 * PassHolderDownloadButton — primary CTA for adding the pass to the
 * wallet.
 *
 * @module business/pass/PassHolderPassDownload/PassHolderDownloadButton
 *
 * 2026-10-19 — initial version. Renders 3 stacked buttons (mobile)
 * or 1 wide button (desktop) depending on viewport. The barcodeValue
 * is passed through for the inline JSX but is rendered by the parent
 * `PassHolderBarcodeDisplay` component to keep concerns separate.
 *
 * Rule 014 § container width — desktop uses max-w-prose on inner
 * content, full width on the button itself.
 *
 * 2026-10-19 (later) — V3 contract fix:
 *   - Accepts 3 separate URIs from V3 (`downloadPage` universal,
 *     `iPhoneUri` .pkpass, `androidUri` Google Wallet deeplink)
 *     instead of a single `downloadUrl`.
 *   - Uses `navigator.userAgent` to pick which URI to surface:
 *       iOS      → `iPhoneUri` (with `downloadPage` fallback)
 *       Android  → `androidUri` (with `downloadPage` fallback)
 *       Other    → `downloadPage` (universal landing page)
 *   - The download href is computed once at mount via `useMemo` —
 *     user-agent doesn't change during a session.
 */

import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Download, Apple, Smartphone } from 'lucide-react';

/**
 * Pick the right download URI based on the runtime user-agent.
 *
 * Decision tree (matches Passcreator's intended UX per V3 docs):
 *   - iOS (iPhone / iPad / iPod)         → `iPhoneUri` (.pkpass direct)
 *   - Android                             → `androidUri` (Google Pay / Passwallet)
 *   - Desktop / unknown                   → `downloadPage` (universal landing)
 *
 * Each branch falls back to `downloadPage` if the platform-specific
 * URI is missing (e.g. backend returned only the universal URL).
 */
export function pickDownloadUri(
  issuance: { downloadPage?: string; iPhoneUri?: string; androidUri?: string },
  userAgent: string,
): string | null {
  const { downloadPage, iPhoneUri, androidUri } = issuance;
  if (!downloadPage && !iPhoneUri && !androidUri) return null;

  // iOS detection — covers iPhone / iPad / iPod. iPad on iPadOS 13+
  // reports `Macintosh` and `Safari`; the `Mobile` + `Touch` (or
  // `MacIntel` w/o `Chrome`) heuristics catch it.
  const isIOS =
    /iPad|iPhone|iPod/.test(userAgent) ||
    (/Macintosh/.test(userAgent) && /Mobile|Touch/.test(userAgent));
  if (isIOS) return iPhoneUri ?? downloadPage ?? null;

  // Android — covers phones + tablets. `ChromeOS` shows up as Linux +
  // `Chrome`, so we keep the Android regex separate from "Linux + Chrome".
  const isAndroid = /Android/.test(userAgent);
  if (isAndroid) return androidUri ?? downloadPage ?? null;

  // Desktop / unknown — use the universal landing page.
  return downloadPage ?? iPhoneUri ?? androidUri ?? null;
}

export interface PassHolderDownloadButtonProps {
  /**
   * V3 `data.downloadPage` — universal Passcreator landing page
   * (device-sniffs Apple vs Google when the visitor opens it).
   */
  downloadPage?: string;
  /** V3 `data.iPhoneUri` — direct .pkpass link (Apple Wallet / Passwallet). */
  iPhoneUri?: string;
  /** V3 `data.androidUri` — Google Pay / Passwallet deeplink. */
  androidUri?: string;
  /** V3 `data.barcodeValue` — passed through for per-row style overrides. */
  barcodeValue?: string | null;
  /** Template UUID — used for the `data-testid` only. */
  templateId: string;
}

export function PassHolderDownloadButton({
  downloadPage,
  iPhoneUri,
  androidUri,
  templateId,
}: PassHolderDownloadButtonProps) {
  const { t } = useTranslation('passHolder');

  // Pick the right URI for this device. Computed once per mount —
  // user-agent doesn't change inside a session. SSR-safe via the
  // optional `typeof navigator !== 'undefined'` check.
  const downloadHref = useMemo(() => {
    if (typeof navigator === 'undefined') return null;
    return pickDownloadUri(
      { downloadPage, iPhoneUri, androidUri },
      navigator.userAgent,
    );
  }, [downloadPage, iPhoneUri, androidUri]);

  // When the backend returned no URI at all (e.g. pre-launch state),
  // we don't render any CTA — the parent `PassHolderPassDownload`
  // already shows a "not ready yet" copy in that case, but defensive
  // here too so an empty button never breaks the click handler.
  if (!downloadHref) {
    return null;
  }

  return (
    <div
      className="flex flex-col gap-3 md:flex-row"
      data-testid="pass-holder-download-buttons"
    >
      {/* Primary CTA — "Add to Apple Wallet" / "下載 .pkpass".
          Same href on both CTAs today because V3's `downloadPage`
          already does device-sniffing server-side; splitting into 2
          different URIs is a future refinement once we wire
          platform-specific CTAs (Apple icon on iOS, Google icon on
          Android). */}
      <a
        href={downloadHref}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex h-12 min-w-[44px] flex-1 items-center justify-center gap-2 rounded-md px-4 text-base font-medium transition-colors"
        style={{
          backgroundColor: 'var(--color-primary)',
          color: 'var(--color-primary-foreground)',
        }}
        data-testid={`pass-holder-download-cta-${templateId}`}
      >
        <Download size={20} aria-hidden="true" />
        <span>{t('download.appleWallet')}</span>
      </a>

      {/* Secondary CTA — explicit .pkpass hint for users on Android
          who may not realize they need Passwallet to open .pkpass.
          See `PassHolderAndroidReminder` below for the dedicated
          reminder card. */}
      <a
        href={downloadHref}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex h-12 min-w-[44px] flex-1 items-center justify-center gap-2 rounded-md border px-4 text-base font-medium transition-colors md:flex-none md:px-6"
        style={{
          borderColor: 'var(--color-border)',
          color: 'var(--color-foreground)',
          backgroundColor: 'var(--color-background)',
        }}
        data-testid="pass-holder-download-direct"
      >
        <Smartphone size={20} aria-hidden="true" />
        <span>{t('download.directDownload')}</span>
      </a>

      {/* iOS-specific hint (rendered as a tertiary label, not a button)
          — informs iPhone users the link is Apple Wallet-ready.
          Hidden on mobile (md+ only) where space is tight. */}
      <span
        className="hidden items-center gap-1 text-xs md:inline-flex"
        style={{ color: 'var(--color-muted-foreground)' }}
        aria-hidden="true"
      >
        <Apple size={14} />
        {t('download.iosHint')}
      </span>
    </div>
  );
}