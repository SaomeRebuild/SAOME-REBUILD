/**
 * InitialMessageField — Step 5 section 1 (推播訊息).
 *
 * Renders a single-line `<input>` with a 50-char cap and a live character
 * counter. Optional field (Step 5 has no required inputs); the store
 * default is '' so the input starts empty.
 *
 * Behavior matches DescriptionField (Step 4 section 1) but with the
 * shorter INITIAL_MESSAGE_MAX_LENGTH=50 cap and no required validation.
 *
 * The `maxLength` HTML attribute enforces the cap at the input layer;
 * `setInitialMessage` also truncates at the cap as a belt-and-suspenders
 * guard against paste (which can exceed `maxLength` in some browsers).
 */

import { useTranslation } from 'react-i18next';
import { useCardBuilderStore } from '../CardBuilderEditor.store';
import { INITIAL_MESSAGE_MAX_LENGTH } from '@saome/shared/constants/card-back-fields';

interface InitialMessageFieldProps {
  /**
   * Surface the field's character counter as the only "validation" UI.
   * Step 5 has no required-field error state for initialMessage (it's
   * optional); the prop is forwarded for parity with the Step 4 sections
   * but currently unused.
   */
  showValidation: boolean;
}

export function InitialMessageField({ showValidation: _showValidation }: InitialMessageFieldProps) {
  const { t } = useTranslation('cardEditor');
  const initialMessage = useCardBuilderStore((s) => s.initialMessage);
  const setInitialMessage = useCardBuilderStore((s) => s.setInitialMessage);

  return (
    <section className="flex min-w-0 flex-col gap-2">
      <header className="flex flex-col gap-1">
        <h3
          className="text-base font-semibold text-foreground"
          style={{ fontFamily: 'var(--font-family-heading)' }}
        >
          {t('step5.initialMessage.label')}
        </h3>
        <p className="text-sm text-muted-foreground">
          {t('step5.initialMessage.helper')}
        </p>
      </header>

      <div className="flex flex-col gap-1.5">
        <input
          id="step5-initial-message"
          type="text"
          value={initialMessage}
          onChange={(e) => setInitialMessage(e.target.value)}
          placeholder={t('step5.initialMessage.placeholder')}
          aria-describedby="step5-initial-message-counter"
          autoComplete="off"
          maxLength={INITIAL_MESSAGE_MAX_LENGTH}
          className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        />
        <div className="flex items-center justify-end">
          <span
            id="step5-initial-message-counter"
            className="text-xs tabular-nums text-muted-foreground"
          >
            {t('step5.initialMessage.counter', {
              count: initialMessage.length,
            })}
          </span>
        </div>
      </div>
    </section>
  );
}