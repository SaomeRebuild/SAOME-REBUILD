/**
 * CropActions — Cancel / Reset / Apply button group shown in the crop state.
 *
 * Pure presentation. The parent owns the action handlers and the i18n labels
 * (so it can pass already-translated text without this component needing
 * a useTranslation hook).
 *
 * @module components/business/dashboard/CardBuilderEditor/LogoUploader/CropActions
 */

import { Check, RotateCcw, X } from 'lucide-react';

export interface CropActionsProps {
  cancelLabel: string;
  resetLabel: string;
  applyLabel: string;
  onCancel: () => void;
  onReset: () => void;
  onApply: () => void;
}

export function CropActions({ cancelLabel, resetLabel, applyLabel, onCancel, onReset, onApply }: CropActionsProps) {
  return (
    <div className="flex flex-wrap items-center justify-center gap-3">
      <button
        type="button"
        onClick={onCancel}
        className="
          flex items-center gap-2 rounded-lg border border-border bg-card px-4 py-2
          text-sm font-medium text-foreground transition-all duration-150
          hover:border-muted-foreground hover:text-muted-foreground
        "
      >
        <X size={14} aria-hidden="true" />
        {cancelLabel}
      </button>
      <button
        type="button"
        onClick={onReset}
        className="
          flex items-center gap-2 rounded-lg border border-border bg-card px-4 py-2
          text-sm font-medium text-foreground transition-all duration-150
          hover:border-muted-foreground hover:text-muted-foreground
        "
      >
        <RotateCcw size={14} aria-hidden="true" />
        {resetLabel}
      </button>
      <button
        type="button"
        onClick={onApply}
        className="
          flex items-center gap-2 rounded-lg bg-primary px-6 py-2
          text-sm font-semibold text-on-primary transition-all duration-150
          hover:scale-[1.02] hover:shadow-[var(--shadow-glow)]
          active:scale-[0.98]
          disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:scale-100
        "
      >
        <Check size={14} aria-hidden="true" />
        {applyLabel}
      </button>
    </div>
  );
}
