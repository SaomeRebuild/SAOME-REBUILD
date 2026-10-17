/**
 * PassHolderMembershipTierRow — Radio Card sub-component for a single
 * membership tier. Renders as a `<label>` wrapping a hidden `<input
 * type="radio">` so the entire card surface is clickable.
 *
 * Visual contract (per design-system/MASTER.md):
 *   - Surface:           var(--color-card) bg + var(--color-border) border
 *   - Selected:          2px var(--color-primary) ring (focus + selected)
 *   - Hover:             scale-1.02 transform (200ms ease-out)
 *   - Active/click:      scale-0.98
 *   - Disabled:          60% opacity + cursor-not-allowed
 *   - prefers-reduced-motion: 瞬時切換, no transform
 *
 * Cost display rules:
 *   - both costs null              → "免費" / "Free" only
 *   - durationType === 'monthly'   → monthlyCost || "免費"
 *   - durationType === 'yearly'    → yearlyCost || "免費"
 *
 * Rewards list: only rendered when `tier.rewards.length > 0`.
 */

import { useId } from 'react';
import { Check } from 'lucide-react';
import { currencySymbol } from './PassHolderMembershipTiers.types';
import type { PassHolderMembershipTierRowProps } from './PassHolderMembershipTiers.types';

/** Format the cost for display; null = "Free" (costFree label). */
function formatCost(
  tier: PassHolderMembershipTierRowProps['tier'],
  symbol: string,
  costFreeLabel: string,
): string {
  if (tier.durationType === 'monthly') {
    return tier.monthlyCost === null ? costFreeLabel : `${symbol} ${tier.monthlyCost}`;
  }
  return tier.yearlyCost === null ? costFreeLabel : `${symbol} ${tier.yearlyCost}`;
}

export function PassHolderMembershipTierRow({
  tier,
  index,
  currency,
  labels,
  selected,
  onSelect,
  disabled,
}: PassHolderMembershipTierRowProps) {
  const radioId = useId();
  const symbol = currencySymbol(currency);
  const costText = formatCost(tier, symbol, labels.costFree);
  const periodText = tier.durationType === 'monthly' ? labels.perMonth : labels.perYear;

  return (
    <label
      htmlFor={radioId}
      className={[
        'flex cursor-pointer flex-col gap-2 rounded-lg border p-3',
        'transition-all duration-200 ease-out',
        // hover/active scales (CSS handles prefers-reduced-motion)
        'motion-safe:hover:scale-[1.02] motion-safe:active:scale-[0.98]',
        selected ? 'ring-2' : '',
        disabled ? 'cursor-not-allowed opacity-60' : '',
      ].join(' ')}
      style={{
        backgroundColor: 'var(--color-card)',
        borderColor: 'var(--color-border)',
        // CSS custom property for the ring color (avoids Tailwind class bloat)
        ...(selected
          ? ({ '--tw-ring-color': 'var(--color-primary)' } as React.CSSProperties)
          : {}),
      }}
      data-testid="pass-holder-tier-row"
      data-tier-index={index}
      data-tier-selected={selected ? 'true' : 'false'}
    >
      <input
        id={radioId}
        type="radio"
        name="pass-holder-membership-tier"
        value={index}
        checked={selected}
        disabled={disabled}
        onChange={() => onSelect(index)}
        className="sr-only"
        data-testid={`pass-holder-tier-row-radio-${index}`}
        aria-label={tier.name}
      />

      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          {/* Visible radio dot (input is sr-only) */}
          <span
            aria-hidden="true"
            className={[
              'flex h-5 w-5 items-center justify-center rounded-full border-2',
              selected ? 'border-transparent' : 'border-current',
            ].join(' ')}
            style={{
              borderColor: selected ? 'var(--color-primary)' : 'var(--color-muted-foreground)',
              backgroundColor: selected ? 'var(--color-primary)' : 'transparent',
              color: selected ? 'var(--color-on-primary)' : 'transparent',
            }}
          >
            {selected ? <Check size={12} aria-hidden="true" /> : null}
          </span>
          <span
            className="text-base font-semibold"
            style={{ color: 'var(--color-foreground)' }}
          >
            {tier.name}
          </span>
        </div>
        <div
          className="flex items-baseline gap-1"
          data-testid="pass-holder-tier-cost"
        >
          <span
            className="text-base font-semibold"
            style={{ color: 'var(--color-foreground)' }}
          >
            {costText}
          </span>
          {tier.monthlyCost !== null || tier.yearlyCost !== null ? (
            <span
              className="text-xs"
              style={{ color: 'var(--color-muted-foreground)' }}
            >
              {periodText}
            </span>
          ) : null}
        </div>
      </div>

      {tier.rewards.length > 0 ? (
        <div
          className="flex flex-col gap-1"
          data-testid="pass-holder-tier-rewards"
        >
          <span
            className="text-xs font-medium"
            style={{ color: 'var(--color-muted-foreground)' }}
          >
            {labels.rewardsLabel}
          </span>
          <ul className="flex flex-col gap-0.5 pl-0 text-sm" style={{ listStyle: 'none' }}>
            {tier.rewards.map((reward, ri) => (
              <li
                key={`${reward.label}-${ri}`}
                className="flex items-center gap-2"
                style={{ color: 'var(--color-foreground)' }}
              >
                <span
                  aria-hidden="true"
                  className="inline-block h-1.5 w-1.5 rounded-full"
                  style={{ backgroundColor: 'var(--color-muted-foreground)' }}
                />
                {reward.label}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </label>
  );
}
