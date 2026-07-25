import { useTranslation } from 'react-i18next';

export function TermsPage() {
  const { t } = useTranslation();

  return (
    <div className="py-16 lg:py-24" style={{ backgroundColor: 'var(--color-background)' }}>
      <div className="mx-auto max-w-3xl px-4 sm:px-6">
        <p className="text-sm" style={{ color: 'var(--color-muted-foreground)' }}>
          {t('legal.terms.effectiveDate')}
        </p>
        <h1
          className="mt-2 text-3xl font-bold"
          style={{ fontFamily: 'var(--font-family-heading)', color: 'var(--color-foreground)' }}
        >
          {t('legal.terms.title')}
        </h1>

        <div className="mt-10 space-y-8 text-sm leading-relaxed">
          <section>
            <h2 className="mb-3 text-lg font-semibold" style={{ fontFamily: 'var(--font-family-heading)', color: 'var(--color-foreground)' }}>
              1. {t('legal.terms.s1')}
            </h2>
            <div className="space-y-3">
              <p><strong style={{ color: 'var(--color-primary)' }}>1.1</strong> {t('legal.terms.s1p1')}</p>
              <p><strong style={{ color: 'var(--color-primary)' }}>1.2</strong> {t('legal.terms.s1p2')}</p>
              <p><strong style={{ color: 'var(--color-primary)' }}>1.3</strong> {t('legal.terms.s1p3')}</p>
            </div>
          </section>

          <section>
            <h2 className="mb-3 text-lg font-semibold" style={{ fontFamily: 'var(--font-family-heading)', color: 'var(--color-foreground)' }}>
              2. {t('legal.terms.s2')}
            </h2>
            <div className="space-y-3">
              <p><strong style={{ color: 'var(--color-primary)' }}>2.1</strong> {t('legal.terms.s2p1')}</p>
              <p><strong style={{ color: 'var(--color-primary)' }}>2.2</strong> {t('legal.terms.s2p2')}</p>
            </div>
          </section>

          <section>
            <h2 className="mb-3 text-lg font-semibold" style={{ fontFamily: 'var(--font-family-heading)', color: 'var(--color-foreground)' }}>
              3. {t('legal.terms.s3')}
            </h2>
            <div className="space-y-3">
              <p><strong style={{ color: 'var(--color-primary)' }}>3.1</strong> {t('legal.terms.s3p1')}</p>
              <p><strong style={{ color: 'var(--color-primary)' }}>3.2</strong> {t('legal.terms.s3p2')}</p>
              <p><strong style={{ color: 'var(--color-primary)' }}>3.3</strong> {t('legal.terms.s3p3')}</p>
            </div>
          </section>

          <section>
            <h2 className="mb-3 text-lg font-semibold" style={{ fontFamily: 'var(--font-family-heading)', color: 'var(--color-foreground)' }}>
              4. {t('legal.terms.s4')}
            </h2>
            <div className="space-y-3">
              <p><strong style={{ color: 'var(--color-primary)' }}>4.1</strong> {t('legal.terms.s4p1')}</p>
              <p><strong style={{ color: 'var(--color-primary)' }}>4.2</strong> {t('legal.terms.s4p2')}</p>
            </div>
          </section>

          <section>
            <h2 className="mb-3 text-lg font-semibold" style={{ fontFamily: 'var(--font-family-heading)', color: 'var(--color-foreground)' }}>
              5. {t('legal.terms.s5')}
            </h2>
            <div className="space-y-3">
              <p><strong style={{ color: 'var(--color-primary)' }}>5.1</strong> {t('legal.terms.s5p1')}</p>
              <p><strong style={{ color: 'var(--color-primary)' }}>5.2</strong> {t('legal.terms.s5p2')}</p>
            </div>
          </section>

          <section>
            <h2 className="mb-3 text-lg font-semibold" style={{ fontFamily: 'var(--font-family-heading)', color: 'var(--color-foreground)' }}>
              6. {t('legal.terms.s6')}
            </h2>
            <div className="space-y-3">
              <p><strong style={{ color: 'var(--color-primary)' }}>6.1</strong> {t('legal.terms.s6p1')}</p>
              <p><strong style={{ color: 'var(--color-primary)' }}>6.2</strong> {t('legal.terms.s6p2')}</p>
              <p><strong style={{ color: 'var(--color-primary)' }}>6.3</strong> {t('legal.terms.s6p3')}</p>
            </div>
          </section>

          <section>
            <h2 className="mb-3 text-lg font-semibold" style={{ fontFamily: 'var(--font-family-heading)', color: 'var(--color-foreground)' }}>
              7. {t('legal.terms.s7')}
            </h2>
            <div className="space-y-3">
              <p><strong style={{ color: 'var(--color-primary)' }}>7.1</strong> {t('legal.terms.s7p1')}</p>
              <p><strong style={{ color: 'var(--color-primary)' }}>7.2</strong> {t('legal.terms.s7p2')}</p>
            </div>
          </section>

          <section>
            <h2 className="mb-3 text-lg font-semibold" style={{ fontFamily: 'var(--font-family-heading)', color: 'var(--color-foreground)' }}>
              8. {t('legal.terms.s8')}
            </h2>
            <div className="space-y-3">
              <p><strong style={{ color: 'var(--color-primary)' }}>8.1</strong> {t('legal.terms.s8p1')}</p>
              <p><strong style={{ color: 'var(--color-primary)' }}>8.2</strong> {t('legal.terms.s8p2')}</p>
              <p><strong style={{ color: 'var(--color-primary)' }}>8.3</strong> {t('legal.terms.s8p3')}</p>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
