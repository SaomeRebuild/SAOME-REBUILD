/**
 * PassCardPreview — 卡片正面預覽（Body / Secondary Fields 部分）
 * Apple Pass 風格：淡色分隔線 + 標籤/值對（靜態顯示，不含動態 issuerName / storeName）
 *
 * textColor (optional): 套用到 field label（左標籤） + value（右值）共 2 個 span。
 */
import { useTranslation } from 'react-i18next';

interface PassCardPreviewBodyProps {
  /** Optional text color override (hex with #). Applied to label + value spans. */
  textColor?: string;
  compact?: boolean;
}

export function PassCardPreviewBody({ textColor, compact }: PassCardPreviewBodyProps) {
  const { t } = useTranslation('passCard');

  return (
    <div className={compact ? 'mt-2 flex flex-col gap-1 px-2' : 'mt-4 flex flex-col gap-2 px-4'}>
      {/* 分隔線 - Apple Pass 風格 (非文字 span, 不套 textColor) */}
      <div className="h-px w-full bg-neutral-200" />

      {/* 左右欄位 */}
      <div className={compact ? 'flex items-center justify-between py-0.5' : 'flex items-center justify-between py-1'}>
        {/* 左標籤 — textColor 套用範圍 #3 (body 左) */}
        <span
          className={compact ? 'text-[9px]' : 'text-xs'}
          style={textColor ? { color: textColor } : undefined}
        >
          {t('fieldLabelLeft')}
        </span>
        {/* 右值 — textColor 套用範圍 #4 (body 右) */}
        <span
          className={compact ? 'text-[9px] font-medium' : 'text-xs font-medium'}
          style={textColor ? { color: textColor } : undefined}
        >
          {t('fieldLabelRight')}
        </span>
      </div>

      {/* 底部分隔線 (非文字 span, 不套 textColor) */}
      <div className="h-px w-full bg-neutral-200" />
    </div>
  );
}
