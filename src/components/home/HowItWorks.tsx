import { useTranslation } from 'react-i18next';
import { UserPlus, Settings, Palette, Smartphone } from 'lucide-react';

const steps = [
  { icon: UserPlus, titleKey: 'step1Title', descKey: 'step1Desc' },
  { icon: Settings, titleKey: 'step2Title', descKey: 'step2Desc' },
  { icon: Palette, titleKey: 'step3Title', descKey: 'step3Desc' },
  { icon: Smartphone, titleKey: 'step4Title', descKey: 'step4Desc' },
];

export function HowItWorks() {
  const { t } = useTranslation();

  return (
    <section id="about" className="py-20 lg:py-28 mt-0" style={{ backgroundColor: 'var(--color-muted)' }}>
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <h2
          className="text-center text-3xl font-bold sm:text-4xl"
          style={{
            marginBottom: '6rem',
            fontFamily: 'var(--font-family-heading)',
            color: 'var(--color-foreground)',
          }}
        >
          {t('howItWorks.title')}
        </h2>

        <div className="grid grid-cols-1 gap-12 md:grid-cols-2 lg:grid-cols-4 lg:gap-16">
          {steps.map((step) => {
            const Icon = step.icon;
            return (
              <div
                key={step.titleKey}
                className="flex flex-col items-center rounded-xl border p-8 text-center"
                style={{
                  borderColor: 'var(--color-border)',
                  backgroundColor: 'var(--color-card)',
                }}
              >
                <div
                  className="flex h-20 w-20 items-center justify-center rounded-full"
                  style={{ backgroundColor: 'var(--color-primary)' }}
                >
                  <Icon size={32} style={{ color: 'var(--color-on-primary)' }} />
                </div>
                <h3
                  className="mt-6 text-xl font-semibold"
                  style={{ fontFamily: 'var(--font-family-heading)', color: 'var(--color-foreground)' }}
                >
                  {t(`howItWorks.${step.titleKey}`)}
                </h3>
                <p
                  className="mt-3 text-sm leading-relaxed"
                  style={{ color: 'var(--color-muted-foreground)' }}
                >
                  {t(`howItWorks.${step.descKey}`)
                  }
                </p>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
