/**
 * MaxDiscountAmountField — Step 6 section 5 (最高折抵金額).
 *
 * CONDITIONALLY rendered: only shown when `rewardType === 'percent_off'`.
 *
 * Renders an `<input type="number">` for setting the per-use discount ceiling
 * when using percentage discounts.
 *
 * Behavior:
 *   - Input `0` is accepted and signals "no cap" (displayed as "無上限").
 *   - `null` in the store also means "no cap" (user cleared the field).
 *   - The `setMaxDiscountAmount` setter clamps to [0, MAX_DISCOUNT_AMOUNT_MAX].
 */

import { useTranslation } from 'react-i18next';
import { useCardBuilderStore } from '../../CardBuilderEditor.store';
import { MAX_DISCOUNT_AMOUNT_MAX } from '@saome/shared/constants';
import type { MaxDiscountAmountFieldProps } from './StampCardLogic.types';

export function MaxDiscountAmountField({ showValidation: _showValidation }: MaxDiscountAmountFieldProps) {
  const { t } = useTranslation('cardEditor');
  const rewardType = useCardBuilderStore((s) => s.rewardType);
  const maxDiscountAmount = useCardBuilderStore((s) => s.maxDiscountAmount);
  const setMaxDiscountAmount = useCardBuilderStore((s) => s.setMaxDiscountAmount);

  // Only visible in percent_off mode.
  if (rewardType !== 'percent_off') return null;

  const isZero = maxDiscountAmount === 0;
  const isEmpty = maxDiscountAmount === null;

  return (
    <section className="flex min-w-0 flex-col gap-2">
      <header className="flex flex-col gap-1">
        <h3
          className="text-base font-semibold text-foreground"
          style={{ fontFamily: 'var(--font-family-heading)' }}
        >
          {t('step6.stamp.maxDiscountTitle')}
        </h3>
        <p className="text-sm text-muted-foreground">
          {t('step6.stamp.maxDiscountDescription')}
        </p>
      </header>

      <div className="flex flex-col gap-1.5">
        <div className="flex items-center gap-2">
          <input
            id="step6-max-discount"
            type="number"
            inputMode="decimal"
            value={isEmpty ? '' : String(maxDiscountAmount ?? '')}
            onChange={(e) => {
              const raw = e.target.value.trim();
              if (raw === '') {
                // User cleared the field → null = no cap.
                setMaxDiscountAmount(null);
                return;
              }
              const num = parseFloat(raw);
              if (Number.isNaN(num) || num < 0) return;
              // Clamp to MAX_DISCOUNT_AMOUNT_MAX (setter does this).
              setMaxDiscountAmount(Math.round(num));
            }}
            placeholder={t('step6.stamp.maxDiscountPlaceholder')}
            min={0}
            max={MAX_DISCOUNT_AMOUNT_MAX}
            aria-describedby="step6-max-discount-hint"
            className={`
              flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm
              text-foreground ring-offset-background
              placeholder:text-muted-foreground
              focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2
            `}
          />
          <span className="shrink-0 text-sm text-muted-foreground">
            {t('step6.stamp.rewardValueAmountUnit') || '$'}
          </span>
        </div>

        {/* Helper text */}
        <div id="step6-max-discount-hint" className="flex flex-col gap-0.5">
          <p className="text-xs text-muted-foreground">
            {t('step6.stamp.maxDiscountHelper')}
          </p>
          {isEmpty && (
            <p className="text-xs text-muted-foreground italic">
              {t('step6.stamp.maxDiscountOptional')}
            </p>
          )}
          {isZero && (
            <p className="text-xs text-muted-foreground italic">
              {t('step6.stamp.maxDiscountZeroIsNoCap')}
            </p>
          )}
        </div>
      </div>
    </section>
  );
}
