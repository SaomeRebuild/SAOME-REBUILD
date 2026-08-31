/**
 * PassCardPreview — 卡片本體預覽
 * Apple Pass 風格：白色背景、圓角、柔陰影（Dark mode 適配）
 *
 * The icon image is consumed by MediaAssetUploader/Preview (128×128 panel
 * in the editor workspace), not inside the phone preview. This component
 * renders the card template body only — logo / type label / strip
 * placeholder / holder name / barcode.
 */
import type { PassCardPreviewProps } from './PassCardPreview.types';
import { PassCardPreviewHeader } from './PassCardPreviewHeader';
import { PassCardPreviewBody } from './PassCardPreviewBody';
import { PassCardPreviewFooter } from './PassCardPreviewFooter';
import { PassCardPreviewBack } from './PassCardPreviewBack';
import { PassCardPreviewStrip } from './PassCardPreviewStrip';
import { cn } from '@/lib/utils';

export function PassCardPreview({
  name,
  cardType,
  issuerLogo,
  backgroundColor,
  textColor,
  side = 'front',
  holderName,
  barcodeType,
  className,
  compact = false,
  ...props
}: PassCardPreviewProps) {
  return (
    <div
      className={cn(
        'relative w-full overflow-hidden rounded-[12px] border border-neutral-200 bg-white shadow-[0_4px_16px_rgba(0,0,0,0.15)]',
        'dark:border-neutral-700 dark:shadow-[0_4px_16px_rgba(0,0,0,0.5)]',
        className
      )}
      style={{ aspectRatio: '375 / 503' }}
      {...props}
    >
      {/* 卡片本體 — 固定白色背景，模擬實體 Pass */}
      <div className="relative flex h-full w-full flex-col bg-white">
        {side === 'back' ? (
          // ─── Back Side：完全清除正面殘留 UI ───
          <PassCardPreviewBack compact={compact} />
        ) : (
          // ─── Front Side ───
          <>
            <PassCardPreviewHeader
              cardType={cardType}
              issuerLogo={issuerLogo}
              name={name}
              compact={compact}
            />

            {/* Strip / Hero — 卡片名稱 + 預設 CreditCard 圖示（icon 預覽在 MediaAssetUploader 面板） */}
            <PassCardPreviewStrip
              name={name}
              backgroundColor={backgroundColor}
              textColor={textColor}
              compact={compact}
            />

            {/* Body */}
            <PassCardPreviewBody compact={compact} />

            {/* Footer / Barcode */}
            <PassCardPreviewFooter holderName={holderName} barcodeType={barcodeType} compact={compact} />
          </>
        )}
      </div>
    </div>
  );
}
