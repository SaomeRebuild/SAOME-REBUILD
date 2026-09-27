/**
 * Step7TableCardToolbar — vertical 5-tool selector (desktop).
 *
 * @module components/business/dashboard/CardBuilderEditor/Step7TableCard/Step7TableCardToolbar
 * @description Desktop-only vertical icon+label toolbar that lives in
 * the right-side sidebar. Mobile users see a separate bottom toolbar
 * rendered directly by `Step7TableCard` (see
 * `Step7MobileInspectorSheet` for the mobile inspector sheet).
 *
 * Active state uses the orange-outline visual language (Issue 1):
 *   - active   → border-primary + bg-card
 *   - inactive → border-transparent + bg-transparent
 * `border-transparent` baseline prevents layout shift on toggle.
 */

import { useTranslation } from 'react-i18next';
import { Type, Image as ImageIcon, Square, Layers, Palette } from 'lucide-react';
import type { ReactElement } from 'react';
import type { ToolKey } from './Step7TableCard.types';

interface Props {
  activeTool: ToolKey;
  onToolChange: (tool: ToolKey) => void;
}

const TOOLS: Array<{ key: ToolKey; icon: ReactElement; i18nKey: string }> = [
  { key: 'text', icon: <Type className="h-4 w-4" aria-hidden="true" />, i18nKey: 'tools.text' },
  { key: 'image', icon: <ImageIcon className="h-4 w-4" aria-hidden="true" />, i18nKey: 'tools.image' },
  { key: 'background', icon: <Palette className="h-4 w-4" aria-hidden="true" />, i18nKey: 'tools.background' },
  { key: 'shape', icon: <Square className="h-4 w-4" aria-hidden="true" />, i18nKey: 'tools.shape' },
  { key: 'layers', icon: <Layers className="h-4 w-4" aria-hidden="true" />, i18nKey: 'tools.layers' },
];

export function Step7TableCardToolbar({ activeTool, onToolChange }: Props) {
  const { t } = useTranslation('tableCard');
  return (
    <nav
      aria-label={t('tools.ariaLabel')}
      data-testid="step7-toolbar"
      className="flex flex-col gap-1 rounded-lg border border-border bg-card p-2 shadow-sm"
    >
      {TOOLS.map((tool) => {
        const isActive = tool.key === activeTool;
        return (
          <button
            key={tool.key}
            type="button"
            onClick={() => onToolChange(tool.key)}
            data-tool={tool.key}
            data-active={isActive}
            aria-pressed={isActive}
            title={t(tool.i18nKey)}
            className={`
              inline-flex h-9 w-full items-center gap-2 rounded-md border-2 px-2.5 text-sm font-medium transition-colors
              ${
                isActive
                  ? 'border-primary text-foreground bg-card'
                  : 'border-transparent text-muted-foreground hover:bg-muted hover:text-foreground'
              }
            `}
          >
            {tool.icon}
            <span>{t(tool.i18nKey)}</span>
          </button>
        );
      })}
    </nav>
  );
}

export default Step7TableCardToolbar;
