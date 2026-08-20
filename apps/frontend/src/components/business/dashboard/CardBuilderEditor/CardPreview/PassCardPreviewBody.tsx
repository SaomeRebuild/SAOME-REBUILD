/**
 * PassCardPreview — 卡片正面預覽（Body / Secondary Fields 部分）
 * Apple Pass 風格：淡色分隔線 + 標籤/值對
 */
import { useTranslation } from 'react-i18next';

interface PassCardPreviewBodyProps {
  storeName?: string;
  issuerName?: string;
  compact?: boolean;
}

export function PassCardPreviewBody({ storeName, issuerName, compact }: PassCardPreviewBodyProps) {
  const { t } = useTranslation('passCard');

  return (
    <div className={compact ? 'mt-2 flex flex-col gap-1 px-2' : 'mt-4 flex flex-col gap-2 px-4'}>
      {/* 分隔線 - Apple Pass 風格 */}
      <div className="h-px w-full bg-neutral-200" />

      {/* 發卡機構 */}
      <div className={compact ? 'flex items-center justify-between py-0.5' : 'flex items-center justify-between py-1'}>
        <span className={compact ? 'text-[9px] text-neutral-500' : 'text-xs text-neutral-500'}>
          {t('fieldLabelLeft')}
        </span>
        <span className={compact ? 'text-[9px] font-medium text-neutral-900' : 'text-xs font-medium text-neutral-900'}>
          {issuerName || storeName || t('fieldLabelRight')}
        </span>
      </div>

      {/* 底部分隔線 */}
      <div className="h-px w-full bg-neutral-200" />
    </div>
  );
}
