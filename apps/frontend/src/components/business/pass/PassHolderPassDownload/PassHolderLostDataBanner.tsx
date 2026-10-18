/**
 * PassHolderLostDataBanner — recovery banner shown when a holder row
 * has `barcode_value` populated but ALL 3 V3 URIs (downloadPage /
 * iPhoneUri / androidUri) NULL.
 *
 * @module business/pass/PassHolderPassDownload/PassHolderLostDataBanner
 *
 * Background (2026-10-19 partial-update bug — runs/improvements/feedback/20261019-pass-holder-v3-partial-update-bug.md):
 *
 * Pre-COALESCE-fix era: `updatePassHolderIssuance` issued an
 * unconditional `SET xxx = ${input.xxx ?? null}` for all 7 runtime
 * columns. The barcode-backfill path in `registerService.attemptIssuance`
 * runs TWO calls (first with all 7 fields, second with only
 * `barcodeValue`); the second call wiped the 6 sibling columns back
 * to NULL. Rows registered BEFORE the fix landed carry
 * `barcode_value` set but `pass_identifier` / `download_url` /
 * `issued_at` / `iphone_uri` / `android_uri` all NULL.
 *
 * Such rows are unrecoverable from V3 LIST alone — V3 LIST response
 * doesn't expose identifier / iPhoneUri / androidUri for
 * re-issuance. Only `downloadPage` is theoretically recoverable via
 * a per-template V3 LIST + email match (best-effort, not pursued in
 * this fix). The user-facing recovery path is contact-support.
 *
 * The banner therefore renders:
 *   1. A clear "your pass is missing some details" title
 *   2. Body copy explaining the situation
 *   3. A mailto CTA pointing at the tenant's `supportEmail` (with
 *      `support@saome.org` as a generic fallback) so the user has a
 *      direct path to re-issuance.
 *
 * The barcode sub-display is still rendered by the parent
 * (`PassHolderPassDownload`) so the user can see the recovered
 * barcode value while they contact support. This sub-component only
 * carries the banner + CTA.
 *
 * 2026-10-19 — initial version. Self-contained so the parent
 * `PassHolderPassDownload` stays under the 100-line main-component
 * ceiling (Rule 000 § A.1).
 */

import { useTranslation } from 'react-i18next';
import { AlertTriangle } from 'lucide-react';

export interface PassHolderLostDataBannerProps {
  /**
   * Per-tenant support mailbox. When undefined, the CTA links to
   * `support@saome.org` (a generic catch-all). Typing the prop
   * loosely (rather than via `PublicPassTemplate.supportEmail`)
   * because the `supportEmail` field is not yet on the type — when
   * it's added, the parent switches to the typed accessor. Today
   * the cast in the parent widens the type to read this field if
   * present (defensive — old rows may carry it).
   */
  supportEmail?: string;
}

export function PassHolderLostDataBanner({
  supportEmail,
}: PassHolderLostDataBannerProps) {
  const { t } = useTranslation('passHolder');

  // Resolve the support mailbox. `support@saome.org` is the SaaS
  // catch-all — production tenants should ship their own
  // supportEmail on `PublicPassTemplate` once that field is added
  // (Rule 019 § 4.1 L4 sync required at that point).
  const to =
    supportEmail && supportEmail.length > 0
      ? supportEmail
      : 'support@saome.org';

  return (
    <div
      role="alert"
      className="flex flex-col gap-2 rounded-md border p-3 md:p-4"
      style={{
        borderColor: 'var(--color-warning, var(--color-destructive))',
        backgroundColor:
          'var(--color-warning-background, var(--color-destructive-background, var(--color-background)))',
      }}
      data-testid="pass-holder-download-lost-data"
    >
      <div className="flex items-start gap-2">
        <AlertTriangle
          size={20}
          className="mt-0.5 shrink-0"
          style={{ color: 'var(--color-warning, var(--color-destructive))' }}
          aria-hidden="true"
        />
        <div className="flex flex-1 flex-col gap-1">
          <p
            className="text-sm font-semibold"
            style={{
              color: 'var(--color-warning, var(--color-destructive))',
            }}
          >
            {t('lostData.title')}
          </p>
          <p
            className="text-sm"
            style={{ color: 'var(--color-foreground)' }}
          >
            {t('lostData.body')}
          </p>
        </div>
      </div>
      <a
        href={`mailto:${to}`}
        className="inline-flex h-11 min-w-[44px] items-center self-start rounded-md border px-4 text-sm font-medium transition-colors"
        style={{
          borderColor: 'var(--color-warning, var(--color-destructive))',
          color: 'var(--color-warning, var(--color-destructive))',
          backgroundColor: 'var(--color-background)',
        }}
        data-testid="pass-holder-download-lost-data-cta"
      >
        {t('lostData.contactCta')}
      </a>
    </div>
  );
}
