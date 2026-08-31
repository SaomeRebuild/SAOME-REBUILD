/**
 * Preview — Idle/Success state when the user already has an uploaded asset.
 *
 * Variant-agnostic: works for logo, icon (next plan: background).
 * Shows a 128×128 square preview of the previously-uploaded asset with a
 * "replace" button below (and an optional success badge after upload).
 *
 * Bug-φ fix (Phase 3 of CardBuilder data-loss + icon-preview plan 2026-08-31):
 * The previous version had NO onError handler, so a broken `<img src>` would
 * just show a broken-image glyph with no diagnostic. The icon variant was
 * reported as "破圖" without any feedback to the user. The fix adds an
 * onError state that:
 *   1. Replaces the broken glyph with an upload-prompt-style empty state
 *   2. Logs the failure to console for DevTools triage
 *   3. Re-fires the `onReplace` callback so the user can re-upload
 *
 * The signature matches the LogoUploader (now defunct) pattern of "click to
 * re-upload if the image is gone" — Rule 028 § upload-error-handling.
 *
 * @module components/business/dashboard/CardBuilderEditor/MediaAssetUploader/Preview
 */

import { useState, useCallback } from 'react';
import { Check, ImageOff, Image as ImageIcon } from 'lucide-react';

export interface PreviewProps {
  /** Fully-qualified image URL (e.g. `${api.baseUrl}${api.paths.cardImage(...)}`). */
  displayUrl: string;
  /** Whether to render the success badge overlay (visible for ~2s after upload). */
  showSuccessBadge: boolean;
  /** i18n: "Replace" button label. */
  replaceLabel: string;
  /** i18n: success badge message (rendered below the preview). */
  successLabel: string;
  /** i18n: error message shown when the image fails to load. */
  loadErrorLabel?: string;
  /** Forwarded click → triggers hidden file input. */
  onReplace: () => void;
}

export function Preview({
  displayUrl,
  showSuccessBadge,
  replaceLabel,
  successLabel,
  loadErrorLabel,
  onReplace,
}: PreviewProps) {
  // Bug-φ fix: track load failure so we can render an actionable fallback
  // instead of a cryptic broken-image glyph. (Phase 3 of icon-preview plan.)
  const [loadError, setLoadError] = useState(false);

  const handleError = useCallback(() => {
    // eslint-disable-next-line no-console
    console.error(
      '[MediaAssetUploader.Preview] Failed to load asset image:',
      displayUrl,
    );
    setLoadError(true);
  }, [displayUrl]);

  const handleLoad = useCallback(() => {
    setLoadError(false);
  }, []);

  return (
    <div className="flex flex-col items-center gap-3">
      <div className="relative h-32 w-32 overflow-hidden rounded-xl bg-muted">
        {loadError ? (
          <div
            data-testid="asset-load-error"
            className="flex h-full w-full flex-col items-center justify-center gap-1 p-2 text-center text-xs text-muted-foreground"
          >
            <ImageOff className="h-6 w-6 text-muted-foreground/60" aria-hidden />
            <span className="leading-tight">{loadErrorLabel ?? replaceLabel}</span>
          </div>
        ) : (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img
            src={displayUrl}
            alt=""
            className="h-full w-full object-contain"
            data-testid="asset-preview-img"
            onError={handleError}
            onLoad={handleLoad}
          />
        )}
        {showSuccessBadge && !loadError && (
          <div
            data-testid="success-badge"
            className="absolute inset-0 flex items-center justify-center bg-emerald-500/80"
          >
            <Check className="h-12 w-12 text-white" aria-hidden />
          </div>
        )}
      </div>
      <button
        type="button"
        onClick={onReplace}
        className="flex items-center gap-2 text-sm font-medium text-primary underline-offset-2 hover:underline"
        data-testid="replace-button"
      >
        <ImageIcon className="h-4 w-4" aria-hidden />
        {loadError
          ? (loadErrorLabel ?? replaceLabel)
          : showSuccessBadge
            ? successLabel
            : replaceLabel}
      </button>
    </div>
  );
}
