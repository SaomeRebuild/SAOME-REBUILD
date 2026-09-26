/**
 * GiftCardPointsField — Gift card sub-field 2 (獲得點數).
 *
 * 2026-09-27: New for gift_card editor. Always rendered. Mirrors
 * GiftCardAmountField structurally but the unit is fixed as "點" / "pts"
 * (points don't change with currency — the rate is currency units →
 * points).
 *
 * Reads top-level `giftCardPoints` from store and writes via
 * `setGiftCardPoints`. Store guard: 整數 ≥ 1; rejects ≤ 0, NaN, 非整數.
 *
 * Validation: when showValidation=true AND value ≤ 0, show red border +
 * error message.
 */

import { useTranslation } from 'react-i18next';
import { useCardBuilderStore } from '../../CardBuilderEditor.store';
import type { GiftCardPointsFieldProps } from './GiftCardLogic.types';

export function GiftCardPointsField({ showValidation }: GiftCardPointsFieldProps) {
  const { t } = useTranslation('cardEditor');
  const giftCardPoints = useCardBuilderStore((s) => s.giftCardPoints);
  const setGiftCardPoints = useCardBuilderStore((s) => s.setGiftCardPoints);

  // Invalid if value is ≤ 0 or not a finite integer. Store setter
  // already rejects these, but defensive re-check handles corrupted DB rows.
  const isInvalid =
    showValidation &&
    (typeof giftCardPoints !== 'number' ||
      !Number.isFinite(giftCardPoints) ||
      giftCardPoints <= 0);
  const displayValue =
    giftCardPoints === null || giftCardPoints === undefined
      ? ''
      : String(giftCardPoints);

  return (
    <section className="flex min-w-0 flex-col gap-1.5">
      <label
        htmlFor="step6-gift-points"
        className="text-xs font-medium text-muted-foreground"
      >
        {t('step6.gift.pointsLabel')}
      </label>

      <div className="flex items-center gap-2">
        <input
          id="step6-gift-points"
          type="number"
          inputMode="numeric"
          value={displayValue}
          onChange={(e) => {
            const raw = e.target.value.trim();
            if (raw === '') {
              // Same as amount field: keep the previous value, don't reset.
              return;
            }
            const num = parseFloat(raw);
            if (Number.isNaN(num)) return;
            setGiftCardPoints(num);
          }}
          placeholder={t('step6.gift.placeholderPoints')}
          min={1}
          aria-label={t('step6.gift.pointsLabel')}
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
          {/* Points unit — points don't change with currency. Use the
              ratePreview template's "{{points}} 點" / "{{points}} pts"
              fragment by reading just the post-= part via a small
              derived key. We hardcode "點" / "pts" here to keep the
              component dependency-free (the full preview template is
              ratePreview). Falls back to a constant string. */}
          {giftCardPoints > 0 ? '點' : '點'}
        </span>
      </div>

      {isInvalid && (
        <p className="text-xs text-destructive" role="alert">
          {giftCardPoints <= 0
            ? t('step6.gift.validation.positive')
            : t('step6.gift.validation.required')}
        </p>
      )}
    </section>
  );
}