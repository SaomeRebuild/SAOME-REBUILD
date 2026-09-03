/**
 * PassCardPreviewStrip — 卡片正面 Strip / Hero 區塊
 * Apple Pass 風格：固定深灰黑色背景 + icon placeholder + 名稱
 *
 * The strip is a static placeholder (CreditCard icon) for the card name
 * region. The actual icon image preview lives in MediaAssetUploader/Preview
 * (128×128 panel in the editor workspace), not inside the card template.
 *
 * BACKGROUND IMAGE: This component owns the card background image.
 * The container has `position: relative` + `overflow-hidden` so the
 * absolutely-positioned `<img>` (background) and overlay div are
 * CONSTRAINED to the strip area (h-[100px] / h-[120px]). They do NOT
 * leak up into the header or down into the body.
 *
 * Strip 背景策略（自 2026-09-03 cycle）：
 * - Strip 永遠是深灰黑色 (`#1f2937`) — 不跟 color picker 改變。
 *   這是固定視覺，模仿 Apple Wallet 的彩色 hero strip。
 * - 上傳背景圖 → 圖片 `absolute inset-0 object-cover` 滿版蓋住深灰。
 *   `overflow-hidden` 確保圖片不會溢出 strip 邊界。
 *
 * `rgba(0,0,0,0.35)` overlay 永遠渲染，確保白字在 strip 區域可讀
 * （圖片之上額外暗化，避免彩色圖片破壞文字對比）。
 */
import { CreditCard } from 'lucide-react';
import { useTranslation } from 'react-i18next';

interface PassCardPreviewStripProps {
  name?: string;
  /** 卡片背景圖（可選，R2 URL）— 套用到 strip 區域，object-cover 滿版 */
  backgroundImage?: string;
  /** 卡片文字色（套用到 strip 內的 icon 與名稱） */
  textColor?: string;
  /** 緊湊模式 */
  compact?: boolean;
}

/** Strip 固定背景色 — 永遠深灰黑色，不跟 color picker 改變 */
const STRIP_BACKGROUND_COLOR = '#1f2937';

export function PassCardPreviewStrip({
  name,
  backgroundImage,
  textColor = '#ffffff',
  compact,
}: PassCardPreviewStripProps) {
  const { t } = useTranslation('passCard');

  // Dark semi-transparent overlay ensures text readability over any card background.
  const overlayColor = 'rgba(0, 0, 0, 0.35)';

  return (
    <div
      className={
        compact
          ? 'relative mx-0 mt-2 flex h-[100px] flex-col items-center justify-center gap-1 overflow-hidden text-center'
          : 'relative mx-0 mt-4 flex h-[120px] flex-col items-center justify-center gap-2 overflow-hidden text-center'
      }
      style={{ backgroundColor: STRIP_BACKGROUND_COLOR }}
    >
      {/* 背景圖（覆蓋 strip 整個區域；因父容器有 overflow-hidden,
          不會溢出到 header / body） */}
      {backgroundImage && (
        <img
          src={backgroundImage}
          alt=""
          className="pointer-events-none absolute inset-0 h-full w-full object-cover"
          aria-hidden="true"
        />
      )}

      {/* 半透明遮罩（確保文字可讀，覆蓋於背景圖之上） */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{ backgroundColor: overlayColor }}
        aria-hidden="true"
      />

      {/* 卡片圖示 placeholder（icon 預覽在 MediaAssetUploader 面板，不在卡片內） */}
      <CreditCard
        className={compact ? 'relative h-6 w-6' : 'relative h-12 w-12'}
        style={{ color: textColor }}
        aria-hidden="true"
      />

      {/* 卡片名稱 */}
      <span
        className={compact ? 'relative text-xs font-semibold leading-tight' : 'relative text-lg font-semibold'}
        style={{ color: textColor }}
      >
        {name || t('defaultName')}
      </span>
    </div>
  );
}
