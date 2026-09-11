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
import { useCardBuilderStore } from '../CardBuilderEditor.store';

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
  leftField,
  rightField,
  stampGridRows,
  stampIconId,
  rewardName,
  firstRewardTierName,
  description,
  backFields,
  links,
  className,
  compact = false,
  ...props
}: PassCardPreviewProps) {
  // cashbackTiers from store: used to derive firstCashbackTierName for the
  // cashback_card memberLevel → reward override in PassCardPreviewBody.
  // The parent (CardBuilderEditorWorkspace) does NOT pass firstCashbackTierName
  // as a prop, so we always derive it here from the store. This is the
  // single source of truth for the cashback_card preview value.
  // (2026-09-12 cashback card member-level → reward refactor.)
  const cashbackTiers = useCardBuilderStore((s) => s.cashbackTiers);
  const firstCashbackTierName = cashbackTiers?.[0]?.name ?? '';
  return (
    <div
      className={cn(
        // 2026-09-10: outer border 改成 transparent — 真實 Apple Wallet pass
        // 沒有 card-level 外框（卡本體直接疊在 phone 背景上）。Preview 環境
        // 的「卡片邊界」視覺由父層 `<aside>` 的虛線 border + bg-card 提供，
        // 所以這裡的內層 border 不需要可見。改 transparent 保留 box，
        // 方便未來若要再加回 outline（例如 hover 狀態）不用改 DOM。
        'relative w-full overflow-hidden rounded-[12px] border border-transparent bg-white shadow-[0_4px_16px_rgba(0,0,0,0.15)]',
        'dark:shadow-[0_4px_16px_rgba(0,0,0,0.5)]',
        // Back side (2026-09-05): fill PhoneFrame content area instead of
        // a single 375:503 card aspect-ratio. The PhoneFrame's own
        // overflow-y-auto handles vertical scrolling when content overflows.
        side === 'back' && 'h-full',
        className
      )}
      style={side === 'back' ? undefined : { aspectRatio: '375 / 600' }}
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
          // Step 4 card-info (2026-09-04): pass description / backFields /
          // links through so Section 1 / 4 / 5 reflect the live editor state.
          <PassCardPreviewBack
            compact={compact}
            description={description}
            backFields={backFields}
            links={links}
          />
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
              cardType={cardType}
              stampIconId={stampIconId}
              stampGridRows={stampGridRows}
            />

            {/* Body */}
            <PassCardPreviewBody
              textColor={textColor}
              compact={compact}
              leftField={leftField}
              rightField={rightField}
              stampGridRows={stampGridRows}
              cardType={cardType}
              rewardName={rewardName}
              firstRewardTierName={firstRewardTierName}
              firstCashbackTierName={firstCashbackTierName}
            />

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
