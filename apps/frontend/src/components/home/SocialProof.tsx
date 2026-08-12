import { useTranslation } from 'react-i18next';
import { Users, Store, CreditCard, TrendingUp } from 'lucide-react';

const stats = [
  { icon: Users, value: '50,000+', label: 'active_members' },
  { icon: Store, value: '500+', label: 'merchants' },
  { icon: CreditCard, value: '120,000+', label: 'passes_issued' },
  { icon: TrendingUp, value: '35%', label: 'avg_engagement' },
];

export function SocialProof() {
  const { t } = useTranslation('landing');

  return (
    <section
      className="border-y py-16"
      style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-card)' }}
    >
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <p
          className="mb-12 text-center text-sm font-medium"
          style={{ color: 'var(--color-muted-foreground)' }}
        >
          {t('socialProof.trustedBy')}
        </p>

        <div className="grid grid-cols-2 gap-8 md:grid-cols-4">
          {stats.map((stat) => {
            const Icon = stat.icon;
            return (
              <div key={stat.label} className="flex flex-col items-center gap-3">
                <div
                  className="flex h-12 w-12 items-center justify-center rounded-lg"
                  style={{ backgroundColor: 'var(--color-muted)' }}
                >
                  <Icon size={24} style={{ color: 'var(--color-accent)' }} />
                </div>
                <div className="text-center">
                  <p
                    className="text-2xl font-bold"
                    style={{ color: 'var(--color-primary)' }}
                  >
                    {stat.value}
                  </p>
                  <p
                    className="mt-1 text-sm"
                    style={{ color: 'var(--color-muted-foreground)' }}
                  >
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
