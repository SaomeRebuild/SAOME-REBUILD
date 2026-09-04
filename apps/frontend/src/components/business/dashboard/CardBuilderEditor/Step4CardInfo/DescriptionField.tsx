/**
 * DescriptionField — card description textarea (Step 4 section 1).
 *
 * Renders a `<textarea>` with a live character counter. Required by
 * `isStep4Valid()` (the parent passes `showValidation={!isStep4Valid()}`),
 * so an empty textarea shows a destructive border + error message.
 *
 * `setDescription` is called on every keystroke → the live preview in
 * `PassCardPreviewBack` (Section 1) updates without waiting for "Next".
 */

import { useTranslation } from 'react-i18next';
import { useCardBuilderStore } from '../CardBuilderEditor.store';
import { DESCRIPTION_MAX_LENGTH } from '@saome/shared/constants/card-back-fields';

interface DescriptionFieldProps {
  /** Surface the required-field error. Pass `!isStep4Valid()` from the parent. */
  showValidation: boolean;
}

export function DescriptionField({ showValidation }: DescriptionFieldProps) {
  const { t } = useTranslation('cardEditor');
  const description = useCardBuilderStore((s) => s.description);
  const setDescription = useCardBuilderStore((s) => s.setDescription);
  const isEmpty = description.trim().length === 0;

  return (
    <section className="flex min-w-0 flex-col gap-2">
      <header className="flex flex-col gap-1">
        <h3
          className="text-base font-semibold text-foreground"
          style={{ fontFamily: 'var(--font-family-heading)' }}
        >
          {t('step4.description.title')}
        </h3>
        <p className="text-sm text-muted-foreground">
          {t('step4.description.hint')}
        </p>
      </header>

      <div className="flex flex-col gap-1.5">
        <textarea
          id="step4-description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder={t('step4.description.title')}
          aria-invalid={showValidation && isEmpty ? 'true' : undefined}
          aria-describedby={showValidation && isEmpty ? 'step4-description-error' : 'step4-description-counter'}
          maxLength={DESCRIPTION_MAX_LENGTH}
          autoComplete="off"
          rows={3}
          className={`flex min-h-[80px] w-full resize-y rounded-md border bg-background px-3 py-2 text-sm text-foreground ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 md:min-h-[80px] ${
            showValidation && isEmpty ? 'border-destructive focus-visible:ring-destructive' : 'border-input'
          }`}
        />
        <div className="flex items-center justify-between gap-2">
          {showValidation && isEmpty ? (
            <p
              id="step4-description-error"
              className="flex items-center gap-1.5 text-xs"
              style={{ color: 'var(--color-destructive)' }}
              role="alert"
            >
              <span aria-hidden="true">⚠</span>
              {t('step4.description.required')}
            </p>
          ) : (
            <span />
          )}
          <span
            id="step4-description-counter"
            className="text-xs tabular-nums text-muted-foreground"
          >
            {t('step4.description.counter', { count: description.length })}
          </span>
        </div>
      </div>
    </section>
  );
}