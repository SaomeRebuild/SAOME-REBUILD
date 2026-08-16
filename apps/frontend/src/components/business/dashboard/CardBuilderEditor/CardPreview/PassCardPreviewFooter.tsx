/**
 * PassCardPreview — 卡片背面預覽（Footer / Barcode 部分）
 * Apple Pass 風格：底部區域 + barcode icon 占位
 */
import { Barcode } from 'lucide-react';

interface PassCardPreviewFooterProps {
  holderName?: string;
  compact?: boolean;
}

/** 示範用條碼值 */
const DEMO_BARCODE_VALUE = '4938591027384';

export function PassCardPreviewFooter({ holderName, compact }: PassCardPreviewFooterProps) {
  return (
    <div className={compact ? 'flex flex-1 flex-col items-center justify-end gap-0 self-stretch border-t border-neutral-200 bg-neutral-50 p-2 pt-1' : 'flex flex-col items-center justify-center gap-3 border-t border-neutral-200 bg-neutral-50 p-4'}>
      {/* Barcode icon 占位 */}
      <Barcode size={compact ? 56 : 80} className="text-neutral-400" aria-hidden="true" />

      {/* Barcode 值 */}
      <span className={compact ? 'truncate max-w-full text-[8px] text-neutral-500' : 'text-xs text-neutral-500'}>
        {holderName || DEMO_BARCODE_VALUE}
      </span>
    </div>
  );
}
