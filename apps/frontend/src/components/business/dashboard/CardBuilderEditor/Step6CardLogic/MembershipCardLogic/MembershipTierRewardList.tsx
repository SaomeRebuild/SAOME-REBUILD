/**
 * MembershipTierRewardList — 會員獎勵 sub-rows 列表.
 *
 * Renders the per-tier 會員獎勵 sub-rows (label + value pairs, up to
 * MAX_REWARDS_PER_TIER=5) and the "新增會員獎勵" button.
 *
 * Behavior:
 *   - Iterates `tier.rewards` array, renders one `<MembershipTierRewardRow>` per entry.
 *   - "新增會員獎勵" button appends a new empty row via `addMembershipTierReward(tierId)`.
 *     Disabled at MAX_REWARDS_PER_TIER=5.
 *   - `removeMembershipTierReward` does NOT auto-refill (0-row state is valid).
 */

import { useTranslation } from 'react-i18next';
import { PlusIcon, GiftIcon } from 'lucide-react';
import { useCardBuilderStore } from '../../CardBuilderEditor.store';
import { MAX_REWARDS_PER_TIER } from '@saome/shared/constants';
import { MembershipTierRewardRow } from './MembershipTierRewardRow';
import type { MembershipTierRewardListProps } from './MembershipCardLogic.types';

export function MembershipTierRewardList({
  showValidation: _showValidation,
  tierId,
}: MembershipTierRewardListProps) {
  const { t } = useTranslation('cardEditor');
  const tier = useCardBuilderStore((s) =>
    s.membershipTiers.find((tier) => tier.id === tierId),
  );
  const addMembershipTierReward = useCardBuilderStore((s) => s.addMembershipTierReward);

  if (!tier) return null;

  const rewards = tier.rewards;
  const canAdd = rewards.length < MAX_REWARDS_PER_TIER;

  return (
    <section className="flex min-w-0 flex-col gap-2 border-t border-dashed border-border pt-3">
      <header className="flex items-center gap-2">
        <GiftIcon size={14} aria-hidden="true" className="text-primary" />
        <h4 className="text-sm font-semibold text-foreground">
          {t('step6.membership.rewardsTitle')}
        </h4>
      </header>
      <p className="text-xs text-muted-foreground">
        {t('step6.membership.rewardsHint')}
      </p>

      {/* Reward list — empty state shows hint only. */}
      {rewards.length === 0 ? (
        <div className="flex min-h-[2.5rem] items-center rounded-lg border border-dashed border-border bg-muted/20 px-3 py-2">
          <p className="text-xs text-muted-foreground">
            {t('step6.membership.rewardsEmpty')}
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {rewards.map((reward) => (
            <MembershipTierRewardRow
              key={reward.id}
              showValidation={_showValidation}
              tierId={tierId}
              rewardId={reward.id}
            />
          ))}
        </div>
      )}

      {/* Add reward button — disabled at MAX_REWARDS_PER_TIER=5 */}
      <button
        type="button"
        onClick={() => addMembershipTierReward(tierId)}
        disabled={!canAdd}
        aria-label={t('step6.membership.addReward')}
        className={`
          inline-flex items-center justify-center gap-2 self-start rounded-md
          border border-dashed border-input bg-background px-3 py-1.5 text-xs font-medium
          text-foreground
          transition-all duration-150
          hover:scale-[1.01] hover:border-primary/60 hover:bg-primary/5
          active:scale-[0.99]
          focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2
          disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:scale-100
        `}
      >
        <PlusIcon size={12} aria-hidden="true" />
        <span>{t('step6.membership.addReward')}</span>
      </button>

      {!canAdd && (
        <p className="text-xs text-muted-foreground">
          {t('step6.membership.maxRewardsReached')}
        </p>
      )}
    </section>
  );
}