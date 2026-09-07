/**
 * Step6CardLogicComingSoon — Placeholder shown for card types without a Step 6 implementation.
 *
 * Rendered when cardType is null or not yet a supported card type.
 * Does NOT include prev/next buttons — those live in CardBuilderEditorWorkspace.
 */

import { useTranslation } from 'react-i18next';
import { type CardType } from '@saome/shared/schemas/card';

interface Step6CardLogicComingSoonProps {
  /** The card type that is not yet supported, or null if no type selected. */
  cardType: CardType | null;
}

export function Step6CardLogicComingSoon({ cardType }: Step6CardLogicComingSoonProps) {
  const { t } = useTranslation('cardEditor');

  const cardTypeLabel = cardType
    ? t(`step1.cardTypes.${cardType}`)
    : null;

  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed border-border bg-muted/30 py-10">
      <svg
        aria-hidden="true"
        className="text-muted-foreground/50"
        fill="none"
        height="32"
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth={1.5}
        width="32"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M9.879 7.519c1.171-1.025 3.071-1.025 4.242 0 1.172 1.025 1.172 2.687 0 3.712-.203.179-.43.326-.67.442-.745.361-1.45.999-1.45 1.827v.75M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9 5.25h.008v.008H12v-.008z"
        />
      </svg>
      <div className="flex flex-col items-center gap-1 text-center">
        <p className="text-sm font-medium text-foreground">
          {cardType
            ? t('step6.comingSoon.otherCardTypes')
            : t('step6.comingSoon.otherCardTypes')}
        </p>
        {cardType ? (
          <p className="text-xs text-muted-foreground">
            {t('step6.comingSoon.hint')} ({cardTypeLabel})
          </p>
        ) : (
          <p className="text-xs text-muted-foreground">
            {t('step6.comingSoon.hint')}
          </p>
        )}
      </div>
    </div>
  );
}
