import { useTranslation } from 'react-i18next';
import { COLLECTION_ROWS, CONTROLLER_ROWS } from './data';

export function ControllerTable() {
  const { t } = useTranslation('legal');

  return (
    <div className="overflow-hidden rounded-lg border" style={{ borderColor: 'var(--color-border)' }}>
      <table className="w-full text-sm">
        <tbody style={{ borderColor: 'var(--color-border)' }}>
          {CONTROLLER_ROWS.map((row) => (
            <tr key={row.labelKey} style={{ borderColor: 'var(--color-border)' }}>
              <td
                className="w-40 px-4 py-3 font-medium"
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

export function CollectionTable() {
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
              {t('privacy.collection.tableHeader.type')}
            </th>
            <th
              className="px-4 py-2 text-left font-medium"
              style={{ color: 'var(--color-primary)' }}
            >
              {t('privacy.collection.tableHeader.purpose')}
            </th>
            <th
              className="px-4 py-2 text-left font-medium"
              style={{ color: 'var(--color-primary)' }}
            >
              {t('privacy.collection.tableHeader.basis')}
            </th>
          </tr>
        </thead>
        <tbody style={{ borderColor: 'var(--color-border)' }}>
          {COLLECTION_ROWS.map((row) => (
            <tr key={row.typeKey} style={{ borderColor: 'var(--color-border)' }}>
              <td
                className="px-4 py-3 align-top font-medium"
                style={{ color: 'var(--color-primary)' }}
              >
                {t(row.typeKey)}
              </td>
              <td
                className="px-4 py-3 align-top"
                style={{ color: 'var(--color-muted-foreground)' }}
              >
                {t(row.purposeKey)}
              </td>
              <td
                className="px-4 py-3 align-top"
                style={{ color: 'var(--color-muted-foreground)' }}
              >
                {t(row.basisKey)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
