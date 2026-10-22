/**
 * Pass-holder zod schemas — Layer 1 of the API contract.
 *
 * @module shared/schemas/passHolder
 * @description This file is the SINGLE SOURCE OF TRUTH for the
 * public pass-registration contract (Rule 019 § 1).
 *
 * History: `apps/backend/src/modules/pass-templates/schemas/request.ts`
 * has carried a "Layer 1 = packages/shared/schemas/passHolder.ts"
 * comment since 2026-10-16, but the file did not exist — the backend
 * hand-rolled its own zod and the two could silently drift. This file
 * closes that gap for the NEW gift-card purchase contract; migrating the
 * whole pre-existing register payload is deliberately out of scope and
 * tracked in
 * `runs/decisions/2026-10-23-gift-card-paid-registration.md`.
 *
 * Rules honoured here:
 *   - Rule 019 § 1: shared zod is the contract; backend mirrors it.
 *   - Rule 023 § Shared Validation 用 i18n Key: every `message` is an
 *     i18n key, never a user-facing string, so web and React Native
 *     resolve it through their own translation files.
 *   - Rule 024 § mobile future-proof: no web-only APIs here.
 */

import { z } from 'zod';
import { currencySchema } from './card';
import { validateGiftCardPurchase } from '../logic/giftCardPurchase';
import type { PublicGiftCardConfig } from '../types/passHolder';

export const passHolderPhoneCountryCodeSchema = z.enum(['+886', '+27']);

/**
 * Gift-card purchase input — the customer-facing points value the
 * public page collects.
 *
 * Deliberately takes POINTS, not an amount: the price is always derived
 * from the tenant's rate by `pointsToAmount`, so a client can never
 * propose its own price. The fence check needs the template config,
 * which is why it is supplied as a refinement argument rather than a
 * parsed field.
 */
export const giftCardPurchaseInputSchema = z.object({
  points: z
    .number({ invalid_type_error: 'passHolder.validation.pointsInvalid' })
    .int('passHolder.validation.pointsInvalid')
    .positive('passHolder.validation.pointsInvalid'),
});

/**
 * Zod-wrapped variant that ALSO enforces the template's fences.
 *
 * Use this in the backend register path (where the template config is
 * known) and in the frontend purchase form (same config arrives on the
 * public DTO, so the customer gets instant feedback instead of a
 * round-trip 400).
 */
export function withGiftCardFences(
  config: PublicGiftCardConfig,
): z.ZodType<{ points: number }> {
  return giftCardPurchaseInputSchema.superRefine((data, ctx) => {
    const result = validateGiftCardPurchase(data.points, config);
    if (!result.ok) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['points'],
        message: result.message,
      });
    }
  });
}

/**
 * Shape persisted to `public.pass_holders.gift_card_snapshot`.
 *
 * Declared here (rather than only as a TS interface) so the backend can
 * `parse()` before writing JSONB — Rule 032 § 1 requires the application
 * layer to validate jsonb payloads instead of passing them straight
 * through to SQL. A `superRefine` re-checks the self-consistency
 * contract so a future refactor can't persist a snapshot whose amount
 * disagrees with its own frozen rate.
 */
export const giftCardSnapshotSchema = z.object({
  points: z.number().int().positive(),
  amount: z.number().nonnegative(),
  currency: currencySchema,
  unitAmount: z.number().int().positive(),
  unitPoints: z.number().int().positive(),
  checkoutMinPoints: z.number().int().positive(),
  checkoutMaxPoints: z.number().int().positive(),
});

export type GiftCardPurchaseInput = z.infer<typeof giftCardPurchaseInputSchema>;
export type GiftCardSnapshotDto = z.infer<typeof giftCardSnapshotSchema>;