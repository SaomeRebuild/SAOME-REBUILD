/**
 * CardBuilderEditorSteps — step indicator (Linear Pills style)
 *
 * Features:
 * - 8 small pills laid out horizontally to save space
 * - Wrapped in a rounded container so right-aligned usage still reads as
 *   one cohesive group
 * - Hover tooltip shows the full label
 * - Completed steps render a filled background + Check icon
 * - Current step renders a primary color ring
 * - Mobile: shows the progress text (no pills)
 * - Tablet+: shows the full pills + progress label
 *
 * 2026-10-26 — step 8 labelKey changed from 'steps.save' to
 * 'steps.save.title'. The 'cardEditor.steps.save' key was restructured
 * from a flat string into a nested object (title / summary / publish / …)
 * on 2026-10-06, but this file was never updated. i18next resolves
 * 'steps.save' to an object, and with `returnObjects` disabled it falls
 * back to the literal string
 * "key 'steps.save (zh-TW)' returned an object instead of string.",
 * which surfaced as the step-8 progress label (8/8) and as the step-8
 * pill tooltip on every step.
 *
 * Every labelKey below MUST point at a leaf (string-valued) translation
 * key. `npm run verify:i18n` (Check 6) enforces this statically.
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
  { key: 8, labelKey: 'steps.save.title' },
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

      {/* Step Progress Label — left aligned */}
      <div>
        <span className="text-xs font-medium text-muted-foreground">
          {t(STEP_KEYS[currentStep - 1].labelKey)} ({currentStep}/8)
        </span>
      </div>
    </div>
  );
}
