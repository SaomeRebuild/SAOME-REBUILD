/**
 * StampCardImageComposer — main component (L2 business, ≤100 lines).
 *
 * The component is a thin trigger + status display layer. All
 * orchestration (compose + upload + state machine) lives in
 * `useStampCardImageComposer` (`.hooks.ts`).
 *
 * Visual: a button labeled with the i18n key `stampCard.composer.trigger.previewSaveAsZero`,
 * with a status pill below it showing the current state.
 *
 * 2026-10-13 — Created with the stamp card image composition plan.
 */

import { useTranslation } from 'react-i18next';
import { useStampCardImageComposer } from './StampCardImageComposer.hooks';
import type { StampCardImageInput } from '@saome/shared/schemas/stampCard';
import { STAMP_FILL_CAP } from '@saome/shared/constants/stampCard';
import { isGridFullyStampable } from '@saome/shared/logic/stampCardImage';

export interface StampCardImageComposerProps {
  templateId: string | null;
  authToken: string | null;
  input: StampCardImageInput;
}

export function StampCardImageComposer({
  templateId,
  authToken,
  input,
}: StampCardImageComposerProps) {
  const { t } = useTranslation('stampCard');
  const { status, error, composeAndSave, reset } = useStampCardImageComposer({
    templateId,
    authToken,
    input,
  });

  const gridClipped = !isGridFullyStampable(input.rows, input.cols);

  const statusLabel = (() => {
    switch (status) {
      case 'idle':
        return t('composer.status.idle');
      case 'composing':
        return t('composer.status.composing');
      case 'uploading':
        return t('composer.status.uploading');
      case 'saved':
        return t('composer.status.saved');
      case 'error':
        return t('composer.status.error');
    }
  })();

  return (
    <div className="flex flex-col gap-2" data-testid="stamp-card-composer">
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={composeAndSave}
          disabled={status === 'composing' || status === 'uploading' || !templateId}
          className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50"
          data-testid="stamp-card-composer-button"
        >
          {t('composer.trigger.previewSaveAsZero')}
        </button>
        <span
          className="text-sm text-muted-foreground"
          data-testid="stamp-card-composer-status"
        >
          {statusLabel}
          {status === 'error' && error ? ` (${error})` : null}
        </span>
        {status !== 'idle' && status !== 'composing' && status !== 'uploading' ? (
          <button
            type="button"
            onClick={reset}
            className="text-xs text-muted-foreground underline"
            data-testid="stamp-card-composer-reset"
          >
            {t('composer.trigger.previewSaveAsZero').endsWith('0.png') ? 'reset' : 'reset'}
          </button>
        ) : null}
      </div>
      {gridClipped ? (
        <p
          className="text-xs text-amber-600"
          data-testid="stamp-card-composer-cap-warning"
        >
          {t('composer.cap.warning', { count: input.rows * input.cols })}
          {' '}
          (cap = {STAMP_FILL_CAP})
        </p>
      ) : null}
      <p
        className="text-xs text-muted-foreground"
        data-testid="stamp-card-composer-grid-hint"
      >
        {t('composer.gridTransparent')}
      </p>
    </div>
  );
}
