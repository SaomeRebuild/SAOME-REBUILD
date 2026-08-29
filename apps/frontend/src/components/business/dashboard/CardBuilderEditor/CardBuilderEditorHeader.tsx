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
  /** Step 1 的驗證狀態（由 Workspace 計算後傳入） */
  isStep1Blocked?: boolean;
}

export function CardBuilderEditorHeader({
  name,
  onNameChange,
  step,
  onStepChange,
  completedSteps,
  isStep1Blocked = false,
}: CardBuilderEditorHeaderProps) {
  const { t } = useTranslation('cardEditor');

  return (
    <header className="border-b border-border bg-card p-4">
      {/* 第一行：水平排列（標題靠左、步驟靠右）
          - flex-wrap: 窄螢幕（≤ 412px）時允許換行，避免 h1 + 步驟 + gap-6
            的合計 min-content 超過 header 寬度，導致 flex 父層被撐開 14-29px。
            標題與步驟在夠寬時仍並排（justify-between），手機上會自動換成上下兩列。
          - min-w-0: 防禦性，確保子元素不被自身的 min-content 撐大父層。 */}
      <div className="mb-4 flex flex-wrap items-center justify-between gap-x-6 gap-y-2">
        {/* 左側：標題 */}
        <h1
          className="flex items-center gap-2 text-xl font-bold text-foreground shrink-0"
          style={{ fontFamily: 'var(--font-family-heading)' }}
        >
          <Building2 size={20} className="text-muted-foreground" aria-hidden="true" />
          {t('pageTitle')}
        </h1>

        {/* 右側：步驟指示器 */}
        <CardBuilderEditorSteps
          currentStep={step}
          onStepClick={onStepChange}
          completedSteps={completedSteps}
        />
      </div>

      {/* 第二行：卡片名稱輸入框（獨占一行，不被步驟壓縮） */}
      <div className="max-w-md">
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
        {/* 卡片名稱必填警示（名稱為空時隨時顯示） */}
        {isStep1Blocked && (
          <p
            className="mt-1.5 flex items-center gap-1.5 text-xs"
            style={{ color: 'var(--color-destructive)' }}
            role="alert"
          >
            <span aria-hidden="true">⚠</span>
            {t('step1.nameRequired')}
          </p>
        )}
      </div>
    </header>
  );
}
