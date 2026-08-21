/**
 * CardBuilderEditorSteps — 步驟指示器（Linear Pills 風格）
 *
 * 特色：
 * - 8 個小膠囊排列，節省空間
 * - 包在圓潤背景容器內，右對齊時仍是統一整體
 * - Hover tooltip 顯示完整標籤
 * - 已完成步驟顯示 filled background + Check icon
 * - 當前步驟顯示 primary color ring
 * - Mobile：顯示進度文字（不顯示 Pills）
 * - Tablet+：顯示完整 Pills + 進度標籤
 */

import { useTranslation } from 'react-i18next';
import { Check } from 'lucide-react';
import type { EditorStep } from './CardBuilderEditor.types';

interface CardBuilderEditorStepsProps {
  currentStep: EditorStep;
  onStepClick: (step: EditorStep) => void;
  completedSteps?: Set<EditorStep>;
}

const STEP_KEYS: Array<{ key: EditorStep; labelKey: string }> = [
  { key: 1, labelKey: 'steps.selectType' },
  { key: 2, labelKey: 'steps.cardSettings' },
  { key: 3, labelKey: 'steps.cardDesign' },
  { key: 4, labelKey: 'steps.cardInfo' },
  { key: 5, labelKey: 'steps.geolocation' },
  { key: 6, labelKey: 'steps.cardLogic' },
  { key: 7, labelKey: 'steps.customizePlaceCard' },
  { key: 8, labelKey: 'steps.save' },
];

export function CardBuilderEditorSteps({
  currentStep,
  onStepClick,
  completedSteps = new Set(),
}: CardBuilderEditorStepsProps) {
  const { t } = useTranslation('cardEditor');

  return (
    <div className="flex flex-col items-start gap-1.5">
      {/* Linear Pills — Tablet+ only (hidden on mobile) */}
      <nav
        aria-label="Card builder steps"
        className="hidden items-center gap-1.5 rounded-lg bg-muted/60 px-3 py-1.5 sm:flex"
      >
        {STEP_KEYS.map((step) => {
          const isCompleted = completedSteps.has(step.key) || currentStep > step.key;
          const isCurrent = currentStep === step.key;
          const isClickable = isCompleted || isCurrent;

          return (
            <button
              key={step.key}
              type="button"
              onClick={() => isClickable && onStepClick(step.key)}
              disabled={!isClickable}
              title={t(step.labelKey)}
              className={`
                flex h-6 min-w-6 items-center justify-center rounded-full
                border text-xs font-semibold transition-all duration-150
                ${isCompleted
                  ? 'border-success bg-success text-success-foreground hover:bg-success/90'
                  : isCurrent
                    ? 'border-primary bg-primary text-on-primary shadow-sm'
                    : 'border-muted-foreground/30 bg-muted/50 text-muted-foreground'
                }
                ${isClickable ? 'cursor-pointer hover:scale-110' : 'cursor-not-allowed'}
              `}
            >
              {isCompleted ? (
                <Check size={12} aria-hidden="true" />
              ) : (
                step.key
              )}
            </button>
          );
        })}
      </nav>

      {/* Step Progress Label — 左對齊 */}
      <div>
        <span className="text-xs font-medium text-muted-foreground">
          {t(STEP_KEYS[currentStep - 1].labelKey)} ({currentStep}/8)
        </span>
      </div>
    </div>
  );
}
