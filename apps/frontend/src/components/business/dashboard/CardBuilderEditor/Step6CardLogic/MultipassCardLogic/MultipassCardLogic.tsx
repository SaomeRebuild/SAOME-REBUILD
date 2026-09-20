/**
 * MultipassCardLogic — Step 6 sub-module for multipass (多通卡).
 *
 * Composes 1 top-level sub-component:
 *   1. <MultipassTierList /> — list of up to 5 multipass tiers (each row
 *                              contains its own name + stampsNeeded +
 *                              rewardType + rewardValue fields).
 *
 * Background context (2026-09-19):
 *   - Multipass cards have UP TO 5 tiers, each carrying its own
 *     stampsNeeded + rewardType + rewardValue.
 *   - stampsNeeded = 0 is a LEGITIMATE value (welcome gift "辦卡立刻送").
 *   - stampsNeeded is COMPLETELY DECOUPLED from Step 3 stamp grid.
 *
 * Differences from stamp_card (now split out):
 *   - 5 max tiers (vs 1 flat reward rule).
 *   - Per-tier rewardType / rewardValue (vs card-wide single reward).
 *   - Adds the multipass-only stampsNeeded field.
 *
 * Differences from discount_card:
 *   - thresholdSpend → stampsNeeded (the axis is "stamps to unlock"
 *     instead of "spend to qualify").
 *   - discountPercent → rewardType + rewardValue (multipass uses the
 *     stamp_card pattern of amount_off / percent_off + value, not the
 *     single-percent pattern).
 *   - NO card-level expiry section (multipass has no card-wide lifetime).
 *
 * Default 1 tier row (matches user requirement "預設一個 row"). The
 * store's `removeMultipassTier` re-adds 1 default tier if the array
 * becomes empty; the auto-add useEffect below is a defense-in-depth
 * in case the store is bypassed (e.g. malformed DB row during initial
 * load → loadSettings seeds 0 tiers).
 *
 * The parent (Step6CardLogic dispatcher) is responsible for prev/next
 * buttons in CardBuilderEditorWorkspace.
 *
 * Total multipass tiers bounded by MAX_MULTIPASS_TIERS=5 (per
 * `shared/constants/multipass-card.ts`).
 */

import { useEffect } from 'react';
import { useCardBuilderStore } from '../../CardBuilderEditor.store';
import { MultipassAccrualModeField } from './MultipassAccrualModeField';
import { MultipassTierList } from './MultipassTierList';
import type { MultipassCardLogicProps } from './MultipassCardLogic.types';

export function MultipassCardLogic({ showValidation }: MultipassCardLogicProps) {
  const multipassTiers = useCardBuilderStore((s) => s.multipassTiers);
  const addMultipassTier = useCardBuilderStore((s) => s.addMultipassTier);

  // Auto-add default tier if the array is somehow empty (defense-in-depth).
  // The store's `removeMultipassTier` re-adds 1 default tier when the
  // array becomes empty, but this useEffect guards against external
  // corruption (e.g. malformed DB row during initial load) so the UI
  // always shows at least 1 tier row. Mirrors the DiscountCardLogic
  // auto-add useEffect pattern (2026-09-18).
  useEffect(() => {
    if (multipassTiers.length === 0) {
      addMultipassTier();
    }
  }, [multipassTiers.length, addMultipassTier]);

  return (
    <div className="flex min-w-0 flex-col gap-6">
      {/* 2026-09-20 PR-5: Card-wide accrual mode radio (renders BEFORE the tier list,
          matching StampCardLogic composition order: StampAccrualModeField is rendered
          before StampTierList / AccrualThresholdField). Multiline edit makes
          threshold inputs per-tier (rendered inside each MultipassTierRow). */}
      <MultipassAccrualModeField showValidation={showValidation} />
      <MultipassTierList showValidation={showValidation} />
    </div>
  );
}
