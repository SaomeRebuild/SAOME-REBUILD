import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ArrowRight } from 'lucide-react';

export function CTASection() {
  const { t } = useTranslation('landing');

  return (
    <section className="py-20 lg:py-28" style={{ backgroundColor: 'var(--color-background)' }}>
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col items-center text-center">
          <h2
            className="text-3xl font-bold sm:text-4xl"
            style={{ fontFamily: 'var(--font-family-heading)', color: 'var(--color-foreground)' }}
          >
            {t('cta.title')}
          </h2>
          <p
            className="mt-4 text-lg"
            style={{ color: 'var(--color-muted-foreground)' }}
          >
            {t('cta.subtitle')}
          </p>
          <Link
            to="/register"
            className="mt-8 inline-flex items-center justify-center gap-2 rounded-md shadow-sm transition-all hover:opacity-90 hover:-translate-y-px active:translate-y-0 interactive-scale"
            style={{
              backgroundColor: 'var(--color-primary)',
              color: 'var(--color-on-primary)',
              padding: '1rem 2rem',
              fontSize: '1rem',
              fontWeight: 500,
            }}
          >
            {t('cta.button')}
            <ArrowRight size={18} />
          </Link>
        </div>
      </div>
    </section>
  );
}
