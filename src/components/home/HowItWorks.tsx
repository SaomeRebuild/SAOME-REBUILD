import { useTranslation } from 'react-i18next';
import { UserPlus, Settings, Smartphone } from 'lucide-react';

const steps = [
  { icon: UserPlus, titleKey: 'step1Title', descKey: 'step1Desc' },
  { icon: Settings, titleKey: 'step2Title', descKey: 'step2Desc' },
  { icon: Smartphone, titleKey: 'step3Title', descKey: 'step3Desc' },
];

export function HowItWorks() {
  const { t } = useTranslation();

  return (
    <section id="about" className="bg-muted py-20 lg:py-28">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <h2 className="mb-16 text-center text-3xl font-bold text-primary sm:text-4xl">
          {t('howItWorks.title')}
        </h2>

        <div className="grid grid-cols-1 gap-8 md:grid-cols-3">
          {steps.map((step, index) => {
            const Icon = step.icon;
            return (
              <div key={step.titleKey} className="relative flex flex-col items-center text-center">
                {index < steps.length - 1 && (
                  <div className="absolute left-[calc(50%+3rem)] top-10 hidden h-px w-[calc(100%-6rem)] bg-border lg:block" />
                )}
                <div className="relative z-10 flex h-20 w-20 items-center justify-center rounded-full bg-white shadow-md">
                  <Icon size={32} className="text-accent" />
                </div>
                <h3 className="mt-6 text-xl font-semibold text-primary">
                  {t(`howItWorks.${step.titleKey}`)}
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-secondary">
                  {t(`howItWorks.${step.descKey}`)}
                </p>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
