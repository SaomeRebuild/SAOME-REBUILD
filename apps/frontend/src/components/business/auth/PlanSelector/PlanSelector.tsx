import { useTranslation } from 'react-i18next';
import type { PricingTier } from '@/components/pricing';
import { cn } from '@/lib/utils';

export interface PlanSelectorProps {
  selectedPlan: PricingTier | null;
  onSelect: (tier: PricingTier) => void;
}

export function PlanSelector({ selectedPlan, onSelect }: PlanSelectorProps) {
  const { t } = useTranslation('auth');

  const plans: Array<{
    tier: PricingTier;
    name: string;
    price: number;
    description: string;
    features: string[];
    isPopular?: boolean;
  }> = [
    {
      tier: 'green',
      name: t('register.plan.green.name'),
      price: 900,
      description: t('register.plan.green.desc'),
      features: [
        t('register.plan.features.cardTemplates3'),
        t('register.plan.features.email50'),
        t('register.plan.features.address1'),
      ],
    },
    {
      tier: 'gold',
      name: t('register.plan.gold.name'),
      price: 1500,
      description: t('register.plan.gold.desc'),
      isPopular: true,
      features: [
        t('register.plan.features.cardTemplates6'),
        t('register.plan.features.email80'),
        t('register.plan.features.address3'),
        t('register.plan.features.subaccount1'),
      ],
    },
    {
      tier: 'platinum',
      name: t('register.plan.platinum.name'),
      price: 2500,
      description: t('register.plan.platinum.desc'),
      features: [
        t('register.plan.features.cardTemplates10'),
        t('register.plan.features.email100'),
        t('register.plan.features.address10'),
        t('register.plan.features.subaccount5'),
      ],
    },
  ];

  return (
    <div className="space-y-4">
      <p className="text-center text-sm font-medium" style={{ color: 'var(--color-primary)' }}>
        {t('register.plan.trialHint')}
      </p>
      <div className="grid gap-4 sm:grid-cols-3">
        {plans.map((plan) => (
          <button
            key={plan.tier}
            type="button"
            onClick={() => onSelect(plan.tier)}
            aria-pressed={selectedPlan === plan.tier}
            className={cn(
              'relative min-w-0 rounded-xl border-2 p-4 text-left transition-all duration-200 sm:p-8',
              'focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none',
              selectedPlan === plan.tier
                ? 'border-primary ring-2 ring-primary/20'
                : 'border-neutral-200 hover:border-primary/50'
            )}
            style={{
              backgroundColor: 'var(--color-card)',
            }}
          >
            {plan.isPopular && (
              <div
                className="absolute -top-2.5 left-1/2 -translate-x-1/2 rounded-full px-2.5 py-0.5 text-xs font-semibold"
                style={{
                  backgroundColor: 'var(--color-accent)',
                  color: 'var(--color-on-accent)',
                }}
              >
                {t('register.plan.mostPopular')}
              </div>
            )}

            <div className="mb-3">
              <p
                className="text-sm font-medium"
                style={{ color: 'var(--color-muted-foreground)' }}
              >
                {plan.name}
              </p>
              <div className="mt-1 flex items-baseline gap-0.5">
                <span
                  className="text-2xl font-bold"
                  style={{ color: 'var(--color-primary)' }}
                >
                  ${plan.price}
                </span>
                <span
                  className="text-xs"
                  style={{ color: 'var(--color-muted-foreground)' }}
                >
                  {t('register.plan.pricePerMonth')}
                </span>
              </div>
              <p
                className="mt-1 text-xs"
                style={{ color: 'var(--color-muted-foreground)' }}
              >
                {t('register.plan.priceNote')}
              </p>
            </div>

            <p
              className="mb-3 text-xs"
              style={{ color: 'var(--color-muted-foreground)' }}
            >
              {plan.description}
            </p>

            <ul className="space-y-1.5">
              {plan.features.map((feature, i) => (
                <li
                  key={i}
                  className="flex items-start gap-1.5 text-xs"
                  style={{ color: 'var(--color-muted-foreground)' }}
                >
                  <span style={{ color: 'var(--color-accent)' }}>✓</span>
                  {feature}
                </li>
              ))}
            </ul>
          </button>
        ))}
      </div>
    </div>
  );
}
