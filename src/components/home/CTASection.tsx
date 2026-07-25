import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ArrowRight } from 'lucide-react';

export function CTASection() {
  const { t } = useTranslation();

  return (
    <section className="bg-background py-20 lg:py-28">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col items-center text-center">
          <h2 className="text-3xl font-bold text-primary sm:text-4xl">
            {t('cta.title')}
          </h2>
          <p className="mt-4 text-lg text-secondary">
            {t('cta.subtitle')}
          </p>
          <Link
            to="/register"
            className="mt-8 inline-flex items-center justify-center gap-2 rounded-md bg-accent px-8 py-4 text-base font-medium text-on-accent shadow-sm transition-all hover:opacity-90 hover:-translate-y-px active:translate-y-0"
          >
            {t('cta.button')}
            <ArrowRight size={18} />
          </Link>
        </div>
      </div>
    </section>
  );
}
