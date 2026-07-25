import { useTranslation } from 'react-i18next';
import { PricingCard } from './PricingCard';

export function PricingSection() {
  const { t } = useTranslation();

  const plans = [
    {
      tier: 'green' as const,
      name: t('pricing.green.name'),
      price: 900,
      period: t('pricing.perMonth'),
      description: t('pricing.green.description'),
      features: [
        t('pricing.green.f1'),
        t('pricing.green.f2'),
        t('pricing.green.f3'),
      ],
    },
    {
      tier: 'gold' as const,
      name: t('pricing.gold.name'),
      price: 1500,
      period: t('pricing.perMonth'),
      description: t('pricing.gold.description'),
      features: [
        t('pricing.gold.f1'),
        t('pricing.gold.f2'),
        t('pricing.gold.f3'),
        t('pricing.gold.f4'),
      ],
      isPopular: true,
    },
    {
      tier: 'platinum' as const,
      name: t('pricing.platinum.name'),
      price: 2500,
      period: t('pricing.perMonth'),
      description: t('pricing.platinum.description'),
      features: [
        t('pricing.platinum.f1'),
        t('pricing.platinum.f2'),
        t('pricing.platinum.f3'),
        t('pricing.platinum.f4'),
      ],
    },
  ];

  return (
    <section id="pricing" className="bg-background py-20 lg:py-28">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mb-14 text-center">
          <h2 className="text-3xl font-bold text-primary sm:text-4xl">
            {t('pricing.title')}
          </h2>
          <p className="mt-4 text-lg text-secondary">
            {t('pricing.subtitle')}
          </p>
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
            />
          ))}
        </div>
      </div>
    </section>
  );
}
