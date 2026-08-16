/**
 * PassCardPreview — 卡片正面預覽（Strip / Hero 部分）
 * Apple Pass 風格：彩色 strip + icon + 名稱
 */
import { CreditCard } from 'lucide-react';

interface PassCardPreviewStripProps {
  name?: string;
  backgroundColor?: string;
  textColor?: string;
  compact?: boolean;
}

export function PassCardPreviewStrip({ name, backgroundColor = '#1a1a1a', textColor = '#ffffff', compact }: PassCardPreviewStripProps) {
  return (
    <div
      className={compact ? 'mx-0 mt-2 flex h-[56px] flex-col items-center justify-center gap-1 text-center' : 'mx-0 mt-4 flex h-[120px] flex-col items-center justify-center gap-2 text-center'}
      style={{ backgroundColor, color: textColor }}
    >
      {/* 卡片圖示 */}
      <CreditCard className={compact ? 'h-6 w-6' : 'h-12 w-12'} style={{ color: textColor }} aria-hidden="true" />

      {/* 卡片名稱 */}
      <span className={compact ? 'text-xs font-semibold leading-tight' : 'text-lg font-semibold'} style={{ color: textColor }}>
        {name || '未命名卡片'}
      </span>
    </div>
  );
}
