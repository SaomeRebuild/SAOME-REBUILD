/**
 * MembershipTierRewardLabelField — 會員獎勵 sub-row field 1 (label).
 *
 * Renders a `<input type="text">` for the reward label (e.g. "專屬優惠").
 * Max REWARD_LABEL_MAX_LENGTH=20 chars. Calls
 * `setMembershipTierReward(tierId, rewardId, { label })` on each change.
 * Store guard: truncates at the cap.
 */

import { useTranslation } from 'react-i18next';
import { useCardBuilderStore } from '../../CardBuilderEditor.store';
import { REWARD_LABEL_MAX_LENGTH } from '@saome/shared/constants';
import type { MembershipTierRewardLabelFieldProps } from './MembershipCardLogic.types';

export function MembershipTierRewardLabelField({
  showValidation: _showValidation,
  tierId,
  rewardId,
}: MembershipTierRewardLabelFieldProps) {
  const { t } = useTranslation('cardEditor');
  const reward = useCardBuilderStore((s) => {
    const tier = s.membershipTiers.find((t) => t.id === tierId);
    return tier?.rewards.find((r) => r.id === rewardId);
  });
  const setMembershipTierReward = useCardBuilderStore((s) => s.setMembershipTierReward);

  if (!reward) return null;

  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      <label
        htmlFor={`step6-membership-${tierId}-reward-${rewardId}-label`}
        className="text-xs font-medium text-muted-foreground"
      >
        {t('step6.membership.rewardLabelTitle')}
      </label>
      <input
        id={`step6-membership-${tierId}-reward-${rewardId}-label`}
        type="text"
        value={reward.label}
        onChange={(e) => {
          setMembershipTierReward(tierId, rewardId, { label: e.target.value });
        }}
        placeholder={t('step6.membership.rewardLabelPlaceholder')}
        maxLength={REWARD_LABEL_MAX_LENGTH}
        aria-label={t('step6.membership.rewardLabelTitle')}
        className="
          flex h-9 w-full min-w-0 rounded-md border border-input bg-background px-3 py-1.5
          text-sm text-foreground ring-offset-background
          placeholder:text-muted-foreground
          focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2
          disabled:cursor-not-allowed disabled:opacity-50
        "
      />
    </div>
  );
}