/**
 * MultipassTierList — Step 6 section (多通卡級距列表).
 *
 * Renders the list of multipass tiers (up to MAX_MULTIPASS_TIERS=5) and
 * the "新增獎勵級距" button below.
 *
 * Behavior (mirrors DiscountTierList pattern):
 *   - Iterates `multipassTiers` array, renders one `<MultipassTierRow>` per entry.
 *   - "新增獎勵級距" button appends a new empty tier via `addMultipassTier`.
 *     Disabled at MAX_MULTIPASS_TIERS=5 (matches backend schema cap).
 *   - `removeMultipassTier` RE-ADDS 1 default tier if array becomes empty
 *     (matches user requirement "預設一個 row"). So the list is always
 *     ≥ 1 row.
 *   - Tier order follows the store's natural order (sorted on save).
 *
 * Differs from DiscountTierList:
 *   - Uses multipass* namespaced fields/store setters.
 *   - Header icon is TicketCheck (semantically matches multipass stamp
 *     accumulation) instead of Percent (which represents discount).
 *
 * PR-3 (2026-09-19): split out of StampCardLogic / shared with discount
 * pattern. Multipass cards now have their own dedicated sub-module.
 *
 * PR-4 (2026-09-19) add-on: derive `duplicateStampsNeededByRow` map and
 * forward the count to each row → StampsNeededField for warning UI.
 * Pure UI logic, no store / schema changes.
 *   - 2-pass algorithm: first count occurrences of each stampsNeeded,
 *     then map each tier.id → its duplicate value (or null).
 *   - Edge case: stampsNeeded === 0 (welcome gift) is treated like any
 *     other number — two welcome-gift tiers would also trigger warning,
 *     which is intentional (consistent UX: any duplicate → warning).
 */

import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { PlusIcon, TicketCheckIcon } from 'lucide-react';
import { useCardBuilderStore } from '../../CardBuilderEditor.store';
import { MAX_MULTIPASS_TIERS } from '@saome/shared/constants';
import { MultipassTierRow } from './MultipassTierRow';
import type { MultipassTierListProps } from './MultipassCardLogic.types';

export function MultipassTierList({ showValidation }: MultipassTierListProps) {
  const { t } = useTranslation('cardEditor');
  const multipassTiers = useCardBuilderStore((s) => s.multipassTiers);
  const addMultipassTier = useCardBuilderStore((s) => s.addMultipassTier);

  const canAdd = multipassTiers.length < MAX_MULTIPASS_TIERS;

  // PR-4: 計算每個 row 的 stampsNeeded 是否與其他 row 重複。
  // Output: Map<tierId, number | null> — duplicate count or null.
  // Re-computes only when multipassTiers changes (useMemo deps).
  const duplicateStampsNeededByRow = useMemo(() => {
    const counts = new Map<number, number>();
    for (const tier of multipassTiers) {
      if (tier.stampsNeeded == null) continue;
      counts.set(
        tier.stampsNeeded,
        (counts.get(tier.stampsNeeded) ?? 0) + 1,
      );
    }
    const result = new Map<string, number | null>();
    for (const tier of multipassTiers) {
      const count = counts.get(tier.stampsNeeded) ?? 0;
      result.set(tier.id, count > 1 ? tier.stampsNeeded : null);
    }
    return result;
  }, [multipassTiers]);

  return (
    <section className="flex min-w-0 flex-col gap-3">
      <header className="flex flex-col gap-1">
        <h3
          className="flex items-center gap-2 text-base font-semibold text-foreground"
          style={{ fontFamily: 'var(--font-family-heading)' }}
        >
          <TicketCheckIcon size={16} aria-hidden="true" className="text-primary" />
          {t('step6.multipass.tiersTitle')}
        </h3>
        <p className="text-sm text-muted-foreground">
          {t('step6.multipass.tiersHint')}
        </p>
      </header>

      {/* Tier list — always ≥ 1 row (store seeds default + removeMultipassTier refills). */}
      <div className="flex flex-col gap-3">
        {multipassTiers.map((tier) => (
          <MultipassTierRow
            key={tier.id}
            showValidation={showValidation}
            tierId={tier.id}
            duplicateStampsNeeded={duplicateStampsNeededByRow.get(tier.id) ?? null}
          />
        ))}
      </div>

      {/* Add tier button — disabled at MAX_MULTIPASS_TIERS=5 */}
      <button
        type="button"
        onClick={addMultipassTier}
        disabled={!canAdd}
        aria-label={t('step6.multipass.addTier')}
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
        <span>{t('step6.multipass.addTier')}</span>
      </button>

      {/* Cap reached hint — shown when multipassTiers.length === MAX_MULTIPASS_TIERS */}
      {!canAdd && (
        <p className="text-xs text-muted-foreground">
          {t('step6.multipass.maxTiersReached')}
        </p>
      )}
    </section>
  );
}
