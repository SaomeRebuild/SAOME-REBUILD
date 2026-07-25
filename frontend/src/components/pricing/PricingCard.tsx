import { Link } from 'react-router-dom';
import { Check } from 'lucide-react';

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
}

const tierStyles: Record<PricingTier, {
  border: string;
  badge: string;
  button: string;
}> = {
  green: {
    border: 'border-border',
    badge: 'bg-green-100 text-green-800',
    button: 'bg-primary text-on-primary hover:bg-primary/90',
  },
  gold: {
    border: 'border-accent',
    badge: 'bg-accent text-on-accent',
    button: 'bg-accent text-on-accent hover:bg-accent/90',
  },
  platinum: {
    border: 'border-border',
    badge: 'bg-muted text-primary',
    button: 'bg-primary text-on-primary hover:bg-primary/90',
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
}: PricingCardProps) {
  const styles = tierStyles[tier];

  return (
    <div className={`relative flex flex-col rounded-xl border-2 ${styles.border} bg-white p-6 shadow-sm`}>
      {isPopular && (
        <div className={`absolute -top-3 left-1/2 -translate-x-1/2 rounded-full px-3 py-1 text-xs font-semibold ${styles.badge}`}>
          Most Popular
        </div>
      )}

      <div className="mb-4">
        <p className="text-sm font-medium text-secondary">{name}</p>
        <div className="mt-2 flex items-baseline gap-1">
          <span className="text-3xl font-bold text-primary">${price}</span>
          {period && <span className="text-sm text-secondary">{period}</span>}
        </div>
        <p className="mt-2 text-sm text-secondary">{description}</p>
      </div>

      <ul className="mb-6 flex flex-col gap-2.5">
        {features.map((feature, i) => (
          <li key={i} className="flex items-start gap-2 text-sm text-secondary">
            <Check size={16} className="mt-0.5 shrink-0 text-accent" />
            {feature}
          </li>
        ))}
      </ul>

      <Link
        to="/register"
        className={`mt-auto w-full rounded-lg px-4 py-2.5 text-center text-sm font-medium transition-all ${styles.button}`}
      >
        {ctaLabel}
      </Link>
    </div>
  );
}
