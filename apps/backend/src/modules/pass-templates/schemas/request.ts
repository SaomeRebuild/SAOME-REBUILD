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
// 2026-10-17 — DO NOT compute thirteenYearsAgo / thirteenYearsAgoIsoDate
//   at module init. Workerd freezes `new Date()` to the Unix epoch
//   (1970-01-01T00:00:00.000Z) when called from module scope, so a
//   top-of-file `new Date()` returns 1970-01-01 — which after
//   `setFullYear(year - 13)` becomes 1957-01-01 — pinning the schema
//   to "born before 1957" and rejecting every adult year.
//   See runs/improvements/feedback/20261017-pass-holder-backend-error-capture.md
//   for the trace + this fix.
//
//   The refine now calls `new Date()` and `setFullYear` INSIDE the
//   predicate closure (i.e., at request time) so workerd returns the
//   live clock (2026-10-17) and the boundary resolves correctly.
//   The predicate is called once per parse — no perf concern.
/**
 * Currency code aligned with `packages/shared/schemas/card.ts::Currency`
 * (TWD for Taiwan, ZAR for South Africa). Used by the paid-membership
 * register flow to drive the payment provider (TWD → Ecpay, ZAR → Payfast).
 */
const passHolderCurrencySchema = z.enum(['TWD', 'ZAR']);

/**
 * Payment provider aligned with `packages/shared/schemas/card.ts` and the
 * CHECK constraint on `public.pass_holders.payment_provider`. The frontend
 * uses the simulated Payfast / Ecpay button today; real provider calls
 * arrive with the Passcreator V3 backend integration (P1 follow-up).
 */
const passHolderPaymentProviderSchema = z.enum(['payfast', 'ecpay']);

/**
 * Payment status. The CHECK constraint defaults new rows to 'pending';
 * the simulated flow writes 'completed' once the user clicks through.
 * Real provider flows may emit 'failed' on gateway decline.
 *
 * 2026-10-18 — added 'not_required' for non-paid templates (stamp card
 * / free reward / cashback / etc.). See
 * runs/decisions/2026-10-18-payment-status-not-required-enum.md and
 * the cross-field refinement on `passHolderRegisterPayloadSchema` that
 * enforces (paymentStatus === 'completed') ↔ (paymentProvider set).
 */
const passHolderPaymentStatusSchema = z.enum([
  'pending',
  'completed',
  'failed',
  'not_required',
]);

/**
 * Membership tier duration type. Mirrors the `durationType` field in
 * `PublicMembershipTier` (packages/shared/types/passHolder.ts).
 */
const passHolderTierDurationTypeSchema = z.enum(['monthly', 'yearly']);

/**
 * Frozen snapshot of the selected tier at registration time. Mirrors
 * `packages/shared/types/passHolder.ts::MembershipTierSnapshot`. Stored
 * as JSONB so the receipt / dashboard can show the original price even
 * if the template's tier definition later changes.
 */
export const membershipTierSnapshotSchema = z.object({
  index: z.number().int().min(0),
  name: z.string().min(1).max(80),
  durationType: passHolderTierDurationTypeSchema,
  paidAmount: z.number().nonnegative().nullable(),
  currency: passHolderCurrencySchema,
});

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
    .refine(
      (s) => {
        // Lazy boundary — compute at request time, not module init.
        const thirteenYearsAgo = new Date();
        thirteenYearsAgo.setFullYear(
          thirteenYearsAgo.getFullYear() - MIN_HOLDER_AGE_YEARS,
        );
        const thirteenYearsAgoIsoDate = thirteenYearsAgo
          .toISOString()
          .slice(0, 10);
        return s <= thirteenYearsAgoIsoDate;
      },
      {
        message: 'passHolder.errors.tooYoung',
      },
    ),
  email: z.string().email(),
  // ================================================================
  // 2026-10-16 — paid-membership extension (Rule 019 § 4.1 quad-binding)
  //   All four fields are OPTIONAL. The frontend's PassHolderRegistration
  //   only populates them when `template.isPaid === true`; the route
  //   accepts the bare 5 fields for non-paid templates without rejecting
  //   the request. When a paid template is registered without these
  //   fields, the backend persists the row with `payment_status =
  //   'pending'` (the default) so the schema doesn't reject the insert.
  // ================================================================
  /**
   * 0-based index into the template's `membershipTiers` array. When
   * provided, the backend re-validates it against the template's actual
   * tier list (see `registerService.ts`).
   */
  selectedTierIndex: z.number().int().min(0).optional(),
  /**
   * Frozen snapshot of the selected tier. Persisted as JSONB so the
   * receipt is self-contained even if the template's tier definition
   * is later edited.
   */
  membershipTierSnapshot: membershipTierSnapshotSchema.optional(),
  /**
   * Payment provider. Driven by `template.currency` on the frontend
   * (TWD → 'ecpay', ZAR → 'payfast'); backend accepts either.
   */
  paymentProvider: passHolderPaymentProviderSchema.optional(),
  /**
   * Payment status. The simulated UI only emits 'completed' / 'not_required';
   * 'pending' (default) and 'failed' are reserved for the real provider flows.
   *
   * 2026-10-18 — 'not_required' added for non-paid templates. Cross-field
   * refinement below enforces:
   *   - completed   → paymentProvider MUST be set
   *   - not_required → paymentProvider MUST be unset
   */
  paymentStatus: passHolderPaymentStatusSchema.optional(),
})
  /**
   * 2026-10-18 — Cross-field validation for payment fields. Ensures the
   * 4 paid-membership fields stay consistent: paymentProvider can only
   * appear with paymentStatus='completed', and paymentStatus='not_required'
   * forbids a provider. Without this, a stale frontend could send
   * `paymentStatus: 'completed'` without a provider (DB would accept via
   * column CHECK, but the row would be incomplete) or send
   * `paymentStatus: 'not_required'` with a provider (semantic garbage).
   * See runs/decisions/2026-10-18-payment-status-not-required-enum.md.
   */
  .superRefine((data, ctx) => {
    if (data.paymentStatus === 'completed' && !data.paymentProvider) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['paymentProvider'],
        message: 'passHolder.errors.paymentProviderRequiredForCompleted',
      });
    }
    if (data.paymentStatus === 'not_required' && data.paymentProvider) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['paymentProvider'],
        message: 'passHolder.errors.paymentProviderForbiddenForNotRequired',
      });
    }
  });

export type PassHolderRegisterPayload = z.infer<typeof passHolderRegisterPayloadSchema>;