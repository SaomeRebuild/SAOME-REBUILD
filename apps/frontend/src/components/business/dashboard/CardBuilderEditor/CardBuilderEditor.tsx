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
 * - 新建模式（無 ?id= URL）：store 為初始狀態
 * - 編輯模式（有 ?id= URL）：mount 時從 API 取得既有的 settings 並載入 store
 * - URL 追蹤：自己監聽 window.location（而非靠父層 prop），這樣 pushState /
 *   navigate 更新 URL 時能即時感應到並 fetch
 */

import { useEffect, useState, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import type { CardBuilderEditorProps, EditorStep } from './CardBuilderEditor.types';
import { CardBuilderEditorHeader } from './CardBuilderEditorHeader';
import { CardBuilderEditorWorkspace } from './CardBuilderEditorWorkspace';
import { CardBuilderEditorPreview } from './CardBuilderEditorPreview';
import { MobilePreviewPanel } from './MobilePreviewPanel';
import { useCardBuilderStore } from './CardBuilderEditor.store';
import { cardService } from '@/services/cardService';

export function CardBuilderEditor({
  onSave: _onSave,
  onBack: _onBack,
}: CardBuilderEditorProps) {
  const [isLoading, setIsLoading] = useState(true);
  const [searchParams] = useSearchParams();

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
    setCardType,
    loadSettings,
    reset,
  } = useCardBuilderStore();

  // 從 URL 讀取 templateId（自己監聽 URL，而非靠父層 prop）
  // 這樣 pushState / navigate 更新 URL 時能即時觸發 fetch
  const templateId = searchParams.get('id');

  // 初始化：根據 URL（新建或編輯）載入資料
  useEffect(() => {
    if (templateId) {
      // 編輯模式：reset 舊的 stale 資料，再 fetch 既有的 template settings
      // 否則上一個 draft 的 storeName/barcodeType 等值會殘留，
      // 而 loadSettings 的 ?? fallback 不會覆蓋這些舊值（因為新值也是空字串）。
      reset();
      setCardId(templateId);
      setIsLoading(true);
      cardService.getById(templateId)
        .then((template) => {
          loadSettings(template.settings);
          // cardType 存在 DB card_type 欄位（不在 settings JSONB），需要獨立設定
          if (template.cardType) {
            setCardType(template.cardType);
          }
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
      setIsLoading(false);
    }
  }, [templateId]); // eslint-disable-line react-hooks/exhaustive-deps

  // ============================================================
  // Auto-save: name changes → debounced PUT /cards/:id
  // ============================================================
  const nameSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!cardId) return;
    if (name === '') return; // Don't save empty name on first mount

    // Debounce: save name 1s after user stops typing
    if (nameSaveTimerRef.current) clearTimeout(nameSaveTimerRef.current);
    nameSaveTimerRef.current = setTimeout(() => {
      cardService.update(cardId, { name }).catch((err) => {
        console.warn('[CardBuilderEditor] name auto-save failed:', err);
      });
    }, 1000);

    return () => {
      if (nameSaveTimerRef.current) clearTimeout(nameSaveTimerRef.current);
    };
  }, [cardId, name]);

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
      // Step 1 完成：cardType 已經知道
      if (!cardId) {
        // 新建：建立草稿（含 cardType）
        try {
          const template = await cardService.create({
            name: currentName || '未命名卡片',
            cardType: currentCardType,
            settings: { isPaid: false },
          });
          setCardId(template.id);
        } catch (err) {
          console.error('Failed to create draft on Step 1 complete:', err);
          return; // 不跳 step
        }
      } else {
        // 繼續：更新既有草稿（從 resume 回來的）
        try {
          await cardService.update(cardId, {
            name: currentName,
            cardType: currentCardType,
          });
        } catch (err) {
          console.error('Failed to update draft on Step 1 continue:', err);
          // 不 block 前進，update 失敗只是沒存到
        }
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
