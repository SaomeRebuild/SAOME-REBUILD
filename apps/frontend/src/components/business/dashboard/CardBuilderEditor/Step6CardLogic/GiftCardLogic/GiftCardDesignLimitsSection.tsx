/**
 * GiftCardDesignLimitsSection — 雙層 fence sub-module: card-design fence wrapper.
 *
 * 2026-10-20: New for card-design fence (PR 1 of 雙層 fence 補強).
 * 包含 hero intro + 2 sub-field (min points + max points).
 *
 * The card-design fence bounds the points range this gift_card template can
 * configure. Wide bounds on purpose — admin can set extreme values for
 * special campaigns, and the narrower checkout fence (PR 2) provides the
 * customer-facing per-transaction bound.
 *
 * Differences from CouponCardLogic:
 *   - No radio group — single layout (range min-max).
 *   - Just composes 2 sub-fields, no preview block.
 *
 * The parent (GiftCardLogic dispatcher) renders the card-type-specific
 * hero intro BEFORE this sub-module. This sub-module only handles the
 * form composition.
 */

import { useTranslation } from 'react-i18next';
import { GiftCardDesignMinPointsField } from './GiftCardDesignMinPointsField';
import { GiftCardDesignMaxPointsField } from './GiftCardDesignMaxPointsField';
import type { GiftCardDesignLimitsSectionProps } from './GiftCardLogic.types';

export function GiftCardDesignLimitsSection({
  showValidation,
}: GiftCardDesignLimitsSectionProps) {
  const { t } = useTranslation('cardEditor');

  return (
    <div className="flex min-w-0 flex-col gap-4">
      {/* Hero intro for the card-design fence section */}
      <div className="flex flex-col gap-1.5 rounded-lg border border-dashed border-border bg-muted/30 p-4">
        <p className="text-sm font-medium text-foreground">
          {t('step6.gift.design.intro')}
        </p>
        <p className="text-xs text-muted-foreground">
          {t('step6.gift.design.introHint')}
        </p>
      </div>

      <div className="flex min-w-0 flex-col gap-4 md:flex-row md:gap-6">
        <GiftCardDesignMinPointsField showValidation={showValidation} />
        <GiftCardDesignMaxPointsField showValidation={showValidation} />
      </div>
    </div>
  );
}
