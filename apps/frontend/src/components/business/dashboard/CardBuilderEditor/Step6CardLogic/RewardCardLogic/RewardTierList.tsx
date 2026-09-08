/**
 * RewardTierList — Step 6 section 3 (獎勵級距列表).
 *
 * Renders the list of reward tiers (up to MAX_REWARD_TIERS=5) and the
 * "新增獎勵級距" button below.
 *
 * Behavior:
 *   - Iterates `rewardTiers` array, renders one `<RewardTierRow>` per entry.
 *   - "新增獎勵級距" button appends a new empty tier via `addRewardTier`.
 *     Disabled at MAX_REWARD_TIERS=5 (matches backend schema cap).
 *   - `removeRewardTier` does NOT auto-refill (0-tier state is valid for drafts).
 *   - Tier order in the UI follows the store's natural order (sorted on save).
 *
 * Differences from a single reward (StampCardLogic):
 *   - This component manages up to 5 rows, each fully editable.
 *   - Each row has its own Remove button.
 *   - The list header explains the 5-tier cap.
 */

import { useTranslation } from 'react-i18next';
import { PlusIcon, GiftIcon } from 'lucide-react';
import { useCardBuilderStore } from '../../CardBuilderEditor.store';
import { MAX_REWARD_TIERS } from '@saome/shared/constants';
import { RewardTierRow } from './RewardTierRow';
import type { RewardTierListProps } from './RewardCardLogic.types';

export function RewardTierList({ showValidation }: RewardTierListProps) {
  const { t } = useTranslation('cardEditor');
  const rewardTiers = useCardBuilderStore((s) => s.rewardTiers);
  const addRewardTier = useCardBuilderStore((s) => s.addRewardTier);

  const canAdd = rewardTiers.length < MAX_REWARD_TIERS;

  return (
    <section className="flex min-w-0 flex-col gap-3">
      <header className="flex flex-col gap-1">
        <h3
          className="flex items-center gap-2 text-base font-semibold text-foreground"
          style={{ fontFamily: 'var(--font-family-heading)' }}
        >
          <GiftIcon size={16} aria-hidden="true" className="text-primary" />
          {t('step6.reward.tiersTitle')}
        </h3>
        <p className="text-sm text-muted-foreground">
          {t('step6.reward.tiersHint')}
        </p>
      </header>

      {/* Tier list — empty state shows the hint only. */}
      {rewardTiers.length === 0 ? (
        <div className="flex min-h-[3rem] items-center rounded-lg border border-dashed border-border bg-muted/30 px-4 py-3">
          <p className="text-sm text-muted-foreground">
            {t('step6.reward.preview.tierUnknown')}
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {rewardTiers.map((tier) => (
            <RewardTierRow
              key={tier.id}
              showValidation={showValidation}
              tierId={tier.id}
            />
          ))}
        </div>
      )}

      {/* Add tier button — disabled at MAX_REWARD_TIERS=5 */}
      <button
        type="button"
        onClick={addRewardTier}
        disabled={!canAdd}
        aria-label={t('step6.reward.addTier')}
        className={`
          inline-flex items-center justify-center gap-2 self-start rounded-md
          border border-dashed border-input bg-background px-4 py-2 text-sm font-medium
          text-foreground
          transition-all duration-150
          hover:scale-[1.01] hover:border-primary/60 hover:bg-primary/5
          active:scale-[0.99]
          focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2
          disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:scale-100
        `}
      >
        <PlusIcon size={16} aria-hidden="true" />
        <span>{t('step6.reward.addTier')}</span>
      </button>

      {/* Cap reached hint — shown when rewardTiers.length === MAX_REWARD_TIERS */}
      {!canAdd && (
        <p className="text-xs text-muted-foreground">
          {t('step6.reward.maxTiersReached')}
        </p>
      )}
    </section>
  );
}
