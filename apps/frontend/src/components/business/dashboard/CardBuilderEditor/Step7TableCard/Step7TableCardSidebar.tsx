/**
 * Step7TableCardSidebar — toolbar + Inspector container for Step 7.
 *
 * @module components/business/dashboard/CardBuilderEditor/Step7TableCard/Step7TableCardSidebar
 * @description Renders the desktop sidebar for Step 7: vertical 5-tool
 * toolbar (text/image/background/shape/layers) at top + context-aware
 * Inspector below. Sits in the parent `CardBuilderEditor`'s right column
 * when `step === 7` (Issue 8).
 *
 * State model:
 *   - The parent (`CardBuilderEditor`) owns `activeTool` / `selectedId` and
 *     passes them as override props. This lets the canvas in the left
 *     column + this sidebar in the right column share the same selection
 *     and tool state without prop drilling through the workspace tree.
 *   - When override props are NOT provided, internal state is used (legacy
 *     fallback for tests or embedded usage).
 *
 * `selectedElement` is always derived from the store via `selectedId` —
 * never duplicated as local state.
 *
 * Mobile UI is NOT here — see `Step7MobileToolbar` + `Step7MobileInspectorSheet`
 * rendered by `CardBuilderEditor` at the page level.
 */

import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useCardBuilderStore } from '../CardBuilderEditor.store';
import { Step7TableCardToolbar } from './Step7TableCardToolbar';
import { Step7TableCardInspector } from './Step7TableCardInspector';
import type {
  Step7InspectorProps,
  Step7ToolbarProps,
  ToolKey,
} from './Step7TableCard.types';

interface Props {
  /**
   * Override for selectedId (used by Canvas to drive selection highlight).
   * Defaults to internal state.
   */
  selectedIdOverride?: string | null;
  /**
   * Override for activeTool (used when sidebar is embedded and parent
   * owns the tool state — e.g. mobile bottom sheet). Falls back to
   * internal state.
   */
  activeToolOverride?: ToolKey;
  onActiveToolChangeOverride?: (tool: ToolKey) => void;
}

export function Step7TableCardSidebar(props: Props) {
  const { t } = useTranslation('tableCard');
  const tableCard = useCardBuilderStore((s) => s.tableCard);
  const [internalActiveTool, setInternalActiveTool] = useState<ToolKey>('text');
  const [internalSelectedId] = useState<string | null>(null);

  const activeTool = props.activeToolOverride ?? internalActiveTool;
  const setActiveTool = props.onActiveToolChangeOverride ?? setInternalActiveTool;
  const selectedId = props.selectedIdOverride ?? internalSelectedId;

  const selectedElement =
    tableCard.elements.find((el) => el.id === selectedId) ?? null;

  const toolbarProps: Step7ToolbarProps = {
    activeTool,
    onToolChange: setActiveTool,
  };
  const inspectorProps: Step7InspectorProps = {
    activeTool,
    selectedElement,
  };

  return (
    <aside
      aria-label={t('rightSidebar.ariaLabel')}
      data-testid="step7-sidebar"
      className="flex min-w-0 flex-col gap-3"
    >
      <Step7TableCardToolbar {...toolbarProps} />
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-lg border border-border bg-card shadow-sm">
        <Step7TableCardInspector {...inspectorProps} />
      </div>
    </aside>
  );
}

export default Step7TableCardSidebar;
