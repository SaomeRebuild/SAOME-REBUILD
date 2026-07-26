import { useTranslation } from 'react-i18next';
import { ControllerTable, CollectionTable } from './PrivacyPage/tables';
import { RETENTION_ITEMS, RIGHT_ITEMS } from './PrivacyPage/data';

export function PrivacyPage() {
  const { t } = useTranslation();

  return (
    <div className="py-16 lg:py-24" style={{ backgroundColor: 'var(--color-background)' }}>
      <div className="mx-auto max-w-3xl px-4 sm:px-6">
        <p className="text-sm" style={{ color: 'var(--color-muted-foreground)' }}>
          {t('legal.privacy.date')}
        </p>
        <h1
          className="mt-2 text-3xl font-bold"
          style={{ fontFamily: 'var(--font-family-heading)', color: 'var(--color-foreground)' }}
        >
          {t('legal.privacy.title')}
        </h1>

        <div className="mt-10 space-y-10 text-sm leading-relaxed">
          <section>
            <h2
              className="mb-4 text-lg font-semibold"
              style={{ fontFamily: 'var(--font-family-heading)', color: 'var(--color-foreground)' }}
            >
              A. {t('legal.privacy.sA')}
            </h2>
            <ControllerTable />
          </section>

          <section>
            <h2
              className="mb-4 text-lg font-semibold"
              style={{ fontFamily: 'var(--font-family-heading)', color: 'var(--color-foreground)' }}
            >
              B. {t('legal.privacy.sB')}
            </h2>
            <p className="mb-3" style={{ color: 'var(--color-muted-foreground)' }}>
              {t('legal.privacy.collection.intro')}
            </p>
            <CollectionTable />
          </section>

          <section>
            <h2
              className="mb-4 text-lg font-semibold"
              style={{ fontFamily: 'var(--font-family-heading)', color: 'var(--color-foreground)' }}
            >
              C. {t('legal.privacy.sC')}
            </h2>
            <p style={{ color: 'var(--color-muted-foreground)' }}>
              {t('legal.privacy.processor.body')}
            </p>
          </section>

          <section>
            <h2
              className="mb-4 text-lg font-semibold"
              style={{ fontFamily: 'var(--font-family-heading)', color: 'var(--color-foreground)' }}
            >
              D. {t('legal.privacy.sD')}
            </h2>
            <div className="space-y-3">
              <p style={{ color: 'var(--color-muted-foreground)' }}>
                {t('legal.privacy.sharing.subProcessors')}
              </p>
              <p style={{ color: 'var(--color-muted-foreground)' }}>
                {t('legal.privacy.sharing.intlTransfer')}
              </p>
            </div>
          </section>

          <section>
            <h2
              className="mb-4 text-lg font-semibold"
              style={{ fontFamily: 'var(--font-family-heading)', color: 'var(--color-foreground)' }}
            >
              E. {t('legal.privacy.sE')}
            </h2>
            <p className="mb-3" style={{ color: 'var(--color-muted-foreground)' }}>
              {t('legal.privacy.rights.intro')}
            </p>
            <ul
              className="list-inside list-disc space-y-1"
              style={{ color: 'var(--color-muted-foreground)' }}
            >
              {RIGHT_ITEMS.map((right) => (
                <li key={right.titleKey}>
                  <strong style={{ color: 'var(--color-primary)' }}>
                    {t(`legal.privacy.rights.${right.titleKey}`)}
                  </strong>{' '}
                  — {t(`legal.privacy.rights.${right.descKey}`)}
                </li>
              ))}
            </ul>
          </section>

          <section>
            <h2
              className="mb-4 text-lg font-semibold"
              style={{ fontFamily: 'var(--font-family-heading)', color: 'var(--color-foreground)' }}
            >
              F. {t('legal.privacy.sF')}
            </h2>
            <div className="space-y-3">
              {RETENTION_ITEMS.map((item) => (
                <p key={item.key} style={{ color: 'var(--color-muted-foreground)' }}>
                  {t(`legal.privacy.retention.${item.key}`)}
                </p>
              ))}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
