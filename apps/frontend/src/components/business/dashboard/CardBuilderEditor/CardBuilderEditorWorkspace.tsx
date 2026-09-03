/**
 * CardBuilderEditorWorkspace — 左欄位：操作區
 * 根據 step 顯示不同的操作面板內容
 */

import { useEffect, type HTMLAttributes } from 'react';
import { useTranslation } from 'react-i18next';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import type { CardType, EditorStep } from './CardBuilderEditor.types';
import { CardTypeSelector } from './CardTypeSelector';
import { Step2CardSettings } from './Step2CardSettings';
import { MediaAssetUploader } from './MediaAssetUploader';
import { Step3CardColors } from './Step3CardColors';
import { Step3CardFields } from './Step3CardFields';
import { Step3StampGrid } from './Step3StampGrid';
import { useCardBuilderStore } from './CardBuilderEditor.store';
import { cardService } from '@/services/cardService';

interface CardBuilderEditorWorkspaceProps extends HTMLAttributes<HTMLDivElement> {
  step: EditorStep;
  onStepChange: (step: EditorStep) => void;
  cardType?: CardType | null;
  cardId?: string | null;
  onCardTypeChange: (type: CardType) => void;
  onSave?: (cardId: string, settings: Record<string, unknown>) => Promise<void>;
  onBack?: () => void;
}

