/**
 * CardBuilderEditorPreview — 右欄位：即時預覽區
 */

import type { HTMLAttributes } from 'react';
import { useTranslation } from 'react-i18next';
import { Eye } from 'lucide-react';
import type { CardType } from './CardBuilderEditor.types';

interface CardBuilderEditorPreviewProps extends HTMLAttributes<HTMLDivElement> {
  name: string;
  cardType?: CardType | null;
  /** 強制顯示預覽區（用於 Mobile Bottom Sheet，覆蓋 hidden lg:flex） */
  forceVisible?: boolean;
}

export function CardBuilderEditorPreview({
  name,
  cardType,
  forceVisible = false,
  className,
  ...rest
}: CardBuilderEditorPreviewProps) {
  const { t } = useTranslation('cardEditor');

  return (
    <aside className={`
      w-full flex-col items-center justify-center gap-4 bg-background p-6
      ${forceVisible ? 'flex' : 'hidden lg:flex'}
      ${className || ''}
    `} {...rest}>
      {/* 預覽標題 */}
      <div className="flex w-full items-center gap-2 text-muted-foreground">
        <Eye size={16} aria-hidden="true" />
        <span className="text-sm font-medium">{t('preview.title')}</span>
      </div>

      {/* 卡片預覽 */}
      <div className="flex h-64 w-full max-w-sm items-center justify-center rounded-xl border-2 border-dashed border-border bg-card p-6">
        {cardType ? (
          <div className="flex flex-col items-center gap-3 text-center">
            <span className="text-4xl" aria-hidden="true">
              {/* TODO: 根據 cardType 顯示對應的卡片圖示 */}
              🎴
            </span>
            <p className="font-semibold text-foreground">
              {name || t('preview.untitled')}
            </p>
            <p className="text-sm text-muted-foreground">
              {t(`step1.cardTypes.${cardType}`)}
            </p>
          </div>
        ) : (
          <p className="text-muted-foreground">{t('preview.empty')}</p>
        )}
      </div>
    </aside>
  );
}
