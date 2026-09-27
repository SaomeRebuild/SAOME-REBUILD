/**
 * Step7TableCardInspector — context-aware right-panel editor.
 *
 * @module components/business/dashboard/CardBuilderEditor/Step7TableCard/Step7TableCardInspector
 * @description Renders the appropriate panel for the active tool:
 *   - text       → text content / size / color inputs
 *   - image      → upload (Issue 2) + replace / remove
 *   - background → solid color / gradient picker + bleed selector
 *   - shape      → shape picker + fill / stroke / corner radius
 *   - layers     → list of elements with reorder / delete
 *
 * Above the tool-specific panel, a persistent <Step7TableCardSelectionBar />
 * shows delete + color swatch for the currently-selected element
 * (Issues 5 & 6 — switching tools no longer hides these controls).
 *
 * All "active option" buttons now use the orange-outline style
 * (Issues 1 & 3 — uniform active state across Step 7).
 *
 * Most fields route through `useCardBuilderStore` setters, which
 * bump `tableCardLastEditedAt` and flip the export state to 'stale'.
 */

import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useCardBuilderStore } from '../CardBuilderEditor.store';
import { cardService } from '@/services/cardService';
import {
  BLEED_OPTIONS_MM,
  MAX_IMAGE_ELEMENTS,
  type TableCardBleedMm,
} from '@saome/shared/constants/table-card';
import { validateTableCardImage } from '@saome/shared/logic/imageCrop';
import type {
  TableCardElement,
  TableCardImageElement,
} from '@saome/shared/schemas/card';
import type { Step7InspectorProps } from './Step7TableCard.types';
import {
  buildPolygonElementFromVertices,
  nextPolygonZIndex,
} from './Step7TableCard.polygonElement';
import { Step7TableCardSelectionBar } from './Step7TableCardSelectionBar';

/**
 * Shared "active option" button className — orange outline (Issues 1 & 3).
 * Replaces the previous `bg-primary text-primary-foreground` filled style.
 *
 * `border-transparent` baseline prevents layout shift when toggling.
 */
const OPTION_BTN_BASE =
  'rounded-md border-2 px-3 py-1 text-sm transition-colors';
const OPTION_BTN_ACTIVE = 'border-primary text-foreground bg-card font-medium';
const OPTION_BTN_INACTIVE =
  'border-transparent bg-background text-foreground hover:bg-muted';

/**
 * Round 4 — layer list icon-button className (Issues 2 & 2-1).
 *
 * `LAYER_BTN_BASE` carries the layout + tactile-feedback transitions
 * shared by the ↑ / ↓ / ✕ buttons:
 *   - `transition-transform active:scale-90` — 10% shrink on press
 *     (Issue 2-1: gives the buttons a tactile response, which the
 *     previous `hover:bg-muted`-only style lacked).
 *   - `disabled:opacity-30 disabled:pointer-events-none` — so the new
 *     boundary-clamped ↑ / ↓ buttons (after the swap-with-neighbor
 *     fix) read as visually inert rather than appearing clickable.
 *   - `focus-visible:ring-2` + `ring-ring` — keyboard focus ring
 *     matches the design system tokens.
 *
 * `LAYER_BTN_DEFAULT` adds the hover/active `bg-muted` highlight for
 * the enabled ↑ / ↓ buttons. `LAYER_BTN_DISABLED` swaps in the
 * reduced-opacity rule for the boundary buttons (the `disabled:`
 * variants in TAILWIND only kick in when the `disabled` attribute is
 * set; declaring an explicit class avoids relying on attribute timing).
 */
const LAYER_BTN_BASE =
  'inline-flex h-6 w-6 items-center justify-center rounded p-0 text-xs transition-transform active:scale-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-30 disabled:pointer-events-none';
const LAYER_BTN_DEFAULT = 'hover:bg-muted active:bg-muted';
const LAYER_BTN_DISABLED = '';

/**
 * Frosted-glass panel container (Round 3 Fix 1).
 *
 * Each Inspector tool section (text / image / background / shape / layers)
 * renders inside this container so the underlying canvas or sheet
 * background shows through with a blurred effect — same visual idiom
 * as `Step7MobileToolbar` (`bg-card/60 backdrop-blur-md`).
 *
 * Without this, 5 tool panels visually fight with whatever is behind
 * them (especially the mobile bottom sheet which has a solid `bg-card`
 * surface) and the user reports the editor "gets constantly disturbed
 * by things underneath".
 */
const INSPECTOR_PANEL_BASE =
  'flex flex-col gap-3 rounded-lg border border-border/50 bg-card/60 p-3 backdrop-blur-md backdrop-saturate-150';

