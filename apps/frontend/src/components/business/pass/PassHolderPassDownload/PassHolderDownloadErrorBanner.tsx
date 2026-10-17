/**
 * PassHolderDownloadErrorBanner — error banner shown when V3 issuance
 * failed. Renders the i18n message + a retry CTA when the parent
 * provides `onRetry`.
 *
 * @module business/pass/PassHolderPassDownload/PassHolderDownloadErrorBanner
 *
 * The error key is one of the i18n keys defined in
 * `apps/frontend/src/i18n/locales/passHolder.zh-TW.ts::downloadError`.
 * Today the backend only emits `'passHolder.errors.upstreamFailed'`
 * (see `services/registerService.ts`), but the banner accepts any
 * key for forward-compatibility.
 *
 * 2026-10-19 — initial version. The banner is a self-contained
 * sub-component so the parent `PassHolderPassDownload` stays under
 * 100 lines.
 */

import { useTranslation } from 'react-i18next';
import { AlertCircle } from 'lucide-react';

export interface PassHolderDownloadErrorBannerProps {
  /** i18n key for the error description. */
  errorKey: string;
  /** Optional retry handler. When undefined, the retry button is hidden. */
  onRetry?: () => void;
}

export function PassHolderDownloadErrorBanner({
  errorKey,
  onRetry,
}: PassHolderDownloadErrorBannerProps) {
  const { t } = useTranslation('passHolder');

  return (
    <div
      role="alert"
      className="flex flex-col gap-2 rounded-md border p-3 md:p-4"
      style={{
        borderColor: 'var(--color-destructive)',
        backgroundColor: 'var(--color-destructive-background, var(--color-background))',
      }}
      data-testid="pass-holder-download-error"
    >
      <div className="flex items-start gap-2">
        <AlertCircle
          size={20}
          className="mt-0.5 shrink-0"
          style={{ color: 'var(--color-destructive)' }}
          aria-hidden="true"
        />
        <div className="flex flex-1 flex-col gap-1">
          <p
            className="text-sm font-semibold"
            style={{ color: 'var(--color-destructive)' }}
          >
            {t('downloadError.title')}
          </p>
          <p
            className="text-sm"
            style={{ color: 'var(--color-foreground)' }}
          >
            {t(errorKey, { defaultValue: t('downloadError.body') })}
          </p>
        </div>
      </div>
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="inline-flex h-11 min-w-[44px] items-center self-start rounded-md border px-4 text-sm font-medium transition-colors"
          style={{
            borderColor: 'var(--color-destructive)',
            color: 'var(--color-destructive)',
            backgroundColor: 'var(--color-background)',
          }}
          data-testid="pass-holder-download-retry"
        >
          {t('downloadError.retry')}
        </button>
      )}
    </div>
  );
}