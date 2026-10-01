/**
 * Request zod schemas for the pass-templates module.
 *
 * @module modules/pass-templates/schemas/request
 * @description Zod schemas for the public, no-auth endpoints.
 *
 * Layer 2 of 4 per Rule 019 § 4.1:
 *   - Layer 1: packages/shared/schemas/passHolder.ts (single source of truth)
 *   - Layer 2: this file (backend zod mirror, runtime validation)
 *   - Layer 3: db/passHolders.ts::PassHolderRow (DB row interface)
 *   - Layer 4: services/registerService.ts (service signature)
 *
 * Phone country codes: only '+886' (Taiwan) and '+27' (South Africa).
 * Extend when onboarding new regions — keep in sync with
 * `packages/shared/types/passHolder.ts::PassHolderPhoneCountryCode`.
 *
 * Decision log: runs/decisions/2026-09-29-pass-templates-public-endpoint.md
 */

import { z } from 'zod';

export const passHolderPhoneCountryCodeSchema = z.enum(['+886', '+27']);
export type PassHolderPhoneCountryCode = z.infer<typeof passHolderPhoneCountryCodeSchema>;

/**
 * Birthday validation:
 *   - Must parse as ISO date (YYYY-MM-DD)
 *   - Must be at least 13 years before today (holder age ≥ 13)
 *
 * The frontend also enforces ≥ 13, but the backend re-checks because the
 * frontend can be bypassed.
 */
const MIN_HOLDER_AGE_YEARS = 13;
const thirteenYearsAgo = new Date();
thirteenYearsAgo.setFullYear(thirteenYearsAgo.getFullYear() - MIN_HOLDER_AGE_YEARS);
const thirteenYearsAgoIsoDate = thirteenYearsAgo.toISOString().slice(0, 10);

export const passHolderRegisterPayloadSchema = z.object({
  name: z.string().min(1).max(80),
  phoneCountryCode: passHolderPhoneCountryCodeSchema,
  /**
   * Phone number: digits only, 6-15 chars (E.164 max length).
   * Frontend strips formatting chars before submit; backend re-strips as a
   * safety valve.
   */
  phoneNumber: z
    .string()
    .min(6)
    .max(15)
    .regex(/^[0-9]+$/, 'passHolder.errors.phoneInvalid'),
  birthday: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'passHolder.errors.birthdayInvalid')
    .refine((s) => s <= thirteenYearsAgoIsoDate, {
      message: 'passHolder.errors.tooYoung',
    }),
  email: z.string().email(),
});

export type PassHolderRegisterPayload = z.infer<typeof passHolderRegisterPayloadSchema>;