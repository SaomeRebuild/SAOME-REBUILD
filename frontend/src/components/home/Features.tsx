import { useTranslation } from 'react-i18next';
import { Wallet, Star, ScanBarcode, Building2 } from 'lucide-react';

const features = [
  {
    icon: Wallet,
    titleKey: 'passTitle',
    descKey: 'passDesc',
  },
  {
    icon: Star,
    titleKey: 'pointsTitle',
    descKey: 'pointsDesc',
  },
  {
    icon: ScanBarcode,
    titleKey: 'scannerTitle',
    descKey: 'scannerDesc',
  },
  {
    icon: Building2,
    titleKey: 'multiTenantTitle',
    descKey: 'multiTenantDesc',
  },
];

export function Features() {
  const { t } = useTranslation();

  return (
    <section id="features" className="bg-background py-20 lg:py-28">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mb-16 text-center">
          <h2 className="text-3xl font-bold text-primary sm:text-4xl">
            {t('features.title')}
          </h2>
          <p className="mt-4 text-lg text-secondary">
            {t('features.subtitle')}
          </p>
        </div>

        <div className="grid grid-cols-1 gap-8 md:grid-cols-2 lg:grid-cols-4">
          {features.map((feature) => {
            const Icon = feature.icon;
            return (
              <div
                key={feature.titleKey}
                className="flex flex-col gap-4 rounded-xl border border-border bg-white p-6 transition-shadow hover:shadow-md"
              >
                <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-accent text-on-accent">
                  <Icon size={24} />
                </div>
                <h3 className="text-lg font-semibold text-primary">
                  {t(`features.${feature.titleKey}`)}
                </h3>
                <p className="text-sm leading-relaxed text-secondary">
                  {t(`features.${feature.descKey}`)}
                </p>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
