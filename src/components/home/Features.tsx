import { useTranslation } from 'react-i18next';
import { Wallet, Star, ScanBarcode, Building2, MapPin, Users, Mail, Printer } from 'lucide-react';

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
  {
    icon: MapPin,
    titleKey: 'geoTitle',
    descKey: 'geoDesc',
  },
  {
    icon: Users,
    titleKey: 'memberTitle',
    descKey: 'memberDesc',
  },
  {
    icon: Mail,
    titleKey: 'emailTitle',
    descKey: 'emailDesc',
  },
  {
    icon: Printer,
    titleKey: 'standTitle',
    descKey: 'standDesc',
  },
];

export function Features() {
  const { t } = useTranslation();

  return (
    <section id="features" className="py-20 lg:py-28" style={{ backgroundColor: 'var(--color-background)' }}>
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mb-16 text-center">
          <h2
            className="text-3xl font-bold sm:text-4xl"
            style={{ fontFamily: 'var(--font-family-heading)', color: 'var(--color-foreground)' }}
          >
            {t('features.title')}
          </h2>
          <p
            className="mt-4 text-lg"
            style={{ color: 'var(--color-muted-foreground)' }}
          >
            {t('features.subtitle')}
          </p>
        </div>

        <div className="grid grid-cols-1 gap-8 md:grid-cols-2 lg:grid-cols-3">
          {features.map((feature) => {
            const Icon = feature.icon;
            return (
              <div
                key={feature.titleKey}
                className="flex flex-col gap-4 rounded-xl border p-6 transition-shadow card-hover"
                style={{
                  borderColor: 'var(--color-border)',
                  backgroundColor: 'var(--color-card)',
                }}
              >
                <div
                  className="flex h-12 w-12 items-center justify-center rounded-lg"
                  style={{ backgroundColor: 'var(--color-primary)', color: 'var(--color-on-primary)' }}
                >
                  <Icon size={24} />
                </div>
                <h3
                  className="text-lg font-semibold"
                  style={{ fontFamily: 'var(--font-family-heading)', color: 'var(--color-foreground)' }}
                >
                  {t(`features.${feature.titleKey}`)}
                </h3>
                <p
                  className="text-sm leading-relaxed"
                  style={{ color: 'var(--color-muted-foreground)' }}
                >
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
