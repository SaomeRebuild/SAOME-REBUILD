/**
 * CurrencyField — 貨幣選擇（台幣 / 南非蘭特）
 */

import { useTranslation } from 'react-i18next';
import { useCardBuilderStore } from '../CardBuilderEditor.store';

const CURRENCIES = [
  { value: 'TWD', label: 'TWD', symbol: 'NT$' } as const,
  { value: 'ZAR', label: 'ZAR', symbol: 'R' } as const,
];

export function CurrencyField() {
  const { t } = useTranslation('cardEditor');
  const currency = useCardBuilderStore((s) => s.currency);
  const setCurrency = useCardBuilderStore((s) => s.setCurrency);

  return (
    <div className="space-y-2">
      <h3 className="text-sm font-semibold">{t('step2.currency.title')}</h3>
      <div className="flex gap-4">
        {CURRENCIES.map((c) => (
          <label key={c.value} className="flex items-center gap-2 cursor-pointer">
            <input
              type="radio"
              name="currency"
              value={c.value}
              checked={currency === c.value}
              onChange={() => setCurrency(c.value)}
              className="h-4 w-4 cursor-pointer"
            />
            <span className="text-sm">
              <span className="font-medium">{c.symbol}</span>
              <span className="ml-1 text-muted-foreground">{c.label}</span>
            </span>
          </label>
        ))}
      </div>
    </div>
  );
}