export function CardBuilderEditorWorkspace({
  step,
  onStepChange,
  cardType,
  cardId,
  onCardTypeChange,
  onSave,
  onBack,
  className,
  ...rest
}: CardBuilderEditorWorkspaceProps) {
  const { t } = useTranslation('cardEditor');

  /** Step 2: Read values from Zustand store (source of truth) */
  function getStep2Values() {
    const store = useCardBuilderStore.getState();
    return {
      storeName: store.storeName,
      issuerName: store.issuerName,
    };
  }

  /** Load existing template settings when cardId is provided (edit mode) */
  useEffect(() => {
    if (!cardId) return;
    let cancelled = false;
    (async () => {
      try {
        const template = await cardService.getById(cardId);
        if (cancelled) return;
        console.log('[CardBuilderEditorWorkspace] loaded template:', template);
        useCardBuilderStore.getState().loadSettings(template.settings);
        if (template.cardType && template.cardType !== cardType) {
          onCardTypeChange(template.cardType);
        }
      } catch (err) {
        console.error('[CardBuilderEditorWorkspace] failed to load template:', err);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [cardId]); // eslint-disable-line react-hooks/exhaustive-deps

  function isStep2Valid() {
    const { storeName, issuerName } = getStep2Values();
    return Boolean(storeName.trim() && issuerName.trim());
  }

  async function handleNext() {
    console.log('[handleNext] step:', step, 'cardId:', cardId);
    if (step < 8) {
      if (step === 2 && !isStep2Valid()) return;
      if (step === 2 && cardId && onSave) {
        try {
          const { storeName, issuerName, issuerLogo } = useCardBuilderStore.getState();
          const { barcodeType, passValidDays, expiryDate, currency, isPaid } = useCardBuilderStore.getState();
          await onSave(cardId, {
            barcodeType,
            storeName,
            issuerName,
            issuerLogo: issuerLogo || undefined,
            passValidDays,
            expiryDate,
            currency,
            isPaid,
          });
        } catch (err) {
          console.error('[handleNext] onSave failed:', err);
        }
      }
      // Step 3: persist logo + icon + background R2 keys + colors (Phase 8 of IconUploader plan 2026-08-31 + BackgroundUploader plan 2026-09-01 + Step 3 color picker 2026-09-03).
      // The MediaAssetUploader has already updated the store on upload, so we
      // just forward the current store values to onSave().
      // backgroundColor / textColor are stored with '#' prefix internally;
      // PassCreator contract is 6-char uppercase hex WITHOUT '#' (strip here).
      // Step 3 fields selector (plan 2026-09-04): also persist leftField / rightField.
      // Stamp grid feature (2026-09-04): also persist stampGridRows / stampIconId.
      if (step === 3 && cardId && onSave) {
        try {
          const { issuerLogo, iconImage, backgroundImage, backgroundColor, textColor } = useCardBuilderStore.getState();
          const { leftField, rightField, stampGridRows, stampIconId } = useCardBuilderStore.getState();
          await onSave(cardId, {
            issuerLogo: issuerLogo || undefined,
            iconImage: iconImage || undefined,
            backgroundImage: backgroundImage || undefined,
            backgroundColor: backgroundColor.replace('#', '').toUpperCase(),
            textColor: textColor.replace('#', '').toUpperCase(),
            leftField: leftField ?? undefined,
            rightField: rightField ?? undefined,
            stampGridRows: cardType === 'stamp_card' || cardType === 'multipass' ? stampGridRows : undefined,
            stampIconId: cardType === 'stamp_card' || cardType === 'multipass' ? (stampIconId || undefined) : undefined,
          });
          console.log('[handleNext] Step 3 image keys + colors + fields + stamp grid saved', { issuerLogo, iconImage, backgroundImage, backgroundColor, textColor, leftField, rightField, stampGridRows, stampIconId });
        } catch (err) {
          // Don't block step transition — let the user proceed and retry later.
          console.error('[handleNext] Step 3 onSave failed:', err);
        }
      }
      onStepChange((step + 1) as EditorStep);
    }
  }

  function handlePrev() {
    if (step > 1) {
      onStepChange((step - 1) as EditorStep);
    }
  }

  return (
    <aside className={`flex min-w-0 w-full flex-col gap-6 bg-muted p-6 ${className || ''}`} {...rest}>
      {/* min-w-0: defensive — prevents the aside from being stretched by its
          children's min-content (notably the LogoUploader crop stage's inline
          width on mobile). See feedback 20260830. */}
      {/* Step 1: 卡片類型選擇器 */}
      {step === 1 && (
        <section className="flex min-w-0 flex-col gap-6">
          <h2 className="text-lg font-semibold text-foreground">
            {t('step1.title')}
          </h2>
          <CardTypeSelector value={cardType} onChange={onCardTypeChange} />
          <div className="flex items-center justify-between">
            <button
              type="button"
              onClick={onBack}
              className="
                flex items-center gap-2 rounded-lg border border-border bg-card px-4 py-2.5
                text-sm font-medium text-foreground
                transition-all duration-150
                hover:scale-[1.02] hover:border-primary hover:text-primary
                active:scale-[0.98]
              "
            >
              <ChevronLeft size={16} aria-hidden="true" />
              {t('actions.backToLibrary')}
            </button>
            <button
              type="button"
              onClick={handleNext}
              disabled={!cardType}
              className="
                flex items-center gap-2 rounded-lg bg-primary px-6 py-2.5
                text-sm font-semibold text-on-primary
                transition-all duration-150
                hover:scale-[1.02] hover:shadow-[var(--shadow-glow)]
                active:scale-[0.98]
                disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:scale-100
              "
            >
              {t('step1.next')}
              <ChevronRight size={16} aria-hidden="true" />
            </button>
          </div>
        </section>
      )}

      {/* Step 2: 卡片設定 */}
      {step === 2 && (
        <section className="flex min-w-0 flex-col gap-6">
          <h2 className="text-lg font-semibold text-foreground">
            {t('step2.title')}
          </h2>
          <Step2CardSettings showValidation={!isStep2Valid()} />
          {/* 上一步 / 下一步按鈕 */}
          <div className="flex items-center justify-between pt-2">
            <button
              type="button"
              onClick={handlePrev}
              className="
                flex items-center gap-2 rounded-lg border border-border bg-card px-4 py-2.5
                text-sm font-medium text-foreground
                transition-all duration-150
                hover:scale-[1.02] hover:border-primary hover:text-primary
                active:scale-[0.98]
              "
            >
              <ChevronLeft size={16} aria-hidden="true" />
              {t('actions.prev')}
            </button>
            <button
              type="button"
              onClick={handleNext}
              disabled={!isStep2Valid()}
              className="
                flex items-center gap-2 rounded-lg bg-primary px-6 py-2.5
                text-sm font-semibold text-on-primary
                transition-all duration-150
                hover:scale-[1.02] hover:shadow-[var(--shadow-glow)]
                active:scale-[0.98]
                disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:scale-100
              "
            >
              {t('step1.next')}
              <ChevronRight size={16} aria-hidden="true" />
            </button>
          </div>
        </section>
      )}

      {/* Step 3: 卡片設計（Logo + Icon 上傳） */}
      {step === 3 && (
        <section className="flex min-w-0 flex-col gap-6">
          <h2 className="text-lg font-semibold text-foreground">
            {t('step3.title')}
          </h2>

          {/* 既有 Logo 區塊 — 從既有的單一 LogoUploader 升級為 MediaAssetUploader variant="logo" */}
          <MediaAssetUploader
            variant="logo"
            templateId={cardId ?? ''}
            onUploaded={(key: string) => {
              console.log('[Step3] Logo uploaded:', key);
            }}
          />

          {/* Icon 區塊（Phase 8 — IconUploader plan 2026-08-31）
              - 在 Logo 下方,border-t 區隔
              - 推播通知圖示,不會出現在卡片模板本身（PreviewWrapper 只在 PhoneFrame 內 overlay）
              - 標題使用 font-semibold + font-family-heading(同 MediaAssetUploaderHeader)
                確保兩個變體的 heading 視覺一致
              - showHeader={false}：MediaAssetUploader 不再渲染內部 header,因為這層已自帶 */}
          <section className="flex min-w-0 flex-col gap-2 border-t pt-6">
            <h3
              className="text-base font-semibold text-foreground"
              style={{ fontFamily: 'var(--font-family-heading)' }}
            >
              {t('step3.iconSection.title')}
            </h3>
            <p className="text-sm text-muted-foreground">
              {t('step3.iconSection.hint')}
            </p>
            <MediaAssetUploader
              variant="icon"
              templateId={cardId ?? ''}
              showHeader={false}
              onUploaded={(key: string) => {
                console.log('[Step3] Icon uploaded:', key);
              }}
            />
          </section>

          {/* Background 區塊（BackgroundUploader plan 2026-09-01）
              - 在 Icon 下方,border-t 區隔
              - 背景圖顯示在卡片頂部 hero strip (PassCardPreviewStrip)
                size: 1860×738 像素（PassCreator spec）
              - 結構與 Icon 區塊對稱: <h3> + <p hint> + MediaAssetUploader showHeader={false}
              - showHeader={false}: MediaAssetUploader 不再渲染內部 header,
                因為這層已自帶 heading */}
          <section className="flex min-w-0 flex-col gap-2 border-t pt-6">
            <h3
              className="text-base font-semibold text-foreground"
              style={{ fontFamily: 'var(--font-family-heading)' }}
            >
              {t('step3.backgroundSection.title')}
            </h3>
            <p className="text-sm text-muted-foreground">
              {t('step3.backgroundSection.hint')}
            </p>
            <MediaAssetUploader
              variant="background"
              templateId={cardId ?? ''}
              showHeader={false}
              onUploaded={(key: string) => {
                console.log('[Step3] Background uploaded:', key);
              }}
            />
          </section>

          {/* Colors 區塊（Step 3 Color Picker plan 2026-09-03）
              - 在 Background section 之後,border-t 區隔
              - 渲染兩顆並列按鈕（背景色 / 文字色）+ popover 調色盤 + hex 輸入框
              - 與 icon / background section 對稱,採 parent section header pattern */}
          <Step3CardColors />

          {/* Fields 區塊（Step 3 Fields Selector plan 2026-09-04, plan id baffa936）
              - 在 Colors section 之後,border-t 區隔
              - 渲染兩個並排 native <select>（左欄位 / 右欄位）,
                每個 6 個共用選項 + 對側已選 disabled
              - 選擇 persist 到 store.leftField / rightField,
                並於 handleNext step 3 區段寫進 template_settings
              - 行為副作用（PassCardPreview 渲染等）留待後續計畫 */}
          <Step3CardFields />

          {/* Stamp grid 區塊（Stamp Grid feature 2026-09-04）
              - 條件渲染：僅在 cardType ∈ {stamp_card, multipass} 時顯示
              - 提供集點格數（1×5 / 2×5 / 3×5 / 4×5）+ 印章圖示選擇
              - 寫到 store.stampGridRows / store.stampIconId,
                並於 handleNext step 3 區段寫進 template_settings
              - PassCardPreviewStrip 在 isStampCard 分支 render StampGridPreview */}
          {(cardType === 'stamp_card' || cardType === 'multipass') && <Step3StampGrid />}

          {/* 上一步 / 下一步按鈕 */}
          <div className="flex items-center justify-between pt-2">
            <button
              type="button"
              onClick={handlePrev}
              className="
                flex items-center gap-2 rounded-lg border border-border bg-card px-4 py-2.5
                text-sm font-medium text-foreground
                transition-all duration-150
                hover:scale-[1.02] hover:border-primary hover:text-primary
                active:scale-[0.98]
              "
            >
              <ChevronLeft size={16} aria-hidden="true" />
              {t('actions.prev')}
            </button>
            <button
              type="button"
              onClick={handleNext}
              className="
                flex items-center gap-2 rounded-lg bg-primary px-6 py-2.5
                text-sm font-semibold text-on-primary
                transition-all duration-150
                hover:scale-[1.02] hover:shadow-[var(--shadow-glow)]
                active:scale-[0.98]
              "
            >
              {t('step1.next')}
              <ChevronRight size={16} aria-hidden="true" />
            </button>
          </div>
        </section>
      )}

      {/* Step 4: 卡片資訊（預留） */}
      {step === 4 && (
        <section className="flex flex-col items-center justify-center gap-4 py-12">
          <p className="text-muted-foreground">
            {t('step4.title')}
          </p>
          <p className="text-sm text-muted-foreground/60">
            {t('comingSoon')}
          </p>
          {/* 上一步 / 下一步按鈕 */}
          <div className="flex items-center gap-4 pt-4">
            <button
              type="button"
              onClick={handlePrev}
              className="
                flex items-center gap-2 rounded-lg border border-border bg-card px-4 py-2.5
                text-sm font-medium text-foreground
                transition-all duration-150
                hover:scale-[1.02] hover:border-primary hover:text-primary
                active:scale-[0.98]
              "
            >
              <ChevronLeft size={16} aria-hidden="true" />
              {t('actions.prev')}
            </button>
            <button
              type="button"
              onClick={handleNext}
              className="
                flex items-center gap-2 rounded-lg bg-primary px-6 py-2.5
                text-sm font-semibold text-on-primary
                transition-all duration-150
                hover:scale-[1.02] hover:shadow-[var(--shadow-glow)]
                active:scale-[0.98]
              "
            >
              {t('step1.next')}
              <ChevronRight size={16} aria-hidden="true" />
            </button>
          </div>
        </section>
      )}

      {/* Step 5: 地理位置（預留） */}
      {step === 5 && (
        <section className="flex flex-col items-center justify-center gap-4 py-12">
          <p className="text-muted-foreground">
            {t('step5.title')}
          </p>
          <p className="text-sm text-muted-foreground/60">
            {t('comingSoon')}
          </p>
          {/* 上一步 / 下一步按鈕 */}
          <div className="flex items-center gap-4 pt-4">
            <button
              type="button"
              onClick={handlePrev}
              className="
                flex items-center gap-2 rounded-lg border border-border bg-card px-4 py-2.5
                text-sm font-medium text-foreground
                transition-all duration-150
                hover:scale-[1.02] hover:border-primary hover:text-primary
                active:scale-[0.98]
              "
            >
              <ChevronLeft size={16} aria-hidden="true" />
              {t('actions.prev')}
            </button>
            <button
              type="button"
              onClick={handleNext}
              className="
                flex items-center gap-2 rounded-lg bg-primary px-6 py-2.5
                text-sm font-semibold text-on-primary
                transition-all duration-150
                hover:scale-[1.02] hover:shadow-[var(--shadow-glow)]
                active:scale-[0.98]
              "
            >
              {t('step1.next')}
              <ChevronRight size={16} aria-hidden="true" />
            </button>
          </div>
        </section>
      )}

      {/* Step 6: 卡片邏輯（預留） */}
      {step === 6 && (
        <section className="flex flex-col items-center justify-center gap-4 py-12">
          <p className="text-muted-foreground">
            {t('step6.title')}
          </p>
          <p className="text-sm text-muted-foreground/60">
            {t('comingSoon')}
          </p>
          {/* 上一步 / 下一步按鈕 */}
          <div className="flex items-center gap-4 pt-4">
            <button
              type="button"
              onClick={handlePrev}
              className="
                flex items-center gap-2 rounded-lg border border-border bg-card px-4 py-2.5
                text-sm font-medium text-foreground
                transition-all duration-150
                hover:scale-[1.02] hover:border-primary hover:text-primary
                active:scale-[0.98]
              "
            >
              <ChevronLeft size={16} aria-hidden="true" />
              {t('actions.prev')}
            </button>
            <button
              type="button"
              onClick={handleNext}
              className="
                flex items-center gap-2 rounded-lg bg-primary px-6 py-2.5
                text-sm font-semibold text-on-primary
                transition-all duration-150
                hover:scale-[1.02] hover:shadow-[var(--shadow-glow)]
                active:scale-[0.98]
              "
            >
              {t('step1.next')}
              <ChevronRight size={16} aria-hidden="true" />
            </button>
          </div>
        </section>
      )}

      {/* Step 7: 客製化桌牌（預留） */}
      {step === 7 && (
        <section className="flex flex-col items-center justify-center gap-4 py-12">
          <p className="text-muted-foreground">
            {t('step7.title')}
          </p>
          <p className="text-sm text-muted-foreground/60">
            {t('comingSoon')}
          </p>
          {/* 上一步 / 下一步按鈕 */}
          <div className="flex items-center gap-4 pt-4">
            <button
              type="button"
              onClick={handlePrev}
              className="
                flex items-center gap-2 rounded-lg border border-border bg-card px-4 py-2.5
                text-sm font-medium text-foreground
                transition-all duration-150
                hover:scale-[1.02] hover:border-primary hover:text-primary
                active:scale-[0.98]
              "
            >
              <ChevronLeft size={16} aria-hidden="true" />
              {t('actions.prev')}
            </button>
            <button
              type="button"
              onClick={handleNext}
              className="
                flex items-center gap-2 rounded-lg bg-primary px-6 py-2.5
                text-sm font-semibold text-on-primary
                transition-all duration-150
                hover:scale-[1.02] hover:shadow-[var(--shadow-glow)]
                active:scale-[0.98]
              "
            >
              {t('step1.next')}
              <ChevronRight size={16} aria-hidden="true" />
            </button>
          </div>
        </section>
      )}

      {/* Step 8: 保存（預留） */}
      {step === 8 && (
        <section className="flex flex-col items-center justify-center gap-4 py-12">
          <p className="text-muted-foreground">
            {t('step8.title')}
          </p>
          <p className="text-sm text-muted-foreground/60">
            {t('comingSoon')}
          </p>
          {/* 上一步 / 保存按鈕 */}
          <div className="flex items-center gap-4 pt-4">
            <button
              type="button"
              onClick={handlePrev}
              className="
                flex items-center gap-2 rounded-lg border border-border bg-card px-4 py-2.5
                text-sm font-medium text-foreground
                transition-all duration-150
                hover:scale-[1.02] hover:border-primary hover:text-primary
                active:scale-[0.98]
              "
            >
              <ChevronLeft size={16} aria-hidden="true" />
              {t('actions.prev')}
            </button>
            <button
              type="button"
              onClick={handleNext}
              disabled
              className="
                flex items-center gap-2 rounded-lg bg-primary px-6 py-2.5
                text-sm font-semibold text-on-primary
                transition-all duration-150
                hover:scale-[1.02] hover:shadow-[var(--shadow-glow)]
                active:scale-[0.98]
                disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:scale-100
              "
            >
              {t('actions.save')}
            </button>
          </div>
        </section>
      )}
    </aside>
  );
}
