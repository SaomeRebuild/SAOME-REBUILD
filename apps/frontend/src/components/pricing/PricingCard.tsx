import { Link } from 'react-router-dom';
import { Check } from 'lucide-react';
import type { TFunction } from 'i18next';

export type PricingTier = 'green' | 'gold' | 'platinum';

export interface PricingCardProps {
  tier: PricingTier;
  name: string;
  price: number;
  period?: string;
  description: string;
  features: string[];
  isPopular?: boolean;
  ctaLabel: string;
  savings?: number;
  t: TFunction;
}

const tierColors: Record<PricingTier, {
  border: string;
  badgeBg: string;
  badgeText: string;
  buttonBg: string;
}> = {
  green: {
    border: 'var(--color-border)',
    badgeBg: 'rgba(34, 197, 94, 0.15)',
    badgeText: '#22C55E',
    buttonBg: 'var(--color-primary)',
  },
  gold: {
    border: 'var(--color-accent)',
    badgeBg: 'var(--color-accent)',
    badgeText: 'var(--color-on-accent)',
    buttonBg: 'var(--color-accent)',
  },
  platinum: {
    border: 'var(--color-border)',
    badgeBg: 'var(--color-muted)',
    badgeText: 'var(--color-foreground)',
    buttonBg: 'var(--color-primary)',
  },
};

export function PricingCard({
  tier,
  name,
  price,
  period,
  description,
  features,
  isPopular,
  ctaLabel,
  savings,
  t,
}: PricingCardProps) {
  const colors = tierColors[tier];

  return (
    <div
      className="relative flex flex-col rounded-xl border-2 p-6 shadow-sm card-hover"
      style={{
        borderColor: colors.border,
        backgroundColor: 'var(--color-card)',
      }}
    >
      {isPopular && (
        <div
          className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full px-3 py-1 text-xs font-semibold"
          style={{ backgroundColor: colors.badgeBg, color: colors.badgeText }}
        >
          {t('popular')}
        </div>
      )}

      <div className="mb-4">
        <p className="text-sm font-medium" style={{ color: 'var(--color-muted-foreground)' }}>
          {name}
        </p>
        <div className="mt-2 flex items-baseline gap-1">
          <span
            className="text-3xl font-bold"
            style={{ color: 'var(--color-primary)', fontFamily: 'var(--font-family-heading)' }}
          >
            ${price}
          </span>
          {period && (
            <span className="text-sm" style={{ color: 'var(--color-muted-foreground)' }}>
              {period}
            </span>
          )}
        </div>
        {savings !== undefined && (
          <p className="mt-1 text-sm font-medium" style={{ color: '#22C55E' }}>
            {t('saveAmount', { amount: savings })}
          </p>
        )}
        <p className="mt-1 text-xs" style={{ color: 'var(--color-muted-foreground)' }}>
          {t('currencyNote')}
        </p>
        <p className="mt-2 text-sm" style={{ color: 'var(--color-muted-foreground)' }}>
          {description}
        </p>
      </div>

      <ul className="mb-6 flex flex-col gap-2.5">
        {features.map((feature, i) => (
          <li
            key={i}
            className="flex items-start gap-2 text-sm"
            style={{ color: 'var(--color-muted-foreground)' }}
          >
            <Check size={16} className="mt-0.5 shrink-0" style={{ color: 'var(--color-accent)' }} />
            {feature}
          </li>
        ))}
      </ul>

      <Link
        to="/register"
        className="mt-auto w-full rounded-lg px-4 py-2.5 text-center text-sm font-medium transition-all interactive-scale"
        style={{
          backgroundColor: colors.buttonBg,
          color: 'var(--color-on-primary)',
        }}
      >
        {ctaLabel}
      </Link>
    </div>
  );
}
