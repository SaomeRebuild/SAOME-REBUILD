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
import { membershipTierSnapshotInputSchema } from '@saome/shared/schemas/passHolder';

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
 * Frozen snapshot of the selected tier at registration time.
 *
 * 2026-10-27 — this schema now lives in the SHARED package
 * (`packages/shared/schemas/passHolder.ts::membershipTierSnapshotInputSchema`),
 * which is the single source of truth per Rule 019 § 1. The backend
 * previously kept a LOCAL copy, so the shared package had the
 * TypeScript interface but no runtime validator — and the two could
 * drift.
 *
 * The shared input schema keeps `durationType` REQUIRED (a client
 * that claims a paid purchase must name a cycle). The PERSISTED
 * shape (`membershipTierSnapshotSchema` in the shared package) is
 * looser — it allows a null cycle, because a FREE membership card
 * has one tier with a name but no cycle and no price.
 *
 * NOTE: the values a client sends are NOT trusted. The backend
 * re-derives the snapshot from the template's own tier list (see
 * `registerService.ts`); this schema only keeps the request
 * shape-compatible with older clients that still send a snapshot.
 */
export const membershipTierSnapshotSchema =
  membershipTierSnapshotInputSchema;

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
  /**
   * 2026-10-23 — gift-card extension. Points the customer purchased.
   *
   * Deliberately POINTS, not an amount: the price is always re-derived
   * from the template's own `giftCard*` settings inside `registerService`,
   * so a client can never propose its own price (Rule 032 § 1).
   *
   * Required when the template is a `gift_card`; optional for every
   * other card type. The service enforces the template-dependent part
   * (it needs the template row to know the rate + fences); the
   * cross-field parts that don't need the template are enforced in the
   * `superRefine` below.
   */
  purchasedPoints: z.number().int().positive().optional(),
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
   *
   /**
   * 2026-10-23 — added the gift-card cross-field rule: a payload that
   * carries `purchasedPoints` may not also claim the purchase was
   * `not_required` — a points purchase is never free. The mirrored
   * rule in `registerService::deriveGiftCardPurchase` covers the
   * template-dependent cases (a gift card MUST carry points; the
   * amount is re-derived server-side), which the schema cannot check
   * without the template row.
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
    // 2026-10-23 — gift-card cross-field rule. A points purchase is
    // never free, so `purchasedPoints` may not be paired with
    // `paymentStatus: 'not_required'`; otherwise migration 024's enum
    // would happily persist a "free gift card" row.
    //
    // Deliberately NOT "purchasedPoints requires a paymentProvider":
    // the schema cannot know the template's card type, and a bare
    // `{ purchasedPoints }` (no payment fields at all) must still parse
    // so non-gift callers that send points are not rejected at the
    // wrong layer. The template-dependent half — "a gift card MUST
    // carry points, and the provider must match the template currency"
    // — is enforced in `registerService::deriveGiftCardPurchase`, which
    // is the only place that can read the template's own rate.
    if (
      data.purchasedPoints !== undefined &&
      data.paymentStatus === 'not_required'
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['paymentStatus'],
        message: 'passHolder.errors.pointsForbiddenForNotRequired',
      });
    }
  });

export type PassHolderRegisterPayload = z.infer<typeof passHolderRegisterPayloadSchema>;