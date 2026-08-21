/**
 * CardBuilderEditorWorkspace — 左欄位：操作區
 * 根據 step 顯示不同的操作面板內容
 */

import type { HTMLAttributes } from 'react';
import { useTranslation } from 'react-i18next';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import type { CardType, EditorStep } from './CardBuilderEditor.types';
import { CardTypeSelector } from './CardTypeSelector';
import { Step2CardSettings } from './Step2CardSettings';
import { useCardBuilderStore } from './CardBuilderEditor.store';

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

  /** Step 2: Read values from DOM (source of truth for user input) */
  function getStep2Values() {
    const storeNameEl = document.querySelector<HTMLInputElement>('#storeName');
    const issuerNameEl = document.querySelector<HTMLInputElement>('#issuerName');
    return {
      storeName: storeNameEl?.value ?? '',
      issuerName: issuerNameEl?.value ?? '',
    };
  }

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
          const { storeName, issuerName } = getStep2Values();
          const { barcodeType, passValidDays, expiryDate, currency, isPaid } = useCardBuilderStore.getState();
          await onSave(cardId, {
            barcodeType,
            storeName,
            issuerName,
            passValidDays,
            expiryDate,
            currency,
            isPaid,
          });
        } catch (err) {
          console.error('[handleNext] onSave failed:', err);
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
    <aside className={`flex w-full flex-col gap-6 bg-muted p-6 ${className || ''}`} {...rest}>
      {/* Step 1: 卡片類型選擇器 */}
      {step === 1 && (
        <section className="flex flex-col gap-6">
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
        <section className="flex flex-col gap-6">
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

      {/* Step 3: 卡片設計（預留） */}
      {step === 3 && (
        <section className="flex flex-col items-center justify-center gap-4 py-12">
          <p className="text-muted-foreground">
            {t('step3.title')}
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