export function Step7TableCardInspector({
  activeTool,
  selectedElement,
}: Step7InspectorProps) {
  const { t } = useTranslation('tableCard');
  const cardId = useCardBuilderStore((s) => s.cardId);
  const tableCard = useCardBuilderStore((s) => s.tableCard);
  const setBackground = useCardBuilderStore((s) => s.setTableCardBackground);
  const setBleed = useCardBuilderStore((s) => s.setTableCardBleed);
  const updateElement = useCardBuilderStore((s) => s.updateTableCardElement);
  const addElement = useCardBuilderStore((s) => s.addTableCardElement);
  const removeElement = useCardBuilderStore((s) => s.removeTableCardElement);
  const reorderElement = useCardBuilderStore((s) => s.reorderTableCardElement);

  // Round 4 — 1-based creation-order index map shared by every tool
  // panel's <Step7TableCardSelectionBar /> (Issue 1) AND the layers
  // list rows. Stable across zIndex changes because it derives from
  // array order (= insertion order), not zIndex.
  const indexById = new Map<string, number>(
    tableCard.elements.map((el, idx) => [el.id, idx + 1] as const),
  );
  const selectedIndexNumber: number | null =
    selectedElement ? indexById.get(selectedElement.id) ?? null : null;

  // ===== Image upload wiring (Issue 2) =====
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  const handleUploadClick = () => {
    setUploadError(null);
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    // Reset the input so the same file can be re-selected after a fix.
    e.target.value = '';
    if (!file) return;
    if (!cardId) {
      setUploadError(t('errors.serverError'));
      return;
    }

    // Client-side validation (Rule 032 § Shared Validation — i18n key).
    const validationError = validateTableCardImage(file);
    if (validationError) {
      const key =
        validationError.type === 'tooLarge'
          ? 'image.validation.tooLarge'
          : 'image.validation.wrongFormat';
      setUploadError(t(key));
      return;
    }

    setIsUploading(true);
    setUploadError(null);
    try {
      const elementId = crypto.randomUUID();
      // Round 3 Fix 6 — pass the actual file MIME type to the upload
      // route so the signed PUT URL carries the matching
      // `Content-Type` header. Without this, JPG uploads produced a
      // signature mismatch (R2 returns SignatureDoesNotMatch) and
      // subsequent GETs returned 204, leaving the canvas placeholder.
      // The Inspector's `accept="image/png,image/jpeg"` and
      // `validateTableCardImage` already gate what MIME types reach
      // here; we narrow to the two valid enum values for the zod
      // request body.
      const contentType: 'image/png' | 'image/jpeg' =
        file.type === 'image/jpeg' ? 'image/jpeg' : 'image/png';
      const { uploadUrl } = await cardService.generateTableCardElementUploadUrl(
        cardId,
        elementId,
        contentType,
      );
      const putRes = await fetch(uploadUrl, {
        method: 'PUT',
        body: file,
        headers: { 'Content-Type': contentType },
      });
      if (!putRes.ok) {
        throw new Error(`R2 PUT failed: ${putRes.status}`);
      }
      const newElement: TableCardImageElement = {
        id: elementId,
        type: 'image',
        x: 30,
        y: 30,
        width: 60,
        height: 40,
        rotation: 0,
        zIndex: nextZIndex(tableCard.elements),
        imageKey: `${cardId}/table-card/${elementId}.png`,
      };
      addElement(newElement);
    } catch (err) {
      console.error('[Step7TableCardInspector] image upload failed:', err);
      setUploadError(t('image.validation.uploadFailed'));
    } finally {
      setIsUploading(false);
    }
  };

  // ===== Round 10 — polygon creation mode wiring (MUST be before any
  //   conditional return so the rule-of-hooks lint check passes).
  // Subscribe to the same store state as the canvas. When the user
  // clicks "新增多邊形", we call startPolygonCreation with a bbox
  // hint positioned at the canvas center; the canvas then takes over
  // pointer handling. The Inspector shows a hint + Cancel button
  // while creation is active. These hooks must execute on every
  // render unconditionally (the Inner pattern below), but the
  // component returns early for other activeTool values; we therefore
  // hoist the polygon store reads above the activeTool branching.
  const polygonCreation = useCardBuilderStore((s) => s.polygonCreation);
  const startPolygonCreation = useCardBuilderStore((s) => s.startPolygonCreation);
  const cancelPolygonCreation = useCardBuilderStore((s) => s.cancelPolygonCreation);
  const finishPolygonCreation = useCardBuilderStore((s) => s.finishPolygonCreation);
  const isDrawingPolygon = polygonCreation !== null;

  if (activeTool === 'text') {
    const textEl =
      selectedElement && selectedElement.type === 'text' ? selectedElement : null;
    return (
      <section
        aria-label={t('text.label')}
        className="flex flex-col"
      >
        {/* Selection bar (Issues 5 & 6) — delete + color always visible.
            Round 4 — also passes indexNumber (Issue 1) so the user can
            identify which element they are operating. */}
        <Step7TableCardSelectionBar
          selectedElement={selectedElement}
          indexNumber={selectedIndexNumber}
        />
        <div className={INSPECTOR_PANEL_BASE}>
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium">{t('text.label')}</span>
          {/*
            Round 6 (2026-09-27) — switched from <input type="text"> to
            <textarea> to support Enter-to-break-line multi-line input.
            maxLength={200} is honored by the textarea element (counter
            includes \n characters; zod schema mirrors this).
            rows={3} gives a comfortable mobile touch target and shows
            enough context that users know they can keep typing.
          */}
          <textarea
            value={textEl?.text ?? ''}
            maxLength={200}
            rows={3}
            placeholder={t('text.placeholder')}
            disabled={!textEl}
            onChange={(e) => {
              if (!textEl) return;
              updateElement(textEl.id, { text: e.target.value });
            }}
            className="resize-y rounded-md border border-border bg-background px-2 py-1 text-sm leading-snug"
          />
          <span className="text-xs text-muted-foreground">
            {t('text.counter', { count: textEl?.text.length ?? 0 })}
          </span>
          <span className="text-xs text-muted-foreground">
            {t('text.lineBreakHint')}
          </span>
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium">
            {t('text.fontSize')} ({t('text.fontSizeUnit')})
          </span>
          <input
            type="number"
            min={1}
            max={120}
            value={textEl?.fontSize ?? 12}
            disabled={!textEl}
            onChange={(e) => {
              if (!textEl) return;
              const v = Number(e.target.value);
              if (Number.isFinite(v) && v > 0) updateElement(textEl.id, { fontSize: v });
            }}
            className="rounded-md border border-border bg-background px-2 py-1 text-sm"
          />
        </label>
        <fieldset className="flex flex-col gap-1">
          <legend className="text-sm font-medium">{t('text.fontWeight')}</legend>
          <div className="flex gap-2">
            {(['normal', 'bold'] as const).map((w) => (
              <button
                key={w}
                type="button"
                disabled={!textEl}
                onClick={() => textEl && updateElement(textEl.id, { fontWeight: w })}
                className={`${OPTION_BTN_BASE} ${
                  textEl?.fontWeight === w ? OPTION_BTN_ACTIVE : OPTION_BTN_INACTIVE
                } ${!textEl ? 'cursor-not-allowed opacity-50' : ''}`}
              >
                {w === 'normal' ? t('text.normal') : t('text.bold')}
              </button>
            ))}
          </div>
        </fieldset>
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium">{t('text.color')}</span>
          <input
            type="color"
            value={textEl?.color ?? '#000000'}
            disabled={!textEl}
            onChange={(e) => textEl && updateElement(textEl.id, { color: e.target.value })}
            className="h-9 w-full rounded-md border border-border bg-background"
          />
        </label>
        {!textEl && (
          <button
            type="button"
            onClick={() => {
              const id = crypto.randomUUID();
              const next: TableCardElement = {
                id,
                type: 'text',
                x: 30,
                y: 30,
                width: 80,
                height: 20,
                rotation: 0,
                zIndex: nextZIndex(tableCard.elements),
                text: t('text.placeholder'),
                fontSize: 12,
                fontWeight: 'normal',
                color: '#000000',
              };
              addElement(next);
            }}
            className="rounded-md border border-primary bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            + {t('text.label')}
          </button>
        )}
        </div>
      </section>
    );
  }

  if (activeTool === 'background') {
    const bg = tableCard.background;
    return (
      <section aria-label={t('background.type')} className="flex flex-col">
        <Step7TableCardSelectionBar
          selectedElement={selectedElement}
          indexNumber={selectedIndexNumber}
        />
        <div className={INSPECTOR_PANEL_BASE}>
        <fieldset className="flex flex-col gap-1">
          <legend className="text-sm font-medium">{t('background.type')}</legend>
          <div className="flex gap-2">
            {(['solid', 'gradient'] as const).map((kind) => (
              <button
                key={kind}
                type="button"
                onClick={() => {
                  if (kind === 'solid') {
                    setBackground({ type: 'solid', color: bg.color ?? '#ffffff' });
                  } else {
                    setBackground({
                      type: 'gradient',
                      gradient: bg.gradient ?? { from: '#ffffff', to: '#cccccc', angle: 0 },
                    });
                  }
                }}
                className={`${OPTION_BTN_BASE} ${
                  bg.type === kind ? OPTION_BTN_ACTIVE : OPTION_BTN_INACTIVE
                }`}
              >
                {kind === 'solid' ? t('background.solid') : t('background.gradient')}
              </button>
            ))}
          </div>
        </fieldset>
        {bg.type === 'solid' ? (
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium">{t('background.color')}</span>
            <input
              type="color"
              value={bg.color ?? '#ffffff'}
              onChange={(e) => setBackground({ type: 'solid', color: e.target.value })}
              className="h-9 w-full rounded-md border border-border bg-background"
            />
          </label>
        ) : (
          bg.gradient && (
            <>
              <label className="flex flex-col gap-1 text-sm">
                <span className="font-medium">{t('background.from')}</span>
                <input
                  type="color"
                  value={bg.gradient.from}
                  onChange={(e) =>
                    setBackground({
                      type: 'gradient',
                      gradient: { ...bg.gradient!, from: e.target.value },
                    })
                  }
                  className="h-9 w-full rounded-md border border-border bg-background"
                />
              </label>
              <label className="flex flex-col gap-1 text-sm">
                <span className="font-medium">{t('background.to')}</span>
                <input
                  type="color"
                  value={bg.gradient.to}
                  onChange={(e) =>
                    setBackground({
                      type: 'gradient',
                      gradient: { ...bg.gradient!, to: e.target.value },
                    })
                  }
                  className="h-9 w-full rounded-md border border-border bg-background"
                />
              </label>
              <label className="flex flex-col gap-1 text-sm">
                <span className="font-medium">
                  {t('background.angle')} ({t('background.angleUnit')})
                </span>
                <input
                  type="number"
                  min={0}
                  max={360}
                  value={bg.gradient.angle}
                  onChange={(e) =>
                    setBackground({
                      type: 'gradient',
                      gradient: { ...bg.gradient!, angle: Number(e.target.value) || 0 },
                    })
                  }
                  className="rounded-md border border-border bg-background px-2 py-1 text-sm"
                />
              </label>
            </>
          )
        )}
        <fieldset className="flex flex-col gap-1">
          <legend className="text-sm font-medium">{t('bleed.label')}</legend>
          <div className="flex flex-wrap gap-2">
            {BLEED_OPTIONS_MM.map((mm) => (
              <button
                key={mm}
                type="button"
                onClick={() => setBleed(mm as TableCardBleedMm)}
                className={`${OPTION_BTN_BASE} ${
                  tableCard.bleedMm === mm ? OPTION_BTN_ACTIVE : OPTION_BTN_INACTIVE
                }`}
              >
                {mm === 3
                  ? t('bleed.option3mm')
                  : mm === 5
                    ? t('bleed.option5mm')
                    : t('bleed.option10mm')}
              </button>
            ))}
          </div>
          <p className="text-xs text-muted-foreground">{t('bleed.hint')}</p>
        </fieldset>
        </div>
      </section>
    );
  }

  if (activeTool === 'shape') {
    const shapeEl =
      selectedElement && selectedElement.type === 'shape' ? selectedElement : null;
    // ===== Round 10 (2026-09-27) — extended addShape() =====
    // Supports all 6 shape kinds (rect / circle / line / triangle /
    // ellipse / polygon). Each kind gets sensible defaults:
    //   - line:        fill = '#000000' (irrelevant — canvas uses
    //                  stroke; we still set fill so the schema stays
    //                  consistent across all shapes), stroke = blue,
    //                  strokeWidth = 2. Fill picker is hidden in the
    //                  Inspector for lines.
    //   - others:      fill = blue (#3b82f6), stroke = blue, strokeWidth = 0.
    // Polygon accepts an optional `points` array from the canvas's
    // creation mode; other shapes ignore it.
    const addShape = (
      shape: 'rect' | 'circle' | 'line' | 'triangle' | 'ellipse' | 'polygon',
      opts?: { points?: number[]; vertexCount?: number },
    ) => {
      const id = crypto.randomUUID();
      const isLine = shape === 'line';
      const next: TableCardElement = {
        id,
        type: 'shape',
        shape,
        x: 50,
        y: 50,
        width: 60,
        height: 40,
        rotation: 0,
        zIndex: nextZIndex(tableCard.elements),
        // Line: fill color is unused by the renderer (it draws with
        // `stroke`), but the schema requires the field. Use the line's
        // default stroke color so any future UI that exposes a fill
        // picker doesn't show a value mismatch.
        fill: isLine ? '#000000' : '#3b82f6',
        cornerRadius: shape === 'rect' ? 0 : undefined,
        stroke: '#3b82f6',
        strokeWidth: isLine ? 2 : 0,
        ...(shape === 'polygon' && opts?.points
          ? { points: opts.points, vertexCount: opts.vertexCount ?? opts.points.length / 2 }
          : {}),
      };
      addElement(next);
    };

    // ===== Round 10 — polygon creation mode wiring =====
    // The store hooks themselves live ABOVE the activeTool branching
    // (rule-of-hooks compliance). Only the click handlers + the
    // rendering stay here so we don't drag handlers for tools the
    // user is not currently viewing.

    const handleAddPolygonClick = () => {
      if (isDrawingPolygon) return;
      startPolygonCreation({ x: 50, y: 50, width: 60, height: 40 });
    };

    // Round 14 (2026-09-27) — Inspector "完成" wired to the
    // shared polygon builder. Before Round 14, this handler called
    // `addShape('polygon', { points: pts, vertexCount })`, which
    // hardcoded the element's `x: 50, y: 50, width: 60, height: 40`.
    // The canvas stores `polygonCreation.vertices` in ELEMENT-LOCAL
    // coords (relative to `bboxOrigin`). When the user's clicks
    // spanned more than 60 mm, the resulting polygon's `points`
    // landed at negative x/y or beyond the bbox, and the rendered
    // `<Line>` (which translates points by `el.x / el.y`) drew the
    // shape *off the canvas* — visible only in the layers list.
    //
    // Round 15 (2026-09-27) — pass `polygonCreation.bboxOrigin` into
    // the shared builder so the returned element's `x / y` are
    // canvas-absolute mm (matching what the renderer expects). Both
    // the Inspector "完成" button AND the in-canvas floating finish
    // button now produce identical elements drawn exactly where the
    // user clicked them, even when clicks land near the canvas
    // boundary.
    const handleFinishPolygon = () => {
      if (!isDrawingPolygon || !polygonCreation) return;
      const pts = finishPolygonCreation();
      if (pts) {
        addElement(
          buildPolygonElementFromVertices(
            pts,
            nextPolygonZIndex(tableCard.elements),
            polygonCreation.bboxOrigin,
          ),
        );
      }
    };

    return (
      <section aria-label={t('shape.rect')} className="flex flex-col">
        <Step7TableCardSelectionBar
          selectedElement={selectedElement}
          indexNumber={selectedIndexNumber}
        />
        <div className={INSPECTOR_PANEL_BASE}>
        {/* ===== Add buttons: 2 rows × 3 (Round 10 — added triangle / ellipse / polygon) ===== */}
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => addShape('rect')}
            className={`${OPTION_BTN_BASE} flex-1 ${OPTION_BTN_INACTIVE}`}
            data-testid="shape-add-rect"
          >
            {t('shape.addRect')}
          </button>
          <button
            type="button"
            onClick={() => addShape('circle')}
            className={`${OPTION_BTN_BASE} flex-1 ${OPTION_BTN_INACTIVE}`}
            data-testid="shape-add-circle"
          >
            {t('shape.addCircle')}
          </button>
          <button
            type="button"
            onClick={() => addShape('line')}
            className={`${OPTION_BTN_BASE} flex-1 ${OPTION_BTN_INACTIVE}`}
            data-testid="shape-add-line"
          >
            {t('shape.addLine')}
          </button>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => addShape('triangle')}
            className={`${OPTION_BTN_BASE} flex-1 ${OPTION_BTN_INACTIVE}`}
            data-testid="shape-add-triangle"
          >
            {t('shape.addTriangle')}
          </button>
          <button
            type="button"
            onClick={() => addShape('ellipse')}
            className={`${OPTION_BTN_BASE} flex-1 ${OPTION_BTN_INACTIVE}`}
            data-testid="shape-add-ellipse"
          >
            {t('shape.addEllipse')}
          </button>
          <button
            type="button"
            onClick={handleAddPolygonClick}
            disabled={isDrawingPolygon}
            className={`${OPTION_BTN_BASE} flex-1 ${OPTION_BTN_INACTIVE} ${
              isDrawingPolygon ? 'cursor-not-allowed opacity-50' : ''
            }`}
            data-testid="shape-add-polygon"
          >
            {t('shape.addPolygon')}
          </button>
        </div>

        {/* ===== Round 10 — Polygon creation mode hint ===== */}
        {isDrawingPolygon && polygonCreation && (
          <div
            className="flex flex-col gap-2 rounded-md border border-primary/40 bg-primary/5 px-3 py-2"
            data-testid="polygon-creation-hint"
          >
            <p className="text-xs text-muted-foreground">
              {t('shape.polygonHint', {
                count: polygonCreation.vertices.length / 2,
              })}
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={handleFinishPolygon}
                disabled={polygonCreation.vertices.length < 6}
                className={`${OPTION_BTN_BASE} flex-1 ${
                  polygonCreation.vertices.length >= 6 ? OPTION_BTN_ACTIVE : OPTION_BTN_INACTIVE
                } ${
                  polygonCreation.vertices.length < 6 ? 'cursor-not-allowed opacity-50' : ''
                }`}
                data-testid="polygon-finish"
              >
                {t('shape.polygonFinish')}
              </button>
              <button
                type="button"
                onClick={cancelPolygonCreation}
                className={`${OPTION_BTN_BASE} flex-1 ${OPTION_BTN_INACTIVE}`}
                data-testid="polygon-cancel"
              >
                {t('shape.polygonCancel')}
              </button>
            </div>
          </div>
        )}

        {shapeEl && (
          <>
            {/* ===== Fill picker (Round 10) ===== */}
            {/* Hidden for line because line draws with `stroke` only;
                showing a fill picker that doesn't affect the rendered
                color is misleading. */}
            {shapeEl.shape !== 'line' && (
              <label className="flex flex-col gap-1 text-sm">
                <span className="font-medium">{t('shape.fill')}</span>
                <input
                  type="color"
                  value={shapeEl.fill}
                  onChange={(e) => updateElement(shapeEl.id, { fill: e.target.value })}
                  className="h-9 w-full rounded-md border border-border bg-background"
                  data-testid="shape-fill-input"
                />
              </label>
            )}

            {/* ===== Corner radius (rect only, pre-existing) ===== */}
            {shapeEl.shape === 'rect' && (
              <label className="flex flex-col gap-1 text-sm">
                <span className="font-medium">
                  {t('shape.cornerRadius')} ({t('shape.cornerRadiusUnit')})
                </span>
                <input
                  type="number"
                  min={0}
                  max={50}
                  value={shapeEl.cornerRadius ?? 0}
                  onChange={(e) =>
                    updateElement(shapeEl.id, { cornerRadius: Number(e.target.value) || 0 })
                  }
                  className="rounded-md border border-border bg-background px-2 py-1 text-sm"
                />
              </label>
            )}

            {/* ===== Round 10 — Stroke color picker ===== */}
            {/* All 6 shapes now show stroke / width independently. The
                line bug (Round 9 follow-up): line drew with
                `stroke={el.stroke ?? el.fill}` and `addShape('line')`
                pre-set `stroke`, so the fill picker was a no-op. With
                this dedicated stroke picker, the user changes the
                line's color via `stroke`, which the canvas renders
                directly. */}
            <label className="flex flex-col gap-1 text-sm">
              <span className="font-medium">{t('shape.strokeColor')}</span>
              <input
                type="color"
                value={shapeEl.stroke ?? '#000000'}
                onChange={(e) =>
                  updateElement(shapeEl.id, { stroke: e.target.value })
                }
                className="h-9 w-full rounded-md border border-border bg-background"
                data-testid="shape-stroke-input"
              />
            </label>

            {/* ===== Round 10 — Stroke width input ===== */}
            <label className="flex flex-col gap-1 text-sm">
              <span className="font-medium">
                {t('shape.strokeWidth')} ({t('shape.strokeWidthUnit')})
              </span>
              <input
                type="number"
                min={0}
                max={50}
                step={0.5}
                value={shapeEl.strokeWidth ?? 0}
                onChange={(e) =>
                  updateElement(shapeEl.id, {
                    strokeWidth: Math.max(0, Number(e.target.value) || 0),
                  })
                }
                className="rounded-md border border-border bg-background px-2 py-1 text-sm"
                data-testid="shape-stroke-width-input"
              />
            </label>

            {/* ===== Round 10 — Polygon vertex count (read-only display + manual edit) ===== */}
            {/* The vertices are stored in `points` (Konva flat array).
                We display the count and allow the user to manually
                adjust via a number input that reflects the current
                vertex count. Editing the count via this input is a
                no-op for now (the user can only add vertices via the
                canvas creation mode). Future: re-architect to allow
                per-vertex drag editing. */}
            {shapeEl.shape === 'polygon' && (
              <div className="flex flex-col gap-1 text-sm">
                <span className="font-medium">{t('shape.sides')}</span>
                <input
                  type="number"
                  readOnly
                  value={shapeEl.vertexCount ?? shapeEl.points?.length ? (shapeEl.points?.length ?? 0) / 2 : 0}
                  className="rounded-md border border-border bg-muted/30 px-2 py-1 text-sm"
                  data-testid="shape-polygon-vertex-count"
                />
                <p className="text-xs text-muted-foreground">{t('shape.sidesHint')}</p>
              </div>
            )}
          </>
        )}
        </div>
      </section>
    );
  }

  if (activeTool === 'image') {
    const imageEl =
      selectedElement && selectedElement.type === 'image' ? selectedElement : null;
    // Round 3 Fix 4.4 — image element hard cap (MAX_IMAGE_ELEMENTS = 3).
    // Counting only image elements (text / shape elements are uncapped
    // for now; only images own an R2 object). When at the cap, the
    // upload button is disabled + shows the i18n warning hint. The
    // user must delete an existing image first to free a slot.
    const imageCount = tableCard.elements.filter((el) => el.type === 'image').length;
    const atLimit = imageCount >= MAX_IMAGE_ELEMENTS;
    return (
      <section aria-label={t('image.upload')} className="flex flex-col">
        <Step7TableCardSelectionBar
          selectedElement={selectedElement}
          indexNumber={selectedIndexNumber}
        />
        <div className={INSPECTOR_PANEL_BASE}>
          {/* Hidden file input — clicked via the upload button (Issue 2) */}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/png,image/jpeg"
            onChange={handleFileChange}
            disabled={isUploading || !cardId || atLimit}
            className="sr-only"
            data-testid="image-upload-input"
            aria-label={t('image.uploadAriaLabel')}
          />
          <button
            type="button"
            onClick={handleUploadClick}
            disabled={isUploading || !cardId || atLimit}
            className="rounded-md border border-dashed border-border bg-muted/30 px-3 py-6 text-sm text-muted-foreground transition-colors hover:bg-muted/50 disabled:cursor-not-allowed disabled:opacity-50"
            data-testid="image-upload-button"
          >
            {atLimit
              ? t('image.atLimit', { max: MAX_IMAGE_ELEMENTS })
              : isUploading
                ? t('image.uploading')
                : t('image.upload')}
          </button>
          {atLimit && (
            <p
              role="alert"
              className="text-xs text-warning"
              data-testid="image-upload-limit-hint"
            >
              {t('image.limitHint', { max: MAX_IMAGE_ELEMENTS })}
            </p>
          )}
          {uploadError && (
            <p
              role="alert"
              className="text-xs text-destructive"
              data-testid="image-upload-error"
            >
              {uploadError}
            </p>
          )}
          <p className="text-xs text-muted-foreground">{t('image.uploadHint')}</p>
          <p className="text-xs text-muted-foreground">{t('image.maxSize')}</p>
          {imageEl && (
            <p className="break-all text-xs text-muted-foreground">
              {imageEl.imageKey}
            </p>
          )}
          {/*
            Round 6 (2026-09-27) — image shape transformation. Visible
            only after an image element is uploaded + selected; the
            shape picker is meaningless without a target image. Default
            shape = 'rect' (matches pre-Round-6 rendering for backward
            compatibility).
          */}
          {imageEl && (
            <>
              <fieldset className="flex flex-col gap-1">
                <legend className="text-sm font-medium">
                  {t('image.shapeLabel')}
                </legend>
                <div className="flex gap-2">
                  {(['rect', 'circle', 'triangle'] as const).map((shape) => {
                    const isActive = (imageEl.clipShape ?? 'rect') === shape;
                    return (
                      <button
                        key={shape}
                        type="button"
                        onClick={() =>
                          updateElement(imageEl.id, { clipShape: shape })
                        }
                        className={`${OPTION_BTN_BASE} flex-1 ${
                          isActive ? OPTION_BTN_ACTIVE : OPTION_BTN_INACTIVE
                        }`}
                        data-testid={`image-shape-${shape}`}
                      >
                        {t(`image.shape${shape[0]!.toUpperCase() + shape.slice(1)}`)}
                      </button>
                    );
                  })}
                </div>
              </fieldset>
              {(imageEl.clipShape ?? 'rect') === 'rect' && (
                <label className="flex flex-col gap-1 text-sm">
                  <span className="font-medium">
                    {t('image.clipRadius')} ({t('image.clipRadiusUnit')})
                  </span>
                  <input
                    type="number"
                    min={0}
                    max={50}
                    value={imageEl.clipRadius ?? 0}
                    onChange={(e) =>
                      updateElement(imageEl.id, {
                        clipRadius: Number(e.target.value) || 0,
                      })
                    }
                    className="rounded-md border border-border bg-background px-2 py-1 text-sm"
                  />
                </label>
              )}
            </>
          )}
        </div>
      </section>
    );
  }

  // 'layers' panel — element list with reorder + delete
  //
  // Round 3 Fix 3: build a 1-based creation-order index map so the layer
  // row shows "圖片 1 / 形狀 2" instead of the abstract "圖層 5" zIndex.
  // The list itself stays sorted by zIndex (top-of-canvas first) because
  // that matches the user's mental model; only the displayed label uses
  // creation order. Newly added elements always get the next 1-based slot,
  // so labels stay stable across zIndex changes.
  //
  // Round 4 — `indexById` is now computed at the top of the component
  // so every tool panel's <Step7TableCardSelectionBar /> can render the
  // same number suffix (Issue 1). The layers list reuses the same map.
  return (
    <section aria-label={t('layers.title')} className="flex flex-col">
      <Step7TableCardSelectionBar
        selectedElement={selectedElement}
        indexNumber={selectedIndexNumber}
      />
      <div className={`${INSPECTOR_PANEL_BASE} gap-2`}>
        <h3 className="text-sm font-medium">{t('layers.title')}</h3>
        <p className="text-xs text-muted-foreground">{t('layers.hint')}</p>
        {tableCard.elements.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t('layers.empty')}</p>
        ) : (
          <ul className="flex flex-col gap-1">
            {[...tableCard.elements]
              .sort((a, b) => b.zIndex - a.zIndex)
              .map((el, sortedIdx, sortedArr) => {
                const num = indexById.get(el.id) ?? 0;
                // Round 4 — boundary detection for the new direction-based
                // reorder API. The sorted list order matches the panel UI
                // order; the first row is the top of the panel (no ↑
                // allowed) and the last row is the bottom (no ↓ allowed).
                const canBringForward = sortedIdx > 0;
                const canSendBackward = sortedIdx < sortedArr.length - 1;
                return (
                  <li
                    key={el.id}
                    className="flex items-center justify-between gap-2 rounded-md border border-border bg-background px-2 py-1 text-sm"
                  >
                    <span className="truncate">
                      {t(`layers.elementTypeLabel.${el.type}` as 'layers.elementTypeLabel.text')}{' '}
                      {num}
                    </span>
                    <div className="flex items-center gap-1">
                      {/*
                        Round 4 — Issue 2 fixes:
                          - Pass 'up' / 'down' (direction) instead of
                            zIndex ± 1 (integer arithmetic) so the swap
                            always lands on the actual neighbor.
                          - Issue 2-1 — add `transition-transform
                            active:scale-90 active:bg-muted` for tactile
                            click feedback.
                          - Disable at boundary via `disabled` so the
                            new no-op buttons read as visually inert
                            (matches `disabled:opacity-30
                            disabled:pointer-events-none`).
                        Shared `LAYER_BTN_BASE` keeps the three icon
                        buttons visually aligned (same padding /
                        transition / active scale).
                      */}
                      <button
                        type="button"
                        onClick={() => reorderElement(el.id, 'up')}
                        disabled={!canBringForward}
                        title={t('layers.bringForward')}
                        aria-label={t('layers.bringForward')}
                        className={`${LAYER_BTN_BASE} ${
                          canBringForward ? LAYER_BTN_DEFAULT : LAYER_BTN_DISABLED
                        }`}
                      >
                        ↑
                      </button>
                      <button
                        type="button"
                        onClick={() => reorderElement(el.id, 'down')}
                        disabled={!canSendBackward}
                        title={t('layers.sendBackward')}
                        aria-label={t('layers.sendBackward')}
                        className={`${LAYER_BTN_BASE} ${
                          canSendBackward ? LAYER_BTN_DEFAULT : LAYER_BTN_DISABLED
                        }`}
                      >
                        ↓
                      </button>
                      <button
                        type="button"
                        onClick={() => removeElement(el.id)}
                        title={t('layers.delete')}
                        aria-label={t('layers.delete')}
                        className={`${LAYER_BTN_BASE} text-destructive hover:bg-destructive/10 active:bg-destructive/20`}
                      >
                        ✕
                      </button>
                    </div>
                  </li>
                );
              })}
          </ul>
        )}
      </div>
    </section>
  );
}

/** Compute the next zIndex for a freshly added element. */
function nextZIndex(elements: readonly TableCardElement[]): number {
  return elements.reduce((max, el) => (el.zIndex > max ? el.zIndex : max), -1) + 1;
}

export default Step7TableCardInspector;