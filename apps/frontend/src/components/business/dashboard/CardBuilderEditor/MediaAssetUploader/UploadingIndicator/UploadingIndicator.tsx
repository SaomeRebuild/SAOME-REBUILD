/**
 * UploadingIndicator — Spinner + label shown while the cropped blob uploads to R2.
 *
 * Pure presentation. The parent owns the upload orchestration (see
 * LogoUploader.handleApplyCrop).
 *
 * @module components/business/dashboard/CardBuilderEditor/LogoUploader/UploadingIndicator
 */

export interface UploadingIndicatorProps {
  /** i18n: "uploading..." label. */
  uploadingLabel: string;
}

export function UploadingIndicator({ uploadingLabel }: UploadingIndicatorProps) {
  return (
    <div className="flex flex-col items-center gap-3">
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      <p className="text-sm text-muted-foreground">{uploadingLabel}</p>
    </div>
  );
}
