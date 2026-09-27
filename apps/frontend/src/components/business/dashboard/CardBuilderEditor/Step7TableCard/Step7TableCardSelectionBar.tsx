/**
 * Step7TableCardSelectionBar — persistent selection bar showing
 * delete + color controls for the currently-selected canvas element.
 *
 * @module components/business/dashboard/CardBuilderEditor/Step7TableCard/Step7TableCardSelectionBar
 * @description Sits at the top of every Inspector panel (regardless of
 * active tool) whenever an element is selected. Solves Issues 5 & 6:
 *   - Delete button always visible — switching tools no longer hides it.
 *   - Color swatch always visible — switching tools no longer hides
 *     the per-element color picker.
 *
 * Round 4 — also displays the creation-order element number (`形狀 8`)
 * so the user can identify which element they are operating. The number
 * is computed by the Inspector's `indexById` map (1-based, stable
 * across zIndex changes) and passed in via the `indexNumber` prop.
 *
 * Pulls color field mapping per element type:
 *   - text  → text.color
 *   - shape → shape.fill
 *   - image → locked (image has no color concept)
 *
 * Selection state lives in the parent (Step7TableCardSidebar /
 * Step7TableCard) — this component is presentational + dispatcher.
 */

import { useTranslation } from 'react-i18next';
import { Trash2, Type, Image as ImageIcon, Square, Lock } from 'lucide-react';
import { useCardBuilderStore } from '../CardBuilderEditor.store';
import type { TableCardElement } from '@saome/shared/schemas/card';

interface Props {
  /** Currently-selected element (null hides the bar entirely). */
  selectedElement: TableCardElement | null;
  /**
   * Round 4 — 1-based creation-order index of the selected element
   * (mirrors the layers list row). When provided, rendered as
   * `形狀 元素 8` (zh) / `Shape Element 8` (en) so the user can tell
   * which element they are operating without opening the layers panel.
   * `null` / `undefined` hides the number suffix.
   */
  indexNumber?: number | null;
}

export function Step7TableCardSelectionBar({ selectedElement, indexNumber }: Props) {
  const { t } = useTranslation('tableCard');
  const removeElement = useCardBuilderStore((s) => s.removeTableCardElement);
  const updateElement = useCardBuilderStore((s) => s.updateTableCardElement);

  if (!selectedElement) return null;

  // Per-type color field mapping. Image has no color — show locked icon.
  const isImage = selectedElement.type === 'image';
  const currentColor =
    selectedElement.type === 'text'
      ? selectedElement.color
      : selectedElement.type === 'shape'
        ? selectedElement.fill
        : null;

  const icon =
    selectedElement.type === 'text' ? (
      <Type className="h-4 w-4" aria-hidden="true" />
    ) : selectedElement.type === 'image' ? (
      <ImageIcon className="h-4 w-4" aria-hidden="true" />
    ) : (
      <Square className="h-4 w-4" aria-hidden="true" />
    );

  const typeLabel =
    selectedElement.type === 'text'
      ? t('selectionBar.typeText')
      : selectedElement.type === 'image'
        ? t('selectionBar.typeImage')
        : t('selectionBar.typeShape');

  // Round 4 — display element number when the Inspector supplies it.
  // Example: "形狀 元素 8" / "Shape Element 8".
  const numberLabel =
    indexNumber != null && Number.isInteger(indexNumber) && indexNumber > 0
      ? ` ${t('selectionBar.elementNumber', { num: indexNumber })}`
      : '';

  const handleColorChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (selectedElement.type === 'text') {
      updateElement(selectedElement.id, { color: e.target.value });
    } else if (selectedElement.type === 'shape') {
      updateElement(selectedElement.id, { fill: e.target.value });
    }
  };

  const handleDelete = () => {
    if (!window.confirm(t('selectionBar.deleteConfirm'))) return;
    removeElement(selectedElement.id);
  };

  return (
    <div
      role="region"
      aria-label={`${t('selectionBar.selected', { type: typeLabel })}${numberLabel}`}
      className="flex items-center gap-2 border-b border-border bg-muted/30 px-2 py-1.5"
    >
      <div className="flex min-w-0 items-center gap-1.5 text-sm font-medium text-foreground">
        {icon}
        <span className="truncate">
          {typeLabel}
          {numberLabel}
        </span>
      </div>

      <div className="ml-auto flex items-center gap-1">
        {isImage ? (
          <span
            title={t('selectionBar.colorLockedHint')}
            aria-label={t('selectionBar.colorLockedHint')}
            className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-border bg-muted/40 text-muted-foreground"
          >
            <Lock className="h-3.5 w-3.5" aria-hidden="true" />
          </span>
        ) : (
          <label
            className="relative inline-flex h-7 w-7 cursor-pointer items-center justify-center overflow-hidden rounded-md border border-border"
            title={t('selectionBar.colorLabel')}
            aria-label={t('selectionBar.colorLabel')}
          >
            <span
              aria-hidden="true"
              className="absolute inset-0.5 rounded-sm"
              style={{ backgroundColor: currentColor ?? '#000000' }}
            />
            <input
              type="color"
              value={currentColor ?? '#000000'}
              onChange={handleColorChange}
              className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
            />
          </label>
        )}

        <button
          type="button"
          onClick={handleDelete}
          title={t('selectionBar.deleteButton')}
          aria-label={t('selectionBar.deleteButton')}
          data-testid="selection-bar-delete"
          className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-border text-destructive transition-colors hover:bg-destructive/10"
        >
          <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}

export default Step7TableCardSelectionBar;