/**
 * CardBuilderEditorSteps — 步驟指示器
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
  { key: 5, labelKey: 'steps.customizePlaceCard' },
  { key: 6, labelKey: 'steps.save' },
];

export function CardBuilderEditorSteps({
  currentStep,
  onStepClick,
  completedSteps = new Set(),
}: CardBuilderEditorStepsProps) {
  const { t } = useTranslation('cardEditor');

  return (
    <nav aria-label="Card builder steps" className="flex items-center gap-2">
      {STEP_KEYS.map((step, index) => {
        const isCompleted = completedSteps.has(step.key) || currentStep > step.key;
        const isCurrent = currentStep === step.key;
        const isClickable = isCompleted || isCurrent;

        return (
          <div key={step.key} className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => isClickable && onStepClick(step.key)}
              disabled={!isClickable}
              className={`
                flex h-8 min-w-8 items-center justify-center rounded-full border px-2 text-xs font-semibold
                transition-colors duration-150
                ${isCompleted
                  ? 'border-success bg-success/20 text-success hover:bg-success/30'
                  : isCurrent
                    ? 'border-primary bg-primary/20 text-primary'
                    : 'border-muted-foreground/30 text-muted-foreground'
                }
                ${isClickable ? 'cursor-pointer' : 'cursor-not-allowed'}
              `}
              aria-label={`${t(step.labelKey)} (${isClickable ? '可點擊' : '未完成'})`}
            >
              {isCompleted ? <Check size={14} aria-hidden="true" /> : step.key}
            </button>
            <button
              type="button"
              onClick={() => isClickable && onStepClick(step.key)}
              disabled={!isClickable}
              className={`
                hidden text-sm font-medium transition-colors duration-150 sm:block
                ${isCurrent ? 'text-foreground' : 'text-muted-foreground'}
                ${isClickable ? 'cursor-pointer hover:text-primary' : 'cursor-not-allowed'}
              `}
            >
              {t(step.labelKey)}
            </button>
            {index < STEP_KEYS.length - 1 && (
              <div
                className={`
                  hidden h-px w-6 bg-border sm:block
                  ${isCompleted ? 'bg-success' : ''}
                `}
                aria-hidden="true"
              />
            )}
          </div>
        );
      })}
    </nav>
  );
}
