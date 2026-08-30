/**
 * LogoPreview — Idle/Success state when the user already has a logo.
 *
 * Shows a 128×128 square preview of the previously-uploaded logo with a
 * "replace" button below (and an optional success badge after upload).
 *
 * @module components/business/dashboard/CardBuilderEditor/LogoUploader/LogoPreview
 */

import { Check, Image as ImageIcon } from 'lucide-react';

export interface LogoPreviewProps {
  /** Fully-qualified image URL (e.g. `${api.baseUrl}${api.paths.cardImage(...)}`). */
  displayUrl: string;
  /** Whether to render the success badge overlay (visible for ~2s after upload). */
  showSuccessBadge: boolean;
  /** i18n: "Replace" button label. */
  replaceLabel: string;
  /** i18n: success badge message (rendered below the preview). */
  successLabel: string;
  /** Forwarded click → triggers hidden file input. */
  onReplace: () => void;
}

export function LogoPreview({
  displayUrl,
  showSuccessBadge,
  replaceLabel,
  successLabel,
  onReplace,
}: LogoPreviewProps) {
  return (
    <div className="flex min-w-0 flex-col items-center gap-3">
      {/* Cropped logo preview — maintain square ratio */}
      <div className="relative h-32 w-32 overflow-hidden rounded-xl bg-muted">
        <img src={displayUrl} alt="Logo" className="h-full w-full object-contain" />
        {showSuccessBadge && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/40">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-success">
              <Check size={16} className="text-white" aria-hidden="true" />
            </div>
          </div>
        )}
      </div>

      {showSuccessBadge && <p className="text-xs text-success/80">{successLabel}</p>}

      {/* Replace button */}
      <button
        type="button"
        onClick={onReplace}
        className="
          flex items-center gap-2 rounded-lg border border-border bg-card px-4 py-2
          text-sm font-medium text-foreground transition-all duration-150
          hover:border-primary hover:text-primary
        "
      >
        <ImageIcon size={14} aria-hidden="true" />
        {replaceLabel}
      </button>
    </div>
  );
}
