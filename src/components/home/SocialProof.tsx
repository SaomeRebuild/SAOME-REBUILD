import { useTranslation } from 'react-i18next';
import { Users, Store, CreditCard, TrendingUp } from 'lucide-react';

const stats = [
  { icon: Users, value: '50,000+', label: 'active_members' },
  { icon: Store, value: '500+', label: 'merchants' },
  { icon: CreditCard, value: '120,000+', label: 'passes_issued' },
  { icon: TrendingUp, value: '35%', label: 'avg_engagement' },
];

export function SocialProof() {
  const { t } = useTranslation();

  return (
    <section className="border-y border-border bg-white py-16">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <p className="mb-12 text-center text-sm font-medium text-secondary">
          {t('socialProof.trustedBy')}
        </p>

        <div className="grid grid-cols-2 gap-8 md:grid-cols-4">
          {stats.map((stat) => {
            const Icon = stat.icon;
            return (
              <div key={stat.label} className="flex flex-col items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-muted">
                  <Icon size={24} className="text-accent" />
                </div>
                <div className="text-center">
                  <p className="text-2xl font-bold text-primary">
                    {stat.value}
                  </p>
                  <p className="mt-1 text-sm text-secondary">
                    {t(`socialProof.${stat.label}`)}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
