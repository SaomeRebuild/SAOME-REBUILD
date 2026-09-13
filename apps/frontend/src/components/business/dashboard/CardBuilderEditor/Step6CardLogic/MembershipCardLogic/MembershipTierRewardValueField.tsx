/**
 * MembershipTierRewardValueField — 會員獎勵 sub-row field 2 (value).
 *
 * Renders a `<input type="text">` for the reward value (e.g. URL, plain text).
 * Max REWARD_VALUE_MAX_LENGTH=80 chars. Calls
 * `setMembershipTierReward(tierId, rewardId, { value })` on each change.
 * Store guard: truncates at the cap.
 */

import { useTranslation } from 'react-i18next';
import { useCardBuilderStore } from '../../CardBuilderEditor.store';
import { REWARD_VALUE_MAX_LENGTH } from '@saome/shared/constants';
import type { MembershipTierRewardValueFieldProps } from './MembershipCardLogic.types';

export function MembershipTierRewardValueField({
  showValidation: _showValidation,
  tierId,
  rewardId,
}: MembershipTierRewardValueFieldProps) {
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
        htmlFor={`step6-membership-${tierId}-reward-${rewardId}-value`}
        className="text-xs font-medium text-muted-foreground"
      >
        {t('step6.membership.rewardValueTitle')}
      </label>
      <input
        id={`step6-membership-${tierId}-reward-${rewardId}-value`}
        type="text"
        value={reward.value}
        onChange={(e) => {
          setMembershipTierReward(tierId, rewardId, { value: e.target.value });
        }}
        placeholder={t('step6.membership.rewardValuePlaceholder')}
        maxLength={REWARD_VALUE_MAX_LENGTH}
        aria-label={t('step6.membership.rewardValueTitle')}
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