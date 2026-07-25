import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { PricingCard } from './PricingCard';

const PRICING = {
  monthly: {
    green: 900,
    gold: 1500,
    platinum: 2500,
  },
  yearly: {
    green: 850,
    gold: 1400,
    platinum: 2050,
  },
} as const;

export function PricingSection() {
  const { t } = useTranslation();
  const [isYearly, setIsYearly] = useState(false);

  const plans = [
    {
      tier: 'green' as const,
      name: t('pricing.green.name'),
      price: isYearly ? PRICING.yearly.green : PRICING.monthly.green,
      period: isYearly ? t('pricing.perMonthBilledYearly') : t('pricing.perMonth'),
      description: t('pricing.green.description'),
      features: [
        t('pricing.green.f1'),
        t('pricing.green.f2'),
        t('pricing.green.f3'),
      ],
      savings: isYearly ? PRICING.monthly.green - PRICING.yearly.green : undefined,
    },
    {
      tier: 'gold' as const,
      name: t('pricing.gold.name'),
      price: isYearly ? PRICING.yearly.gold : PRICING.monthly.gold,
      period: isYearly ? t('pricing.perMonthBilledYearly') : t('pricing.perMonth'),
      description: t('pricing.gold.description'),
      features: [
        t('pricing.gold.f1'),
        t('pricing.gold.f2'),
        t('pricing.gold.f3'),
        t('pricing.gold.f4'),
      ],
      savings: isYearly ? PRICING.monthly.gold - PRICING.yearly.gold : undefined,
      isPopular: true,
    },
    {
      tier: 'platinum' as const,
      name: t('pricing.platinum.name'),
      price: isYearly ? PRICING.yearly.platinum : PRICING.monthly.platinum,
      period: isYearly ? t('pricing.perMonthBilledYearly') : t('pricing.perMonth'),
      description: t('pricing.platinum.description'),
      features: [
        t('pricing.platinum.f1'),
        t('pricing.platinum.f2'),
        t('pricing.platinum.f3'),
        t('pricing.platinum.f4'),
      ],
      savings: isYearly ? PRICING.monthly.platinum - PRICING.yearly.platinum : undefined,
    },
  ];

  return (
    <section id="pricing" className="py-20 lg:py-28" style={{ backgroundColor: 'var(--color-background)' }}>
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mb-14 text-center">
          <h2
            className="text-3xl font-bold sm:text-4xl"
            style={{ fontFamily: 'var(--font-family-heading)', color: 'var(--color-foreground)' }}
          >
            {t('pricing.title')}
          </h2>
          <p
            className="mt-4 text-lg"
            style={{ color: 'var(--color-muted-foreground)' }}
          >
            {t('pricing.subtitle')}
          </p>
        </div>

        <div className="mb-10 flex justify-center">
          <div
            className="relative inline-flex rounded-full p-1"
            style={{ backgroundColor: 'var(--color-muted)' }}
          >
            <button
              onClick={() => setIsYearly(false)}
              className={`relative z-10 rounded-full px-4 py-1.5 text-sm font-medium transition-all ${
                !isYearly ? '' : 'opacity-50'
              }`}
              style={{
                color: !isYearly ? 'var(--color-primary-foreground)' : 'var(--color-foreground)',
                backgroundColor: !isYearly ? 'var(--color-primary)' : 'transparent',
              }}
            >
              {t('pricing.monthly')}
            </button>
            <button
              onClick={() => setIsYearly(true)}
              className={`relative z-10 rounded-full px-4 py-1.5 text-sm font-medium transition-all ${
                isYearly ? '' : 'opacity-50'
              }`}
              style={{
                color: isYearly ? 'var(--color-primary-foreground)' : 'var(--color-foreground)',
                backgroundColor: isYearly ? 'var(--color-primary)' : 'transparent',
              }}
            >
              {t('pricing.yearly')}
            </button>
          </div>
        </div>

        <div className="mb-8 text-center">
          <Link
            to="/pricing/compare"
            className="inline-flex items-center gap-2 text-sm font-medium underline underline-offset-4 transition-opacity hover:opacity-80"
            style={{ color: 'var(--color-primary)' }}
          >
            {t('pricing.viewComparison')}
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </Link>
        </div>

        <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
          {plans.map((plan) => (
            <PricingCard
              key={plan.tier}
              tier={plan.tier}
              name={plan.name}
              price={plan.price}
              period={plan.period}
              description={plan.description}
              features={plan.features}
              isPopular={plan.isPopular}
              ctaLabel={t('pricing.cta')}
              savings={plan.savings}
              t={t}
            />
          ))}
        </div>
      </div>
    </section>
  );
}
