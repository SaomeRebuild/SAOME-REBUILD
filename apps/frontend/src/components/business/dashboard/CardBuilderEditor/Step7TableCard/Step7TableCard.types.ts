/**
 * Step7TableCard — 客製化桌牌 component types.
 *
 * @module components/business/dashboard/CardBuilderEditor/Step7TableCard/Step7TableCard.types
 * @description TypeScript types specific to the Step 7 Table Card editor.
 * Re-exports shared schemas where possible (Rule 019 single source of truth).
 */

import type {
  TableCardElement,
  TableCardSettings,
} from '@saome/shared/schemas/card';
import type { RefObject } from 'react';
import type Konva from 'konva';

/** 5-state machine for the export button. */
export type ExportState =
  | 'idle'
  | 'generating'
  | 'ready'
  | 'stale'
  | 'error';

/** Active tool in the right-side toolbar. */
export type ToolKey = 'text' | 'image' | 'background' | 'shape' | 'layers';

/**
 * Step 7 main component props.
 * Connects to the global CardBuilder store; no props for now — future
 * hooks may pass selectedId / stageRef down explicitly.
 */
export interface Step7TableCardProps {
  /** Optional callback when an export succeeds (e.g. toast). */
  onExportSuccess?: (exportKey: string) => void;
  /** Optional callback when an export fails (e.g. error toast). */
  onExportError?: (errorMessage: string) => void;
}

/** Shape passed to the canvas from the parent. */
export interface Step7CanvasProps {
  /** Konva Stage ref owned by the parent (parent owns the lifecycle). */
  stageRef: RefObject<Konva.Stage | null>;
  /**
   * Template (card) UUID — required to build public image URLs for
   * `image` elements via `GET /api/cards/:cardId/table-card/element/image/:elementId`.
   */
  cardId: string | null;
  tableCard: TableCardSettings;
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  onChange: (element: TableCardElement) => void;
  onAdd: (element: TableCardElement) => void;
  readonly?: boolean;
}

/** Right-side panel props (toolbar + inspector context). */
export interface Step7ToolbarProps {
  activeTool: ToolKey;
  onToolChange: (tool: ToolKey) => void;
}

/** Inspector — context-aware editor for the selected element. */
export interface Step7InspectorProps {
  activeTool: ToolKey;
  selectedElement: TableCardElement | null;
}
