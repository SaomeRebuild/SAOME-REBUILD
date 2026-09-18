/**
 * DiscountTierList — Step 6 section (折扣級距列表).
 *
 * Renders the list of discount tiers (up to MAX_DISCOUNT_TIERS=5) and the
 * "新增折扣級距" button below.
 *
 * Behavior:
 *   - Iterates `discountTiers` array, renders one `<DiscountTierRow>` per entry.
 *   - "新增折扣級距" button appends a new empty tier via `addDiscountTier`.
 *     Disabled at MAX_DISCOUNT_TIERS=5 (matches backend schema cap).
 *   - `removeDiscountTier` RE-ADDS 1 default tier if array becomes empty
 *     (matches user requirement "預設一個 row"). So the list is always
 *     ≥ 1 row.
 *   - Tier order in the UI follows the store's natural order (sorted on save).
 *
 * Differs from CashbackTierList:
 *   - Uses discount* namespaced fields/store setters.
 *   - Always shows ≥ 1 row (cashback allows 0).
 */

import { useTranslation } from 'react-i18next';
import { PlusIcon, PercentIcon } from 'lucide-react';
import { useCardBuilderStore } from '../../CardBuilderEditor.store';
import { MAX_DISCOUNT_TIERS } from '@saome/shared/constants';
import { DiscountTierRow } from './DiscountTierRow';
import type { DiscountTierListProps } from './DiscountCardLogic.types';

export function DiscountTierList({ showValidation }: DiscountTierListProps) {
  const { t } = useTranslation('cardEditor');
  const discountTiers = useCardBuilderStore((s) => s.discountTiers);
  const addDiscountTier = useCardBuilderStore((s) => s.addDiscountTier);

  const canAdd = discountTiers.length < MAX_DISCOUNT_TIERS;

  return (
    <section className="flex min-w-0 flex-col gap-3">
      <header className="flex flex-col gap-1">
        <h3
          className="flex items-center gap-2 text-base font-semibold text-foreground"
          style={{ fontFamily: 'var(--font-family-heading)' }}
        >
          <PercentIcon size={16} aria-hidden="true" className="text-primary" />
          {t('step6.discount.tiersTitle')}
        </h3>
        <p className="text-sm text-muted-foreground">
          {t('step6.discount.tiersHint')}
        </p>
      </header>

      {/* Tier list — empty state shows the hint only. */}
      {discountTiers.length === 0 ? (
        <div className="flex min-h-[3rem] items-center rounded-lg border border-dashed border-border bg-muted/30 px-4 py-3">
          <p className="text-sm text-muted-foreground">
            {t('step6.discount.preview.tierUnknown')}
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {discountTiers.map((tier) => (
            <DiscountTierRow
              key={tier.id}
              showValidation={showValidation}
              tierId={tier.id}
            />
          ))}
        </div>
      )}

      {/* Add tier button — disabled at MAX_DISCOUNT_TIERS=5 */}
      <button
        type="button"
        onClick={addDiscountTier}
        disabled={!canAdd}
        aria-label={t('step6.discount.addTier')}
        className={`
          inline-flex items-center justify-center gap-2 self-start rounded-md
          border border-dashed border-input bg-background px-4 py-2 text-sm font-medium
          text-foreground
          transition-all duration-150
          hover:scale-[1.01] hover:border-primary/60 hover:bg-primary/5
          active:scale-[0.99]
          focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2
          disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:scale-100
        `}
      >
        <PlusIcon size={16} aria-hidden="true" />
        <span>{t('step6.discount.addTier')}</span>
      </button>

      {/* Cap reached hint — shown when discountTiers.length === MAX_DISCOUNT_TIERS */}
      {!canAdd && (
        <p className="text-xs text-muted-foreground">
          {t('step6.discount.maxTiersReached')}
        </p>
      )}
    </section>
  );
}
