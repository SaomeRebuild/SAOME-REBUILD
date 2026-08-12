/**
 * Pass Logic
 * 
 * @module shared/logic/pass
 */

import type { PassTier } from '../schemas/pass';

/**
 * Check if pass is valid
 * 
 * @param endDate - Pass end date
 * @returns Whether pass is still valid
 */
export function isPassValid(endDate: Date): boolean {
  return new Date() < endDate;
}

/**
 * Calculate pass expiration date
 * 
 * @param startDate - Pass start date
 * @param durationDays - Duration in days
 * @returns Expiration date
 */
export function calculateExpirationDate(
  startDate: Date,
  durationDays: number
): Date {
  const endDate = new Date(startDate);
  endDate.setDate(endDate.getDate() + durationDays);
  return endDate;
}

/**
 * Get plan display name (green/gold/platinum → 綠卡/金卡/白金卡)
 *
 * @param plan - Plan tier
 * @returns Localized plan name
 */
export function getPlanDisplayName(plan: string): string {
  const names: Record<string, string> = {
    green: '綠卡',
    gold: '金卡',
    platinum: '白金卡',
  };
  return names[plan] ?? plan;
}

/**
 * Get plan display name in English
 *
 * @param plan - Plan tier
 * @returns English plan name
 */
export function getPlanDisplayNameEn(plan: string): string {
  const names: Record<string, string> = {
    green: 'Green Card',
    gold: 'Gold Card',
    platinum: 'Platinum Card',
  };
  return names[plan] ?? plan;
}

/**
 * Get pass tier display name
 *
 * @param tier - Pass tier
 * @returns Localized tier name
 */
export function getPassTierDisplayName(tier: PassTier): string {
  const names: Record<PassTier, string> = {
    basic: '基本版',
    premium: '進階版',
    enterprise: '企業版',
  };
  return names[tier];
}
