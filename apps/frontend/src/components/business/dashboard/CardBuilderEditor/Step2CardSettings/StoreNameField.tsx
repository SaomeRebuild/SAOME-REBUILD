/**
 * StoreNameField — 店名輸入（原生 HTML）
 */

import { useTranslation } from 'react-i18next';
import { useCardBuilderStore } from '../CardBuilderEditor.store';

export function StoreNameField({ showValidation }: { showValidation?: boolean }) {
  const { t } = useTranslation('cardEditor');
  const storeName = useCardBuilderStore((s) => s.storeName);
  const setStoreName = useCardBuilderStore((s) => s.setStoreName);
  const isEmpty = !storeName.trim();

  return (
    <div className="space-y-2">
      <label htmlFor="storeName" className="text-sm font-medium">
        {t('step2.storeName.title')}
      </label>
      <input
        id="storeName"
        type="text"
        value={storeName}
        onChange={(e) => setStoreName(e.target.value)}
        placeholder={t('step2.storeName.placeholder')}
        required
        aria-describedby={showValidation && isEmpty ? 'storeName-error' : undefined}
        aria-invalid={showValidation && isEmpty ? 'true' : undefined}
        className={`flex h-10 w-full rounded-md border bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50
          ${showValidation && isEmpty ? 'border-destructive ring-destructive' : 'border-input'}`}
      />
      {showValidation && isEmpty && (
        <p
          id="storeName-error"
          className="flex items-center gap-1.5 text-xs"
          style={{ color: 'var(--color-destructive)' }}
          role="alert"
        >
          <span aria-hidden="true">⚠</span>
          {t('step2.storeName.required')}
        </p>
      )}
    </div>
  );
}
