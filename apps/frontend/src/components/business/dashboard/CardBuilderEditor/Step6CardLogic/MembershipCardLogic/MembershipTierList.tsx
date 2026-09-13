/**
 * MembershipTierList — Step 6 section (會員等級列表).
 *
 * Renders the list of membership tiers (up to MAX_MEMBERSHIP_TIERS=5) and the
 * "新增會員等級" button below.
 *
 * Behavior:
 *   - Iterates `membershipTiers` array, renders one `<MembershipTierRow>` per entry.
 *   - "新增會員等級" button appends a new empty tier via `addMembershipTier`.
 *     Disabled at MAX_MEMBERSHIP_TIERS=5 (matches backend schema cap).
 *   - `removeMembershipTier` does NOT auto-refill (0-tier state is valid for drafts).
 *   - Tier order follows the store's natural order (no sort needed — tiers are independent).
 */

import { useTranslation } from 'react-i18next';
import { PlusIcon, UsersIcon } from 'lucide-react';
import { useCardBuilderStore } from '../../CardBuilderEditor.store';
import { MAX_MEMBERSHIP_TIERS } from '@saome/shared/constants';
import { MembershipTierRow } from './MembershipTierRow';
import type { MembershipTierListProps } from './MembershipCardLogic.types';

export function MembershipTierList({ showValidation }: MembershipTierListProps) {
  const { t } = useTranslation('cardEditor');
  const membershipTiers = useCardBuilderStore((s) => s.membershipTiers);
  const addMembershipTier = useCardBuilderStore((s) => s.addMembershipTier);

  const canAdd = membershipTiers.length < MAX_MEMBERSHIP_TIERS;

  return (
    <section className="flex min-w-0 flex-col gap-3">
      <header className="flex flex-col gap-1">
        <h3
          className="flex items-center gap-2 text-base font-semibold text-foreground"
          style={{ fontFamily: 'var(--font-family-heading)' }}
        >
          <UsersIcon size={16} aria-hidden="true" className="text-primary" />
          {t('step6.membership.tiersTitle')}
        </h3>
        <p className="text-sm text-muted-foreground">
          {t('step6.membership.tiersHint')}
        </p>
      </header>

      {/* Tier list — empty state shows the hint only. */}
      {membershipTiers.length === 0 ? (
        <div className="flex min-h-[3rem] items-center rounded-lg border border-dashed border-border bg-muted/30 px-4 py-3">
          <p className="text-sm text-muted-foreground">
            {t('step6.membership.validation.tierRequired')}
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {membershipTiers.map((tier) => (
            <MembershipTierRow
              key={tier.id}
              showValidation={showValidation}
              tierId={tier.id}
            />
          ))}
        </div>
      )}

      {/* Add tier button — disabled at MAX_MEMBERSHIP_TIERS=5 */}
      <button
        type="button"
        onClick={addMembershipTier}
        disabled={!canAdd}
        aria-label={t('step6.membership.addTier')}
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
        <span>{t('step6.membership.addTier')}</span>
      </button>

      {/* Cap reached hint — shown when membershipTiers.length === MAX_MEMBERSHIP_TIERS */}
      {!canAdd && (
        <p className="text-xs text-muted-foreground">
          {t('step6.membership.maxTiersReached')}
        </p>
      )}
    </section>
  );
}