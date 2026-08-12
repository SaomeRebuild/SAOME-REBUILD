import { useTranslation } from 'react-i18next';

export function DemoPage() {
  const { t } = useTranslation('landing');

  return (
    <div
      className="flex min-h-[60vh] items-center justify-center"
      style={{ backgroundColor: 'var(--color-background)' }}
    >
      <div className="text-center">
        <h1
          className="text-4xl font-bold sm:text-5xl"
          style={{
            fontFamily: 'var(--font-family-heading)',
            color: 'var(--color-foreground)',
          }}
        >
          {t('demo.title')}
        </h1>
        <p
          className="mt-4 text-lg"
          style={{ color: 'var(--color-muted-foreground)' }}
        >
          {t('demo.subtitle')}
        </p>
      </div>
    </div>
  );
}
