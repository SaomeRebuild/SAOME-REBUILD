/**
 * Member Logic
 * 
 * @module shared/logic/member
 * 
 * ⚠️ NOTE: This module is locale-AGNOSTIC. It does NOT contain any
 * translated strings. All display names must be obtained from the
 * i18n layer (e.g. `packages/shared/i18n/`).
 * 
 * Previously this module had a `getTierDisplayName` function that
 * hard-coded Chinese strings. This was a bug because:
 * 1. The bronze tier returned the wrong value (金牌 instead of 銅牌)
 * 2. It violated the mobile-future-proof rule (locale-aware logic in shared/)
 * 3. It duplicated i18n keys that already exist in `packages/shared/i18n/`
 * 
 * For tier display names, import from i18n directly:
 * ```typescript
 * import { zhTW } from '../i18n/zh-TW';
 * const displayName = zhTW.member.tier[tier];
 * ```
 */

import type { MemberTier } from '../schemas/member';

/**
 * Calculate member discount based on tier
 * 
 * @param tier - Member tier level
 * @returns Discount percentage (0-100)
 */
export function getMemberDiscount(tier: MemberTier): number {
  const discounts: Record<MemberTier, number> = {
    bronze: 0,
    silver: 5,
    gold: 10,
  };
  return discounts[tier];
}

/**
 * Check if member tier can access premium features
 * 
 * @param tier - Member tier level
 * @returns Whether premium features are accessible
 */
export function canAccessPremium(tier: MemberTier): boolean {
  return tier === 'silver' || tier === 'gold';
}

/**
 * Validate email format
 * 
 * @param email - Email address
 * @returns Whether email is valid
 */
export function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}
