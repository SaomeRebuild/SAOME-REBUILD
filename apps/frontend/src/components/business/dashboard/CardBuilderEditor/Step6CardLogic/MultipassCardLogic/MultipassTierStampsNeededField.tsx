/**
 * MultipassTierStampsNeededField — ★ multipass 獨特欄位 (所需印章數).
 *
 * Renders a `<input type="number">` for the stamps-required-to-unlock
 * value. Per-tier stampsNeeded — different from stamp_card's
 * stampAccrualMode (which is card-wide).
 *
 * Bounds:
 *   - MULTIPASS_STAMPS_NEEDED_MIN=0 (welcome gift semantics)
 *   - MULTIPASS_STAMPS_NEEDED_MAX=999 (safety valve, NOT coupled with
 *     Step 3 stampGridRows × 5)
 *
 * Always renders the actual integer value (including 0 = welcome gift).
 * Mirrors DiscountTierThresholdField's 0-display fix (CashbackTierThreshold
 * 2026-09-11 pattern).
 *
 * Validation: shows a red border + error message when `showValidation`
 * is true AND the value is OUT OF RANGE (< 0 or > 999). NOTE: the store
 * setter already clamps to [0, 999] so this branch only fires when the
 * store is bypassed (corrupted DB row → loadSettings seeded a bad value).
 *
 * Non-integer values are silently rejected by the store setter, keeping
 * the previous valid value intact.
 *
 * PR-4 (2026-09-19) add-on: when `duplicateStampsNeeded === value`,
 * renders a warning icon (AlertTriangle) next to the label with the
 * i18n tooltip text. Non-blocking — purely informational.
 */

import { useTranslation } from 'react-i18next';
import { AlertTriangleIcon } from 'lucide-react';
import { useCardBuilderStore } from '../../CardBuilderEditor.store';
import {
  MULTIPASS_STAMPS_NEEDED_MIN,
  MULTIPASS_STAMPS_NEEDED_MAX,
} from '@saome/shared/constants';
import type { MultipassTierStampsNeededFieldProps } from './MultipassCardLogic.types';

export function MultipassTierStampsNeededField({
  showValidation,
  tierId,
  duplicateStampsNeeded,
}: MultipassTierStampsNeededFieldProps) {
  const { t } = useTranslation('cardEditor');
  const tier = useCardBuilderStore((s) =>
    s.multipassTiers.find((tier) => tier.id === tierId),
  );
  const updateMultipassTier = useCardBuilderStore((s) => s.updateMultipassTier);

  if (!tier) return null;

  const value = tier.stampsNeeded;
  const showError =
    showValidation &&
    (value < MULTIPASS_STAMPS_NEEDED_MIN || value > MULTIPASS_STAMPS_NEEDED_MAX);

  // PR-4: 當 row 的 stampsNeeded 跟其他 row 重複，顯示警告圖示 + tooltip
  // （label 右側、input 上方），非阻擋純提示。
  const isDuplicate = duplicateStampsNeeded === value;

  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      <div className="flex items-center gap-2">
        <label
          htmlFor={`step6-multipass-${tierId}-stamps-needed`}
          className="text-xs font-medium text-muted-foreground"
        >
          {t('step6.multipass.tier.stampsNeededTitle')}
        </label>
        {isDuplicate && (
          <span
            className="inline-flex items-center gap-1 text-xs text-amber-600 dark:text-amber-500"
            title={t('step6.multipass.tier.stampsNeededDuplicateWarning', {
              count: duplicateStampsNeeded,
            })}
            data-testid={`step6-multipass-${tierId}-stamps-duplicate-warning`}
            aria-label={t('step6.multipass.tier.stampsNeededDuplicateWarning', {
              count: duplicateStampsNeeded,
            })}
          >
            <AlertTriangleIcon size={12} aria-hidden="true" />
          </span>
        )}
      </div>
      <div className="flex flex-col gap-1">
        <div className="relative flex items-center">
          <input
            id={`step6-multipass-${tierId}-stamps-needed`}
            type="number"
            inputMode="numeric"
            value={value}
            min={MULTIPASS_STAMPS_NEEDED_MIN}
            max={MULTIPASS_STAMPS_NEEDED_MAX}
            step={1}
            onChange={(e) => {
              const raw = e.target.value.trim();
              if (raw === '') {
                // Empty → reset to 0 (welcome gift / not yet specified).
                updateMultipassTier(tierId, { stampsNeeded: 0 });
                return;
              }
              const num = parseFloat(raw);
              // Store setter clamps + rejects non-integer / NaN;
              // we forward the raw input unchanged here so the user
              // sees their typed value mid-edit. The setter is the
              // authoritative gate.
              if (Number.isNaN(num)) return;
              updateMultipassTier(tierId, { stampsNeeded: num });
            }}
            placeholder={t('step6.multipass.tier.stampsNeededPlaceholder')}
            aria-label={t('step6.multipass.tier.stampsNeededTitle')}
            aria-invalid={showError}
            className={`
              flex h-10 w-full rounded-md border bg-background px-3 py-2 text-sm
              text-foreground ring-offset-background
              placeholder:text-muted-foreground
              focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2
              disabled:cursor-not-allowed disabled:opacity-50
              pr-16
              ${showError ? 'border-destructive' : 'border-input'}
            `}
          />
          <span className="pointer-events-none absolute right-3 text-xs text-muted-foreground">
            {t('step6.multipass.tier.stampsNeededUnit')}
          </span>
        </div>
        <p className="text-xs text-muted-foreground">
          {t('step6.multipass.tier.stampsNeededHelper')}
        </p>
        {showError && (
          <p className="text-xs text-destructive" role="alert">
            {value < MULTIPASS_STAMPS_NEEDED_MIN
              ? t('step6.multipass.tier.stampsNeededMinError')
              : t('step6.multipass.tier.stampsNeededMaxError')}
          </p>
        )}
      </div>
    </div>
  );
}
