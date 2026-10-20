/**
 * GiftCardCheckoutLimitsSection — 雙層 fence sub-module: checkout fence wrapper.
 *
 * 2026-10-20: New for checkout fence (PR 2 of 雙層 fence 補強).
 * 包含 hero intro + 4 sub-field (min/max points + min/max amount).
 *
 * The checkout fence bounds the customer's per-transaction purchase range.
 * Stricter than card-design (PR 1) — defaults to 100 / 10_000 per
 * `all_reasonable` strategy. Admin can still set wider bounds for special
 * campaigns in the card-design fence.
 *
 * Differences from GiftCardDesignLimitsSection:
 *   - 4 sub-fields instead of 2 (adds amount dimension)
 *   - Amount fields are currency-aware (元 / NT$ / R prefix/suffix)
 *     via `useTranslation` + `currency` selector (mirrors GiftCardAmountField)
 *   - Within-fence + cross-fence cross-field validation per field
 *
 * Cross-field invariants:
 *   - Within-fence: each (min ≤ max) pair enforced by setter
 *   - Cross-fence (checkout vs design):
 *       checkout min ≥ design min (cannot buy less than template allows)
 *       checkout max ≤ design max (cannot buy more than template allows)
 *     enforced by both setter (write-time) and loadSettings (read-time defensive coerce)
 *
 * The parent (GiftCardLogic dispatcher) renders the card-type-specific
 * hero intro BEFORE this sub-module. This sub-module only handles the
 * form composition.
 */

import { useTranslation } from 'react-i18next';
import { GiftCardCheckoutMinPointsField } from './GiftCardCheckoutMinPointsField';
import { GiftCardCheckoutMaxPointsField } from './GiftCardCheckoutMaxPointsField';
import { GiftCardCheckoutMinAmountField } from './GiftCardCheckoutMinAmountField';
import { GiftCardCheckoutMaxAmountField } from './GiftCardCheckoutMaxAmountField';
import type { GiftCardCheckoutLimitsSectionProps } from './GiftCardLogic.types';

export function GiftCardCheckoutLimitsSection({
  showValidation,
}: GiftCardCheckoutLimitsSectionProps) {
  const { t } = useTranslation('cardEditor');

  return (
    <div className="flex min-w-0 flex-col gap-4">
      {/* Hero intro for the checkout fence section */}
      <div className="flex flex-col gap-1.5 rounded-lg border border-dashed border-border bg-muted/30 p-4">
        <p className="text-sm font-medium text-foreground">
          {t('step6.gift.checkout.intro')}
        </p>
        <p className="text-xs text-muted-foreground">
          {t('step6.gift.checkout.introHint')}
        </p>
      </div>

      <div className="flex min-w-0 flex-col gap-4 md:flex-row md:gap-6">
        <GiftCardCheckoutMinPointsField showValidation={showValidation} />
        <GiftCardCheckoutMaxPointsField showValidation={showValidation} />
      </div>

      <div className="flex min-w-0 flex-col gap-4 md:flex-row md:gap-6">
        <GiftCardCheckoutMinAmountField showValidation={showValidation} />
        <GiftCardCheckoutMaxAmountField showValidation={showValidation} />
      </div>
    </div>
  );
}