/**
 * MultipassTierMaxDiscountAmountField — ★ PR-6 per-tier 最高折抵金額 (2026-09-20).
 *
 * CONDITIONALLY renders: only shown when the tier's `rewardType === 'percent_off'`.
 * Mirrors StampCardLogic.MaxDiscountAmountField behavior but scoped to a single tier.
 *
 * Behavior:
 *   - Input `0` is accepted and signals "no cap" (displayed as "無上限" in zh-TW).
 *   - `null` in the store also means "no cap" (user cleared the field).
 *   - The store setter clamps to [0, MAX_DISCOUNT_AMOUNT_MAX].
 *
 * Differences from StampCardLogic.MaxDiscountAmountField:
 *   - Per-tier (receives `tierId`, reads from `multipassTiers[]`).
 *   - Different i18n namespace: `step6.multipass.tier.maxDiscount*`.
 *
 * Differences from DiscountCardLogic (if any):
 *   - DiscountCardLogic uses card-wide maxDiscountAmount; Multipass is per-tier.
 */

import { useTranslation } from 'react-i18next';
import { useCardBuilderStore } from '../../CardBuilderEditor.store';
import { MAX_DISCOUNT_AMOUNT_MAX } from '@saome/shared/constants';
import type { MultipassTierMaxDiscountAmountFieldProps } from './MultipassCardLogic.types';

export function MultipassTierMaxDiscountAmountField({
  showValidation: _showValidation,
  tierId,
}: MultipassTierMaxDiscountAmountFieldProps) {
  const { t, i18n } = useTranslation('cardEditor');
  const tier = useCardBuilderStore((s) =>
    s.multipassTiers.find((tier) => tier.id === tierId),
  );
  const updateMultipassTier = useCardBuilderStore((s) => s.updateMultipassTier);
  const currency = useCardBuilderStore((s) => s.currency);

  if (!tier) return null;

  // Only visible when rewardType is percent_off.
  if (tier.rewardType !== 'percent_off') return null;

  const maxDiscountAmount = tier.maxDiscountAmount;
  const isZero = maxDiscountAmount === 0;
  const isEmpty = maxDiscountAmount === null;

  // 2026-09-10: split unit into prefix / suffix per locale convention.
  // - ZAR: prefix R (both zh-TW + en)
  // - TWD zh-TW: suffix 元
  // - TWD en: prefix NT$
  const isZAR = currency === 'ZAR';
  const isZhLocale = (i18n.language ?? '').toLowerCase().startsWith('zh');
  const unitText = isZAR
    ? t('step6.multipass.tier.maxDiscountUnitZAR')
    : t('step6.multipass.tier.maxDiscountUnitTWD');
  const renderAsSuffix = !isZAR && isZhLocale;
  const unitPrefix = renderAsSuffix ? '' : unitText;
  const unitSuffix = renderAsSuffix ? unitText : '';

  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      <label
        htmlFor={`step6-multipass-${tierId}-max-discount`}
        className="text-xs font-medium text-muted-foreground"
      >
        {t('step6.multipass.tier.maxDiscountTitle')}
      </label>
      <div className="flex flex-col gap-1">
        <div className="relative flex items-center">
          {unitPrefix && (
            <span className="pointer-events-none absolute left-3 text-xs text-muted-foreground">
              {unitPrefix}
            </span>
          )}
          <input
            id={`step6-multipass-${tierId}-max-discount`}
            type="number"
            inputMode="decimal"
            value={isEmpty ? '' : String(maxDiscountAmount ?? '')}
            min={0}
            max={MAX_DISCOUNT_AMOUNT_MAX}
            step={1}
            onChange={(e) => {
              const raw = e.target.value.trim();
              if (raw === '') {
                // User cleared the field → null = no cap.
                updateMultipassTier(tierId, { maxDiscountAmount: null });
                return;
              }
              const num = parseFloat(raw);
              if (Number.isNaN(num) || num < 0) return;
              updateMultipassTier(tierId, { maxDiscountAmount: Math.round(num) });
            }}
            placeholder={t('step6.multipass.tier.maxDiscountPlaceholder')}
            aria-label={t('step6.multipass.tier.maxDiscountTitle')}
            className={`
              flex h-10 w-full rounded-md border border-input bg-background
              py-2 text-sm text-foreground ring-offset-background
              placeholder:text-muted-foreground
              focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2
              disabled:cursor-not-allowed disabled:opacity-50
              ${unitPrefix ? 'pl-10 pr-3' : 'pr-10 pl-3'}
            `}
          />
          {unitSuffix && (
            <span className="pointer-events-none absolute right-3 text-xs text-muted-foreground">
              {unitSuffix}
            </span>
          )}
        </div>
        <div className="flex flex-col gap-0.5">
          <p className="text-xs text-muted-foreground">
            {t('step6.multipass.tier.maxDiscountHelper')}
          </p>
          {isEmpty && (
            <p className="text-xs text-muted-foreground italic">
              {t('step6.multipass.tier.maxDiscountOptional')}
            </p>
          )}
          {isZero && (
            <p className="text-xs text-muted-foreground italic">
              {t('step6.multipass.tier.maxDiscountZeroIsNoCap')}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
