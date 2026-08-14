import { useTranslation } from 'react-i18next';
import { ComingSoonView } from '../ComingSoonView';

export default function ChartsPage() {
  const { t } = useTranslation('dashboard');
  return <ComingSoonView title={t('toolPages.charts.title')} description={t('toolPages.charts.description')} />;
}
