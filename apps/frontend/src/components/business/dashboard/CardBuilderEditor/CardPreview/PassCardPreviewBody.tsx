/**
 * PassCardPreview — 卡片正面預覽（Body / Secondary Fields 部分）
 * Apple Pass 風格：淡色分隔線 + 標籤/值對（靜態顯示，不含動態 issuerName / storeName）
 *
 * textColor (optional): 套用到 field label + field value 共 4 個 span（左 label、右 value）。
 *
 * PassCreator Label/Value typography (v2 plan 2026-09-04):
 *   - label 是 hint text，font size 較小（10px / 8px compact）
 *   - value 是 primary content，font size 較大（14px / 11px compact, font-medium）
 *   - 兩者都必須存在，符合 PassCreator secondary field 格式。
 */
import { useTranslation } from 'react-i18next';
import type { CardFieldKey } from '@saome/shared/constants/card-fields';

interface PassCardPreviewBodyProps {
  /** Optional text color override (hex with #). Applied to label + value spans. */
  textColor?: string;
  compact?: boolean;
  /** 左欄位選取的 field key（null = 顯示 placeholder） */
  leftField?: CardFieldKey | null;
  /** 右欄位選取的 field key（null = 顯示 placeholder） */
  rightField?: CardFieldKey | null;
}

export function PassCardPreviewBody({
  textColor,
  compact,
  leftField,
  rightField,
}: PassCardPreviewBodyProps) {
  const { t } = useTranslation('passCard');

  // Demo label/value 配對（PassCreator Label + Value 格式）
  const leftPreview = leftField
    ? {
        label: t(`fieldPreview.${leftField}.label`),
        value: t(`fieldPreview.${leftField}.value`),
      }
    : { label: t('fieldLabelLeft'), value: t('fieldLabelRight') };

  const rightPreview = rightField
    ? {
        label: t(`fieldPreview.${rightField}.label`),
        value: t(`fieldPreview.${rightField}.value`),
      }
    : { label: t('fieldLabelLeft'), value: t('fieldLabelRight') };

  // PassCreator typography: label 永遠比 value 小。
  //   非 compact：label 10px / value 14px（差 4px，1.4x 視覺層級）
  //   compact  ：label 8px  / value 11px（差 3px，手機框架內仍保留層級）
  const labelClass = compact ? 'text-[8px]' : 'text-[10px]';
  const valueClass = compact
    ? 'text-[11px] font-medium truncate'
    : 'text-sm font-medium';

  return (
    <div className={compact ? 'mt-2 flex flex-col gap-1 px-2' : 'mt-4 flex flex-col gap-2 px-4'}>
      {/* 分隔線 - Apple Pass 風格 (非文字 span, 不套 textColor) */}
      <div className="h-px w-full bg-neutral-200" />

      {/* 左右欄位 — 兩欄並排 (flex-row)，每欄 L & V 垂直排列 (flex-col)。
          對應 PassCreator secondary field 格式：左欄 [label / value]、右欄 [label / value]。 */}
      <div className={compact ? 'flex flex-row items-start justify-between gap-3 py-0.5' : 'flex flex-row items-start justify-between gap-4 py-1'}>
        {/* 左欄位 column：label（small, top）+ value（larger font-medium, bottom） */}
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          {/* 左 label — textColor 套用範圍 */}
          <span
            className={labelClass}
            style={textColor ? { color: textColor } : undefined}
          >
            {leftPreview.label}
          </span>
          {/* 左 value — textColor 套用範圍 */}
          <span
            className={valueClass}
            style={textColor ? { color: textColor } : undefined}
          >
            {leftPreview.value}
          </span>
        </div>

        {/* 右欄位 column：label（small, top）+ value（larger font-medium, bottom） — 結構對稱 */}
        <div className="flex min-w-0 flex-1 flex-col items-end gap-0.5">
          {/* 右 label — textColor 套用範圍 */}
          <span
            className={labelClass}
            style={textColor ? { color: textColor } : undefined}
          >
            {rightPreview.label}
          </span>
          {/* 右 value — textColor 套用範圍 */}
          <span
            className={valueClass}
            style={textColor ? { color: textColor } : undefined}
          >
            {rightPreview.value}
          </span>
        </div>
      </div>

      {/* 底部分隔線 (非文字 span, 不套 textColor) */}
      <div className="h-px w-full bg-neutral-200" />
    </div>
  );
}
