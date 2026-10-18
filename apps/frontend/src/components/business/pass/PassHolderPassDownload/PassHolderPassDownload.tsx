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
 *
 * 2026-10-19 — **lost-data fallback** (regression for production row
 * `83d3139a-c3bb-4806-8900-5e9b759d0122`). Holder rows registered
 * BEFORE the COALESCE partial-update fix landed will have
 * `barcode_value` populated but ALL 3 URIs (downloadPage / iPhoneUri
 * / androidUri) NULL because the second barcode backfill UPDATE
 * (which only passed `barcodeValue`) wiped the 6 sibling columns
 * via unconditional `SET xxx = null`. The frontend recognizes this
 * partial state (`barcodeValue` set + 0 URIs) and renders a
 * "請聯絡客服重新簽發" banner INSTEAD of the pre-launch "not
 * ready" copy — the i18n key `passHolder.download.lostData.*`
 * carries the recovery messaging. Lost data is unrecoverable from
 * V3 LIST alone (only `downloadPage` is theoretically recoverable
 * — identifier / iPhoneUri / androidUri aren't exposed by V3 LIST),
 * so a human-in-the-loop contact-support flow is the only path.
 *
 * @see runs/improvements/feedback/20261019-pass-holder-v3-partial-update-bug.md
 * @see apps/backend/src/modules/pass-templates/db/passHolders.ts::updatePassHolderIssuance
 */

import { useTranslation } from 'react-i18next';
import { CheckCircle2 } from 'lucide-react';
import type { PassHolderPassDownloadProps } from './PassHolderPassDownload.types';
import { PassHolderDownloadButton } from './PassHolderDownloadButton';
import { PassHolderBarcodeDisplay } from './PassHolderBarcodeDisplay';
import { PassHolderAndroidReminder } from './PassHolderAndroidReminder';
import { PassHolderDownloadErrorBanner } from './PassHolderDownloadErrorBanner';
import { PassHolderLostDataBanner } from './PassHolderLostDataBanner';

export function PassHolderPassDownload({
  template,
  issuance,
  onRetry,
}: PassHolderPassDownloadProps) {
  const { t } = useTranslation('passHolder');

  // 4 distinct states driven by `issuance`:
  //   1. Failed (issuanceError set)   → error banner + retry CTA
  //   2. Success                      → download buttons + barcode + Android reminder
  //   3. Pre-launch (no issuance)     → "pass not ready yet" copy (template not pushed)
  //   4. Lost data (barcode set, 0 URIs) → barcode + 聯絡客服 banner (regression 2026-10-19)
  const hasError = Boolean(issuance?.issuanceError);
  const hasAnyUri = Boolean(
    issuance?.downloadPage || issuance?.iPhoneUri || issuance?.androidUri,
  );
  const hasBarcodeButNoUri = Boolean(issuance?.barcodeValue && !hasAnyUri);

  // supportEmail isn't on `PublicPassTemplate` yet — when added, swap
  // for the typed accessor. Today the type widening lets older rows
  // carry the value without TS errors (defensive — keeps the cast
  // local to this fallback path).
  const supportEmail = (template as { supportEmail?: string }).supportEmail;

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

      {/* Error banner (failure path) — priority over success/download */}
      {hasError && (
        <PassHolderDownloadErrorBanner
          errorKey={issuance!.issuanceError!}
          onRetry={onRetry}
        />
      )}

      {/* Success path: download CTA + barcode + Android reminder.
          PassHolderDownloadButton (split-two-platform-buttons, 2026-10-19)
          renders BOTH iOS + Android platform-specific anchors; barcode
          and Tips render as siblings (per the 4-state branch order in
          this component's docblock). */}
      {!hasError && hasAnyUri && (
        <PassHolderDownloadButton
          downloadPage={issuance!.downloadPage}
          iPhoneUri={issuance!.iPhoneUri}
          androidUri={issuance!.androidUri}
          templateId={template.id}
        />
      )}
      {!hasError && hasAnyUri && issuance?.barcodeValue && (
        <PassHolderBarcodeDisplay barcodeValue={issuance.barcodeValue} />
      )}
      {!hasError && hasAnyUri && <PassHolderAndroidReminder />}

      {/* Lost-data fallback — barcode recovered, URIs missing (regression 2026-10-19) */}
      {!hasError && hasBarcodeButNoUri && issuance?.barcodeValue && (
        <PassHolderBarcodeDisplay barcodeValue={issuance.barcodeValue} />
      )}
      {!hasError && hasBarcodeButNoUri && (
        <PassHolderLostDataBanner supportEmail={supportEmail} />
      )}

      {/* Pre-launch: no issuance, no error, no barcode — known waiting state */}
      {!hasError && !hasAnyUri && !hasBarcodeButNoUri && (
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
