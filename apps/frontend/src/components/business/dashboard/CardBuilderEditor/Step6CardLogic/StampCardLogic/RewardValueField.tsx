/**
 * RewardValueField — Step 6 section 4 (獎勵數量).
 *
 * Renders an `<input type="number">` whose placeholder and unit label
 * change based on the selected `rewardType`:
 *   amount_off  → "輸入折抵金額" + currency unit
 *   percent_off → "輸入折抵%數" + "%" unit
 *
 * Validation:
 *   - Negative numbers are rejected by the `onChange` handler (store
 *     `setRewardValue` silently ignores them — no state update).
 *   - Backend zod `.positive()` is the authoritative double-check on save.
 *   - Step 5's `isStep6Valid()` also checks rewardValue > 0.
 *
 * State dependency: renders a hint paragraph when rewardType is not yet selected.
 */

import { useTranslation } from 'react-i18next';
import { useCardBuilderStore } from '../../CardBuilderEditor.store';
import type { RewardValueFieldProps } from './StampCardLogic.types';

export function RewardValueField({ showValidation }: RewardValueFieldProps) {
  const { t } = useTranslation('cardEditor');
  const rewardType = useCardBuilderStore((s) => s.rewardType);
  const rewardValue = useCardBuilderStore((s) => s.rewardValue);
  const setRewardValue = useCardBuilderStore((s) => s.setRewardValue);
  // 2026-09-10 currency-aware rendering: ZAR prefix (R), TWD suffix (元 / NT$).
  const currency = useCardBuilderStore((s) => s.currency);

  const isAmount = rewardType === 'amount_off';
  const isPercent = rewardType === 'percent_off';
  const isSelected = rewardType !== null;
  const showError = showValidation && isSelected && (rewardValue === null || rewardValue <= 0);

  const placeholder =
    isAmount
      ? t('step6.stamp.rewardValuePlaceholderAmount')
      : isPercent
      ? t('step6.stamp.rewardValuePlaceholderPercent')
      : '';

  // 2026-09-10: split unit into prefix / suffix so currency-aware
  // placement matches locale convention (ZAR prefix R; TWD suffix 元
  // for zh-TW, prefix NT$ for en).
  const isZAR = currency === 'ZAR';
  const unitPrefix =
    isAmount && isZAR
      ? t('step6.stamp.rewardValueAmountUnitZAR')
      : '';
  const unitSuffix =
    isAmount && !isZAR
      ? t('step6.stamp.rewardValueAmountUnitTWD')
      : isPercent
      ? t('step6.stamp.rewardValuePercentUnit')
      : '';

  return (
    <section className="flex min-w-0 flex-col gap-2">
      <header className="flex flex-col gap-1">
        <h3
          className="text-base font-semibold text-foreground"
          style={{ fontFamily: 'var(--font-family-heading)' }}
        >
          {t('step6.stamp.rewardValueLabel')}
        </h3>
      </header>

      {!isSelected && (
        <p className="text-xs text-muted-foreground">
          {t('step6.stamp.rewardTypePlaceholder')}
        </p>
      )}

      {isSelected && (
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center gap-2">
            {unitPrefix && (
              <span className="shrink-0 text-sm text-muted-foreground">
                {unitPrefix}
              </span>
            )}
            <input
              id="step6-reward-value"
              type="number"
              inputMode="decimal"
              value={rewardValue ?? ''}
              onChange={(e) => {
                const raw = e.target.value;
                if (raw === '') {
                  setRewardValue(null);
                  return;
                }
                const num = parseFloat(raw);
                if (Number.isNaN(num) || num <= 0) {
                  // Reject — store setter ignores non-positive values.
                  return;
                }
                setRewardValue(num);
              }}
              placeholder={placeholder}
              min={isPercent ? 1 : undefined}
              max={isPercent ? 100 : undefined}
              aria-describedby="step6-reward-value-hint"
              aria-invalid={showError}
              className={`
                flex h-10 w-full rounded-md border bg-background px-3 py-2 text-sm
                text-foreground ring-offset-background
                placeholder:text-muted-foreground
                focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2
                disabled:cursor-not-allowed disabled:opacity-50
                ${showError ? 'border-destructive' : 'border-input'}
              `}
            />
            {unitSuffix && (
              <span className="shrink-0 text-sm text-muted-foreground">
                {unitSuffix}
              </span>
            )}
          </div>

          {showError && (
            <p className="text-xs text-destructive" role="alert">
              {t('step6.stamp.rewardValueEmptyError')}
            </p>
          )}

          {/* Show validation errors inline when user has typed something invalid */}
          {rewardValue !== null && rewardValue <= 0 && (
            <p className="text-xs text-destructive" role="alert">
              {t('step6.stamp.rewardValueTooSmallError')}
            </p>
          )}
          {isPercent && rewardValue !== null && rewardValue > 100 && (
            <p className="text-xs text-destructive" role="alert">
              {t('step6.stamp.rewardValueTooLargeError')}
            </p>
          )}
        </div>
      )}
    </section>
  );
}
