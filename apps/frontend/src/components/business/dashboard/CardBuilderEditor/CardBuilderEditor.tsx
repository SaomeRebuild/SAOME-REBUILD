/**
 * CardBuilderEditor — 卡片建置器編輯器主組件
 *
 * 佈局結構：
 * - 上容器：CardBuilderEditorHeader（導航列）
 * - 下容器：左右欄位
 *   - 左：CardBuilderEditorWorkspace（操作區）
 *   - 右：CardBuilderEditorPreview（即時預覽區）— Desktop only
 * - Mobile: CardBuilderEditorPreview 改由 MobilePreviewPanel 提供（Bottom Sheet）
 */

import type { CardBuilderEditorProps, EditorStep } from './CardBuilderEditor.types';
import { CardBuilderEditorHeader } from './CardBuilderEditorHeader';
import { CardBuilderEditorWorkspace } from './CardBuilderEditorWorkspace';
import { CardBuilderEditorPreview } from './CardBuilderEditorPreview';
import { MobilePreviewPanel } from './MobilePreviewPanel';
import { useCardBuilderStore } from './CardBuilderEditor.store';

export function CardBuilderEditor({
  initialName = '',
  onSave: _onSave,
  onBack: _onBack,
}: CardBuilderEditorProps) {
  // 使用 store 管理卡片編輯器狀態
  const {
    name,
    cardType,
    step,
    completedSteps,
    cardSide,
    setName,
    setStep,
    setCompletedStep,
    setCardSide,
  } = useCardBuilderStore();

  // 初始化名稱（只在 mount 時執行一次）
  if (name === '' && initialName !== '') {
    setName(initialName);
  }

  function handleStepChange(newStep: EditorStep) {
    if (newStep < step) {
      setStep(newStep);
      return;
    }

    if (newStep === 2 && cardType) {
      setCompletedStep(1);
      setStep(newStep);
    } else if (newStep > step) {
      setStep(newStep);
    }
  }

  return (
    <div className="flex h-full w-full flex-col overflow-hidden">
      {/* 上容器：導航列 */}
      <CardBuilderEditorHeader
        name={name}
        onNameChange={setName}
        step={step}
        onStepChange={handleStepChange}
        completedSteps={completedSteps}
      />

      {/* 下容器：左右欄位 */}
      <div className="flex flex-1 flex-col overflow-hidden lg:flex-row">
        {/* 左欄位：操作區 — 2/3 寬度 */}
        <CardBuilderEditorWorkspace
          step={step}
          onStepChange={handleStepChange}
          cardType={cardType}
          onCardTypeChange={useCardBuilderStore.getState().setCardType}
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
    </div>
  );
}
