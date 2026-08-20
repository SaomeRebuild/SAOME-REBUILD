/**
 * PassValidDaysField — PASS 有效天數（非必填，數字輸入）
 * 與 ExpiryDateField 互斥：填了此欄則到期日清空，反之亦然。
 */

import { useTranslation } from 'react-i18next';
import { useCardBuilderStore } from '../CardBuilderEditor.store';

export function PassValidDaysField() {
  const { t } = useTranslation('cardEditor');
  const passValidDays = useCardBuilderStore((s) => s.passValidDays);
  const setPassValidDays = useCardBuilderStore((s) => s.setPassValidDays);
  const setExpiryDate = useCardBuilderStore((s) => s.setExpiryDate);

  function handleChange(value: string) {
    const num = value === '' ? null : Number(value);
    setPassValidDays(num);
    if (num !== null) {
      setExpiryDate('');
    }
  }

  return (
    <div className="space-y-2">
      <label htmlFor="passValidDays" className="text-sm font-medium">
        {t('step2.passValidDays.title')}
      </label>
      <div className="flex items-center gap-2">
        <input
          id="passValidDays"
          type="number"
          min={1}
          value={passValidDays ?? ''}
          onChange={(e) => handleChange(e.target.value)}
          placeholder={t('step2.passValidDays.placeholder')}
          className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
        />
        <span className="text-sm text-muted-foreground">{t('step2.passValidDays.unit')}</span>
      </div>
      <p className="text-xs text-muted-foreground">{t('step2.passValidDays.hint')}</p>
    </div>
  );
}
