/**
 * ExpiryDateField — 到期日設定（非必填，date picker）
 * 與 PassValidDaysField 互斥：填了此欄則有效天數清空，反之亦然。
 */

import { useTranslation } from 'react-i18next';
import { useCardBuilderStore } from '../CardBuilderEditor.store';

export function ExpiryDateField() {
  const { t } = useTranslation('cardEditor');
  const expiryDate = useCardBuilderStore((s) => s.expiryDate);
  const setExpiryDate = useCardBuilderStore((s) => s.setExpiryDate);
  const setPassValidDays = useCardBuilderStore((s) => s.setPassValidDays);

  function handleChange(value: string) {
    setExpiryDate(value);
    if (value !== '') {
      setPassValidDays(null);
    }
  }

  return (
    <div className="space-y-2">
      <label htmlFor="expiryDate" className="text-sm font-medium">
        {t('step2.expiryDate.title')}
      </label>
      <input
        id="expiryDate"
        type="date"
        value={expiryDate}
        onChange={(e) => handleChange(e.target.value)}
        className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
      />
      <p className="text-xs text-muted-foreground">{t('step2.expiryDate.hint')}</p>
    </div>
  );
}
