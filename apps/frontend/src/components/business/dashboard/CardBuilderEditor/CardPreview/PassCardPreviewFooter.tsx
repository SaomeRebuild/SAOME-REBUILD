/**
 * PassCardPreview — 卡片背面預覽（Footer / Barcode 部分）
 * Apple Pass 風格：底部區域 + barcode image
 *
 * BARCODE PLACEMENT（2026-09-10 第四次修正 — barcode 圖與值都壓到卡片底邊）：
 *
 * 變更範圍：**footer 容器的下 padding** 再壓一次。
 *   - Footer 從 `px-4 pt-1 pb-2` (上 4 / 下 8) 改成 `px-4 pt-1 pb-1` (上 4 / 下 4)，
 *     barcode 圖跟 barcode 值兩者都同時再下移 4px，視覺上更貼近真實 Apple Wallet
 *     發出的 pass（barcode 值距卡片底邊線約 8-12px，而非早期版的 16-20px）。
 *   - Barcode 圖與值之間的 `mt-1` (4) 維持不變 — 圖與值的相對距離不變，
 *     只壓「值到卡片底邊」的距離。
 *
 * 為什麼 `pb-1` (4px) 是最小安全單位：
 *   - 4-grid spacing token 表最下層就是 4px（不可用 2px / 1px）
 *   - Apple Wallet 真實 pass 的 barcode 值離底邊確實只有一點點 padding，
 *     不是早期 Apple 風的「離底邊 20px」寬鬆版
 *   - 4px 對手機框架內（compact）已足夠呼吸，又不會像 8px 那樣看起來離底邊很遠
 *
 * 4-grid 守則：4px spacing token 是允許的最小單位（`pt-1 pb-1 mt-1`），
 * 對齊 4-grid spacing token 表。
 *
 * 第六次修正（2026-09-10 — 移除白色線條）：
 *   - footer `border-t border-neutral-200` → `border-t border-transparent`
 *   - QR code 包裝容器 `border border-neutral-200` → `border border-transparent`
 *   - `bg-white` 保留（real Apple Wallet QR code 也需要白底才能被相機讀取）
 *
 * 尺寸維持上一版：
 *   QR code → 非 compact h-20 w-20 (80px), compact h-16 w-16 (64px)
 *   PDF417  → 非 compact h-32 w-[200px], compact h-24 w-[160px]
 */
import { BARCODE_IMAGES } from '@saome/shared/schemas/cardBuilder';
import type { BarcodeType } from '@saome/shared/schemas/cardBuilder';

interface PassCardPreviewFooterProps {
  holderName?: string;
  barcodeType?: BarcodeType;
  /** 卡片背景色（套用到 footer 背景） */
  backgroundColor?: string;
  compact?: boolean;
}

/** 示範用條碼值 */
const DEMO_BARCODE_VALUE = '4938591027384';

/**
 * Barcode <img> 的 Tailwind class（不含包裝容器）。
 * - QR code：加白色背景容器（透明 QR 圖需要墊底避免與卡片內容融為一體）
 * - PDF417：不需要包裝，直接顯示（本身非透明）
 *
 * QR code 包裝容器刻意不使用任何 `rounded-*` — 真實 Apple Wallet
 * 的 QR code 是直角方框，不是圓角。修改時請勿加回 `rounded-lg` /
 * `rounded-md` 等，否則會偏離真實 PASS 視覺。
 *
 * 尺寸（2026-09-10）：
 *   QR code 縮小 1.5x：非 compact h-20 w-20 (80px), compact h-16 w-16 (64px)
 *   PDF417 維持原尺寸：非 compact h-32 w-[200px], compact h-24 w-[160px]
 */
function barcodeImgClass(compact: boolean, isPdf417: boolean): string {
  if (isPdf417) {
    return compact ? 'h-24 w-[160px] object-contain' : 'h-32 w-[200px] object-contain';
  }
  return compact ? 'h-16 w-16 object-contain' : 'h-20 w-20 object-contain';
}

export function PassCardPreviewFooter({ holderName, barcodeType, backgroundColor, compact }: PassCardPreviewFooterProps) {
  const imgSrc = barcodeType ? BARCODE_IMAGES[barcodeType] : BARCODE_IMAGES.qr_code;
  const isPdf417 = barcodeType === 'pdf_417';

  return (
    <div
      // 2026-09-10 第六次修正：border-t 改成 transparent — 真實 Apple Wallet
      // pass 的 footer 沒有上方分隔線，barcode 區塊直接接在 body 後面。
      // 保留 `border-t` 是為 layout box 完整（border box 對 box-sizing:border-box
      // 沒有 pixel impact，但保留 hook 方便未來若要加回分隔線）。
      className="flex w-full flex-col items-center justify-end self-stretch border-t border-transparent px-4 pt-1 pb-1"
      style={backgroundColor ? { backgroundColor } : undefined}
    >
      {isPdf417 ? (
        // PDF417：不需要包裝容器，直接顯示
        <img
          src={imgSrc}
          alt="Barcode"
          className={barcodeImgClass(compact ?? false, true)}
        />
      ) : (
        // QR code：白色背景墊底（透明 QR 圖需要墊底）
        // 2026-09-10：移除 rounded-lg，QR code 改為直角方框，
        // 對齊真實 Apple Wallet PASS 的 QR code 視覺。
        // 第六次修正：border border-neutral-200 → border-transparent。
        // 保留 `border` className 維持 layout box 完整（雖然 transparent 視覺
        // 上看不見），bg-white 保留（real Apple Wallet QR code 必須有白底，
        // 相機才能讀得到條碼）。
        <div className="flex items-center justify-center border border-transparent bg-white p-1">
          <img
            src={imgSrc}
            alt="Barcode"
            className={barcodeImgClass(compact ?? false, false)}
          />
        </div>
      )}

      {/* Barcode 值 */}
      <span className={compact ? 'mt-1 text-[10px] text-neutral-500' : 'mt-1 text-sm text-neutral-500'}>
        {holderName || DEMO_BARCODE_VALUE}
      </span>
    </div>
  );
}
