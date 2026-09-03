/**
 * PassCardPreview — 卡片本體預覽
 * Apple Pass 風格：白色背景、圓角、柔陰影（Dark mode 適配）
 *
 * The icon image is consumed by MediaAssetUploader/Preview (128×128 panel
 * in the editor workspace), not inside the phone preview. This component
 * renders the card template body only — logo / type label / strip
 * placeholder / holder name / barcode.
 *
 * BACKGROUND IMAGE: The card background is rendered INSIDE PassCardPreviewStrip
 * and constrained to that strip area via `position: relative` on the strip
 * container + `position: absolute; inset: 0` on the bg image. The card body
 * / footer below the strip stays white. This matches Apple Wallet's
 * hero-strip pattern where the background image only covers the colored
 * header strip, not the entire card.
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
  backgroundImage,
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
      {/* 卡片本體 — 套用 backgroundColor 到整個 card body（replaces bg-white）。
          Strip 內部固定深灰黑色（不跟 color picker），所以 strip 與 body 不同色，
          這是預期的 Apple Wallet hero strip 視覺。 */}
      <div
        className="relative flex h-full w-full flex-col"
        style={backgroundColor ? { backgroundColor } : undefined}
      >
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
              textColor={textColor}
              compact={compact}
            />

            {/* Strip / Hero — 卡片名稱 + 預設 CreditCard 圖示
                Strip 內部固定深灰黑色背景（不跟 color picker）,
                背景圖透過 `position: relative` + `absolute inset-0 object-cover`
                約束在 h-[100px] / h-[120px] 的 strip 區塊內滿版,
                不會溢出到 header / body / footer */}
            <PassCardPreviewStrip
              name={name}
              backgroundImage={backgroundImage}
              // Strip bg 永遠是深灰黑色，所以 text/icon 必須用淺色才看得見。
              // 不直接用 card textColor，否則 picker 預設 #000000 會讓 strip 變成黑底黑字。
              textColor="#ffffff"
              compact={compact}
            />

            {/* Body */}
            <PassCardPreviewBody textColor={textColor} compact={compact} />

            {/* Footer / Barcode */}
            <PassCardPreviewFooter
              holderName={holderName}
              barcodeType={barcodeType}
              backgroundColor={backgroundColor}
              compact={compact}
            />
          </>
        )}
      </div>
    </div>
  );
}
