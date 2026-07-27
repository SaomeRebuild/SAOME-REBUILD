/**
 * Member Schemas
 * 
 * @module shared/schemas/member
 */

import { z } from 'zod';

export const memberTierSchema = z.enum(['bronze', 'silver', 'gold']);
export type MemberTier = z.infer<typeof memberTierSchema>;

export const memberRoleSchema = z.enum(['user', 'admin', 'superadmin']);
export type MemberRole = z.infer<typeof memberRoleSchema>;

export const createMemberSchema = z.object({
  email: z.string().email(),
  name: z.string().min(2).max(100),
  password: z.string().min(8).max(100),
});

export const updateMemberSchema = z.object({
  name: z.string().min(2).max(100).optional(),
  tier: memberTierSchema.optional(),
});

export type CreateMemberInput = z.infer<typeof createMemberSchema>;
export type UpdateMemberInput = z.infer<typeof updateMemberSchema>;
