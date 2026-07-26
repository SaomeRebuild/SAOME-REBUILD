import { useTranslation } from 'react-i18next';
import { PartiesTable, ScopeTable } from './GDPRPage/tables';
import { ASSISTANCE_ITEMS, TERMINATION_ITEMS } from './GDPRPage/data';

export function GDPRPage() {
  const { t } = useTranslation();

  return (
    <div className="py-16 lg:py-24" style={{ backgroundColor: 'var(--color-background)' }}>
      <div className="mx-auto max-w-3xl px-4 sm:px-6">
        <p className="text-sm" style={{ color: 'var(--color-muted-foreground)' }}>
          {t('legal.gdpr.date')}
        </p>
        <h1
          className="mt-2 text-3xl font-bold"
          style={{ fontFamily: 'var(--font-family-heading)', color: 'var(--color-foreground)' }}
        >
          {t('legal.gdpr.title')}
        </h1>
        <p className="mt-2 text-sm" style={{ color: 'var(--color-muted-foreground)' }}>
          {t('legal.gdpr.subtitle')}
        </p>

        <div className="mt-10 space-y-10 text-sm leading-relaxed">
          <section>
            <h2
              className="mb-4 text-lg font-semibold"
              style={{ fontFamily: 'var(--font-family-heading)', color: 'var(--color-foreground)' }}
            >
              A. {t('legal.gdpr.sA')}
            </h2>
            <PartiesTable />
          </section>

          <section>
            <h2
              className="mb-4 text-lg font-semibold"
              style={{ fontFamily: 'var(--font-family-heading)', color: 'var(--color-foreground)' }}
            >
              B. {t('legal.gdpr.sB')}
            </h2>
            <ScopeTable />
          </section>

          <section>
            <h2
              className="mb-4 text-lg font-semibold"
              style={{ fontFamily: 'var(--font-family-heading)', color: 'var(--color-foreground)' }}
            >
              C. {t('legal.gdpr.sC')}
            </h2>
            <div className="space-y-4">
              <div>
                <h3 className="mb-2 font-medium" style={{ color: 'var(--color-primary)' }}>
                  {t('legal.gdpr.obligations.processingOnly.title')}
                </h3>
                <p style={{ color: 'var(--color-muted-foreground)' }}>
                  {t('legal.gdpr.obligations.processingOnly.body')}
                </p>
              </div>
              <div>
                <h3 className="mb-2 font-medium" style={{ color: 'var(--color-primary)' }}>
                  {t('legal.gdpr.obligations.confidentiality.title')}
                </h3>
                <p style={{ color: 'var(--color-muted-foreground)' }}>
                  {t('legal.gdpr.obligations.confidentiality.body')}
                </p>
              </div>
              <div>
                <h3 className="mb-2 font-medium" style={{ color: 'var(--color-primary)' }}>
                  {t('legal.gdpr.obligations.toms.title')}
                </h3>
                <p style={{ color: 'var(--color-muted-foreground)' }}>
                  {t('legal.gdpr.obligations.toms.body')}
                </p>
              </div>
              <div>
                <h3 className="mb-2 font-medium" style={{ color: 'var(--color-primary)' }}>
                  {t('legal.gdpr.obligations.subProcessors.title')}
                </h3>
                <p style={{ color: 'var(--color-muted-foreground)' }}>
                  {t('legal.gdpr.obligations.subProcessors.existing')}
                </p>
                <p className="mt-1" style={{ color: 'var(--color-muted-foreground)' }}>
                  {t('legal.gdpr.obligations.subProcessors.new')}
                </p>
              </div>
              <div>
                <h3 className="mb-2 font-medium" style={{ color: 'var(--color-primary)' }}>
                  {t('legal.gdpr.obligations.assistance.title')}
                </h3>
                <ul className="ml-5 list-disc space-y-1" style={{ color: 'var(--color-muted-foreground)' }}>
                  {ASSISTANCE_ITEMS.map((item) => (
                    <li key={item.key}>{t(`legal.gdpr.obligations.assistance.${item.key}`)}</li>
                  ))}
                </ul>
              </div>
            </div>
          </section>

          <section>
            <h2
              className="mb-4 text-lg font-semibold"
              style={{ fontFamily: 'var(--font-family-heading)', color: 'var(--color-foreground)' }}
            >
              D. {t('legal.gdpr.sD')}
            </h2>
            <div className="space-y-3">
              {TERMINATION_ITEMS.map((item) => (
                <p key={item.key} style={{ color: 'var(--color-muted-foreground)' }}>
                  {t(`legal.gdpr.termination.${item.key}`)}
                </p>
              ))}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
