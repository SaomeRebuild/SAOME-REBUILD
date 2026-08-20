/**
 * PassCardPreview — 卡片背面預覽（Footer / Barcode 部分）
 * Apple Pass 風格：底部區域 + barcode image
 */
import { BARCODE_IMAGES } from '@saome/shared/schemas/cardBuilder';
import type { BarcodeType } from '@saome/shared/schemas/cardBuilder';

interface PassCardPreviewFooterProps {
  holderName?: string;
  barcodeType?: BarcodeType;
  compact?: boolean;
}

/** 示範用條碼值 */
const DEMO_BARCODE_VALUE = '4938591027384';

export function PassCardPreviewFooter({ holderName, barcodeType, compact }: PassCardPreviewFooterProps) {
  const imgSrc = barcodeType ? BARCODE_IMAGES[barcodeType] : BARCODE_IMAGES.qr_code;
  const isPdf417 = barcodeType === 'pdf_417';

  return (
    <div className={compact ? 'flex flex-1 flex-col items-center justify-end gap-0 self-stretch border-t border-neutral-200 bg-neutral-50 p-2 pt-1' : 'flex flex-col items-center justify-center gap-3 border-t border-neutral-200 bg-neutral-50 p-4'}>
      {/* Barcode image */}
      <img
        src={imgSrc}
        alt="Barcode"
        className={
          compact
            ? isPdf417
              ? 'h-28 w-[224px] object-contain' // PDF417 寬2倍（compact）
              : 'h-28 w-28 object-contain'
            : isPdf417
              ? 'h-32 w-64 object-contain' // PDF417 寬2倍（非compact）
              : 'h-60 w-60 object-contain'
        }
      />

      {/* Barcode 值 */}
      <span className={compact ? 'truncate max-w-full text-[8px] text-neutral-500' : 'text-xs text-neutral-500'}>
        {holderName || DEMO_BARCODE_VALUE}
      </span>
    </div>
  );
}
