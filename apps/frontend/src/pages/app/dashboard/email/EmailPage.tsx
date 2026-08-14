import { useTranslation } from 'react-i18next';
import { ComingSoonView } from '../ComingSoonView';

export default function EmailPage() {
  const { t } = useTranslation('dashboard');
  return <ComingSoonView title={t('toolPages.email.title')} description={t('toolPages.email.description')} />;
}
