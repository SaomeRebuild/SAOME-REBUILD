/**
 * DiscountTierThresholdField — Discount tier sub-field 2 (累積消費門檻).
 *
 * Renders a `<input type="number">` for the cumulative spend threshold.
 *
 * Currency-aware rendering (2026-09-11 pattern, reused 2026-09-18):
 *   - TWD zh-TW: suffix 元 (e.g. "累計消費 1000元")
 *   - TWD en:    prefix NT$ (e.g. "Cumulative Spend NT$1000")
 *   - ZAR:       prefix R (e.g. "Cumulative Spend R1000")
 *
 * Always shows the current numeric value (mirrors CashbackTierThresholdField
 * 2026-09-11 fix): threshold=0 displays as "0" in the input — NOT empty.
 *
 * Calls `updateDiscountTier(tierId, { thresholdSpend })` on each change.
 * Store guard: rejects < 0 (allows 0 as legitimate default tier).
 */

import { useTranslation } from 'react-i18next';
import { useCardBuilderStore } from '../../CardBuilderEditor.store';
import type { DiscountTierThresholdFieldProps } from './DiscountCardLogic.types';

export function DiscountTierThresholdField({ showValidation, tierId }: DiscountTierThresholdFieldProps) {
  const { t, i18n } = useTranslation('cardEditor');
  const tier = useCardBuilderStore((s) =>
    s.discountTiers.find((tier) => tier.id === tierId),
  );
  const currency = useCardBuilderStore((s) => s.currency);
  const updateDiscountTier = useCardBuilderStore((s) => s.updateDiscountTier);

  if (!tier) return null;

  const thresholdSpend = tier.thresholdSpend;
  const isInvalid = showValidation && thresholdSpend < 0;

  // Currency-aware unit placement (mirrors CashbackTierThresholdField).
  // - TWD zh-TW: 「累計消費 [input] 元」  → suffix
  // - TWD en:    「累計消費 NT$ [input]」 → prefix
  // - ZAR:       「累計消費 R [input]」    → prefix
  const isZAR = currency === 'ZAR';
  const isZhLocale = (i18n.language ?? '').startsWith('zh');
  const unitPrefix = isZAR
    ? t('step6.discount.tier.thresholdUnitZAR')
    : !isZhLocale
    ? t('step6.discount.tier.thresholdUnitTWD') // TWD en: NT$ prefix
    : '';
  const unitSuffix = isZAR
    ? ''
    : isZhLocale
    ? t('step6.discount.tier.thresholdUnitTWD') // TWD zh-TW: 元 suffix
    : '';

  // Always render the actual numeric value (including "0").
  const displayValue = String(thresholdSpend);

  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      <label
        htmlFor={`step6-discount-${tierId}-threshold`}
        className="text-xs font-medium text-muted-foreground"
      >
        {t('step6.discount.tier.thresholdTitle')}
      </label>

      <div className="flex items-center gap-2">
        {unitPrefix && (
          <span className="shrink-0 text-sm text-muted-foreground">
            {unitPrefix}
          </span>
        )}
        <input
          id={`step6-discount-${tierId}-threshold`}
          type="number"
          inputMode="numeric"
          value={displayValue}
          onChange={(e) => {
            const raw = e.target.value.trim();
            if (raw === '') {
              // Empty → default to 0 (no threshold, everyone qualifies).
              updateDiscountTier(tierId, { thresholdSpend: 0 });
              return;
            }
            const num = parseFloat(raw);
            if (Number.isNaN(num) || num < 0) return; // store guards < 0
            updateDiscountTier(tierId, { thresholdSpend: Math.round(num) });
          }}
          placeholder={t('step6.discount.tier.thresholdPlaceholder')}
          min={0}
          aria-label={t('step6.discount.tier.thresholdTitle')}
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
        {unitSuffix && (
          <span className="shrink-0 text-sm text-muted-foreground">
            {unitSuffix}
          </span>
        )}
      </div>

      {isInvalid && (
        <p className="text-xs text-destructive" role="alert">
          {t('step6.discount.tier.thresholdInvalidError')}
        </p>
      )}

      {/* Helper text below input — explains the threshold=0 ("no threshold,
          everyone qualifies") meaning since the placeholder is hidden when
          the input has a value. */}
      <p className="text-xs text-muted-foreground">
        {t('step6.discount.tier.thresholdHelper')}
      </p>
    </div>
  );
}
