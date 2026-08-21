/**
 * IssuerNameField — 發卡機構名稱輸入（原生 HTML）
 */

import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/hooks/useAuth';
import { useCardBuilderStore } from '../CardBuilderEditor.store';

export function IssuerNameField({ showValidation }: { showValidation?: boolean }) {
  const { t } = useTranslation('cardEditor');
  const { state } = useAuth();
  const tenant = state.tenant;
  const issuerName = useCardBuilderStore((s) => s.issuerName);
  const setIssuerName = useCardBuilderStore((s) => s.setIssuerName);
  const isEmpty = !issuerName.trim();

  // Pre-fill: 新建時若 store 空，從 tenant.name 預填
  // 當 issuerName 已有值（來自 loadSettings 的 resume 流程）時不覆蓋。
  // 依賴 [tenant, issuerName] 而非 [state.tenant] 確保 loadSettings
  // 設定值之後 effect 不會再用 tenant.name 覆蓋它。
  useEffect(() => {
    if (!issuerName && tenant?.name) {
      setIssuerName(tenant.name);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tenant, issuerName]);

  // Read-only display: 優先用 store 裡已編輯過的值，其次用 tenant.name
  const displayValue = issuerName || tenant?.name || '';

  return (
    <div className="space-y-2">
      <label htmlFor="issuerName" className="text-sm font-medium">
        {t('step2.issuerName.title')}
      </label>
      <input
        id="issuerName"
        type="text"
        value={displayValue}
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
