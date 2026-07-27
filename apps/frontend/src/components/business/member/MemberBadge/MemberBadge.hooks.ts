import { useMemo } from 'react';
import { memberTierSchema, type MemberTier } from '@saome/shared/schemas/member';
import { getTierDisplayName, canAccessPremium } from '@saome/shared/logic/member';

export interface UseMemberBadgeResult {
  displayName: string;
  hasPremiumAccess: boolean;
  isValid: boolean;
}

export function useMemberBadge(tier: string): UseMemberBadgeResult {
  return useMemo(() => {
    const result = memberTierSchema.safeParse(tier);
    
    if (!result.success) {
      return {
        displayName: '',
        hasPremiumAccess: false,
        isValid: false,
      };
    }
    
    const validatedTier: MemberTier = result.data;
    
    return {
      displayName: getTierDisplayName(validatedTier),
      hasPremiumAccess: canAccessPremium(validatedTier),
      isValid: true,
    };
  }, [tier]);
}
