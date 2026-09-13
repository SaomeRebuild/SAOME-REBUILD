/**
 * MembershipTierRewardRow — Single 會員獎勵 sub-row editor.
 *
 * Composes 2 sub-fields in order:
 *   1. <MembershipTierRewardLabelField /> — reward label text input
 *   2. <MembershipTierRewardValueField /> — reward value text input
 *
 * The row includes a Remove button (top-right) that calls
 * `removeMembershipTierReward(tierId, rewardId)`.
 *
 * Desktop layout: 2-col grid (label | value).
 * Mobile layout: stacked vertically.
 */

import { useTranslation } from 'react-i18next';
import { Trash2Icon } from 'lucide-react';
import { useCardBuilderStore } from '../../CardBuilderEditor.store';
import { MembershipTierRewardLabelField } from './MembershipTierRewardLabelField';
import { MembershipTierRewardValueField } from './MembershipTierRewardValueField';
import type { MembershipTierRewardRowProps } from './MembershipCardLogic.types';

export function MembershipTierRewardRow({
  showValidation: _showValidation,
  tierId,
  rewardId,
}: MembershipTierRewardRowProps) {
  const { t } = useTranslation('cardEditor');
  const removeMembershipTierReward = useCardBuilderStore(
    (s) => s.removeMembershipTierReward,
  );

  return (
    <div className="flex min-w-0 flex-col gap-2 rounded-lg border border-border bg-background p-3">
      {/* Row header — Remove button on the right */}
      <div className="flex items-center justify-end">
        <button
          type="button"
          onClick={() => removeMembershipTierReward(tierId, rewardId)}
          aria-label={t('step6.membership.removeReward')}
          className="
            inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium
            text-destructive
            transition-colors duration-150
            hover:bg-destructive/10
            focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2
          "
        >
          <Trash2Icon size={12} aria-hidden="true" />
        </button>
      </div>

      {/* 2-col grid: label | value on md+; stacked on mobile. */}
      <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
        <MembershipTierRewardLabelField
          showValidation={_showValidation}
          tierId={tierId}
          rewardId={rewardId}
        />
        <MembershipTierRewardValueField
          showValidation={_showValidation}
          tierId={tierId}
          rewardId={rewardId}
        />
      </div>
    </div>
  );
}