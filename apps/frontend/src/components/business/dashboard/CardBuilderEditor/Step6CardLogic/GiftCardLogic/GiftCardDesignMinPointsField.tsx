/**
 * GiftCardDesignMinPointsField — Gift card sub-field 3 (方案發行點數下限).
 *
 * 2026-10-20: New for card-design fence (PR 1 of 雙層 fence 補強).
 * Mirrors GiftCardPointsField structurally but bound to the
 * `giftCardDesignMinPoints` store field — the lower bound of the
 * admin-configurable points range for this gift_card template.
 *
 * Differences from GiftCardPointsField:
 *   - Reads `giftCardDesignMinPoints` (not `giftCardPoints`)
 *   - Unit suffix is always "點" (points don't change with currency)
 *   - Validation message uses fence-specific keys (`minGreaterThanMax`)
 *
 * Cross-field invariant: 拒絕 > `giftCardDesignMaxPoints`(由 setter
 * 防護; UI 顯示 `minGreaterThanMax` 錯誤當 setter 拒絕後讀者無法理解。
 *
 * Validation: when showValidation=true AND value 違反 invariant,
 * show red border + error message.
 */

import { useTranslation } from 'react-i18next';
import { useCardBuilderStore } from '../../CardBuilderEditor.store';
import type { GiftCardDesignMinPointsFieldProps } from './GiftCardLogic.types';

export function GiftCardDesignMinPointsField({
  showValidation,
}: GiftCardDesignMinPointsFieldProps) {
  const { t } = useTranslation('cardEditor');
  const value = useCardBuilderStore((s) => s.giftCardDesignMinPoints);
  const maxValue = useCardBuilderStore((s) => s.giftCardDesignMaxPoints);
  const setValue = useCardBuilderStore((s) => s.setGiftCardDesignMinPoints);

  const isOutOfBounds =
    typeof value !== 'number' ||
    !Number.isFinite(value) ||
    !Number.isInteger(value) ||
    value < 1;
  const isOverMax =
    typeof value === 'number' &&
    typeof maxValue === 'number' &&
    Number.isInteger(value) &&
    Number.isInteger(maxValue) &&
    value > maxValue;
  const isInvalid = showValidation && (isOutOfBounds || isOverMax);

  const displayValue =
    value === null || value === undefined ? '' : String(value);

  return (
    <section className="flex min-w-0 flex-col gap-1.5">
      <label
        htmlFor="step6-gift-design-min-points"
        className="text-xs font-medium text-muted-foreground"
      >
        {t('step6.gift.design.minPointsLabel')}
      </label>

      <div className="flex items-center gap-2">
        <input
          id="step6-gift-design-min-points"
          type="number"
          inputMode="numeric"
          value={displayValue}
          onChange={(e) => {
            const raw = e.target.value.trim();
            if (raw === '') {
              // Don't reset — keep the previous value (gift card must
              // always have a defined rate; loadSettings initializes
              // this from DB or initialState).
              return;
            }
            const num = parseFloat(raw);
            if (Number.isNaN(num)) return;
            // Reject values that lose precision (> Number.MAX_SAFE_INTEGER)
            // to prevent corrupted `1.0000000000000003e+21` from entering the store.
            if (!Number.isSafeInteger(num)) {
              console.warn(
                '[GiftCardDesignMinPointsField] rejected unsafe integer:',
                raw,
                '→',
                num,
              );
              return;
            }
            // Store setter rejects ≤ 0, non-integer, > max. We display
            // the rejection via cross-field error if showValidation is on.
            setValue(num);
          }}
          placeholder={t('step6.gift.design.placeholderMinPoints')}
          min={1}
          max={Number.MAX_SAFE_INTEGER}
          step={1}
          aria-label={t('step6.gift.design.minPointsLabel')}
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
          {isOverMax
            ? t('step6.gift.validation.minGreaterThanMax')
            : t('step6.gift.validation.positive')}
        </p>
      )}
    </section>
  );
}
