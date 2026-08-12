import { useTranslation } from 'react-i18next';
import { SCOPE_ROWS } from './data';

export function PartiesTable() {
  const { t } = useTranslation('legal');
  const rows = [
    {
      labelKey: 'gdpr.parties.controllerLabel',
      valueKey: 'gdpr.parties.controllerAddress',
    },
    {
      labelKey: 'gdpr.parties.processorLabel',
      valueKey: 'gdpr.parties.processorAddress',
    },
  ] as const;

  return (
    <div className="overflow-hidden rounded-lg border" style={{ borderColor: 'var(--color-border)' }}>
      <table className="w-full text-sm">
        <tbody style={{ borderColor: 'var(--color-border)' }}>
          {rows.map((row) => (
            <tr key={row.labelKey} style={{ borderColor: 'var(--color-border)' }}>
              <td
                className="w-52 px-4 py-3 font-medium"
                style={{ backgroundColor: 'var(--color-muted)', color: 'var(--color-primary)' }}
              >
                {t(row.labelKey)}
              </td>
              <td className="px-4 py-3" style={{ color: 'var(--color-muted-foreground)' }}>
                {t(row.valueKey)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function ScopeTable() {
  const { t } = useTranslation('legal');

  return (
    <div className="overflow-hidden rounded-lg border" style={{ borderColor: 'var(--color-border)' }}>
      <table className="w-full text-sm">
        <thead style={{ backgroundColor: 'var(--color-muted)' }}>
          <tr>
            <th
              className="px-4 py-2 text-left font-medium"
              style={{ color: 'var(--color-primary)' }}
            >
              {t('gdpr.scope.tableHeader.item')}
            </th>
            <th
              className="px-4 py-2 text-left font-medium"
              style={{ color: 'var(--color-primary)' }}
            >
              {t('gdpr.scope.tableHeader.desc')}
            </th>
          </tr>
        </thead>
        <tbody style={{ borderColor: 'var(--color-border)' }}>
          {SCOPE_ROWS.map((row) => (
            <tr key={row.labelKey} style={{ borderColor: 'var(--color-border)' }}>
              <td
                className="w-40 px-4 py-3 align-top font-medium"
                style={{ backgroundColor: 'var(--color-muted)', color: 'var(--color-primary)' }}
              >
                {t(`gdpr.scope.${row.labelKey}`)}
              </td>
              <td
                className="px-4 py-3 align-top"
                style={{ color: 'var(--color-muted-foreground)' }}
              >
                {t(`gdpr.scope.${row.descKey}`)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
