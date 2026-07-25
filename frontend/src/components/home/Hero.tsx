import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ArrowRight, Play } from 'lucide-react';

export function Hero() {
  const { t } = useTranslation();

  return (
    <section className="relative bg-background pt-32 pb-20 lg:pt-40 lg:pb-32">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col items-center text-center">
          <div className="mb-6 inline-flex items-center rounded-full border border-border bg-white px-4 py-1.5">
            <span className="text-xs font-medium text-secondary">
              {t('hero.badge')}
            </span>
          </div>

          <h1 className="max-w-4xl text-4xl font-bold leading-tight text-primary sm:text-5xl lg:text-6xl">
            {t('hero.title')}
          </h1>

          <p className="mt-6 max-w-2xl text-lg text-secondary">
            {t('hero.subtitle')}
          </p>

          <div className="mt-10 flex flex-col gap-4 sm:flex-row">
            <Link
              to="/register"
              className="inline-flex items-center justify-center gap-2 rounded-md bg-accent px-6 py-3 text-base font-medium text-on-accent shadow-sm transition-all hover:opacity-90 hover:-translate-y-px active:translate-y-0"
            >
              {t('hero.ctaPrimary')}
              <ArrowRight size={18} />
            </Link>
            <Link
              to="/demo"
              className="inline-flex items-center justify-center gap-2 rounded-md border border-border bg-white px-6 py-3 text-base font-medium text-secondary shadow-sm transition-all hover:border-primary hover:text-primary"
            >
              <Play size={18} />
              {t('hero.ctaSecondary')}
            </Link>
          </div>
        </div>

        <div className="mt-16 flex justify-center">
          <div className="relative w-full max-w-4xl">
            <div className="aspect-[16/9] rounded-xl border border-border bg-gradient-to-br from-muted to-white shadow-2xl" />
          </div>
        </div>
      </div>
    </section>
  );
}
