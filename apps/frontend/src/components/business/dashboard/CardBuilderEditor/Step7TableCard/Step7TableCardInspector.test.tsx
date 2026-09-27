/**
 * Step7TableCardInspector — Round 10 (2026-09-27) regression tests.
 *
 * Critical invariants under test:
 *   - 6 shape add buttons (rect / circle / line / triangle / ellipse / polygon)
 *   - Stroke picker is independent from fill picker (Round 10 fix for
 *     Task #1 + #2 — line tool's "改色無效" bug).
 *   - Fill picker hidden for line shapes (line draws with `stroke` only).
 *   - Polygon add button enters creation mode (does NOT directly add
 *     an element; the canvas takes over pointer handling).
 *
 * Run: `npm test -- Step7TableCardInspector.test`
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Step7TableCardInspector } from './Step7TableCardInspector';
import { useCardBuilderStore } from '../CardBuilderEditor.store';
import type { TableCardElement } from '@saome/shared/schemas/card';

import '@/test/i18n';

beforeEach(() => {
  // Reset the store to a clean state before each test so polygonCreation
  // and tableCard.elements don't leak between tests.
  useCardBuilderStore.getState().reset();
});

describe('Step7TableCardInspector — Round 10 shape enhancements', () => {
  describe('6 shape add buttons', () => {
    it('renders all 6 add buttons (rect / circle / line / triangle / ellipse / polygon)', () => {
      render(<Step7TableCardInspector activeTool="shape" selectedElement={null} />);
      // All 6 buttons have data-testid for direct lookup.
      expect(screen.getByTestId('shape-add-rect')).toBeInTheDocument();
      expect(screen.getByTestId('shape-add-circle')).toBeInTheDocument();
      expect(screen.getByTestId('shape-add-line')).toBeInTheDocument();
      expect(screen.getByTestId('shape-add-triangle')).toBeInTheDocument();
      expect(screen.getByTestId('shape-add-ellipse')).toBeInTheDocument();
      expect(screen.getByTestId('shape-add-polygon')).toBeInTheDocument();
    });
  });

  describe('addShape — element defaults', () => {
    it('clicking "Add line" produces an element with fill / stroke / strokeWidth set', async () => {
      const user = userEvent.setup();
      render(<Step7TableCardInspector activeTool="shape" selectedElement={null} />);
      const before = useCardBuilderStore.getState().tableCard.elements.length;
      await user.click(screen.getByTestId('shape-add-line'));
      const after = useCardBuilderStore.getState().tableCard.elements;
      expect(after.length).toBe(before + 1);
      const line = after[after.length - 1]!;
      expect(line.type).toBe('shape');
      if (line.type === 'shape') {
        expect(line.shape).toBe('line');
        // Round 10 fix: line element must have a stroke set so the
        // canvas renderer (which uses `stroke={el.stroke ?? el.fill}`)
        // draws with the intended color, not a fallback.
        expect(line.stroke).toBe('#3b82f6');
        expect(line.strokeWidth).toBe(2);
      }
    });

    it('clicking "Add triangle" produces a shape-kind="triangle" element', async () => {
      const user = userEvent.setup();
      render(<Step7TableCardInspector activeTool="shape" selectedElement={null} />);
      await user.click(screen.getByTestId('shape-add-triangle'));
      const elements = useCardBuilderStore.getState().tableCard.elements;
      const tri = elements[elements.length - 1];
      expect(tri?.type).toBe('shape');
      if (tri?.type === 'shape') {
        expect(tri.shape).toBe('triangle');
        expect(tri.fill).toBe('#3b82f6');
        // Triangle default strokeWidth = 0 (no visible stroke until user
        // picks one in the Inspector).
        expect(tri.strokeWidth).toBe(0);
      }
    });

    it('clicking "Add ellipse" produces a shape-kind="ellipse" element', async () => {
      const user = userEvent.setup();
      render(<Step7TableCardInspector activeTool="shape" selectedElement={null} />);
      await user.click(screen.getByTestId('shape-add-ellipse'));
      const elements = useCardBuilderStore.getState().tableCard.elements;
      const el = elements[elements.length - 1];
      expect(el?.type).toBe('shape');
      if (el?.type === 'shape') {
        expect(el.shape).toBe('ellipse');
      }
    });

    it('clicking "Add polygon" enters creation mode (does NOT directly add an element)', async () => {
      const user = userEvent.setup();
      render(<Step7TableCardInspector activeTool="shape" selectedElement={null} />);
      const before = useCardBuilderStore.getState().tableCard.elements.length;
      await user.click(screen.getByTestId('shape-add-polygon'));
      const after = useCardBuilderStore.getState().tableCard.elements;
      // No new element added yet — the canvas intercepts subsequent clicks.
      expect(after.length).toBe(before);
      // polygonCreation state must be non-null (= drawing mode active).
      expect(useCardBuilderStore.getState().polygonCreation).not.toBeNull();
      // The Inspector should now render the creation-mode hint panel.
      expect(screen.getByTestId('polygon-creation-hint')).toBeInTheDocument();
    });
  });

  describe('Stroke vs Fill picker separation', () => {
    it('selected rect shows BOTH fill picker AND stroke picker (Round 10 fix)', () => {
      const rect: TableCardElement = {
        id: 'rect-1',
        type: 'shape',
        shape: 'rect',
        x: 10,
        y: 10,
        width: 60,
        height: 40,
        rotation: 0,
        zIndex: 1,
        fill: '#ff0000',
        stroke: '#000000',
        strokeWidth: 2,
        cornerRadius: 0,
      };
      render(
        <Step7TableCardInspector activeTool="shape" selectedElement={rect} />,
      );
      // Both pickers are present and addressable via data-testid.
      expect(screen.getByTestId('shape-fill-input')).toBeInTheDocument();
      expect(screen.getByTestId('shape-stroke-input')).toBeInTheDocument();
      expect(screen.getByTestId('shape-stroke-width-input')).toBeInTheDocument();
    });

    it('selected line does NOT show fill picker (line draws with stroke only)', () => {
      // Round 10 — line is stroke-only; showing a fill picker would
      // mislead the user into thinking the fill value affects rendering.
      const line: TableCardElement = {
        id: 'line-1',
        type: 'shape',
        shape: 'line',
        x: 10,
        y: 10,
        width: 60,
        height: 40,
        rotation: 0,
        zIndex: 1,
        fill: '#000000',
        stroke: '#3b82f6',
        strokeWidth: 2,
      };
      render(
        <Step7TableCardInspector activeTool="shape" selectedElement={line} />,
      );
      // No fill picker for lines.
      expect(screen.queryByTestId('shape-fill-input')).not.toBeInTheDocument();
      // But stroke picker IS present (so users can change line color).
      expect(screen.getByTestId('shape-stroke-input')).toBeInTheDocument();
      expect(screen.getByTestId('shape-stroke-width-input')).toBeInTheDocument();
    });

    it('stroke picker writes to el.stroke (regression — line color bug fix)', async () => {
      // Regression test for the user-reported bug: "線段工具改色後畫布上
      // 的線段還是預設顏色". Before Round 10, the only color picker was
      // labeled "fill" but for line elements it didn't affect rendering
      // because the canvas draws with `stroke`. With Round 10's dedicated
      // stroke picker, the user can change line color via stroke.
      const user = userEvent.setup();
      const line: TableCardElement = {
        id: 'line-2',
        type: 'shape',
        shape: 'line',
        x: 10,
        y: 10,
        width: 60,
        height: 40,
        rotation: 0,
        zIndex: 1,
        fill: '#000000',
        stroke: '#3b82f6',
        strokeWidth: 2,
      };
      // Seed the line into the store so the Inspector's `updateElement`
      // can find it (the prop-only `selectedElement` is read-only; the
      // mutation path goes through the store).
      useCardBuilderStore.getState().addTableCardElement(line);
      render(
        <Step7TableCardInspector activeTool="shape" selectedElement={line} />,
      );
      const strokeInput = screen.getByTestId('shape-stroke-input');
      // Simulate user picking a new color via the color picker.
      // Wrapped in act() because the synthetic input/change events trigger
      // store updates that React batches — RTL warns about un-wrapped
      // state updates when assertions run immediately after.
      await user.click(strokeInput);
      await act(async () => {
        fireChange(strokeInput, '#ff00ff');
      });
      // The element's stroke should now reflect the new color.
      const updated = useCardBuilderStore
        .getState()
        .tableCard.elements.find((el: TableCardElement) => el.id === 'line-2');
      expect(updated).toBeDefined();
      if (updated?.type === 'shape') {
        expect(updated.stroke).toBe('#ff00ff');
      }
    });

    it('stroke width input writes to el.strokeWidth', async () => {
      const rect: TableCardElement = {
        id: 'rect-2',
        type: 'shape',
        shape: 'rect',
        x: 10,
        y: 10,
        width: 60,
        height: 40,
        rotation: 0,
        zIndex: 1,
        fill: '#ff0000',
        stroke: '#000000',
        strokeWidth: 0,
        cornerRadius: 0,
      };
      // Seed into the store so updateElement can find it by id.
      useCardBuilderStore.getState().addTableCardElement(rect);
      render(
        <Step7TableCardInspector activeTool="shape" selectedElement={rect} />,
      );
      const widthInput = screen.getByTestId('shape-stroke-width-input');
      await act(async () => {
        fireChange(widthInput, '4');
      });
      const updated = useCardBuilderStore
        .getState()
        .tableCard.elements.find((el: TableCardElement) => el.id === 'rect-2');
      if (updated?.type === 'shape') {
        expect(updated.strokeWidth).toBe(4);
      }
    });
  });

  describe('Polygon creation mode UI', () => {
    it('hint panel shows current vertex count', () => {
      useCardBuilderStore.getState().startPolygonCreation({
        x: 50,
        y: 50,
        width: 60,
        height: 40,
      });
      // Simulate 4 vertex clicks (4 vertices = 8 numbers in flat format).
      useCardBuilderStore.getState().appendPolygonVertex(10, 10);
      useCardBuilderStore.getState().appendPolygonVertex(20, 20);
      useCardBuilderStore.getState().appendPolygonVertex(30, 10);
      useCardBuilderStore.getState().appendPolygonVertex(20, 0);
      render(<Step7TableCardInspector activeTool="shape" selectedElement={null} />);
      const hint = screen.getByTestId('polygon-creation-hint');
      // The hint should contain "4" (vertex count). i18n format:
      // "{{count}} 個頂點". Match loosely on the count.
      expect(hint.textContent).toMatch(/4/);
    });

    it('Finish button creates a polygon element with bbox computed from actual vertices (Round 14 Bug 2 + Round 15 Bug 3)', async () => {
      // Round 14 — clicking "完成" in the Inspector used to call
      // `addShape('polygon', { points, vertexCount })`, which
      // hardcoded `x: 50, y: 50, width: 60, height: 40`. The stored
      // `points` are in element-LOCAL coords (relative to the
      // bboxOrigin the user clicked into). When the user's vertices
      // spanned more than 60 mm (the common case), the rendered
      // polygon landed off-canvas while the layers list still showed
      // the shape — the user saw the bbox shrink to nothing and
      // concluded the polygon "jumped off the canvas".
      //
      // Round 14 fix routed both Inspector + Canvas through the
      // shared `buildPolygonElementFromVertices` helper which
      // computes the bbox from actual vertex extents.
      //
      // Round 15 (2026-09-27) — that fix was *half* right: the bbox
      // extents (width/height) are correct, but the returned
      // element's `x` / `y` were still in the LOCAL frame (not the
      // canvas-absolute frame the renderer expects). When the user
      // clicked anywhere — but especially near the canvas boundary —
      // the resulting shape's stored x/y could go negative and the
      // rendered `<Line>` dropped the polygon outside the canvas.
      //
      // The Round 15 fix routes `polygonCreation.bboxOrigin` through
      // `buildPolygonElementFromVertices` so the returned element's
      // `x = bboxOrigin.x + localMinX`, `y = bboxOrigin.y + localMinY`
      // (canvas-absolute mm). With Inspector default bboxOrigin =
      // (50, 50) and LOCAL vertices spanning (10, 20) → (60, 50):
      //   expected canvas-mm bbox = (60, 70) → (110, 100)
      //   expected element.x = 60, element.y = 70
      //   expected element.width = 50, element.height = 30
      //   expected points = rebased LOCAL (subtract (10, 20))
      const user = userEvent.setup();
      const before = useCardBuilderStore.getState().tableCard.elements.length;
      // Render first so the add buttons are in the DOM.
      render(<Step7TableCardInspector activeTool="shape" selectedElement={null} />);
      // Click "新增多邊形" to enter creation mode. Inspector defaults
      // bboxOrigin = (50, 50).
      await user.click(screen.getByTestId('shape-add-polygon'));
      // Place 4 vertices spanning (10, 20) → (60, 50) in bbox-LOCAL
      // mm. The shared builder computes the bbox from the vertices
      // directly and translates to canvas-absolute via bboxOrigin.
      const state = useCardBuilderStore.getState();
      state.appendPolygonVertex(10, 20);
      state.appendPolygonVertex(60, 20);
      state.appendPolygonVertex(60, 50);
      state.appendPolygonVertex(10, 50);
      // Click 完成 (Round 15 copy — was "完成多邊形").
      const finishBtn = await screen.findByTestId('polygon-finish');
      expect(finishBtn).not.toBeDisabled();
      await user.click(finishBtn);
      // A new element must be added (creation finished).
      const after = useCardBuilderStore.getState().tableCard.elements;
      expect(after.length).toBe(before + 1);
      const poly = after[after.length - 1];
      expect(poly).toBeDefined();
      if (poly && poly.type === 'shape' && poly.shape === 'polygon') {
        // Bug 3 regression: x/y must be canvas-absolute mm,
        // i.e. bboxOrigin (50, 50) + localMinX/Y (10, 20).
        // Before Round 15 the expected values were x: 10, y: 20
        // (local), which rendered the polygon at canvas-mm
        // (10, 20) — 40 mm short of where the user clicked.
        expect(poly.x).toBe(60);
        expect(poly.y).toBe(70);
        // Width / height are bbox spans, identical in both frames
        // (the offset cancels). localMaxX (60) - localMinX (10) = 50.
        expect(poly.width).toBe(50);
        expect(poly.height).toBe(30);
        // Points must be rebased to bbox-local (subtract localMinX/Y).
        expect(poly.points).toEqual([0, 0, 50, 0, 50, 30, 0, 30]);
        expect(poly.vertexCount).toBe(4);
        // polygonCreation must be cleared.
        expect(useCardBuilderStore.getState().polygonCreation).toBeNull();
      } else {
        throw new Error('Inspector Finish did not produce a polygon element');
      }
    });

    it('Round 15 Bug 3 — vertices with negative local coords stay on canvas (regression: jumps-out)', async () => {
      // When the user draws near the canvas boundary (e.g. clicks at
      // canvas-mm (5, 5), (35, 5), (35, 35)) with bboxOrigin =
      // (50, 50), the LOCAL vertices are (-45, -45), (-15, -45),
      // (-15, -15) — all negative. Before Round 15, the element's
      // stored x = -45, y = -45 → the rendered `<Line>` placed the
      // shape 45 mm OUTSIDE the canvas (canvas is 210×297 mm at
      // mm coords but the negative x/y pushed the polygon into the
      // void). The user reported the polygon "jumping off the
      // canvas" precisely because of this.
      //
      // The fix translates the local bbox through bboxOrigin:
      //   el.x = -45 + 50 = 5   (canvas-mm, inside canvas)
      //   el.y = -45 + 50 = 5   (canvas-mm, inside canvas)
      const user = userEvent.setup();
      const before = useCardBuilderStore.getState().tableCard.elements.length;
      render(<Step7TableCardInspector activeTool="shape" selectedElement={null} />);
      await user.click(screen.getByTestId('shape-add-polygon'));
      // Place 3 vertices whose LOCAL coords go negative.
      const state = useCardBuilderStore.getState();
      state.appendPolygonVertex(-45, -45);
      state.appendPolygonVertex(-15, -45);
      state.appendPolygonVertex(-15, -15);
      const finishBtn = await screen.findByTestId('polygon-finish');
      await user.click(finishBtn);
      const after = useCardBuilderStore.getState().tableCard.elements;
      expect(after.length).toBe(before + 1);
      const poly = after[after.length - 1];
      if (poly && poly.type === 'shape' && poly.shape === 'polygon') {
        // Without the fix, these would be -45 (off canvas). With
        // the fix, they equal the actual canvas-mm click position.
        expect(poly.x).toBe(5);
        expect(poly.y).toBe(5);
        expect(poly.width).toBe(30);
        expect(poly.height).toBe(30);
        // Points still rebased to bbox-local (subtract localMinX/Y = -45, -45).
        expect(poly.points).toEqual([0, 0, 30, 0, 30, 30]);
      } else {
        throw new Error('Inspector Finish did not produce a polygon element');
      }
    });

    it('Finish button is disabled when <3 vertices', () => {
      useCardBuilderStore.getState().startPolygonCreation({
        x: 50,
        y: 50,
        width: 60,
        height: 40,
      });
      useCardBuilderStore.getState().appendPolygonVertex(0, 0);
      render(<Step7TableCardInspector activeTool="shape" selectedElement={null} />);
      const finish = screen.getByTestId('polygon-finish');
      expect(finish).toBeDisabled();
    });

    it('Cancel button clears polygonCreation state', async () => {
      const user = userEvent.setup();
      useCardBuilderStore.getState().startPolygonCreation({
        x: 50,
        y: 50,
        width: 60,
        height: 40,
      });
      render(<Step7TableCardInspector activeTool="shape" selectedElement={null} />);
      const cancel = screen.getByTestId('polygon-cancel');
      await user.click(cancel);
      expect(useCardBuilderStore.getState().polygonCreation).toBeNull();
    });

    it('Polygon elements show vertex-count (read-only) in the Inspector', () => {
      // Once a polygon is selected, the Inspector shows a read-only
      // "頂點數" input reflecting the count of vertices in `points`.
      // (Editing individual vertices is a Round 11 feature.)
      const polygon: TableCardElement = {
        id: 'poly-1',
        type: 'shape',
        shape: 'polygon',
        x: 10,
        y: 10,
        width: 60,
        height: 40,
        rotation: 0,
        zIndex: 1,
        fill: '#3b82f6',
        stroke: '#3b82f6',
        strokeWidth: 0,
        points: [0, 0, 30, 30, 0, 30, 0, 0],
        vertexCount: 4,
      };
      render(
        <Step7TableCardInspector activeTool="shape" selectedElement={polygon} />,
      );
      const vertexInput = screen.getByTestId('shape-polygon-vertex-count');
      expect(vertexInput).toBeInTheDocument();
      // The value should be the vertex count (4 in this fixture).
      // We check the .value attribute since the input is read-only.
      expect((vertexInput as HTMLInputElement).value).toBe('4');
    });
  });
});

/**
 * Helper: React Testing Library doesn't have a direct "fire change on
 * color input" helper. `userEvent.type` doesn't work for `<input
 * type="color">` either (it requires native color picker interaction).
 * We dispatch a synthetic change event with the desired value.
 */
function fireChange(input: HTMLElement, value: string) {
  const setter = Object.getOwnPropertyDescriptor(
    window.HTMLInputElement.prototype,
    'value',
  )?.set;
  setter?.call(input, value);
  input.dispatchEvent(new Event('input', { bubbles: true }));
  input.dispatchEvent(new Event('change', { bubbles: true }));
}
