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

import { useState } from 'react';
import type { CardBuilderEditorProps, CardType, EditorStep } from './CardBuilderEditor.types';
import { CardBuilderEditorHeader } from './CardBuilderEditorHeader';
import { CardBuilderEditorWorkspace } from './CardBuilderEditorWorkspace';
import { CardBuilderEditorPreview } from './CardBuilderEditorPreview';
import { MobilePreviewPanel } from './MobilePreviewPanel';

export function CardBuilderEditor({
  initialName = '',
  onSave: _onSave,
  onBack: _onBack,
}: CardBuilderEditorProps) {
  const [name, setName] = useState(initialName);
  const [step, setStep] = useState<EditorStep>(1);
  const [cardType, setCardType] = useState<CardType | null>(null);
  const [completedSteps, setCompletedSteps] = useState<Set<EditorStep>>(new Set());

  function handleStepChange(newStep: EditorStep) {
    if (newStep < step) {
      setStep(newStep);
      return;
    }

    if (newStep === 2 && cardType) {
      setCompletedSteps((prev) => new Set([...prev, 1]));
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
          onCardTypeChange={setCardType}
          onBack={_onBack}
          className="flex-2 lg:w-2/3"
        />

        {/* 右欄位：即時預覽區 — 1/3 寬度，Desktop only */}
        <CardBuilderEditorPreview
          name={name}
          cardType={cardType}
          className="flex-1 lg:w-1/3"
        />
      </div>

      {/* Mobile 預覽面板（Bottom Sheet） */}
      <MobilePreviewPanel name={name} cardType={cardType} />
    </div>
  );
}
