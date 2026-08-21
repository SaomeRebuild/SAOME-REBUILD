/**
 * CardBuilderEditor — 卡片建置器編輯器主組件
 *
 * 佈局結構：
 * - 上容器：CardBuilderEditorHeader（導航列）
 * - 下容器：左右欄位
 *   - 左：CardBuilderEditorWorkspace（操作區）
 *   - 右：CardBuilderEditorPreview（即時預覽區）— Desktop only
 * - Mobile: CardBuilderEditorPreview 改由 MobilePreviewPanel 提供（Bottom Sheet）
 *
 * 資料流：
 * - 新建模式（無 templateId）：使用者從頭建置，store 為初始狀態
 * - 編輯模式（有 templateId）：mount 時從 API 取得既有的 settings 並載入 store
 */

import { useEffect, useState, useRef } from 'react';
import type { CardBuilderEditorProps, EditorStep } from './CardBuilderEditor.types';
import { CardBuilderEditorHeader } from './CardBuilderEditorHeader';
import { CardBuilderEditorWorkspace } from './CardBuilderEditorWorkspace';
import { CardBuilderEditorPreview } from './CardBuilderEditorPreview';
import { MobilePreviewPanel } from './MobilePreviewPanel';
import { useCardBuilderStore } from './CardBuilderEditor.store';
import { cardService } from '@/services/cardService';

export function CardBuilderEditor({
  templateId,
  onSave: _onSave,
  onBack: _onBack,
}: CardBuilderEditorProps) {
  const [isLoading, setIsLoading] = useState(false);

  // 使用 store 管理卡片編輯器狀態
  const {
    name,
    cardId,
    cardType,
    step,
    completedSteps,
    cardSide,
    setName,
    setStep,
    setCompletedStep,
    setCardSide,
    setCardId,
    loadSettings,
    reset,
  } = useCardBuilderStore();

  // 初始化：根據 mode（新建或編輯）載入資料
  useEffect(() => {
    if (templateId) {
      // 編輯模式：fetch 既有的 template settings
      setIsLoading(true);
      cardService.getById(templateId)
        .then((template) => {
          setCardId(template.id);
          loadSettings(template.settings);
          if (template.name) {
            setName(template.name);
          }
        })
        .catch((err) => {
          console.error('Failed to load template:', err);
          // TODO: Show error toast
        })
        .finally(() => {
          setIsLoading(false);
        });
    } else {
      // 新建模式：reset store 並設定 cardId 為 null
      reset();
      setCardId(null);
    }
  }, [templateId]); // eslint-disable-line react-hooks/exhaustive-deps

  // ============================================================
  // Auto-save keep-alive: touch TTL every 5 minutes
  // ============================================================
  const touchTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!cardId) return;

    // Touch immediately on mount / cardId change
    cardService.touch(cardId).catch((err) => {
      console.warn('[CardBuilderEditor] touch failed:', err);
    });

    // Re-touch every 5 minutes to keep the draft alive
    touchTimerRef.current = setInterval(() => {
      if (cardId) {
        cardService.touch(cardId).catch((err) => {
          console.warn('[CardBuilderEditor] touch keep-alive failed:', err);
        });
      }
    }, 5 * 60 * 1000);

    return () => {
      if (touchTimerRef.current) {
        clearInterval(touchTimerRef.current);
        touchTimerRef.current = null;
      }
    };
  }, [cardId]);

  async function handleStepChange(newStep: EditorStep) {
    if (newStep < step) {
      setStep(newStep);
      return;
    }

    // Read current values directly from store to avoid stale closure
    const currentCardType = useCardBuilderStore.getState().cardType;
    const currentName = useCardBuilderStore.getState().name;

    if (newStep === 2 && currentCardType) {
      // Step 1 完成：建立草稿，存入 name + cardType
      try {
        const template = await cardService.create({
          name: currentName || '未命名卡片',
          cardType: currentCardType,
        });
        setCardId(template.id);
      } catch (err) {
        console.error('Failed to create draft on Step 1 complete:', err);
        return; // 不跳 step
      }
      setCompletedStep(1);
      setStep(newStep);
    } else if (newStep > step) {
      console.log('[handleStepChange] newStep > step, calling setStep:', newStep);
      setStep(newStep);
      console.log('[handleStepChange] setStep called');
    }
  }

  return (
    <div className="flex h-full w-full flex-col overflow-hidden">
      {/* Loading state while fetching template */}
      {isLoading && (
        <div className="flex flex-1 items-center justify-center">
          <div className="text-muted-foreground">Loading...</div>
        </div>
      )}

      {!isLoading && (
        <>
        {/* 上容器：導航列 */}
        <CardBuilderEditorHeader
          name={name}
          onNameChange={setName}
          step={step}
          onStepChange={handleStepChange}
          completedSteps={completedSteps}
          isStep1Blocked={!name.trim() || !cardType}
        />

        {/* 下容器：左右欄位 */}
        <div className="flex flex-1 flex-col overflow-hidden lg:flex-row">
          {/* 左欄位：操作區 — 2/3 寬度 */}
          <CardBuilderEditorWorkspace
            step={step}
            onStepChange={handleStepChange}
            cardType={cardType}
            cardId={cardId}
            onCardTypeChange={useCardBuilderStore.getState().setCardType}
            onSave={async (id, settings) => {
              await cardService.update(id, { settings });
            }}
            onBack={_onBack}
            className="flex-2 lg:w-2/3"
          />

          {/* 右欄位：即時預覽區 — 1/3 寬度，Desktop only */}
          <CardBuilderEditorPreview
            cardSide={cardSide}
            onCardSideChange={setCardSide}
            className="flex-1 lg:w-1/3"
          />
        </div>

        {/* Mobile 預覽面板（Bottom Sheet） */}
        <MobilePreviewPanel
          cardSide={cardSide}
          onCardSideChange={setCardSide}
        />
        </>
      )}
    </div>
  );
}
