/**
 * StampCardLogic — Step 6 sub-module for stamp_card / multipass.
 *
 * Composes 6 sub-components in order:
 *   1. <StampAccrualModeField />  — 3-option radio group
 *   2. <RewardNameField />        — text input + counter
 *   3. <RewardTypeField />        — select (amount_off / percent_off)
 *   4. <RewardValueField />       — number input (placeholder follows type)
 *   5. <MaxDiscountAmountField /> — conditional: only for percent_off
 *   6. <StampCardLogicPreview /> — live scenario preview
 *
 * The parent (Step6CardLogic dispatcher) is responsible for prev/next buttons
 * in CardBuilderEditorWorkspace.
 *
 * Total stamp cells = stampGridRows × 5 (from store).
 */

import { useCardBuilderStore } from '../../CardBuilderEditor.store';
import { StampAccrualModeField } from './StampAccrualModeField';
import { RewardNameField } from './RewardNameField';
import { AccrualThresholdField } from './AccrualThresholdField';
import { RewardTypeField } from './RewardTypeField';
import { RewardValueField } from './RewardValueField';
import { MaxDiscountAmountField } from './MaxDiscountAmountField';
import { StampCardLogicPreview } from './StampCardLogicPreview';
import type { StampCardLogicProps } from './StampCardLogic.types';

export function StampCardLogic({ showValidation }: StampCardLogicProps) {
  const stampGridRows = useCardBuilderStore((s) => s.stampGridRows);
  // stampTotal = number of rows × 5 columns per row
  const stampTotal = stampGridRows * 5;

  return (
    <div className="flex min-w-0 flex-col gap-6">
      <StampAccrualModeField showValidation={showValidation} />
      <RewardNameField showValidation={showValidation} />
      {/* AccrualThresholdField is CONDITIONAL: only shown for per_visit / per_spend */}
      <AccrualThresholdField showValidation={showValidation} />
      <RewardTypeField showValidation={showValidation} />
      <RewardValueField showValidation={showValidation} />
      {/* MaxDiscountAmountField is CONDITIONAL: only renders for percent_off */}
      <MaxDiscountAmountField showValidation={showValidation} />
      {/* Preview at the bottom — shows the combined reward scenario */}
      <StampCardLogicPreview stampTotal={stampTotal} />
    </div>
  );
}
