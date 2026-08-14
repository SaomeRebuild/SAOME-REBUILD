import { useTranslation } from 'react-i18next';
import { ComingSoonView } from '../ComingSoonView';

export default function BillingPage() {
  const { t } = useTranslation('dashboard');
  return <ComingSoonView title={t('toolPages.billing.title')} description={t('toolPages.billing.description')} />;
}
