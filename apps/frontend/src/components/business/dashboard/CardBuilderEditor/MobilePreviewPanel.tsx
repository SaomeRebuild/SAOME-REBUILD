/**
 * MobilePreviewPanel — 移動裝置可折疊底部預覽面板
 *
 * 行為：
 * - Mobile (< lg): 浮動按鈕 + 可展開 Bottom Sheet
 * - Desktop (lg+): 保持原本右側預覽（隱藏此元件）
 *
 * 使用 React Portal 將 Bottom Sheet 渲染到 document.body，
 * 確保不受父元件 overflow/z-index 影響。
 */

import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { ChevronUp, Eye } from 'lucide-react';
import { CardBuilderEditorPreview } from './CardBuilderEditorPreview';
import type { CardSide } from './CardBuilderEditorPreview';

interface MobilePreviewPanelProps {
  cardSide?: CardSide;
  onCardSideChange?: (side: CardSide) => void;
}

export function MobilePreviewPanel({
  cardSide,
  onCardSideChange,
}: MobilePreviewPanelProps) {
  const { t } = useTranslation('cardEditor');
  const [isExpanded, setIsExpanded] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return null;

  return (
    <>
      {/* 浮動展開按鈕 — 只在 mobile 顯示 */}
      <button
        type="button"
        onClick={() => setIsExpanded(true)}
        className="
          fixed bottom-6 right-6 z-40 flex items-center gap-2 rounded-full
          bg-primary px-4 py-3 shadow-lg
          text-sm font-semibold text-on-primary
          transition-all duration-150
          hover:scale-105 hover:shadow-xl
          active:scale-95
          lg:hidden
        "
        aria-label={t('preview.togglePreview')}
      >
        <Eye size={18} aria-hidden="true" />
        <span>{t('preview.togglePreview')}</span>
      </button>

      {/* Bottom Sheet — 使用 Portal 渲染到 document.body */}
      {isExpanded && createPortal(
        <div className="fixed inset-0 z-[9999] flex flex-col justify-end">
          {/* 遮罩層 */}
          <div
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={() => setIsExpanded(false)}
            aria-hidden="true"
          />

          {/* 面板內容 */}
          <div
            className="
              relative flex flex-col rounded-t-2xl bg-card shadow-[0_-4px_20px_rgba(0,0,0,0.15)]
              animate-in slide-in-from-bottom duration-300
            "
            style={{ maxHeight: '80vh' }}
          >
            {/* 拖曳手柄 */}
            <div className="flex justify-center py-3">
              <button
                type="button"
                onClick={() => setIsExpanded(false)}
                className="flex h-2 w-12 cursor-pointer items-center justify-center rounded-full bg-muted-foreground/20"
                aria-label={t('preview.closePreview')}
              >
                <ChevronUp size={16} className="text-muted-foreground" aria-hidden="true" />
              </button>
            </div>

            {/* 預覽標題 */}
            <div className="border-b border-border px-4 pb-2">
              <h3 className="text-sm font-medium text-muted-foreground">
                {t('preview.title')}
              </h3>
            </div>

            {/* 預覽內容 — 可滾動 */}
            <div className="flex-1 overflow-y-auto p-4">
              <div className="flex min-h-[calc(100%-2rem)] flex-col items-center justify-start gap-4 pt-2">
                <CardBuilderEditorPreview
                  cardSide={cardSide}
                  onCardSideChange={onCardSideChange}
                  forceVisible
                />
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}
    </>
  );
}
