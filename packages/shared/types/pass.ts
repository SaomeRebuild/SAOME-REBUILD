/**
 * Pass Types
 * 
 * @module shared/types/pass
 */

/**
 * Pass tier levels
 */
export type PassTier = 'basic' | 'premium' | 'enterprise';

/**
 * Pass status
 */
export type PassStatus = 'active' | 'expired' | 'cancelled';

/**
 * Pass entity
 */
export interface Pass {
  id: string;
  memberId: string;
  tier: PassTier;
  status: PassStatus;
  startDate: Date;
  endDate: Date;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Create pass input
 */
export interface CreatePassInput {
  memberId: string;
  tier: PassTier;
  durationDays: number;
}
