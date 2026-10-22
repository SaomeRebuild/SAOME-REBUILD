/**
 * PassHolderSubmitErrorBanner — dismissable alert above the form when
 * the backend rejects a registration.
 *
 * 2026-10-17 — original bug (Bug 4 umbrella): the rejected promise from
 * `passHolderService.register` escaped as an unhandled rejection, so the
 * user saw the raw i18n key in the console while the UI gave no
 * feedback. See
 * `runs/improvements/feedback/20261017-pass-holder-backend-error-capture.md`.
 *
 * 2026-10-17 (later) — diagnostic line for `tooYoung` specifically: the
 * API can return `received` (the birthday the SERVER saw) and
 * `minBirthdayBoundary` (the oldest date the API accepts). Showing
 * both is the only way to disambiguate a UI/autofill bug (user typed
 * 1989, API got 2026) from a backend math bug (API got 1989-01-01).
 *
 * 2026-10-23 — extracted from `PassHolderRegistration.tsx` when the
 * payment orchestration moved into `usePassHolderPayment`. Presentation
 * only; the banner state lives in the hook.
 */

import { useTranslation } from 'react-i18next';
import type { SubmitErrorState } from './PassHolderRegistration.helpers';

export interface PassHolderSubmitErrorBannerProps {
  /** Already-localized headline (never a raw i18n key). */
  message: string;
  submitError: SubmitErrorState;
  onDismiss: () => void;
}

export function PassHolderSubmitErrorBanner({
  message,
  submitError,
  onDismiss,
}: PassHolderSubmitErrorBannerProps) {
  const { t } = useTranslation('passHolder');

  const showDiagnostics =
    submitError.i18nKey === 'passHolder.errors.tooYoung' &&
    (submitError.received !== undefined || submitError.minBirthdayBoundary !== undefined);

  return (
    <div
      role="alert"
      aria-live="polite"
      data-testid="pass-holder-submit-error"
      className="rounded-md border px-3 py-2 text-sm"
      style={{
        borderColor: 'var(--color-destructive)',
        backgroundColor: 'var(--color-destructive-bg, rgba(220, 38, 38, 0.08))',
        color: 'var(--color-destructive)',
      }}
    >
      <div className="flex items-start gap-2">
        <div className="flex-1">
          <span data-testid="pass-holder-submit-error-message">{message}</span>
          {showDiagnostics ? (
            <div
              data-testid="pass-holder-submit-error-diagnostic"
              className="mt-1 font-mono text-xs opacity-80"
            >
              {submitError.received !== undefined ? (
                <span data-testid="pass-holder-submit-error-received">
                  {t('submitErrorDebug.receivedPrefix')}
                  {submitError.received}
                </span>
              ) : null}
              {submitError.minBirthdayBoundary !== undefined ? (
                <span data-testid="pass-holder-submit-error-boundary">
                  {submitError.received !== undefined ? ' · ' : ''}
                  {t('submitErrorDebug.boundaryMid')}
                  {submitError.minBirthdayBoundary}
                </span>
              ) : null}
            </div>
          ) : null}
        </div>
        <button
          type="button"
          onClick={onDismiss}
          aria-label={t('submitErrorDismiss', '關閉')}
          className="text-xs underline"
          style={{ color: 'var(--color-destructive)' }}
          data-testid="pass-holder-submit-error-dismiss"
        >
          {t('submitErrorDismiss', '關閉')}
        </button>
      </div>
    </div>
  );
}