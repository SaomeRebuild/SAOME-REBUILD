import { useTranslation } from 'react-i18next';
import { SCOPE_ROWS } from './data';

export function PartiesTable() {
  const { t } = useTranslation();
  const rows = [
    {
      labelKey: 'legal.gdpr.parties.controllerLabel',
      valueKey: 'legal.gdpr.parties.controllerAddress',
    },
    {
      labelKey: 'legal.gdpr.parties.processorLabel',
      valueKey: 'legal.gdpr.parties.processorAddress',
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
  const { t } = useTranslation();

  return (
    <div className="overflow-hidden rounded-lg border" style={{ borderColor: 'var(--color-border)' }}>
      <table className="w-full text-sm">
        <thead style={{ backgroundColor: 'var(--color-muted)' }}>
          <tr>
            <th
              className="px-4 py-2 text-left font-medium"
              style={{ color: 'var(--color-primary)' }}
            >
              {t('legal.gdpr.scope.tableHeader.item')}
            </th>
            <th
              className="px-4 py-2 text-left font-medium"
              style={{ color: 'var(--color-primary)' }}
            >
              {t('legal.gdpr.scope.tableHeader.desc')}
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
                {t(`legal.gdpr.scope.${row.labelKey}`)}
              </td>
              <td
                className="px-4 py-3 align-top"
                style={{ color: 'var(--color-muted-foreground)' }}
              >
                {t(`legal.gdpr.scope.${row.descKey}`)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
