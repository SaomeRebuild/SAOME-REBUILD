import { useTranslation } from 'react-i18next';
import { ControllerTable, CollectionTable } from './PrivacyPage/tables';
import { RETENTION_ITEMS, RIGHT_ITEMS } from './PrivacyPage/data';

export function PrivacyPage() {
  const { t } = useTranslation('legal');

  return (
    <div className="py-16 lg:py-24" style={{ backgroundColor: 'var(--color-background)' }}>
      <div className="mx-auto max-w-3xl px-4 sm:px-6">
        <p className="text-sm" style={{ color: 'var(--color-muted-foreground)' }}>
          {t('privacy.date')}
        </p>
        <h1
          className="mt-2 text-3xl font-bold"
          style={{ fontFamily: 'var(--font-family-heading)', color: 'var(--color-foreground)' }}
        >
          {t('privacy.title')}
        </h1>

        <div className="mt-10 space-y-10 text-sm leading-relaxed">
          <section>
            <h2
              className="mb-4 text-lg font-semibold"
              style={{ fontFamily: 'var(--font-family-heading)', color: 'var(--color-foreground)' }}
            >
              A. {t('privacy.sA')}
            </h2>
            <ControllerTable />
          </section>

          <section>
            <h2
              className="mb-4 text-lg font-semibold"
              style={{ fontFamily: 'var(--font-family-heading)', color: 'var(--color-foreground)' }}
            >
              B. {t('privacy.sB')}
            </h2>
            <p className="mb-3" style={{ color: 'var(--color-muted-foreground)' }}>
              {t('privacy.collection.intro')}
            </p>
            <CollectionTable />
          </section>

          <section>
            <h2
              className="mb-4 text-lg font-semibold"
              style={{ fontFamily: 'var(--font-family-heading)', color: 'var(--color-foreground)' }}
            >
              C. {t('privacy.sC')}
            </h2>
            <p style={{ color: 'var(--color-muted-foreground)' }}>
              {t('privacy.processor.body')}
            </p>
          </section>

          <section>
            <h2
              className="mb-4 text-lg font-semibold"
              style={{ fontFamily: 'var(--font-family-heading)', color: 'var(--color-foreground)' }}
            >
              D. {t('privacy.sD')}
            </h2>
            <div className="space-y-3">
              <p style={{ color: 'var(--color-muted-foreground)' }}>
                {t('privacy.sharing.subProcessors')}
              </p>
              <p style={{ color: 'var(--color-muted-foreground)' }}>
                {t('privacy.sharing.intlTransfer')}
              </p>
            </div>
          </section>

          <section>
            <h2
              className="mb-4 text-lg font-semibold"
              style={{ fontFamily: 'var(--font-family-heading)', color: 'var(--color-foreground)' }}
            >
              E. {t('privacy.sE')}
            </h2>
            <p className="mb-3" style={{ color: 'var(--color-muted-foreground)' }}>
              {t('privacy.rights.intro')}
            </p>
            <ul
              className="list-inside list-disc space-y-1"
              style={{ color: 'var(--color-muted-foreground)' }}
            >
              {RIGHT_ITEMS.map((right) => (
                <li key={right.titleKey}>
                  <strong style={{ color: 'var(--color-primary)' }}>
                    {t(`privacy.rights.${right.titleKey}`)}
                  </strong>{' '}
                  — {t(`privacy.rights.${right.descKey}`)}
                </li>
              ))}
            </ul>
          </section>

          <section>
            <h2
              className="mb-4 text-lg font-semibold"
              style={{ fontFamily: 'var(--font-family-heading)', color: 'var(--color-foreground)' }}
            >
              F. {t('privacy.sF')}
            </h2>
            <div className="space-y-3">
              {RETENTION_ITEMS.map((item) => (
                <p key={item.key} style={{ color: 'var(--color-muted-foreground)' }}>
                  {t(`privacy.retention.${item.key}`)}
                </p>
              ))}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
