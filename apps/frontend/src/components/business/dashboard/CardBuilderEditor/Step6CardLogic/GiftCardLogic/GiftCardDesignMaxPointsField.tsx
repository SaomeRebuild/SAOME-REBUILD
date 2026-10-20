/**
 * GiftCardDesignMaxPointsField — Gift card sub-field 4 (方案發行點數上限).
 *
 * 2026-10-20: New for card-design fence (PR 1 of 雙層 fence 補強).
 * Mirrors GiftCardDesignMinPointsField structurally but bound to the
 * `giftCardDesignMaxPoints` store field — the upper bound of the
 * admin-configurable points range for this gift_card template.
 *
 * Cross-field invariant: 拒絕 < `giftCardDesignMinPoints`(由 setter
 * 防護). UI 顯示 `minGreaterThanMax` 錯誤當 user 試圖違反 invariant.
 *
 * Validation: when showValidation=true AND value 違反 invariant,
 * show red border + error message.
 */

import { useTranslation } from 'react-i18next';
import { useCardBuilderStore } from '../../CardBuilderEditor.store';
import type { GiftCardDesignMaxPointsFieldProps } from './GiftCardLogic.types';

export function GiftCardDesignMaxPointsField({
  showValidation,
}: GiftCardDesignMaxPointsFieldProps) {
  const { t } = useTranslation('cardEditor');
  const value = useCardBuilderStore((s) => s.giftCardDesignMaxPoints);
  const minValue = useCardBuilderStore((s) => s.giftCardDesignMinPoints);
  const setValue = useCardBuilderStore((s) => s.setGiftCardDesignMaxPoints);

  const isOutOfBounds =
    typeof value !== 'number' ||
    !Number.isFinite(value) ||
    !Number.isInteger(value) ||
    value < 1;
  const isUnderMin =
    typeof value === 'number' &&
    typeof minValue === 'number' &&
    Number.isInteger(value) &&
    Number.isInteger(minValue) &&
    value < minValue;
  const isInvalid = showValidation && (isOutOfBounds || isUnderMin);

  const displayValue =
    value === null || value === undefined ? '' : String(value);

  return (
    <section className="flex min-w-0 flex-col gap-1.5">
      <label
        htmlFor="step6-gift-design-max-points"
        className="text-xs font-medium text-muted-foreground"
      >
        {t('step6.gift.design.maxPointsLabel')}
      </label>

      <div className="flex items-center gap-2">
        <input
          id="step6-gift-design-max-points"
          type="number"
          inputMode="numeric"
          value={displayValue}
          onChange={(e) => {
            const raw = e.target.value.trim();
            if (raw === '') {
              return;
            }
            const num = parseFloat(raw);
            if (Number.isNaN(num)) return;
            // Reject values that lose precision (> Number.MAX_SAFE_INTEGER)
            // to prevent corrupted `1.0000000000000003e+21` from entering the store.
            if (!Number.isSafeInteger(num)) {
              console.warn(
                '[GiftCardDesignMaxPointsField] rejected unsafe integer:',
                raw,
                '→',
                num,
              );
              return;
            }
            setValue(num);
          }}
          placeholder={t('step6.gift.design.placeholderMaxPoints')}
          min={1}
          max={Number.MAX_SAFE_INTEGER}
          step={1}
          aria-label={t('step6.gift.design.maxPointsLabel')}
          aria-invalid={isInvalid}
          className={`
            flex h-10 w-full min-w-0 rounded-md border bg-background px-3 py-2 text-sm
            text-foreground ring-offset-background
            placeholder:text-muted-foreground
            focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2
            disabled:cursor-not-allowed disabled:opacity-50
            ${isInvalid ? 'border-destructive' : 'border-input'}
          `}
        />
        <span className="shrink-0 text-sm text-muted-foreground">
          {t('step6.gift.pointsUnit')}
        </span>
      </div>

      {isInvalid && (
        <p className="text-xs text-destructive" role="alert">
          {isUnderMin
            ? t('step6.gift.validation.minGreaterThanMax')
            : t('step6.gift.validation.positive')}
        </p>
      )}
    </section>
  );
}
