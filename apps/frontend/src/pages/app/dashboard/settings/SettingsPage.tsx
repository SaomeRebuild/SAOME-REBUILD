import { useTranslation } from 'react-i18next';
import { ComingSoonView } from '../ComingSoonView';

export default function SettingsPage() {
  const { t } = useTranslation('dashboard');
  return <ComingSoonView title={t('toolPages.settings.title')} description={t('toolPages.settings.description')} />;
}
