/**
 * PassCardPreview — 卡片本體預覽
 * Apple Pass 風格：白色背景、圓角、柔陰影（Dark mode 適配）
 *
 * Phase 9 (2026-08-31): icon image is rendered by PreviewWrapper's
 * PushNotificationMockup overlay (inside PhoneFrame, above the card).
 * This component renders the card template body only — logo / type
 * label / strip placeholder / holder name / barcode.
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

            {/* Strip / Hero — 卡片圖示 + 卡片名稱（icon 在 PushNotificationMockup 顯示，不在這） */}
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
