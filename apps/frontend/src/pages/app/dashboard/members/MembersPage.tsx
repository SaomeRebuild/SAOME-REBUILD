import { useTranslation } from 'react-i18next';
import { ComingSoonView } from '../ComingSoonView';

export default function MembersPage() {
  const { t } = useTranslation('dashboard');
  return <ComingSoonView title={t('toolPages.members.title')} description={t('toolPages.members.description')} />;
}
