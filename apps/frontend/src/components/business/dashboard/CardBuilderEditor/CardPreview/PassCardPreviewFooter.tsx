/**
 * PassCardPreview — 卡片背面預覽（Footer / Barcode 部分）
 * Apple Pass 風格：底部區域 + barcode image
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

export function PassCardPreviewFooter({ holderName, barcodeType, backgroundColor, compact }: PassCardPreviewFooterProps) {
  const imgSrc = barcodeType ? BARCODE_IMAGES[barcodeType] : BARCODE_IMAGES.qr_code;
  const isPdf417 = barcodeType === 'pdf_417';

  return (
    <div
      className="flex w-full flex-col items-center justify-center self-stretch border-t border-neutral-200 p-4"
      style={backgroundColor ? { backgroundColor } : undefined}
    >
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
