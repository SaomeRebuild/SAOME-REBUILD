/**
 * PassHolderPassDownload barrel — exports the public API for the
 * post-submit "下載 Pass" view that replaces the previous placeholder.
 *
 * @module business/pass/PassHolderPassDownload
 *
 * 2026-10-19 — introduced with the Passcreator V3 per-pass issuance
 * integration. The previous `PassHolderRegistrationSuccess` was a
 * placeholder Construction-icon card; this folder renders the actual
 * download CTA + Passwallet Android reminder + barcode display +
 * retry banner when V3 issuance failed.
 *
 * Rule 000 § A.1 — business component folder structure.
 * Rule 023 § 翻譯書寫紀律 — all user-visible strings go through i18n.
 * Rule 013 / 014 — mobile-first responsive (default 1-col stack,
 * md: 2-col grid for the action row).
 */

export { PassHolderPassDownload } from './PassHolderPassDownload';
export { PassHolderDownloadButton } from './PassHolderDownloadButton';
export { PassHolderBarcodeDisplay } from './PassHolderBarcodeDisplay';
export { PassHolderAndroidReminder } from './PassHolderAndroidReminder';
export { PassHolderDownloadErrorBanner } from './PassHolderDownloadErrorBanner';
export type {
  PassHolderPassDownloadProps,
  PassHolderIssuanceView,
} from './PassHolderPassDownload.types';