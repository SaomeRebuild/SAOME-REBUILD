/**
 * Step8SaveActions — Primary action button + secondary "Back to Library"
 * button for Step 8.
 *
 * Renders two buttons:
 *   - 「儲存並發布」 (primary): triggers `onPublish()`; disabled when
 *     `validation.canPublish === false` or `status === 'saving'`.
 *   - 「返回模板庫」 (secondary): triggers `onBack()`.
 *
 * On validation failure (e.g. user never picked a card type), the
 * primary button is disabled AND a small hint text appears below to
 * explain what's missing. This mirrors the Step 7 guard pattern in
 * CardBuilderEditorWorkspace.tsx (`isStep7Valid()`).
 */

import { useTranslation } from 'react-i18next';
import { ArrowLeft, CheckCircle2, Loader2 } from 'lucide-react';
import type { Step8SaveActionsProps } from './Step8Save.types';

export function Step8SaveActions({
  status,
  validation,
  onPublish,
  onBack,
}: Step8SaveActionsProps) {
  const { t } = useTranslation('cardEditor');

  const isSaving = status === 'saving';
  const isDisabled = !validation.canPublish || isSaving;

  // Build validation hint text — show the FIRST failing field only to
  // keep the hint compact. Mirrors the Step 7 hint pattern.
  const hintKey = !validation.hasCardType
    ? 'steps.save.validationCardType'
    : !validation.hasCardName
      ? 'steps.save.validationName'
      : null;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col items-stretch gap-3 sm:flex-row sm:items-center sm:justify-between">
        {/* Secondary: Back to Library */}
        <button
          type="button"
          onClick={onBack}
          disabled={isSaving}
          data-testid="step8-back-button"
          className="
            flex items-center gap-2 rounded-lg border border-border bg-card px-4 py-2.5
            text-sm font-medium text-foreground
            transition-all duration-150
            hover:scale-[1.02] hover:border-primary hover:text-primary
            active:scale-[0.98]
            disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:scale-100
          "
        >
          <ArrowLeft size={16} aria-hidden="true" />
          {t('steps.save.back')}
        </button>

        {/* Primary: Save & Publish */}
        <button
          type="button"
          onClick={() => {
            void onPublish();
          }}
          disabled={isDisabled}
          data-testid="step8-publish-button"
          className="
            flex items-center justify-center gap-2 rounded-lg bg-primary px-6 py-2.5
            text-sm font-semibold text-on-primary
            transition-all duration-150
            hover:scale-[1.02] hover:shadow-[var(--shadow-glow)]
            active:scale-[0.98]
            disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:scale-100
          "
        >
          {isSaving ? (
            <Loader2 size={16} className="animate-spin" aria-hidden="true" />
          ) : (
            <CheckCircle2 size={16} aria-hidden="true" />
          )}
          {t('steps.save.publish')}
        </button>
      </div>

      {/* Validation hint when primary is disabled by incomplete state.
          Mirrors Step 7's red hint pattern (CardBuilderEditorWorkspace
          isStep7Valid). Only renders when hintKey is non-null AND the
          button is disabled for that reason (not because saving is in
          flight, which is a different UX state). */}
      {hintKey && status !== 'saving' && (
        <p
          className="flex items-center gap-1.5 text-xs"
          style={{ color: 'var(--color-destructive)' }}
          role="alert"
          data-testid="step8-validation-hint"
        >
          <span aria-hidden="true">⚠</span>
          {t(hintKey)}
        </p>
      )}
    </div>
  );
}