/**
 * Step7TableCard — 客製化桌牌 canvas (≤ 100 行組裝).
 *
 * @module components/business/dashboard/CardBuilderEditor/Step7TableCard
 * @description Layout for Step 7: Konva canvas + canvas-specific state
 * (FAB removed in favor of Header inline button — Issue 7).
 *
 * After Issue 8 refactor (2026-09-27), the toolbar + inspector live in
 * `Step7TableCardSidebar` which is rendered by the parent
 * `CardBuilderEditor` in its right column when `step === 7`. This file
 * only renders the canvas itself.
 *
 * State / orchestration lifted to the parent:
 *   - `stageRef`, `activeTool`, `selectedId` → from parent
 *   - Export button → Header (via `headerActions` slot)
 *
 * The canvas-only role keeps this file well under the 100-line L2 limit
 * (Rule 000 § A.2).
 */

import { useRef } from 'react';
import type { RefObject } from 'react';
import type Konva from 'konva';
import { useTranslation } from 'react-i18next';
import { useCardBuilderStore } from '../CardBuilderEditor.store';
import { Step7TableCardCanvas } from './Step7TableCardCanvas.web';
import type { ToolKey } from './Step7TableCard.types';

interface Props {
  /**
   * Konva stage ref. Owned by the parent (CardBuilderEditor) so the
   * Header export button + canvas share the same stage instance.
   * Optional — if not provided, an internal ref is created (legacy /
   * test fallback).
   */
  stageRef?: RefObject<Konva.Stage | null>;
  /** Currently-selected element id (shared with sidebar). */
  selectedId: string | null;
  /** Callback when the canvas selects an element. */
  onSelect: (id: string | null) => void;
  /** Currently-active tool (shared with sidebar — drives Inspector panel). */
  activeTool: ToolKey;
}

export function Step7TableCard({
  stageRef: externalStageRef,
  selectedId,
  onSelect,
  activeTool: _activeTool,
}: Props) {
  const { t } = useTranslation('tableCard');
  const tableCard = useCardBuilderStore((s) => s.tableCard);
  const cardId = useCardBuilderStore((s) => s.cardId);
  const updateElement = useCardBuilderStore((s) => s.updateTableCardElement);

  // Fallback stage ref for legacy / test callers that don't pass one.
  const internalStageRef = useRef<Konva.Stage | null>(null);
  const stageRef = externalStageRef ?? internalStageRef;

  return (
    <div className="flex min-w-0 flex-col gap-2 pb-16 lg:pb-0">
      {/*
        Canvas container.
        - `overflow-hidden` clips the Stage if the Konva scale misses for any reason.
        - `flex items-center justify-center` keeps the Stage horizontally centered
          on mobile viewports where it scales below its natural 595px width.
      */}
      <div className="flex items-center justify-center overflow-hidden rounded-lg border border-border bg-muted/30 p-2 shadow-sm sm:p-4">
        <Step7TableCardCanvas
          stageRef={stageRef}
          cardId={cardId}
          tableCard={tableCard}
          selectedId={selectedId}
          onSelect={onSelect}
          onChange={(el) => updateElement(el.id, el)}
          onAdd={() => {
            /* unused — Toolbar + Inspector handle adds via the right sidebar */
          }}
        />
      </div>
      <p className="text-xs text-muted-foreground" aria-live="polite">
        {t('canvas.addElementHint')}
      </p>
    </div>
  );
}

export default Step7TableCard;
