/**
 * PassCardPreview — 卡片正面預覽（Strip / Hero 部分）
 * Apple Pass 風格：彩色 strip + icon placeholder + 名稱
 *
 * The strip is a static placeholder (CreditCard icon) for the card name
 * region. The actual icon image preview lives in MediaAssetUploader/Preview
 * (128×128 panel in the editor workspace), not inside the card template.
 */
import { CreditCard } from 'lucide-react';
import { useTranslation } from 'react-i18next';

interface PassCardPreviewStripProps {
  name?: string;
  backgroundColor?: string;
  textColor?: string;
  compact?: boolean;
}

export function PassCardPreviewStrip({ name, backgroundColor = '#1a1a1a', textColor = '#ffffff', compact }: PassCardPreviewStripProps) {
  const { t } = useTranslation('passCard');
  return (
    <div
      className={compact ? 'mx-0 mt-2 flex h-[100px] flex-col items-center justify-center gap-1 text-center' : 'mx-0 mt-4 flex h-[120px] flex-col items-center justify-center gap-2 text-center'}
      style={{ backgroundColor, color: textColor }}
    >
      {/* 卡片圖示 placeholder（icon 預覽在 MediaAssetUploader 面板，不在卡片內） */}
      <CreditCard className={compact ? 'h-6 w-6' : 'h-12 w-12'} style={{ color: textColor }} aria-hidden="true" />

      {/* 卡片名稱 */}
      <span className={compact ? 'text-xs font-semibold leading-tight' : 'text-lg font-semibold'} style={{ color: textColor }}>
        {name || t('defaultName')}
      </span>
    </div>
  );
}
