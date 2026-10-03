/**
 * Step7MobileToolbar — horizontal icon-only toolbar fixed at the bottom.
 *
 * @module components/business/dashboard/CardBuilderEditor/Step7TableCard/Step7MobileToolbar
 * @description Mobile-only (<lg) horizontal toolbar fixed at the bottom
 * of the viewport. Tapping a tool toggles `activeTool`; the parent
 * opens the `Step7MobileInspectorSheet` to show the inspector.
 *
 * iOS safe-area-inset is respected via `pb-[env(safe-area-inset-bottom)]`.
 *
 * Sits OUTSIDE `Step7TableCardSidebar` (which is desktop-only) so it
 * renders independently of the desktop aside's `display: none`.
 */

import { useTranslation } from 'react-i18next';
import { Type, Image as ImageIcon, Square, Layers, Palette, QrCode } from 'lucide-react';
import type { ReactElement } from 'react';
import type { ToolKey } from './Step7TableCard.types';

interface Props {
  activeTool: ToolKey;
  onToolChange: (tool: ToolKey) => void;
}

const TOOLS: Array<{ key: ToolKey; icon: ReactElement; i18nKey: string }> = [
  { key: 'text', icon: <Type className="h-4 w-4" aria-hidden="true" />, i18nKey: 'tools.text' },
  { key: 'image', icon: <ImageIcon className="h-4 w-4" aria-hidden="true" />, i18nKey: 'tools.image' },
  // 2026-10-04 — QR Code tool (Step 7 桌牌設計).
  // Mobile toolbar mirrors desktop toolbar order; see Step7TableCardToolbar.
  { key: 'qrcode', icon: <QrCode className="h-4 w-4" aria-hidden="true" />, i18nKey: 'tools.qrcode' },
  { key: 'background', icon: <Palette className="h-4 w-4" aria-hidden="true" />, i18nKey: 'tools.background' },
  { key: 'shape', icon: <Square className="h-4 w-4" aria-hidden="true" />, i18nKey: 'tools.shape' },
  { key: 'layers', icon: <Layers className="h-4 w-4" aria-hidden="true" />, i18nKey: 'tools.layers' },
];

export function Step7MobileToolbar({ activeTool, onToolChange }: Props) {
  const { t } = useTranslation('tableCard');
  return (
    <nav
      aria-label={t('tools.ariaLabel')}
      data-testid="step7-mobile-toolbar"
      data-testid-translucent="true"
      className="
        fixed inset-x-0 bottom-0 z-30 flex justify-around border-t border-border
        bg-card/60 backdrop-blur-md backdrop-saturate-150
        px-2 pb-[env(safe-area-inset-bottom)] shadow-[0_-2px_8px_rgba(0,0,0,0.06)]
        lg:hidden
      "
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
              inline-flex h-12 min-w-[44px] items-center justify-center gap-2 rounded-md border-2 px-2 text-sm font-medium transition-colors
              ${
                isActive
                  ? 'border-primary text-foreground bg-card'
                  : 'border-transparent text-muted-foreground hover:bg-muted hover:text-foreground'
              }
            `}
          >
            {tool.icon}
          </button>
        );
      })}
    </nav>
  );
}

export default Step7MobileToolbar;
