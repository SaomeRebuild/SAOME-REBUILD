/**
 * MultipassTierRewardValueField — Reward value input.
 *
 * Conditional on `rewardType`:
 *   - amount_off: cash discount number (placeholder + unit depend on currency)
 *   - percent_off: integer 1-100
 *   - null: hidden (user must pick a type first)
 *
 * Mirrors StampCardLogic.RewardValueField pattern:
 *   - amount_off: TWD zh-TW suffix 「元」; TWD en prefix「NT$」; ZAR prefix「R」
 *   - percent_off: integer 1-100, suffix「%」
 *
 * Validation: shows a red border + error message when `showValidation`
 * is true AND the value is null.
 *
 * ★ PR-5 (2026-09-20) Fix #1: 0 = legitimate (no discount for this tier).
 * Previously the condition was `value === null || value <= 0`. Now ONLY
 * `value === null` triggers the error. The store setter `setRewardValue`
 * ALSO rejects ≤ 0 (so 0 can never reach the store from this UI), and
 * the backend zod `.positive()` schema enforces it on save (Rule 032
 * silent-killer backstop). 歡迎禮 (stampsNeeded=0) does NOT use
 * rewardValue===0 to convey "no reward"; see `stampsNeeded === 0`.
 *
 * ★ PR-5 Fix #2: ZAR prefix / TWD suffix layout. The component now
 * distinguishes between prefix and suffix placement:
 *   - amount_off + ZAR: prefix 「R」 on the left
 *   - amount_off + TWD (zh-TW): suffix 「元」 on the right
 *   - amount_off + TWD (en): suffix 「NT$」 on the right (en 文)
 *   - amount_off + ZAR (en): prefix 「R」 on the left (en 文)
 *   - percent_off: suffix 「%」 on the right (no currency dependency)
 * The suffix renders at right-3 with `pr-X` padding on the input;
 * the prefix renders at left-3 with `pl-X` padding on the input.
 */

import { useTranslation } from 'react-i18next';
import { useCardBuilderStore } from '../../CardBuilderEditor.store';
import type { MultipassTierRewardValueFieldProps } from './MultipassCardLogic.types';

export function MultipassTierRewardValueField({
  showValidation,
  tierId,
}: MultipassTierRewardValueFieldProps) {
  const { t } = useTranslation('cardEditor');
  const currency = useCardBuilderStore((s) => s.currency);
  const tier = useCardBuilderStore((s) =>
    s.multipassTiers.find((tier) => tier.id === tierId),
  );
  const updateMultipassTier = useCardBuilderStore((s) => s.updateMultipassTier);

  if (!tier) return null;

  const value = tier.rewardValue;
  const rewardType = tier.rewardType;

  // 沒選 rewardType → 不 render (user 必須先選 type).
  if (rewardType === null) return null;

  // ★ PR-5 Fix #1: 0 = 合法 (no discount for this tier). Only null triggers
  // the red border / error message. This makes stampsNeeded === 0 (歡迎禮)
  // decoupled from rewardValue === 0 (no discount). The store setter still
  // rejects ≤ 0 (which would be an off-by-one — `setRewardValue` rejects
  // non-positive; UI cannot even produce a 0 here except via direct state
  // mutation, in which case validation passes — by design).
  const showError = showValidation && value === null;

  // 區分 prefix / suffix 兩種 layout (★ PR-5 Fix #2):
  //   - ZAR amount: prefix 「R」 放左側 (貨幣在前的 locale 慣例)
  //   - TWD amount: suffix 「元」 / 「NT$」 放右側
  //   - percent: suffix 「%」 永遠在右側
  const isZAR = currency === 'ZAR';
  const isAmount = rewardType === 'amount_off';
  const isPercent = rewardType === 'percent_off';

  const unitPrefix =
    isAmount && isZAR ? t('step6.multipass.tier.rewardValueAmountUnitZAR') : '';
  const unitSuffix =
    isPercent
      ? t('step6.multipass.tier.rewardValuePercentUnit')
      : isAmount && !isZAR
        ? t('step6.multipass.tier.rewardValueAmountUnitTWD')
        : '';

  const paddingClass = unitPrefix
    ? 'pl-12'  // R 在左 → 預留左側空間
    : 'pr-12'; // 元 / NT$ / % 在右 → 預留右側空間

  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      <label
        htmlFor={`step6-multipass-${tierId}-reward-value`}
        className="text-xs font-medium text-muted-foreground"
      >
        {t('step6.multipass.tier.rewardValueTitle')}
      </label>
      <div className="flex flex-col gap-1">
        <div className="relative flex items-center">
          {unitPrefix && (
            <span className="pointer-events-none absolute left-3 text-xs text-muted-foreground">
              {unitPrefix}
            </span>
          )}
          <input
            id={`step6-multipass-${tierId}-reward-value`}
            type="number"
            inputMode="decimal"
            value={value ?? ''}
            // ★ PR-5 Fix #1 relaxation: amount_off input allows 0 (it's a
            // legitimate value at the schema level — "no discount for this
            // tier"). The store setter still rejects <= 0 (the schema is
            // z.number().positive(); we keep that as the backstop), but the
            // UI input lets the user type 0 freely. If they submit, backend
            // zod rejects → 400. UX: visible red border on this field only.
            min={rewardType === 'percent_off' ? 1 : 0}
            max={rewardType === 'percent_off' ? 100 : undefined}
            step={rewardType === 'percent_off' ? 1 : 'any'}
            onChange={(e) => {
              const raw = e.target.value.trim();
              if (raw === '') {
                // Empty → clear value (store accepts null).
                updateMultipassTier(tierId, { rewardValue: null });
                return;
              }
              const num = parseFloat(raw);
              if (Number.isNaN(num)) return;
              updateMultipassTier(tierId, { rewardValue: num });
            }}
            placeholder={t(
              `step6.multipass.tier.${rewardType === 'amount_off' ? 'rewardValueAmountPlaceholder' : 'rewardValuePercentPlaceholder'}`,
            )}
            aria-label={t('step6.multipass.tier.rewardValueTitle')}
            aria-invalid={showError}
            className={`
              flex h-10 w-full rounded-md border bg-background py-2 text-sm
              text-foreground ring-offset-background
              placeholder:text-muted-foreground
              focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2
              disabled:cursor-not-allowed disabled:opacity-50
              ${paddingClass} ${unitPrefix ? 'pl-12 pr-3' : 'pr-12 pl-3'}
              ${showError ? 'border-destructive' : 'border-input'}
            `}
          />
          {unitSuffix && (
            <span className="pointer-events-none absolute right-3 text-xs text-muted-foreground">
              {unitSuffix}
            </span>
          )}
        </div>
        {showError && (
          <p className="text-xs text-destructive" role="alert">
            {t('step6.multipass.tier.rewardValueRequiredError')}
          </p>
        )}
      </div>
    </div>
  );
}
