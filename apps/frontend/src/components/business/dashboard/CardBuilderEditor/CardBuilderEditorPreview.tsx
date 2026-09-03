/**
 * CardBuilderEditorPreview — 右欄位：即時預覽區
 */

import type { HTMLAttributes } from 'react';
import { useTranslation } from 'react-i18next';
import { Eye } from 'lucide-react';
import { PreviewWrapper } from './PreviewWrapper';
import { useCardBuilderStore } from './CardBuilderEditor.store';
import { api } from '@/config/api';
import { getAccessToken } from '@/services/authStore';

export type CardSide = 'front' | 'back';

interface CardBuilderEditorPreviewProps extends HTMLAttributes<HTMLDivElement> {
  /** 強制顯示預覽區（用於 Mobile Bottom Sheet，覆蓋 hidden lg:flex） */
  forceVisible?: boolean;
  /** 目前顯示的卡片面 */
  cardSide?: CardSide;
  /** 卡片面切換時 callback */
  onCardSideChange?: (side: CardSide) => void;
}

export function CardBuilderEditorPreview({
  forceVisible = false,
  cardSide = 'front',
  onCardSideChange,
  className,
  ...rest
}: CardBuilderEditorPreviewProps) {
  const { t } = useTranslation('cardEditor');

  // 從 store 取得卡片資料（issuerName, storeName 不傳入預覽：不需即時預覽）
  const {
    name,
    cardType,
    issuerLogo,
    holderName,
    backgroundColor,
    textColor,
    barcodeType,
    backgroundImage,
    backgroundImageVersion,
    cardId,
    // Step 3 — 顯示欄位（對應 templateSettings.leftField / rightField）
    leftField,
    rightField,
  } = useCardBuilderStore();

  // 組裝背景圖 URL（cache-busting via backgroundImageVersion）
  const backgroundImageUrl = backgroundImage && cardId
    ? `${api.baseUrl}${api.paths.cardImage(cardId, 'background')}?token=${encodeURIComponent(getAccessToken() ?? '')}&v=${backgroundImageVersion}`
    : undefined;

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

      {/* 卡片預覽（手機框架 + 卡片本體） */}
      <div className="flex h-auto w-full max-w-sm items-center justify-center rounded-xl border-2 border-dashed border-border bg-card p-4">
        {cardType ? (
          <PreviewWrapper
            name={name}
            cardType={cardType}
            issuerLogo={issuerLogo}
            backgroundImage={backgroundImageUrl}
            holderName={holderName}
            backgroundColor={backgroundColor}
            textColor={textColor}
            barcodeType={barcodeType}
            leftField={leftField}
            rightField={rightField}
            side={cardSide}
            showPhoneFrame={true}
          />
        ) : (
          <p className="text-muted-foreground">{t('preview.empty')}</p>
        )}
      </div>

      {/* 卡片正反面切換按鈕 */}
      <div className="flex w-full max-w-sm items-center justify-between">
        <span className="text-sm text-muted-foreground">
          {t('preview.cardSide')}
        </span>
        <div className="flex rounded-lg border border-border bg-muted p-1">
          <button
            type="button"
            onClick={() => onCardSideChange?.('front')}
            className={`
              flex-1 cursor-pointer rounded-md px-3 py-1.5 text-sm font-medium
              transition-all duration-150
              focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1
              ${cardSide === 'front'
                ? 'bg-primary text-on-primary shadow-sm'
                : 'text-muted-foreground hover:bg-muted-foreground/10 hover:text-foreground active:scale-95'
              }
            `}
          >
            {t('preview.front')}
          </button>
          <button
            type="button"
            onClick={() => onCardSideChange?.('back')}
            className={`
              flex-1 cursor-pointer rounded-md px-3 py-1.5 text-sm font-medium
              transition-all duration-150
              focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1
              ${cardSide === 'back'
                ? 'bg-primary text-on-primary shadow-sm'
                : 'text-muted-foreground hover:bg-muted-foreground/10 hover:text-foreground active:scale-95'
              }
            `}
          >
            {t('preview.back')}
          </button>
        </div>
      </div>
    </aside>
  );
}
