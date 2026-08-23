/**
 * IssuerNameField — 發卡機構名稱輸入（原生 HTML）
 *
 * issuerName 由 CardBuilderEditor 在 mount / fetch 完成後直接寫入 store。
 * 此元件只負責呈現 store 值，不需要自己的 useEffect 預填邏輯。
 */

import { useTranslation } from 'react-i18next';
import { useCardBuilderStore } from '../CardBuilderEditor.store';

export function IssuerNameField({ showValidation }: { showValidation?: boolean }) {
  const { t } = useTranslation('cardEditor');
  const issuerName = useCardBuilderStore((s) => s.issuerName);
  const isEmpty = !issuerName.trim();

  return (
    <div className="space-y-2">
      <label htmlFor="issuerName" className="text-sm font-medium">
        {t('step2.issuerName.title')}
      </label>
      <input
        id="issuerName"
        type="text"
        value={issuerName}
        disabled
        placeholder={t('step2.issuerName.placeholder')}
        required
        aria-describedby={showValidation && isEmpty ? 'issuerName-error' : undefined}
        aria-invalid={showValidation && isEmpty ? 'true' : undefined}
        className={`flex h-10 w-full rounded-md border bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50
          ${showValidation && isEmpty ? 'border-destructive ring-destructive' : 'border-input'}`}
      />
      {showValidation && isEmpty && (
        <p
          id="issuerName-error"
          className="flex items-center gap-1.5 text-xs"
          style={{ color: 'var(--color-destructive)' }}
          role="alert"
        >
          <span aria-hidden="true">⚠</span>
          {t('step2.issuerName.required')}
        </p>
      )}
    </div>
  );
}
