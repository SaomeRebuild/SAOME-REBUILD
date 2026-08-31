/**
 * MediaAssetUploaderHeader — 上容器：變體標題 + 規格說明
 *
 * Variant-agnostic: renders whatever title + description strings the parent
 * passes (typically `t('title')` + `t('hint')` from the active variant's
 * i18n namespace). Sits above the upload area so users immediately know
 * which variant they're editing (logo vs icon) and what crop spec applies.
 *
 * Design tokens (design-system/MASTER.md § 2 typography + § 9 spacing):
 * - Title:  text-base font-semibold + font-family-heading (Fredoka)
 * - Description: text-sm text-muted-foreground
 * - Container gap: gap-2 (title ↔ description), left-aligned to match the
 *   sibling section headings (e.g. CardBuilderEditorWorkspace's Icon
 *   區塊 — 「推播通知圖示」) so the two variants read as one section.
 *
 * @module components/business/dashboard/CardBuilderEditor/MediaAssetUploader/MediaAssetUploaderHeader
 */

export interface MediaAssetUploaderHeaderProps {
  /** i18n: variant title (e.g. "上傳 Logo" / "Upload Logo"). */
  title: string;
  /** i18n: variant description (e.g. "Logo 會被裁切為正方形..."). */
  description?: string;
  /** Optional className forwarded to the outer wrapper. */
  className?: string;
}

export function MediaAssetUploaderHeader({
  title,
  description,
  className = '',
}: MediaAssetUploaderHeaderProps) {
  return (
    <div
      data-testid="asset-uploader-header"
      className={`flex w-full flex-col items-start gap-2 ${className}`}
    >
      <h3
        className="text-base font-semibold text-foreground"
        style={{ fontFamily: 'var(--font-family-heading)' }}
      >
        {title}
      </h3>
      {description && (
        <p className="text-sm text-muted-foreground">{description}</p>
      )}
    </div>
  );
}
