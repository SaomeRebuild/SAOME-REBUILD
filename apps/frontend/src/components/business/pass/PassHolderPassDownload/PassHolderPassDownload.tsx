/**
 * PassHolderPassDownload — post-submit "下載 Pass" view.
 *
 * @module business/pass/PassHolderPassDownload/PassHolderPassDownload
 *
 * Replaces the previous `PassHolderRegistrationSuccess` placeholder
 * (Construction icon + "coming soon" copy). After registration, the
 * backend's V3 issuance either succeeded (Passcreator returned a
 * per-pass `identifier` + `linkToPassPage` + `barcodeValue`) or
 * failed (we persisted `issuance_error` and surfaced a retry CTA).
 *
 * Main component is ≤ 100 lines and only assembles sub-components
 * (Rule 000 § A.1). Sub-components live in the same folder; the
 * parent `PassHolderRegistration` keeps state and toggles between
 * the form and this view.
 *
 * 2026-10-19 — initial version. The component is i18n-driven
 * (`t('passHolder.download.*')` / `t('passHolder.passwalletReminder.*')`)
 * — keeps the view localizable to en / zh-TW without code changes.
 */

import { useTranslation } from 'react-i18next';
import { CheckCircle2 } from 'lucide-react';
import type { PassHolderPassDownloadProps } from './PassHolderPassDownload.types';
import { PassHolderDownloadButton } from './PassHolderDownloadButton';
import { PassHolderBarcodeDisplay } from './PassHolderBarcodeDisplay';
import { PassHolderAndroidReminder } from './PassHolderAndroidReminder';
import { PassHolderDownloadErrorBanner } from './PassHolderDownloadErrorBanner';

export function PassHolderPassDownload({
  template,
  issuance,
  onRetry,
}: PassHolderPassDownloadProps) {
  const { t } = useTranslation('passHolder');

  // Three distinct states driven by `issuance`:
  //   1. Failed (issuanceError set)  → error banner + retry CTA
  //   2. Success                     → download buttons + barcode + Android reminder
  //   3. Pre-launch (no issuance)    → "pass not ready yet" copy (template not pushed)
  //
  // V3 contract (2026-10-19 fix): the "downloadUrl is set" gate now
  // checks ANY of the 3 URIs (downloadPage / iPhoneUri / androidUri).
  // The `PassHolderDownloadButton` does its own user-agent detection
  // to pick which URI to surface as the href.
  const hasError = Boolean(issuance?.issuanceError);
  const hasAnyUri = Boolean(
    issuance?.downloadPage || issuance?.iPhoneUri || issuance?.androidUri,
  );

  return (
    <section
      className="flex flex-col gap-4 rounded-lg border p-4 md:p-6"
      style={{
        backgroundColor: 'var(--color-card)',
        borderColor: 'var(--color-border)',
      }}
      data-testid="pass-holder-download"
    >
      {/* Header */}
      <header className="flex items-start gap-3">
        <CheckCircle2
          size={32}
          style={{ color: 'var(--color-primary)' }}
          aria-hidden="true"
        />
        <div className="flex flex-col">
          <h1
            className="text-xl font-semibold md:text-2xl"
            style={{ color: 'var(--color-foreground)' }}
          >
            {t('download.title')}
          </h1>
          <p
            className="text-sm"
            style={{ color: 'var(--color-muted-foreground)' }}
          >
            {t('download.subtitle', { issuerName: template.issuerName })}
          </p>
        </div>
      </header>

      {/* Error banner (failure path) — takes priority over download */}
      {hasError && (
        <PassHolderDownloadErrorBanner
          errorKey={issuance!.issuanceError!}
          onRetry={onRetry}
        />
      )}

      {/* Download CTA row (success path) */}
      {!hasError && hasAnyUri && (
        <PassHolderDownloadButton
          downloadPage={issuance!.downloadPage}
          iPhoneUri={issuance!.iPhoneUri}
          androidUri={issuance!.androidUri}
          barcodeValue={issuance!.barcodeValue ?? null}
          templateId={template.id}
        />
      )}

      {/* Barcode display (success path, only when barcode value is set) */}
      {!hasError && hasAnyUri && issuance?.barcodeValue && (
        <PassHolderBarcodeDisplay barcodeValue={issuance.barcodeValue} />
      )}

      {/* Android reminder (success path) */}
      {!hasError && hasAnyUri && (
        <PassHolderAndroidReminder />
      )}

      {/* Pre-launch state: no issuance, no error — known waiting state */}
      {!hasError && !hasAnyUri && (
        <p
          className="text-sm"
          style={{ color: 'var(--color-muted-foreground)' }}
          data-testid="pass-holder-download-not-ready"
        >
          {t('download.notReadyYet')}
        </p>
      )}
    </section>
  );
}