/**
 * Member Types
 * 
 * @module shared/types/member
 */

/**
 * Member tier levels
 */
export type MemberTier = 'bronze' | 'silver' | 'gold';

/**
 * Member role types
 */
export type MemberRole = 'user' | 'admin' | 'superadmin';

/**
 * Member entity
 */
export interface Member {
  id: string;
  email: string;
  name: string;
  tier: MemberTier;
  role: MemberRole;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Member creation input
 */
export interface CreateMemberInput {
  email: string;
  name: string;
  password: string;
}

/**
 * Member update input
 */
export interface UpdateMemberInput {
  name?: string;
  tier?: MemberTier;
}
