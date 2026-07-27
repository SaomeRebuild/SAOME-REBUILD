import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { memberTierSchema, type MemberTier } from '@saome/shared/schemas/member';
import { canAccessPremium } from '@saome/shared/logic/member';

export interface UseMemberBadgeResult {
  displayName: string;
  ariaLabel: string;
  hasPremiumAccess: boolean;
  isValid: boolean;
}

export function useMemberBadge(tier: string): UseMemberBadgeResult {
  const { t } = useTranslation();

  return useMemo(() => {
    const result = memberTierSchema.safeParse(tier);

    if (!result.success) {
      return {
        displayName: '',
        ariaLabel: '',
        hasPremiumAccess: false,
        isValid: false,
      };
    }

    const validatedTier: MemberTier = result.data;
    const displayName = t(`member.tier.${validatedTier}`);
    const ariaLabel = t('member.tier.ariaLabel', { tier: displayName });

    return {
      displayName,
      ariaLabel,
      hasPremiumAccess: canAccessPremium(validatedTier),
      isValid: true,
    };
  }, [tier, t]);
}

