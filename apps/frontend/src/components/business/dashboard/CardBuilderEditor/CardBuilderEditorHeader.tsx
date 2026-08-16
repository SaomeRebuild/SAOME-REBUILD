/**
 * CardBuilderEditorHeader — 上容器：導航列
 * 包含 h1 標題、卡片名稱輸入框、步驟指示器
 */

import { useTranslation } from 'react-i18next';
import type { EditorStep } from './CardBuilderEditor.types';
import { CardBuilderEditorSteps } from './CardBuilderEditorSteps';
import { Building2 } from 'lucide-react';

interface CardBuilderEditorHeaderProps {
  name: string;
  onNameChange: (name: string) => void;
  step: EditorStep;
  onStepChange: (step: EditorStep) => void;
  completedSteps?: Set<EditorStep>;
}

export function CardBuilderEditorHeader({
  name,
  onNameChange,
  step,
  onStepChange,
  completedSteps,
}: CardBuilderEditorHeaderProps) {
  const { t } = useTranslation('cardEditor');

  return (
    <header className="flex flex-col gap-4 border-b border-border bg-card p-4 sm:flex-row sm:items-center sm:justify-between sm:gap-6">
      {/* 左：h1 標題 */}
      <h1
        className="flex items-center gap-2 text-xl font-bold text-foreground"
        style={{ fontFamily: 'var(--font-family-heading)' }}
      >
        <Building2 size={20} className="text-muted-foreground" aria-hidden="true" />
        {t('pageTitle')}
      </h1>

      {/* 中：卡片名稱輸入框 */}
      <div className="flex-1 sm:max-w-xs">
        <label htmlFor="card-name" className="sr-only">
          {t('cardNameLabel')}
        </label>
        <input
          id="card-name"
          type="text"
          value={name}
          onChange={(e) => onNameChange(e.target.value)}
          placeholder={t('cardNamePlaceholder')}
          className="
            w-full rounded-lg border border-border bg-muted px-4 py-2
            text-sm text-foreground placeholder:text-muted-foreground
            transition-colors duration-150
            focus:border-primary focus:outline-none focus:ring-2 focus:ring-ring
          "
        />
      </div>

      {/* 右：步驟指示器 */}
      <CardBuilderEditorSteps
        currentStep={step}
        onStepClick={onStepChange}
        completedSteps={completedSteps}
      />
    </header>
  );
}
