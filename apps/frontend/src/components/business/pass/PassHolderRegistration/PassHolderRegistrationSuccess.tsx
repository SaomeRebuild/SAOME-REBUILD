/**
 * PassHolderRegistrationSuccess — post-submit view. Renders a "Pass
 * download coming soon" placeholder that mirrors the dashboard
 * `ComingSoonView` pattern but lives inside the L2 folder so the form
 * swap is contained.
 */

import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Construction } from 'lucide-react';
import type { PublicPassTemplate } from '@saome/shared/types/passHolder';

export interface PassHolderRegistrationSuccessProps {
  template: PublicPassTemplate;
}

export function PassHolderRegistrationSuccess({ template }: PassHolderRegistrationSuccessProps) {
  const { t } = useTranslation('passHolder');

  return (
    <section
      className="flex flex-col items-center gap-3 rounded-lg border p-8 text-center"
      data-testid="pass-holder-success"
      style={{
        backgroundColor: 'var(--color-card)',
        borderColor: 'var(--color-border)',
      }}
    >
      <Construction size={40} style={{ color: 'var(--color-muted-foreground)' }} aria-hidden="true" />
      <h1
        className="text-2xl font-semibold"
        style={{ color: 'var(--color-foreground)' }}
      >
        {t('success.title')}
      </h1>
      <p
        className="text-sm"
        style={{ color: 'var(--color-muted-foreground)' }}
      >
        {t('success.description')}
      </p>
      <Link
        to="/"
        className="mt-2 text-sm font-medium underline"
        style={{ color: 'var(--color-primary)' }}
        data-testid="pass-holder-success-back"
      >
        {t('success.backToTemplate', { templateName: template.issuerName })}
      </Link>
    </section>
  );
}