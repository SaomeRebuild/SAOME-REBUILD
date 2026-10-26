/**
 * Template settings — giftCardSettings section.
 *
 * @module shared/schemas/card/templateSettings/giftCard
 * @description Part of the flat `templates.settings` JSONB schema.
 *
 * Composed into the single flat object by `templateSettings/index.ts`.
 * The field definitions are copied verbatim from the former
 * `packages/shared/schemas/card.ts` — do not reorder.
 */

import { z } from 'zod';

export const giftCardSettingsSchema = z.object({
  // ===== Step 6 — Gift Card 卡 (2026-09-27, gift_card only) =====
  // Prepaid model: customers pay X currency units to receive Y points;
  // points are then redeemed for in-store products at a tenant-defined
  // exchange rate. Simpler than stamp/reward cards — single flat rule,
  // no tier list, no point accrual over time.
  //
  //   - giftCardAmount: positive integer (currency units the customer pays)
  //   - giftCardPoints: positive integer (points the customer receives)
  //
  // Default 1:1 (1 ??= 1 ?? per user decision 2026-09-27.
  // Store setter enforces `> 0` and integer; backend zod is the
  // authoritative gate on save (Rule 032 § 1).
  giftCardAmount: z.number().int().positive().optional(),
  giftCardPoints: z.number().int().positive().optional(),
  // ===== Step 6 — Gift Card 雙層 fence: 方案發行點數範圍 (2026-10-20, gift_card only, PR 1 of 2) =====
  // Card-design fence: bounds the points range this gift_card template can
  // configure (admin-facing). Wide bounds on purpose — special campaigns can
  // set extreme values, and the narrower checkout fence (PR 2) provides the
  // customer-facing per-transaction bound.
  //
  //   - giftCardDesignMinPoints: minimum points issuable for this template (整數 ≥ 1)
  //   - giftCardDesignMaxPoints: maximum points issuable for this template (整數 ≥ 1)
  //
  // Cross-field invariant (min ≤ max) is enforced by `setGiftCardDesignMinPoints`
  // / `setGiftCardDesignMaxPoints` setters + loadSettings defensive coerce
  // (Rule 030 / 032).
  giftCardDesignMinPoints: z.number().int().positive().optional(),
  giftCardDesignMaxPoints: z.number().int().positive().optional(),
  // ===== Step 6 — Gift Card 雙層 fence: 顧客單筆交易範圍 (2026-10-20, gift_card only, PR 2 of 2) =====
  // Checkout fence: bounds the customer's per-transaction purchase range
  // (i.e. min/max points + amount the customer can buy in one checkout).
  // Stricter than card-design — uses business-realistic defaults
  // (100 / 10_000) per `all_reasonable` strategy; admin sets wider bound
  // for special campaigns in the design fence (PR 1).
  //
  //   - giftCardCheckoutMinPoints: minimum points customer can purchase (整數 ≥ 1)
  //   - giftCardCheckoutMaxPoints: maximum points customer can purchase (整數 ≥ 1)
  //   - giftCardCheckoutMinAmount: minimum currency amount customer pays (整數 ≥ 1)
  //   - giftCardCheckoutMaxAmount: maximum currency amount customer pays (整數 ≥ 1)
  //
  // Cross-field invariants (enforced by setters + loadSettings defensive coerce):
  //   - Within checkout fence: min ≤ max (for both points + amount)
  //   - Within design fence (read at runtime via setters):
  //       checkout min ≥ design min
  //       checkout max ≤ design max
  //     cannot buy less or more than template allows
  giftCardCheckoutMinPoints: z.number().int().positive().optional(),
  giftCardCheckoutMaxPoints: z.number().int().positive().optional(),
  giftCardCheckoutMinAmount: z.number().int().positive().optional(),
  giftCardCheckoutMaxAmount: z.number().int().positive().optional(),
});
