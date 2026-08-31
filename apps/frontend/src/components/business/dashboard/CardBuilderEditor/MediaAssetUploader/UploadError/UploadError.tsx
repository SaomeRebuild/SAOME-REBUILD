/**
 * UploadError — Error state with retry button.
 *
 * Pure presentation: shows validation / upload error message + Cancel button.
 * The error text comes pre-resolved from the parent (i18n key mapping already done).
 *
 * @module components/business/dashboard/CardBuilderEditor/LogoUploader/UploadError
 */

import { AlertCircle } from 'lucide-react';

export interface UploadErrorProps {
  /** Pre-resolved error message (string, ready to display). */
  message: string;
  /** i18n: "Cancel" / "重試" button label. */
  cancelLabel: string;
  /** Forwarded click → returns to idle state. */
  onCancel: () => void;
}

export function UploadError({ message, cancelLabel, onCancel }: UploadErrorProps) {
  return (
    <div className="flex min-w-0 flex-col items-center gap-4">
      <div className="flex flex-col items-center gap-2 rounded-xl border border-destructive/30 bg-destructive/5 p-6">
        <AlertCircle size={32} className="text-destructive" aria-hidden="true" />
        <p className="text-sm text-destructive">{message}</p>
      </div>
      <button
        type="button"
        onClick={onCancel}
        className="
          flex items-center gap-2 rounded-lg border border-border bg-card px-4 py-2
          text-sm font-medium text-foreground transition-all duration-150
          hover:border-primary hover:text-primary
        "
      >
        {cancelLabel}
      </button>
    </div>
  );
}
