/**
 * CardBuilderEditorHeader — 上容器：導航列
 * 包含 h1 標題、Logo Text 輸入框、步驟指示器
 *
 * 2026-09-13 semantic swap: the input id="card-name" now binds to the
 * Logo Text (pass header text shown next to the issuer logo), NOT to
 * the SQL column `templates.name`. The actual Card Name (record name)
 * is now edited via the Step 2 `CardNameField` (which writes to the SQL
 * column top-level). The Header input stays focused on Logo Text — the
 * most prominent identity element on the pass.
 */

import { useTranslation } from 'react-i18next';
import type { EditorStep } from './CardBuilderEditor.types';
import { CardBuilderEditorSteps } from './CardBuilderEditorSteps';
import { Building2 } from 'lucide-react';

interface CardBuilderEditorHeaderProps {
  /** Logo Text (pass header text). Bound to the input id="logo-text". */
  logoText: string;
  onLogoTextChange: (logoText: string) => void;
  /**
   * Card Name (pass record name). Displayed in the header sub-line so the
   * user can see at a glance which template they're editing, but NOT
   * editable here — the editor is via Step 2's `CardNameField`.
   */
  cardName: string;
  step: EditorStep;
  onStepChange: (step: EditorStep) => void;
  completedSteps?: Set<EditorStep>;
  /**
   * Step 1 的驗證狀態（由 Workspace 計算後傳入）
   *
   * 2026-09-13 swap: blocked-by-empty now keys off Logo Text
   * (`!logoText.trim()`) because that's what the user MUST fill to advance
   * past Step 1. Card Name is a Step 2 concern (the workspace allows it
   * to be edited mid-flow).
   */
  isStep1Blocked?: boolean;
}

export function CardBuilderEditorHeader({
  logoText,
  onLogoTextChange,
  cardName,
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

      {/* Card Name 顯示（唯讀，方便使用者辨識當前模板）.
          2026-09-13 swap: Card Name 不再綁在 header input。實際編輯在 Step 2。 */}
      {cardName && (
        <p className="mb-2 truncate text-xs text-muted-foreground" title={cardName}>
          {t('cardNameDisplay', { cardName })}
        </p>
      )}

      {/* 第二行：Logo Text 輸入框（獨占一行，不被步驟壓縮） */}
      <div className="max-w-md">
        <label htmlFor="logo-text" className="sr-only">
          {t('logoTextLabel')}
        </label>
        <input
          id="logo-text"
          type="text"
          value={logoText}
          onChange={(e) => onLogoTextChange(e.target.value)}
          placeholder={t('logoTextPlaceholder')}
          className="
            w-full rounded-lg border border-border bg-muted px-4 py-2
            text-sm text-foreground placeholder:text-muted-foreground
            transition-colors duration-150
            focus:border-primary focus:outline-none focus:ring-2 focus:ring-ring
          "
        />
        {/* Logo Text 必填警示（為空時隨時顯示）.
            2026-09-13 swap: from `nameRequired` to `logoTextRequired` — same
            shape, new semantic. The alert gates Step 1 "Next" via
            isStep1Blocked in the parent workspace. */}
        {isStep1Blocked && (
          <p
            className="mt-1.5 flex items-center gap-1.5 text-xs"
            style={{ color: 'var(--color-destructive)' }}
            role="alert"
          >
            <span aria-hidden="true">⚠</span>
            {t('step1.logoTextRequired')}
          </p>
        )}
      </div>
    </header>
  );
}
