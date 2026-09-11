/**
 * CashbackTierList — Step 6 section (現金回饋級距列表).
 *
 * Renders the list of cashback tiers (up to MAX_CASHBACK_TIERS=5) and the
 * "新增回饋級距" button below.
 *
 * Behavior:
 *   - Iterates `cashbackTiers` array, renders one `<CashbackTierRow>` per entry.
 *   - "新增回饋級距" button appends a new empty tier via `addCashbackTier`.
 *     Disabled at MAX_CASHBACK_TIERS=5 (matches backend schema cap).
 *   - `removeCashbackTier` does NOT auto-refill (0-tier state is valid for drafts).
 *   - Tier order in the UI follows the store's natural order (sorted on save).
 *
 * Differs from RewardTierList:
 *   - No earningMode selector (cashback is always spend-driven).
 *   - Each row has only 3 fields: name + thresholdSpend + cashbackPercent.
 *   - thresholdSpend = 0 is a legitimate "default tier" (everyone qualifies).
 */

import { useTranslation } from 'react-i18next';
import { PlusIcon, BadgeDollarSignIcon } from 'lucide-react';
import { useCardBuilderStore } from '../../CardBuilderEditor.store';
import { MAX_CASHBACK_TIERS } from '@saome/shared/constants';
import { CashbackTierRow } from './CashbackTierRow';
import type { CashbackTierListProps } from './CashbackCardLogic.types';

export function CashbackTierList({ showValidation }: CashbackTierListProps) {
  const { t } = useTranslation('cardEditor');
  const cashbackTiers = useCardBuilderStore((s) => s.cashbackTiers);
  const addCashbackTier = useCardBuilderStore((s) => s.addCashbackTier);

  const canAdd = cashbackTiers.length < MAX_CASHBACK_TIERS;

  return (
    <section className="flex min-w-0 flex-col gap-3">
      <header className="flex flex-col gap-1">
        <h3
          className="flex items-center gap-2 text-base font-semibold text-foreground"
          style={{ fontFamily: 'var(--font-family-heading)' }}
        >
          <BadgeDollarSignIcon size={16} aria-hidden="true" className="text-primary" />
          {t('step6.cashback.tiersTitle')}
        </h3>
        <p className="text-sm text-muted-foreground">
          {t('step6.cashback.tiersHint')}
        </p>
      </header>

      {/* Tier list — empty state shows the hint only. */}
      {cashbackTiers.length === 0 ? (
        <div className="flex min-h-[3rem] items-center rounded-lg border border-dashed border-border bg-muted/30 px-4 py-3">
          <p className="text-sm text-muted-foreground">
            {t('step6.cashback.preview.tierUnknown')}
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {cashbackTiers.map((tier) => (
            <CashbackTierRow
              key={tier.id}
              showValidation={showValidation}
              tierId={tier.id}
            />
          ))}
        </div>
      )}

      {/* Add tier button — disabled at MAX_CASHBACK_TIERS=5 */}
      <button
        type="button"
        onClick={addCashbackTier}
        disabled={!canAdd}
        aria-label={t('step6.cashback.addTier')}
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
        <span>{t('step6.cashback.addTier')}</span>
      </button>

      {/* Cap reached hint — shown when cashbackTiers.length === MAX_CASHBACK_TIERS */}
      {!canAdd && (
        <p className="text-xs text-muted-foreground">
          {t('step6.cashback.maxTiersReached')}
        </p>
      )}
    </section>
  );
}
