/**
 * PassCardPreviewStrip — 卡片正面 Strip / Hero 區塊
 * Apple Pass 風格：彩色 strip + icon placeholder + 名稱
 *
 * The strip is a static placeholder (CreditCard icon) for the card name
 * region. The actual icon image preview lives in MediaAssetUploader/Preview
 * (128×128 panel in the editor workspace), not inside the card template.
 *
 * BACKGROUND IMAGE: This component owns the card background image.
 * The container has `position: relative` + `overflow-hidden` so the
 * absolutely-positioned `<img>` (background) and overlay div are
 * CONSTRAINED to the strip area (h-[100px] / h-[120px]). They do NOT
 * leak up into the header or down into the body. When `backgroundImage`
 * is absent, the strip falls back to `backgroundColor` (default #1f2937
 * dark gray — Apple Wallet-like default).
 *
 * This matches Apple Wallet's hero-strip pattern where the background
 * image only covers the colored header strip, not the entire card.
 */
import { CreditCard } from 'lucide-react';
import { useTranslation } from 'react-i18next';

interface PassCardPreviewStripProps {
  name?: string;
  /** 卡片背景圖（可選，R2 URL）— 套用到 strip 區域 */
  backgroundImage?: string;
  /** 卡片背景色（可選）— 當無背景圖時作為 strip 背景色 */
  backgroundColor?: string;
  /** 卡片文字色（套用到 strip 內的 icon 與名稱） */
  textColor?: string;
  /** 緊湊模式 */
  compact?: boolean;
}

export function PassCardPreviewStrip({
  name,
  backgroundImage,
  backgroundColor = '#1f2937',
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
      style={{ backgroundColor }}
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
