/**
 * PassHolderRegistrationHeader — sub-component for the L2 main.
 *
 * Shows the page title + subtitle above the form. Pulled out of the main
 * component to keep the L2 assembly file under 100 lines.
 */

import { useTranslation } from 'react-i18next';
import type { PublicPassTemplate } from '@saome/shared/types/passHolder';

export interface PassHolderRegistrationHeaderProps {
  template: PublicPassTemplate;
}

export function PassHolderRegistrationHeader({ template }: PassHolderRegistrationHeaderProps) {
  const { t } = useTranslation('passHolder');
  return (
    <header
      className="flex flex-col gap-1 pb-4"
      data-testid="pass-holder-registration-header"
    >
      <h1
        className="text-xl font-bold sm:text-2xl"
        style={{ color: 'var(--color-foreground)' }}
      >
        {t('title')}
      </h1>
      <p
        className="text-sm"
        style={{ color: 'var(--color-muted-foreground)' }}
      >
        {t('subtitle', { issuerName: template.issuerName })}
      </p>
    </header>
  );
}