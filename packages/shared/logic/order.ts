/**
 * Order Logic
 * 
 * @module shared/logic/order
 */

import type { CreateOrderInput } from '../schemas/order';
import type { MemberTier } from '../schemas/member';

/**
 * Calculate order total
 * 
 * @param items - Order items
 * @returns Total amount
 */
export function calculateOrderTotal(
  items: { price: number; quantity: number }[]
): number {
  return items.reduce((sum, item) => sum + item.price * item.quantity, 0);
}

/**
 * Apply member discount to order
 * 
 * @param total - Original total
 * @param tier - Member tier
 * @returns Discounted total
 */
export function applyMemberDiscount(total: number, tier: MemberTier): number {
  const discounts: Record<MemberTier, number> = {
    bronze: 0,
    silver: 0.05,
    gold: 0.1,
  };
  const discount = discounts[tier];
  return Math.round(total * (1 - discount) * 100) / 100;
}
