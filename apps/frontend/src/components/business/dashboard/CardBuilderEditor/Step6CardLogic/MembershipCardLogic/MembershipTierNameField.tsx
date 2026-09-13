/**
 * MembershipTierNameField — Membership tier sub-field 1 (等級名稱).
 *
 * Renders a `<input type="text">` for the tier name. Max TIER_NAME_MAX_LENGTH=40
 * chars. Calls `updateMembershipTier(tierId, { name })` on each change.
 * Store guard: truncates at the cap.
 */

import { useTranslation } from 'react-i18next';
import { useCardBuilderStore } from '../../CardBuilderEditor.store';
import { TIER_NAME_MAX_LENGTH } from '@saome/shared/constants';
import type { MembershipTierNameFieldProps } from './MembershipCardLogic.types';

export function MembershipTierNameField({
  showValidation,
  tierId,
}: MembershipTierNameFieldProps) {
  const { t } = useTranslation('cardEditor');
  const tier = useCardBuilderStore((s) =>
    s.membershipTiers.find((tier) => tier.id === tierId),
  );
  const updateMembershipTier = useCardBuilderStore((s) => s.updateMembershipTier);

  if (!tier) return null;

  const name = tier.name;
  const isInvalid = showValidation && name.trim() === '';

  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      <label
        htmlFor={`step6-membership-${tierId}-name`}
        className="text-xs font-medium text-muted-foreground"
      >
        {t('step6.membership.tier.nameTitle')}
      </label>
      <input
        id={`step6-membership-${tierId}-name`}
        type="text"
        value={name}
        onChange={(e) => {
          updateMembershipTier(tierId, { name: e.target.value });
        }}
        placeholder={t('step6.membership.tier.namePlaceholder')}
        maxLength={TIER_NAME_MAX_LENGTH}
        aria-label={t('step6.membership.tier.nameTitle')}
        aria-invalid={isInvalid}
        className={`
          flex h-10 w-full min-w-0 rounded-md border bg-background px-3 py-2 text-sm
          text-foreground ring-offset-background
          placeholder:text-muted-foreground
          focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2
          disabled:cursor-not-allowed disabled:opacity-50
          ${isInvalid ? 'border-destructive' : 'border-input'}
        `}
      />
      <p className="text-xs text-muted-foreground">
        {t('step6.membership.tier.nameCounter', { count: name.length })}
      </p>
      {isInvalid && (
        <p className="text-xs text-destructive" role="alert">
          {t('step6.membership.tier.nameRequiredError')}
        </p>
      )}
    </div>
  );
}