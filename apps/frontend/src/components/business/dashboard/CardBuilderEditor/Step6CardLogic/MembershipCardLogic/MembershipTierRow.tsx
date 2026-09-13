/**
 * MembershipTierRow — Single membership tier editor row.
 *
 * Composes 4 sub-fields in order:
 *   1. <MembershipTierNameField />   — text input (tier name)
 *   2. <MembershipTierDurationTypeField />  — monthly/yearly radio (only when hasExpiry=true)
 *   3. <MembershipTierCostField />   — number input (currency-aware; always shown)
 *   4. <MembershipTierRewardList />  — 會員獎勵 sub-rows (label + value pairs)
 *
 * The row includes a Remove button (top-right) that calls `removeMembershipTier(id)`.
 *
 * Cost field visibility rules (2026-09-13 update — user clarification):
 *   - hasExpiry=true  → render durationType radio + cost field (cost field writes to
 *                       monthlyCost / yearlyCost based on durationType).
 *   - hasExpiry=false → render ONLY the cost field (lifetime mode). The cost field
 *                       writes to `lifetimeCost` (separate from monthlyCost/yearlyCost).
 *                       Tenants use lifetime mode to sell the right to a lifetime tier
 *                       at a one-time price (consumer can directly purchase lifetime
 *                       membership). The duration radio is hidden because lifetime
 *                       has no monthly/yearly distinction.
 *
 * Desktop layout: name on top, then 2-col grid for duration+cost (when hasExpiry),
 * or single cost field (when hasExpiry=false), then reward list at the bottom.
 * Mobile layout: stacked vertically.
 *
 * Differs from CashbackTierRow:
 *   - hasExpiry toggle controls visibility of duration radio (not cost field).
 *   - Cost field always shown — writes to lifetimeCost in lifetime mode,
 *     monthlyCost/yearlyCost in with-expiry mode.
 *   - Each tier carries 會員獎勵 sub-rows.
 */

import { useTranslation } from 'react-i18next';
import { Trash2Icon } from 'lucide-react';
import { useCardBuilderStore } from '../../CardBuilderEditor.store';
import { MembershipTierNameField } from './MembershipTierNameField';
import { MembershipTierDurationTypeField } from './MembershipTierDurationTypeField';
import { MembershipTierCostField } from './MembershipTierCostField';
import { MembershipTierRewardList } from './MembershipTierRewardList';
import type { MembershipTierRowProps } from './MembershipCardLogic.types';

export function MembershipTierRow({ showValidation, tierId }: MembershipTierRowProps) {
  const { t } = useTranslation('cardEditor');
  const removeMembershipTier = useCardBuilderStore((s) => s.removeMembershipTier);
  const hasExpiry = useCardBuilderStore((s) => s.hasExpiry);

  return (
    <div className="flex min-w-0 flex-col gap-4 rounded-lg border border-border bg-card p-4">
      {/* Row header — Remove button on the right */}
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-medium text-muted-foreground">
          {t('step6.membership.tier.nameTitle')}
        </span>
        <button
          type="button"
          onClick={() => removeMembershipTier(tierId)}
          aria-label={t('step6.membership.removeTier')}
          className="
            inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium
            text-destructive
            transition-colors duration-150
            hover:bg-destructive/10
            focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2
          "
        >
          <Trash2Icon size={14} aria-hidden="true" />
          <span>{t('step6.membership.removeTier')}</span>
        </button>
      </div>

      {/* Tier name — full-width text input */}
      <MembershipTierNameField showValidation={showValidation} tierId={tierId} />

      {/* Duration type + Cost — when card-wide hasExpiry=true, show both. */}
      {hasExpiry ? (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <MembershipTierDurationTypeField showValidation={showValidation} tierId={tierId} />
          <MembershipTierCostField showValidation={showValidation} tierId={tierId} />
        </div>
      ) : (
        // hasExpiry=false (lifetime) — show ONLY the cost field (lifetime mode).
        // The cost field writes to `lifetimeCost` (separate from monthlyCost/yearlyCost).
        // 2026-09-13 user clarification: even with no expiry, the fee input stays
        // visible because tenants can sell the right to a lifetime tier at a
        // one-time price (consumer directly purchases lifetime membership).
        <div className="grid grid-cols-1 gap-3">
          <MembershipTierCostField
            showValidation={showValidation}
            tierId={tierId}
            lifetimeMode
          />
        </div>
      )}

      {/* 會員獎勵 sub-rows */}
      <MembershipTierRewardList showValidation={showValidation} tierId={tierId} />
    </div>
  );
}