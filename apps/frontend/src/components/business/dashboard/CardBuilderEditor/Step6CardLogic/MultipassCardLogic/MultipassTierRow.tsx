/**
 * MultipassTierRow — Single multipass tier editor row.
 *
 * Composes 5 sub-fields in order:
 *   1. <MultipassTierNameField />              — tier name (text input + counter)
 *   2. <MultipassTierStampsNeededField />      — ★ multipass 獨特: stamps to unlock
 *   3. <MultipassTierAccrualThresholdField />  — ★ PR-5 per-tier 門檻輸入框 (條件渲染)
 *   4. <MultipassTierRewardTypeField />        — amount_off / percent_off radio
 *   5. <MultipassTierRewardValueField />       — conditional on rewardType
 *
 * Layout: 2-col grid on desktop (name + stampsNeeded in row 1,
 * rewardType + rewardValue in row 2). Stacks vertically on mobile.
 *
 * Plus a remove button (calls removeMultipassTier). The remove button
 * sits on a footer row, full-width right-aligned, mirroring the
 * DiscountTierRow pattern.
 *
 * PR-5 layout (2026-09-20):
 *   - Per-tier threshold field is inserted between stampsNeeded and
 *     rewardType, wrapping onto its own row (full width). The
 *     2-col grid below it still splits rewardType + rewardValue.
 *   - On mobile: stacks vertically — name → stampsNeeded → threshold
 *     → rewardType → rewardValue → remove.
 *
 * Differs from DiscountTierRow:
 *   - 4 fields (vs 3): adds the multipass-specific stampsNeeded input.
 *   - rewardType is a RADIO (vs dropdown in StampCardLogic.RewardTypeField).
 *     Matches the radio pattern used by StampCardLogic's RewardTypeField.
 *   - Uses multipass* namespaced fields/store setters.
 *
 * PR-4 (2026-09-19) add-on: receive `duplicateStampsNeeded` from list
 * and pass to <MultipassTierStampsNeededField>. Other sub-components
 * don't need the warning prop.
 */

import { useTranslation } from 'react-i18next';
import { Trash2Icon } from 'lucide-react';
import { useCardBuilderStore } from '../../CardBuilderEditor.store';
import { MultipassTierAccrualThresholdField } from './MultipassTierAccrualThresholdField';
import { MultipassTierNameField } from './MultipassTierNameField';
import { MultipassTierStampsNeededField } from './MultipassTierStampsNeededField';
import { MultipassTierRewardTypeField } from './MultipassTierRewardTypeField';
import { MultipassTierRewardValueField } from './MultipassTierRewardValueField';
import { MultipassTierMaxDiscountAmountField } from './MultipassTierMaxDiscountAmountField';
import type { MultipassTierRowProps } from './MultipassCardLogic.types';

export function MultipassTierRow({
  showValidation,
  tierId,
  duplicateStampsNeeded,
}: MultipassTierRowProps) {
  const { t } = useTranslation('cardEditor');
  const removeMultipassTier = useCardBuilderStore((s) => s.removeMultipassTier);

  return (
    <div className="flex min-w-0 flex-col gap-3 rounded-lg border border-border bg-card p-4">
      {/* 2-col grid: name + stampsNeeded in row 1, rewardType + rewardValue in row 2.
          md+ desktop = side-by-side; mobile = stacked.
          PR-5 (2026-09-20): per-tier threshold field is rendered between
          stampsNeeded and rewardType, on its own row at full width (the
          threshold has its own header + helper + 2 inputs, so a full-width
          row reads cleaner than splitting). grid-rows: 3 implied by structure. */}
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <MultipassTierNameField showValidation={showValidation} tierId={tierId} />
        <MultipassTierStampsNeededField
          showValidation={showValidation}
          tierId={tierId}
          duplicateStampsNeeded={duplicateStampsNeeded}
        />
        {/* Per-tier threshold — wraps onto row 2 (full-width). Conditionally
            renders nothing when multipassAccrualMode === null | 'per_stamp'. */}
        <div className="md:col-span-2">
          <MultipassTierAccrualThresholdField
            showValidation={showValidation}
            tierId={tierId}
          />
        </div>
        <MultipassTierRewardTypeField showValidation={showValidation} tierId={tierId} />
        <MultipassTierRewardValueField showValidation={showValidation} tierId={tierId} />
        {/* Per-tier max discount cap — only shown when rewardType === 'percent_off' */}
        <div className="md:col-span-2">
          <MultipassTierMaxDiscountAmountField showValidation={showValidation} tierId={tierId} />
        </div>
      </div>
      <div className="flex justify-end">
        <button
          type="button"
          onClick={() => removeMultipassTier(tierId)}
          aria-label={t('step6.multipass.tier.removeTier')}
          className="inline-flex items-center gap-2 rounded-md border border-input bg-background px-3 py-1.5 text-xs font-medium text-muted-foreground transition-all hover:scale-[1.01] hover:border-destructive/60 hover:bg-destructive/5 hover:text-destructive focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        >
          <Trash2Icon size={14} aria-hidden="true" />
          <span>{t('step6.multipass.tier.removeTier')}</span>
        </button>
      </div>
    </div>
  );
}
