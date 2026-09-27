/**
 * Step7TableCardCanvas — conformance tests (Round 2 fix, 2026-09-27).
 *
 * Critical invariants under test:
 *   - Responsive stage sizing (Fix 4a): the canvas owns a `containerRef`
 *     + ResizeObserver that re-measures on viewport changes and feeds
 *     `width/height/scale` props to Konva `<Stage>`.
 *   - Image element rendering (Fix 2): the previous placeholder Rect
 *     is gone; the canvas routes image elements through `CanvasImage`
 *     which calls `useImage` (CORS-safe <img> loader) and renders a
 *     real Konva `<Image>` on success.
 *
 * Strategy:
 *   - jsdom has no canvas context, so we mock react-konva and verify
 *     behavior via mocked prop capture + structural file/source checks.
 *   - We assert on the source for invariants that can't be reliably
 *     observed through render (e.g. that `useImage` is imported, that
 *     ResizeObserver is used, that the placeholder Rect was replaced).
 *
 * Run: `npm test -- Step7TableCardCanvas.test`
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render } from '@testing-library/react';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { useRef } from 'react';
import type { RefObject } from 'react';
import type Konva from 'konva';

import { Step7TableCardCanvas } from './Step7TableCardCanvas.web';
import type { TableCardSettings } from '@saome/shared/schemas/card';

// Round 13 (2026-09-27) — also import the pure conversion helper so we
// can unit-test the math directly without going through the full
// React render tree (jsdom can't run real Konva, and the existing
// mock-based tests only check source-code patterns).
import { polygonPointerToLocalMm } from './Step7TableCardCanvas.web';
import { PREVIEW_WIDTH_PX, TABLE_CARD_WIDTH_MM } from '@saome/shared/constants/table-card';

// Mock react-konva — jsdom has no canvas context. Track props via the
// call log so we can assert what the canvas passes to Konva.
const stagePropsLog: Array<Record<string, unknown>> = [];
// Round 10 (2026-09-27) — per-primitive prop logs. The mock factory
// pushes each call's props into these arrays so the round 10 render
// tests can assert that the canvas dispatched to the correct Konva
// primitive with the expected props. We can't `require('react-konva')`
// inside a test because vitest returns a separate module instance
// that doesn't carry the vi.fn `.mock` property — these closure-bound
// arrays are the only reliable way to observe the mock invocations.
const regularPolygonPropsLog: Array<Record<string, unknown>> = [];
const ellipsePropsLog: Array<Record<string, unknown>> = [];
const linePropsLog: Array<Record<string, unknown>> = [];

vi.mock('react-konva', () => ({
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  Stage: vi.fn(({ children, ...props }: any) => {
    // eslint-disable-next-line no-console
    // (Stage mock intentionally does NOT log to avoid noise; child
    // primitives still get rendered as divs for observation.)
    stagePropsLog.push(props);
    return <div data-testid="konva-stage">{children}</div>;
  }),
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  Layer: vi.fn(({ children }: any) => (
    <div data-testid="konva-layer">{children}</div>
  )),
  // Round 7 (2026-09-27) — added Group to the mock so the new
  // circle / triangle clipShape wrappers can render. Group just
  // forwards children; jsdom can't paint the actual clipFunc.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  Group: vi.fn(({ children }: any) => (
    <div data-testid="konva-group">{children}</div>
  )),
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  Rect: vi.fn((props: any) => (
    <div data-testid="konva-rect" data-props={JSON.stringify(props)} />
  )),
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  Circle: vi.fn(() => <div data-testid="konva-circle" />),
  // Round 10 (2026-09-27) — added Ellipse / RegularPolygon mocks for
  // the new triangle / ellipse / polygon shape branches.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  Ellipse: vi.fn((props: any) => {
    ellipsePropsLog.push(props);
    return <div data-testid="konva-ellipse" data-props={JSON.stringify(props)} />;
  }),
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  RegularPolygon: vi.fn((props: any) => {
    regularPolygonPropsLog.push(props);
    return <div data-testid="konva-regular-polygon" data-props={JSON.stringify(props)} />;
  }),
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  Line: vi.fn((props: any) => {
    linePropsLog.push(props);
    return <div data-testid="konva-line" data-props={JSON.stringify(props)} />;
  }),
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  Text: vi.fn(() => <div data-testid="konva-text" />),
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  Image: vi.fn(() => <div data-testid="konva-image" />),
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  Transformer: vi.fn((props: any) => (
    <div data-testid="konva-transformer" ref={props.ref} />
  )),
}));

// Mock use-image — we don't actually load anything in jsdom.
vi.mock('use-image', () => ({
  default: () => [undefined as HTMLImageElement | undefined, 'loading'] as const,
}));

import '@/test/i18n';

const baseSettings: TableCardSettings = {
  elements: [],
  background: { type: 'solid', color: '#ffffff' },
  bleedMm: 3,
};

function Harness({ settings }: { settings?: TableCardSettings }) {
  const stageRef = useRef<Konva.Stage | null>(null);
  return (
    <div style={{ width: '800px', height: '1000px' }}>
      <Step7TableCardCanvas
        stageRef={stageRef as RefObject<Konva.Stage | null>}
        cardId="card-uuid"
        tableCard={settings ?? baseSettings}
        selectedId={null}
        onSelect={() => {}}
        onChange={() => {}}
        onAdd={() => {}}
      />
    </div>
  );
}

// =============================================================================
// Round 13 (2026-09-27) — polygon click coordinate conversion.
//
// Why this exists:
//   Round 10's onMouseDown handler used `pos.x / stageSize.scale` and
//   subtracted `polygonCreation.bboxOrigin.x` (which is in mm). The
//   result was stored as if it were mm but actually mixed units,
//   causing the preview line / numbered vertex markers / finish
//   button to render far off-canvas (e.g. a click at canvas CSS px
//   300 stored 250, which mmToPx then placed at ~849px — outside the
//   595×842 visible Stage). User reported "no dashed line, no
//   numbered vertex, no finish button".
//
//   The fix is a single-source-of-truth helper `polygonPointerToLocalMm`
//   that performs the full CSS px → stage internal px → mm conversion
//   chain. These tests pin the math so a similar regression in the
//   click handlers (or anywhere else the formula is reused) trips a
//   test instead of slipping through like Round 12's source-pattern
//   checks did.
// =============================================================================
describe('Step7TableCardCanvas — Round 13 polygon click conversion helper', () => {
  const PREVIEW_SCALE = PREVIEW_WIDTH_PX / TABLE_CARD_WIDTH_MM;

  // Sanity: PREVIEW_SCALE is the conversion ratio the canvas uses.
  // If this drifts the rest of the test suite will silently assert
  // against the wrong numbers.
  it('PREVIEW_SCALE matches canvas constant (≈ 2.83 px/mm for A4)', () => {
    expect(PREVIEW_SCALE).toBeCloseTo(595 / 210, 6);
    expect(PREVIEW_SCALE).toBeGreaterThan(2);
    expect(PREVIEW_SCALE).toBeLessThan(3);
  });

  describe('polygonPointerToLocalMm — desktop (stageScale = 1)', () => {
    it('click at canvas (300, 300) → local (55.88, 55.88) mm when bboxOrigin = (50, 50)', () => {
      // 300 CSS px → 300 / 1 / (595/210) = 300 × 210 / 595 = 105.882 mm;
      // minus 50 mm bboxOrigin = 55.882 mm. Round 10 stored 250 here
      // (the bug).
      const { localX, localY } = polygonPointerToLocalMm(
        { x: 300, y: 300 },
        1,
        { x: 50, y: 50 },
      );
      expect(localX).toBeCloseTo(300 * (210 / 595) - 50, 6);
      expect(localY).toBeCloseTo(300 * (210 / 595) - 50, 6);
      // Round-number sanity: ≈ 56 mm.
      expect(localX).toBeCloseTo(55.88, 1);
      expect(localY).toBeCloseTo(55.88, 1);
    });

    it('click at bboxOrigin itself → local (0, 0) mm (regression: was nonzero in Round 10)', () => {
      const { localX, localY } = polygonPointerToLocalMm(
        { x: 50 * PREVIEW_SCALE, y: 50 * PREVIEW_SCALE },
        1,
        { x: 50, y: 50 },
      );
      expect(localX).toBeCloseTo(0, 6);
      expect(localY).toBeCloseTo(0, 6);
    });

    it('click at (0, 0) on canvas → local (-50, -50) mm (negative = left of bbox)', () => {
      const { localX, localY } = polygonPointerToLocalMm(
        { x: 0, y: 0 },
        1,
        { x: 50, y: 50 },
      );
      expect(localX).toBeCloseTo(-50, 6);
      expect(localY).toBeCloseTo(-50, 6);
    });
  });

  describe('polygonPointerToLocalMm — mobile (stageScale < 1)', () => {
    it('click at viewport (200, 200) with stageScale=0.538 → local mm un-scales correctly', () => {
      // On mobile, stage DOM container is 320×456 CSS px; scale = 320/595.
      // User clicks at CSS px 200. To get back to the internal coord
      // (0..595) we divide by 0.538; then to mm we divide by PREVIEW_SCALE.
      const scale = 320 / 595;
      const { localX, localY } = polygonPointerToLocalMm(
        { x: 200, y: 200 },
        scale,
        { x: 50, y: 50 },
      );
      // Expected: 200 / 0.538 / 2.83 - 50 ≈ 131.4 - 50 = 81.4 mm.
      expect(localX).toBeCloseTo(81.4, 0);
      expect(localY).toBeCloseTo(81.4, 0);
    });

    it('mobile click at canvas center → local matches desktop click at same canvas-mm position', () => {
      // Mobile and desktop should produce the SAME local-mm result
      // when the user clicks at the same physical canvas-mm location.
      // This invariant is what makes scale-to-fit "feel right" — the
      // user doesn't have to compensate for the visual scale.
      const scale = 320 / 595;
      const desktop = polygonPointerToLocalMm(
        { x: 200, y: 200 },
        1,
        { x: 50, y: 50 },
      );
      const mobile = polygonPointerToLocalMm(
        // Mobile: same canvas-mm position is 200 * scale CSS px.
        { x: 200 * scale, y: 200 * scale },
        scale,
        { x: 50, y: 50 },
      );
      expect(mobile.localX).toBeCloseTo(desktop.localX, 1);
      expect(mobile.localY).toBeCloseTo(desktop.localY, 1);
    });
  });

  describe('polygonPointerToLocalMm — Round 10 regression signature', () => {
    // These assertions encode the EXACT numbers the user reported
    // before the fix. If anyone reverts the conversion to the
    // broken formula, the assertions will produce wildly wrong
    // numbers and the test will fail loudly.
    it('Round 10 stored 250 for a 300px click; Round 13 must store ≈ 56 mm', () => {
      const { localX, localY } = polygonPointerToLocalMm(
        { x: 300, y: 300 },
        1,
        { x: 50, y: 50 },
      );
      // Pre-fix value was 250 (300 / 1 - 50); post-fix is ≈ 56.
      // Lock in the post-fix value with a tight tolerance.
      expect(localX).not.toBe(250);
      expect(localX).toBeGreaterThan(50);
      expect(localX).toBeLessThan(60);
      expect(localY).toBeGreaterThan(50);
      expect(localY).toBeLessThan(60);
    });

    it('Round 10 produced off-canvas vertices (e.g. 849px for a 300px click); Round 13 renders within the visible Stage', () => {
      // The full chain: store the localX via the helper, then read
      // it back through mmToPx (the rendering path). The result must
      // land within PREVIEW_WIDTH_PX × PREVIEW_HEIGHT_PX.
      //
      // Pre-fix: localX stored as 250 mm → renders at 250 * 2.83 ≈
      //   707 px inside Group at mmToPx(50)=141 → absolute 848 px
      //   (outside the 595-wide canvas).
      // Post-fix: localX stored as 56 mm → renders at 56 * 2.83 ≈
      //   158 px inside Group at 141 → absolute 299 px (matches the
      //   user's 300 px click).
      const local = polygonPointerToLocalMm(
        { x: 300, y: 300 },
        1,
        { x: 50, y: 50 },
      );
      const absoluteX = 50 * PREVIEW_SCALE + local.localX * PREVIEW_SCALE;
      const absoluteY = 50 * PREVIEW_SCALE + local.localY * PREVIEW_SCALE;
      expect(absoluteX).toBeCloseTo(300, 0);
      expect(absoluteY).toBeCloseTo(300, 0);
      expect(absoluteX).toBeLessThan(PREVIEW_WIDTH_PX);
      expect(absoluteY).toBeLessThan(842);
    });
  });
});

describe('Step7TableCardCanvas — Round 2 fixes (source + render)', () => {
  beforeEach(() => {
    stagePropsLog.length = 0;
    regularPolygonPropsLog.length = 0;
    ellipsePropsLog.length = 0;
    linePropsLog.length = 0;
    sessionStorage.setItem('saome.accessToken', 'test-token');
  });

  describe('Fix 4a — responsive stage sizing', () => {
    it('renders a Stage with scaleX/scaleY props (Fix 4a enabled)', () => {
      render(<Harness />);
      // After mount, at least one Stage render call should include
      // scaleX/scaleY props (the responsive sizing feature).
      const allStages = stagePropsLog;
      expect(allStages.length).toBeGreaterThan(0);
      const lastStage = allStages[allStages.length - 1];
      expect(lastStage).toHaveProperty('scaleX');
      expect(lastStage).toHaveProperty('scaleY');
    });

    it('default Stage size is PREVIEW_WIDTH_PX (595) at desktop viewport', () => {
      render(<Harness />);
      const lastStage = stagePropsLog[stagePropsLog.length - 1];
      // When container >= 595px, the canvas uses full preview size
      expect(lastStage?.width).toBe(595);
      expect(lastStage?.height).toBe(842);
    });

    it('source: Stage uses container-driven scaleX/scaleY logic', () => {
      // Source-level assertion: verify the canvas file declares a
      // ResizeObserver and sets scaleX/scaleY based on container width.
      const src = readFileSync(
        resolve(__dirname, './Step7TableCardCanvas.web.tsx'),
        'utf8',
      );
      expect(src).toMatch(/new ResizeObserver/);
      expect(src).toMatch(/scaleX=\{stageSize\.scale\}/);
      expect(src).toMatch(/scaleY=\{stageSize\.scale\}/);
      expect(src).toMatch(/containerWidth\s*\/\s*PREVIEW_WIDTH_PX/);
    });
  });

  // ============================================================
  // Round 10 (2026-09-27) — render-level coverage for triangle /
  // ellipse / polygon shapes. The mock library captures the props
  // passed to each Konva primitive; we assert the dispatch reaches
  // the right primitive with the right props.
  // ============================================================
  describe('Round 10 — triangle / ellipse / polygon render via mock', () => {
    it('renders a triangle element via RegularPolygon with sides={3}', () => {
      const before = regularPolygonPropsLog.length;
      const settings: TableCardSettings = {
        elements: [
          {
            id: 'tri-1',
            type: 'shape',
            shape: 'triangle',
            x: 10,
            y: 10,
            width: 60,
            height: 40,
            rotation: 0,
            zIndex: 1,
            fill: '#ff0000',
            stroke: '#000000',
            strokeWidth: 1,
          },
        ],
        background: { type: 'solid', color: '#ffffff' },
        bleedMm: 3,
      };
      render(<Harness settings={settings} />);
      const afterCalls = regularPolygonPropsLog.slice(before);
      // At least one RegularPolygon was rendered with sides={3}.
      const triangleCall = afterCalls.find((p) => p?.sides === 3);
      expect(triangleCall).toBeDefined();
    });

    it('renders an ellipse element via Ellipse with radiusX / radiusY = half bbox', () => {
      const before = ellipsePropsLog.length;
      const settings: TableCardSettings = {
        elements: [
          {
            id: 'el-1',
            type: 'shape',
            shape: 'ellipse',
            x: 10,
            y: 10,
            width: 80,
            height: 40,
            rotation: 0,
            zIndex: 1,
            fill: '#00ff00',
            stroke: undefined,
            strokeWidth: undefined,
          },
        ],
        background: { type: 'solid', color: '#ffffff' },
        bleedMm: 3,
      };
      render(<Harness settings={settings} />);
      const afterCalls = ellipsePropsLog.slice(before);
      // Width=80mm × PREVIEW_SCALE (≈2.833 px/mm) → radiusX ≈ 113.33 px.
      // Height=40mm → radiusY ≈ 56.67 px.
      const PREVIEW_SCALE = 595 / 210;
      const ellipseCall = afterCalls.find(
        (p) =>
          typeof p?.radiusX === 'number' &&
          Math.abs(p.radiusX - (80 / 2) * PREVIEW_SCALE) < 0.01 &&
          typeof p?.radiusY === 'number' &&
          Math.abs(p.radiusY - (40 / 2) * PREVIEW_SCALE) < 0.01,
      );
      expect(ellipseCall).toBeDefined();
    });

    it('renders a polygon element via Line with closed=true and points from element.points', () => {
      const before = linePropsLog.length;
      // Note: Line is also used by the preview helper, so we look
      // for a closed=true call whose points match the element's
      // stored array (distinguishes from the polygon preview line,
      // which has closed=false).
      const settings: TableCardSettings = {
        elements: [
          {
            id: 'poly-1',
            type: 'shape',
            shape: 'polygon',
            x: 10,
            y: 10,
            width: 60,
            height: 40,
            rotation: 0,
            zIndex: 1,
            fill: '#0000ff',
            stroke: '#000000',
            strokeWidth: 1,
            points: [0, 0, 30, 30, 0, 30],
            vertexCount: 3,
          },
        ],
        background: { type: 'solid', color: '#ffffff' },
        bleedMm: 3,
      };
      render(<Harness settings={settings} />);
      const afterCalls = linePropsLog.slice(before);
      const polygonCall = afterCalls.find(
        (p) =>
          p?.closed === true &&
          Array.isArray(p?.points) &&
          (p.points as number[]).length === 6,
      );
      expect(polygonCall).toBeDefined();
    });

    it('Round 18 regression: Line points are converted mm→px (not raw mm)', () => {
      // Root cause of the 2026-09-27 user-reported bug:
      //   `points={pts}` passed bbox-local mm directly to Konva.Line,
      //   which interprets `points` as raw canvas-px offsets. The
      //   visible triangle rendered at ~1/PREVIEW_SCALE ≈ 0.353× the
      //   bbox span (≈ 17.7×14.1 mm for the 60×40 bbox below) while
      //   the vertex markers (which correctly used `mmToPx`) sat at
      //   the true click positions — "編號圍出來的大小與實際形狀不合,
      //   實際的形狀偏小".
      //
      // This test pins the contract: the Line MUST receive points
      // multiplied by PREVIEW_SCALE so the rendered shape matches the
      // marker positions (and the user's actual click positions).
      const PREVIEW_SCALE = 595 / 210; // ≈ 2.833 px/mm
      const before = linePropsLog.length;
      const settings: TableCardSettings = {
        elements: [
          {
            id: 'poly-mm-px',
            type: 'shape',
            shape: 'polygon',
            x: 10,
            y: 10,
            width: 60,
            height: 40,
            rotation: 0,
            zIndex: 1,
            fill: '#0000ff',
            stroke: '#000000',
            strokeWidth: 1,
            // Bbox-local mm (per schema). After the fix, the Line
            // receives each value × PREVIEW_SCALE (canvas-px).
            points: [0, 0, 30, 30, 0, 30],
            vertexCount: 3,
          },
        ],
        background: { type: 'solid', color: '#ffffff' },
        bleedMm: 3,
      };
      render(<Harness settings={settings} />);
      const afterCalls = linePropsLog.slice(before);
      const polygonCall = afterCalls.find(
        (p) =>
          p?.closed === true &&
          Array.isArray(p?.points) &&
          (p.points as number[]).length === 6,
      );
      expect(polygonCall).toBeDefined();
      const pts = polygonCall?.points as number[];
      // Pinpoint each value: 0 mm → 0 px, 30 mm → 30 × PREVIEW_SCALE px.
      expect(pts[0]).toBeCloseTo(0, 5);
      expect(pts[1]).toBeCloseTo(0, 5);
      expect(pts[2]).toBeCloseTo(30 * PREVIEW_SCALE, 5);
      expect(pts[3]).toBeCloseTo(30 * PREVIEW_SCALE, 5);
      expect(pts[4]).toBeCloseTo(0, 5);
      expect(pts[5]).toBeCloseTo(30 * PREVIEW_SCALE, 5);
      // Sanity guard: if a future regression drops the conversion
      // and passes raw mm, pts[2] would be 30 (mm-as-px). The
      // canonical canvas-px value is ~85, which is what we assert.
      expect(pts[2]).not.toBe(30);
    });
  });

  describe('Fix 2 — image element renders via useImage', () => {
    it('source: CanvasImage uses useImage and KonvaImage', () => {
      // Static check: the canvas must import use-image and route image
      // elements through CanvasImage (not the old placeholder Rect).
      const src = readFileSync(
        resolve(__dirname, './Step7TableCardCanvas.web.tsx'),
        'utf8',
      );
      expect(src).toMatch(/import useImage from 'use-image'/);
      // CanvasImage component should call useImage
      expect(src).toMatch(/useImage\(imageUrl,\s*'anonymous'\)/);
      // Success branch must render KonvaImage
      expect(src).toMatch(/return\s*\(\s*<CanvasKonvaImage/);
      expect(src).toMatch(/Image as KonvaImage/);
    });

    it('source: image element branch no longer renders the gray placeholder', () => {
      // Regression: the previous code had a TODO that just rendered a
      // gray Rect. Confirm that's gone and CanvasImage is used instead.
      const src = readFileSync(
        resolve(__dirname, './Step7TableCardCanvas.web.tsx'),
        'utf8',
      );
      // Look for the image branch in renderElement — it should use CanvasImage
      const imageBranchMatch = src.match(
        /if \(el\.type === 'image'\) \{[\s\S]*?\n  \}/,
      );
      expect(imageBranchMatch).not.toBeNull();
      const branch = imageBranchMatch?.[0] ?? '';
      expect(branch).toContain('<CanvasImage');
      // The branch must NOT directly render a Rect with the gray placeholder fill
      expect(branch).not.toContain('fill="#e5e7eb"');
      expect(branch).not.toContain('fill="#9ca3af"');
    });

    it('source: CanvasImage failure branch renders a red dashed placeholder', () => {
      const src = readFileSync(
        resolve(__dirname, './Step7TableCardCanvas.web.tsx'),
        'utf8',
      );
      // Failure branch should produce a visibly distinct placeholder
      expect(src).toMatch(/fill="#fee2e2"/);
      expect(src).toMatch(/stroke="#dc2626"/);
    });
  });

  // ===================================================================
  // Round 7 (2026-09-27) — image click regression + gradient angle
  // ===================================================================
  //
  // Two bugs surfaced in Round 7:
  //
  //   1. Uploaded images were not clickable while loading. The
  //      loading placeholder Rect had `listening={false}`, so the
  //      user's first click (almost always during loading) bubbled
  //      to the Stage's `onMouseDown` and cleared selection. The
  //      image became selectable only after the second click, once
  //      the Konva.Image had rendered.
  //
  //   2. The background gradient's `bg.gradient.angle` slider had
  //      no visible effect. `renderBackground` hard-coded the start
  //      / end points to (0,0) → (W,H), so the gradient always
  //      rendered as a top-left → bottom-right diagonal regardless
  //      of the user's selected angle.
  //
  // Both fixes are at the source level because jsdom cannot run
  // Konva's hit-test or canvas rasterization to verify the visual
  // outcome.

  describe('Round 7 — image element clickability during loading', () => {
    it('source: loading placeholder Rect has onClick and onTap (regression — image not clickable)', () => {
      const src = readFileSync(
        resolve(__dirname, './Step7TableCardCanvas.web.tsx'),
        'utf8',
      );
      // The loading branch must wire up onClick and onTap on the
      // placeholder Rect so users can attach the Transformer at
      // any point during the upload. The previous version had
      // `listening={false}` here, which silently dropped clicks.
      // We use a tolerant regex that matches the onClick/onTap
      // pair anywhere inside the loading branch (between the
      // `status === 'loading'` check and the next return).
      expect(src).toMatch(
        /status === 'loading'[\s\S]*?onClick=\{\(\) => onSelect\(element\.id\)\}/,
      );
      expect(src).toMatch(
        /status === 'loading'[\s\S]*?onTap=\{\(\) => onSelect\(element\.id\)\}/,
      );
    });

    it('source: loading placeholder Rect no longer has listening={false}', () => {
      const src = readFileSync(
        resolve(__dirname, './Step7TableCardCanvas.web.tsx'),
        'utf8',
      );
      // Defensive: the previous bug was caused by `listening={false}`
      // on the loading Rect. Verify it's gone. Note: the bleed
      // overlay layer and the circle/triangle image wrapper Group
      // still legitimately use `listening={false}`, so we constrain
      // the negative assertion to the loading Rect's JSX attributes
      // (skipping the comment block, which legitimately references
      // the old behavior to document the fix).
      //
      // Match from the loading Rect's `fill="#e5e7eb"` attribute
      // (unique to the loading Rect — failed branch uses
      // `fill="#fee2e2"`) through to the closing `/>`.
      const loadingRect = src.match(
        /fill="#e5e7eb"[\s\S]*?onTap=\{\(\) => onSelect\(element\.id\)\}\s*\/>/,
      );
      expect(loadingRect).not.toBeNull();
      expect(loadingRect?.[0] ?? '').not.toMatch(/listening=\{false\}/);
    });
  });

  describe('Round 7 — background gradient angle wired via shared helper', () => {
    it('source: renderBackground calls gradientAngleToEndPoints with bg.gradient.angle', () => {
      const src = readFileSync(
        resolve(__dirname, './Step7TableCardCanvas.web.tsx'),
        'utf8',
      );
      // The Round 7 fix routes `bg.gradient.angle` through the
      // shared `gradientAngleToEndPoints` helper so the slider
      // actually drives Konva's fillLinearGradient{Start,End}Point.
      // Allow an optional trailing comma after the last argument
      // (prettier keeps multi-line argument lists comma-terminated).
      expect(src).toMatch(/import\s*\{[^}]*\bgradientAngleToEndPoints\b[^}]*\}\s*from\s*'@saome\/shared\/logic\/tableCard'/);
      expect(src).toMatch(
        /gradientAngleToEndPoints\(\s*bg\.gradient\.angle,\s*PREVIEW_WIDTH_PX,\s*PREVIEW_HEIGHT_PX,?\s*\)/,
      );
    });

    it('source: renderBackground no longer hard-codes the diagonal (0,0) → (W,H)', () => {
      const src = readFileSync(
        resolve(__dirname, './Step7TableCardCanvas.web.tsx'),
        'utf8',
      );
      // Defensive: the previous bug was caused by hard-coded
      // fillLinearGradientStartPoint={{ x: 0, y: 0 }} and
      // fillLinearGradientEndPoint={{ x: PREVIEW_WIDTH_PX,
      // y: PREVIEW_HEIGHT_PX }}. After the Round 7 fix the
      // gradient block should not contain those literals.
      const gradientBlock = src.match(
        /if \(bg\.type === 'gradient' && bg\.gradient\)[\s\S]*?\n  \}/,
      );
      expect(gradientBlock).not.toBeNull();
      const block = gradientBlock?.[0] ?? '';
      expect(block).not.toMatch(/fillLinearGradientStartPoint=\{\{\s*x:\s*0,\s*y:\s*0\s*\}\}/);
      expect(block).not.toMatch(/fillLinearGradientEndPoint=\{\{\s*x:\s*PREVIEW_WIDTH_PX,\s*y:\s*PREVIEW_HEIGHT_PX\s*\}\}/);
      // The block should destructure the helper output and pass it to Konva.
      expect(block).toMatch(/fillLinearGradientStartPoint=\{start\}/);
      expect(block).toMatch(/fillLinearGradientEndPoint=\{end\}/);
    });
  });

  // ===================================================================
  // Round 6 (2026-09-27) — text wrap + image shape transformation
  // ===================================================================
  //
  // Source-level conformance tests for invariants that jsdom cannot
  // observe through render (Konva uses HTMLCanvasElement which jsdom
  // doesn't support, so the actual Konva.Image clipFunc + Konva.Text
  // wrap behavior can only be verified at the source level).

  describe('Round 6 — text element wrap="word" support', () => {
    it('source: KonvaText element gets wrap="word" prop (multi-line)', () => {
      const src = readFileSync(
        resolve(__dirname, './Step7TableCardCanvas.web.tsx'),
        'utf8',
      );
      // Verify wrap is set on the text rendering branch. round 6
      // introduces this so users can type Enter-to-break-line and see
      // multi-line text on the canvas.
      expect(src).toMatch(/wrap="word"/);
    });

    it('source: KonvaText element has ellipsis={false} (no "…" truncation)', () => {
      const src = readFileSync(
        resolve(__dirname, './Step7TableCardCanvas.web.tsx'),
        'utf8',
      );
      // ellipsis={false} prevents Konva from appending "…" when
      // content overflows the bounding box height. Users can resize
      // the bounding box taller from the Transformer handles if they
      // need more vertical room, instead of seeing a truncated string.
      expect(src).toMatch(/ellipsis=\{false\}/);
    });
  });

  describe('Round 6 — image shape transformation (clipShape / clipRadius)', () => {
    it('source: clipShape === "rect" uses Konva.Image native cornerRadius', () => {
      const src = readFileSync(
        resolve(__dirname, './Step7TableCardCanvas.web.tsx'),
        'utf8',
      );
      // Rect mode must route clipRadius through Konva.Image's
      // built-in cornerRadius prop (mm → px via PREVIEW_SCALE). This
      // is the legacy / default path; we keep it for backward compat.
      // Round 7 (2026-09-27) — passes `cornerRadius={...}` directly
      // on <KonvaImage> instead of building a `clipProps` object and
      // spreading it. The two regexes below verify the new direct-prop
      // form (legacy `clipProps.cornerRadius = ...` and
      // `{...clipProps}` are no longer used).
      expect(src).toMatch(
        /cornerRadius=\{cornerRadiusPx\s*>\s*0\s*\?\s*cornerRadiusPx\s*:\s*undefined\}/,
      );
      expect(src).toMatch(/<KonvaImage[\s\S]*?cornerRadius=\{cornerRadiusPx/);
    });

    it('source: clipShape === "circle" wraps Konva.Image in a Konva.Group with clipFunc', () => {
      const src = readFileSync(
        resolve(__dirname, './Step7TableCardCanvas.web.tsx'),
        'utf8',
      );
      // Round 7 (2026-09-27) — bug fix. Konva.Image ignores
      // `clipFunc` (clipFunc is only applied during Konva.Group /
      // Konva.Layer draw cycles). We now wrap the Image in a
      // `<Group clipFunc={...}>` for the circle / triangle paths.
      //
      //   - The branch must branch on clipShape === 'circle' and
      //     build a clipFunc that draws an arc inscribed in the
      //     bounding box. The arc starts at angle 0 and sweeps 2π.
      //   - The branch must render <Group ... clipFunc={clipFunc}>.
      expect(src).toMatch(/clipShape === 'circle'/);
      expect(src).toMatch(
        /ctx\.arc\(\s*width\s*\/\s*2,\s*height\s*\/\s*2,\s*radius,\s*0,\s*Math\.PI\s*\*\s*2\s*\)/,
      );
      expect(src).toMatch(/<Group[\s\S]*?clipFunc=\{clipFunc\}/);
    });

    it('source: clipShape === "triangle" wraps Konva.Image in a Konva.Group with clipFunc', () => {
      const src = readFileSync(
        resolve(__dirname, './Step7TableCardCanvas.web.tsx'),
        'utf8',
      );
      // Triangle mode must construct a clipFunc with three vertices:
      // apex at top-center, base spanning the full width. Round 7
      // wraps this in a Group so Konva actually applies the clipFunc
      // (the bare Konva.Image.clipFunc is a silent no-op).
      //
      // The new implementation expresses the shape routing as a
      // ternary `clipShape === 'circle' ? ... : ...` so the literal
      // string `clipShape === 'triangle'` no longer appears; we
      // verify the triangle geometry instead (the unique draw
      // calls — `moveTo(width/2, 0)`, two `lineTo` calls to
      // opposite corners). The Group wrapping is shared with the
      // circle path, asserted via the regex below.
      expect(src).toMatch(/ctx\.moveTo\(\s*width\s*\/\s*2,\s*0\s*\)/);
      expect(src).toMatch(/ctx\.lineTo\(\s*width,\s*height\s*\)/);
      expect(src).toMatch(/ctx\.lineTo\(\s*0,\s*height\s*\)/);
      expect(src).toMatch(/<Group[\s\S]*?clipFunc=\{clipFunc\}/);
    });

    it('source: circle path uses literal "circle" branch label', () => {
      const src = readFileSync(
        resolve(__dirname, './Step7TableCardCanvas.web.tsx'),
        'utf8',
      );
      // Defensive: make sure the circle branch identifier is still
      // present in the source so a future refactor doesn't silently
      // route both circle + triangle into the same handler (the
      // drawing math is different).
      expect(src).toMatch(/clipShape\s*===\s*'circle'/);
    });

    it('source: clipRadius default is 0 (no rounding when undefined)', () => {
      const src = readFileSync(
        resolve(__dirname, './Step7TableCardCanvas.web.tsx'),
        'utf8',
      );
      // Defensive: when clipRadius is undefined, the canvas must
      // default to 0 (no rounding) — never NaN, never undefined.
      expect(src).toMatch(/mmToPx\(element\.clipRadius\s*\?\?\s*0\)/);
    });

    it('source: wrapping Group carries the element id (Transformer attach target)', () => {
      const src = readFileSync(
        resolve(__dirname, './Step7TableCardCanvas.web.tsx'),
        'utf8',
      );
      // Round 7 — when the Image is wrapped in a Group, the Group
      // must own the `id={element.id}` so `stage.findOne(`#${id}`)`
      // (in the canvas's Transformer wiring) attaches to the right
      // node. Without this the Transformer would still target the
      // inner Image, defeating the whole wrapper purpose.
      expect(src).toMatch(/<Group[\s\S]*?id=\{element\.id\}/);
      expect(src).toMatch(/<Group[\s\S]*?draggable/);
      // Also confirm the inner KonvaImage has listening={false} so
      // click / drag events bubble up to the Group's handlers.
      expect(src).toMatch(/listening=\{false\}/);
    });
  });

  // ===================================================================
  // Round 8 (2026-09-27) — image clickability after loading
  // ===================================================================
  //
  // User report (2026-09-27): "新上傳的圖片在畫布上一開始可以點選，後來又不行了，
  // 已經在畫布上的舊圖片也是不能點選。" After the Round 7 fix made the
  // LOADING placeholder Rect clickable, the user noticed that the
  // LOADED Konva.Image is still unclickable. The Round 7 fix only
  // addressed the loading state, not the loaded state.
  //
  // Root cause:
  //   Konva.Image uses PIXEL-BASED hit detection by default. For PNG
  //   uploads with transparent backgrounds (logos, icons, sticker art),
  //   clicks on the transparent area do not fire onClick. The user
  //   sees the image rendered (Konva.Image renders visible pixels
  //   correctly), but clicking anywhere on the bounding box outside
  //   the visible silhouette silently does nothing. JPEG uploads with
  //   no transparency also exhibit this when combined with the
  //   Stage's onMouseDown deselect logic and a Transformer attached
  //   to the wrong node after a re-render.
  //
  // Fix:
  //   Unify the rect / circle / triangle code paths so all three
  //   render `<Group><KonvaImage listening={false} /></Group>`.
  //   - Group has `id`, draggable, onClick, onTap, onDragEnd,
  //     onTransformEnd, opacity — ALL event handling on the Group.
  //   - Inner Konva.Image has `listening={false}` so events bubble
  //     up to the Group consistently across all clipShape values.
  //   - Group's clipFunc is set ONLY for circle / triangle. For rect
  //     (the default), no clipFunc → rectangular hit region (fixes
  //     the pixel-based hit detection bug).
  //   - Inner Konva.Image keeps `cornerRadius` (the rect rounding
  //     feature). Konva.Image.cornerRadius still renders correctly
  //     inside a Group because it's a built-in property that draws
  //     rounded corners on the image's own pixels.
  //
  // Why source-level tests (not runtime):
  //   jsdom has no canvas context. We can't actually click on a
  //   Konva.Image in jsdom. The behavioral fix is verified manually
  //   in dev (visible in browser). The structural tests below pin
  //   down the code shape so a future refactor can't silently
  //   regress to the bare-KonvaImage-onClick pattern.

  describe('Round 8 — image clickability after loading', () => {
    it('source: rect path no longer renders a bare <KonvaImage> with onClick (regression — pixel-based hit detection)', () => {
      const src = readFileSync(
        resolve(__dirname, './Step7TableCardCanvas.web.tsx'),
        'utf8',
      );
      // Before Round 8, the rect branch returned a bare
      // <KonvaImage id={...} onClick={handleClick} onTap={handleTap} ... />.
      // That bare KonvaImage uses pixel-based hit detection by
      // default — clicks on transparent pixels of the uploaded
      // image do NOT fire onClick. The user sees the image but
      // can't select it.
      //
      // After Round 8, the rect path also wraps the Konva.Image in
      // a Group. The Group's hit region is its bounding box, so
      // clicks anywhere in the image's footprint select it.
      //
      // We assert on the BAD pattern (it should NOT exist). The
      // positive Group assertion is in the next test.
      //
      // The regex range (0–1000 chars) covers the actual distance
      // from `<KonvaImage` to `onClick={handleClick}` in the source
      // (~553 chars including comments) without false-matching the
      // comment block (which mentions `<KonvaImage>` in prose and
      // also uses `onClick`/`onTap` later).
      expect(src).not.toMatch(
        /<KonvaImage\s+id=\{element\.id\}[\s\S]{0,1000}onClick=\{handleClick\}[\s\S]{0,200}onTap=\{handleTap\}/,
      );
    });

    it('source: CanvasKonvaImage returns a single Group wrapper regardless of clipShape', () => {
      const src = readFileSync(
        resolve(__dirname, './Step7TableCardCanvas.web.tsx'),
        'utf8',
      );
      // The unified CanvasKonvaImage has a single return statement
      // that returns <Group>...</Group>. The Group's `clipFunc` prop
      // is set conditionally (undefined for rect, arc for circle,
      // triangle path for triangle). The inner <KonvaImage> has
      // listening={false} so events bubble to the Group.
      //
      // We check the structural shape: a single <Group> with onClick,
      // onTap, id, draggable, and a nested <KonvaImage ... listening={false}>.
      expect(src).toMatch(/<Group[\s\S]*?onClick=\{handleClick\}/);
      expect(src).toMatch(/<Group[\s\S]*?onTap=\{handleTap\}/);
      expect(src).toMatch(/<Group[\s\S]*?id=\{element\.id\}/);
      expect(src).toMatch(/<Group[\s\S]*?draggable/);
      // The inner Konva.Image has listening={false} (events bubble up).
      expect(src).toMatch(/<KonvaImage[\s\S]*?listening=\{false\}/);
    });

    it('source: clipFunc is only set when clipShape is circle or triangle (not rect)', () => {
      const src = readFileSync(
        resolve(__dirname, './Step7TableCardCanvas.web.tsx'),
        'utf8',
      );
      // The clipFunc variable is built by an `if/else` ladder keyed
      // off `clipShape === 'circle'` (ternary or if-statement).
      // For rect, clipFunc evaluates to undefined → Group has no
      // clipFunc → full bounding-box hit region (fixes the
      // pixel-based hit detection bug).
      // For circle, clipFunc draws an arc inscribed in the bbox.
      // For triangle (the implicit else branch), clipFunc draws a
      // 3-vertex triangle.
      //
      // Structural assertion: the `clipShape === 'circle'` branch
      // label is present (Round 6 introduced this; Round 7 wrapped
      // it in a Group). The `clipFunc={clipFunc}` prop on the Group
      // is set (Round 7 wiring). After Round 8, the same Group
      // structure applies to rect as well (no clipFunc → undefined).
      expect(src).toMatch(/clipShape\s*===\s*'circle'/);
      expect(src).toMatch(/clipFunc=\{clipFunc\}/);
    });

    it('source: inner Konva.Image keeps cornerRadius prop (rect rounding preserved)', () => {
      const src = readFileSync(
        resolve(__dirname, './Step7TableCardCanvas.web.tsx'),
        'utf8',
      );
      // Round 6's rect-rounding feature (clipRadius → cornerRadius)
      // must still work after the unification. The cornerRadius
      // prop is set on the inner Konva.Image (not on the Group)
      // because Konva.Image.cornerRadius is a built-in property
      // that draws rounded corners on the image's pixels. It works
      // inside a Group because Group applies its own x/y/rotation
      // /scale AFTER its children's draw cycles.
      expect(src).toMatch(
        /cornerRadius=\{cornerRadiusPx\s*>\s*0\s*\?\s*cornerRadiusPx\s*:\s*undefined\}/,
      );
      // The cornerRadius prop is on the inner Konva.Image (not on
      // the Group). Verify by looking for the prop within a
      // Konva.Image context.
      expect(src).toMatch(/<KonvaImage[\s\S]*?cornerRadius=\{cornerRadiusPx/);
    });
  });

  // ===================================================================
  // Round 9 (2026-09-27) — Konva.Group hit region regression
  // ===================================================================
  //
  // User feedback on 2026-09-27 after Round 8 merged: "還是點擊不到圖片"
  // (still can't click image). Round 8 unified the rect / circle /
  // triangle code paths under `<Group><KonvaImage listening={false} /></Group>`,
  // but the structural fix didn't account for a fundamental Konva
  // behavior: **Konva.Group has NO hit region of its own — its hit
  // detection comes entirely from its children**.
  //
  // With the inner Konva.Image set to `listening={false}`, the Group
  // has no listening descendants → no hit region → clicks on the
  // image's bounding box fall through to the Stage. The Stage's
  // `onMouseDown` handler then calls `onSelect(null)` (clears
  // selection) because `e.target === e.target.getStage()` is true.
  //
  // This bug is unique to CanvasKonvaImage (which uses the Group
  // wrapper). Text / shape elements render directly with their own
  // onClick + Konva's built-in hit detection (rectangular for Rect,
  // circular for Circle, line for Line), so they're unaffected.
  //
  // Fix:
  //   Add a transparent `<Rect>` as the FIRST child of the Group.
  //   The Rect spans the Group's local coordinate system
  //   (x=0, y=0, width=width, height=height) and has
  //   `fill="rgba(0,0,0,0)"` so it doesn't affect the visual
  //   output. Konva traverses children for hit detection in REVERSE
  //   order; the Rect's hit region (the full bbox, clipped by the
  //   Group's clipFunc when set) is now hit-testable. Clicks bubble
  //   up to the Group, firing its onClick handler.
  //
  // For circle / triangle clipShape paths, the Group's clipFunc
  // clips BOTH the visual canvas AND the hit canvas, so the
  // transparent Rect is properly limited to the shape's interior —
  // clicks outside the shape still fall through to the Stage
  // (correct deselect behavior).
  //
  // Why source-level tests (not runtime):
  //   jsdom has no canvas context. Konva's hit detection happens
  //   inside the canvas draw cycle, which jsdom can't simulate. The
  //   structural tests below pin down the code shape (Rect exists,
  //   Rect is nested in the Group, Rect spans the full bbox) so a
  //   future refactor can't silently regress to "Group with no
  //   listening children".
  describe('Round 9 — Konva.Group hit region (image still unclickable after Round 8)', () => {
    it('source: Group contains a transparent hit-target Rect (regression — Konva.Group needs listening children for hit region)', () => {
      const src = readFileSync(
        resolve(__dirname, './Step7TableCardCanvas.web.tsx'),
        'utf8',
      );
      // Konva.Group's hit detection comes entirely from its
      // children. With only a Konva.Image that has
      // listening={false}, the Group has NO hit region — clicks on
      // the bounding box fall through to the Stage (which clears
      // selection via onMouseDown).
      //
      // The fix: add a transparent <Rect> as a listening child to
      // give the Group a hit region. The Rect has
      // fill="rgba(0,0,0,0)" so it doesn't affect the visual
      // output (no fill = transparent fill = invisible rendering,
      // but still hit-testable because Konva uses the shape path,
      // not the fill, for hit detection).
      expect(src).toMatch(/<Rect[\s\S]*?fill="rgba\(0,0,0,0\)"/);
    });

    it('source: hit-target Rect is nested inside the Group wrapper (not a sibling)', () => {
      const src = readFileSync(
        resolve(__dirname, './Step7TableCardCanvas.web.tsx'),
        'utf8',
      );
      // The Rect must be INSIDE the Group (between <Group ...> and
      // </Group>), not just somewhere else in the file. The Group
      // wrapper for image elements is uniquely identifiable by the
      // presence of `id={element.id}` (which the Round 8 prose
      // comments don't contain — anchors the match to the actual JSX
      // and prevents matching the comment block).
      const groupMatch = src.match(
        /<Group[\s\S]*?id=\{element\.id\}[\s\S]*?<\/Group>/,
      );
      expect(groupMatch).not.toBeNull();
      expect(groupMatch?.[0] ?? '').toMatch(/<Rect[\s\S]*?fill="rgba\(0,0,0,0\)"/);
    });

    it('source: hit-target Rect spans the full bbox (x=0, y=0, width=width, height=height)', () => {
      const src = readFileSync(
        resolve(__dirname, './Step7TableCardCanvas.web.tsx'),
        'utf8',
      );
      // The hit Rect must cover the Group's local coordinate system
      // (origin at top-left of the bbox, dimensions matching the
      // image's width / height). Without this, some portion of the
      // bbox would not be hit-testable, reintroducing the bug for
      // that region.
      //
      // Anchor on `id={element.id}` to match the actual JSX Group,
      // not the Round 8 prose comment.
      const groupMatch = src.match(
        /<Group[\s\S]*?id=\{element\.id\}[\s\S]*?<\/Group>/,
      );
      expect(groupMatch).not.toBeNull();
      const groupBody = groupMatch?.[0] ?? '';
      expect(groupBody).toMatch(/<Rect[\s\S]*?x=\{0\}[\s\S]*?y=\{0\}/);
      expect(groupBody).toMatch(/<Rect[\s\S]*?width=\{width\}[\s\S]*?height=\{height\}/);
    });

    it('source: inner Konva.Image still has listening={false} (events bubble to Group via hit Rect)', () => {
      const src = readFileSync(
        resolve(__dirname, './Step7TableCardCanvas.web.tsx'),
        'utf8',
      );
      // Defensive: the inner Konva.Image stays listening={false}
      // even with the hit Rect in place. This ensures events on the
      // visible image pixels bubble up to the Group via the Rect
      // (consistent path), not via the Konva.Image's built-in
      // pixel-based hit detection. If we ever flip this back to
      // listening={true}, PNG-with-transparent-background uploads
      // would regress to the original bug.
      expect(src).toMatch(/<KonvaImage[\s\S]*?listening=\{false\}/);
    });
  });

  // ============================================================
  // Round 10 (2026-09-27) — triangle / ellipse / polygon rendering
  // + polygon creation mode
  // ============================================================
  describe('Round 10 — triangle / ellipse / polygon shape branches', () => {
    let src: string;
    beforeEach(() => {
      src = readFileSync(
        resolve(__dirname, 'Step7TableCardCanvas.web.tsx'),
        'utf8',
      );
    });

    it('source: imports Ellipse and RegularPolygon from react-konva', () => {
      // Both new Konva primitives must be imported. Without these,
      // the triangle / ellipse branches fail to compile.
      expect(src).toMatch(/import\s*\{[^}]*Ellipse[^}]*\}\s*from\s*'react-konva'/);
      expect(src).toMatch(/import\s*\{[^}]*RegularPolygon[^}]*\}\s*from\s*'react-konva'/);
    });

    it('source: shape branch dispatches on the new triangle / ellipse / polygon kinds', () => {
      // The shape branch must have explicit dispatch for each new
      // shape kind. Without these, the renderer would fall through
      // to the existing rect / circle / line branches and silently
      // mis-render.
      expect(src).toMatch(/el\.shape\s*===\s*'triangle'/);
      expect(src).toMatch(/el\.shape\s*===\s*'ellipse'/);
      expect(src).toMatch(/el\.shape\s*===\s*'polygon'/);
    });

    it('source: triangle uses RegularPolygon with sides={3}', () => {
      // Round 11 — Triangle is rendered as RegularPolygon with
      // sides=3, wrapped in a <Group> so the Group owns the bbox
      // math (the prior bug was RegularPolygon being positioned at
      // the bbox CENTER, which broke drag/transform math because
      // Konva's RegularPolygon.width()/height() return 0).
      //
      // Match the `el.shape === 'triangle'` branch (looking up to
      // 1500 chars ahead so we catch the Group wrapper).
      const triangleBranch = src.match(
        /el\.shape\s*===\s*'triangle'[\s\S]{0,3500}?<\/Group>/,
      );
      expect(triangleBranch).not.toBeNull();
      expect(triangleBranch?.[0] ?? '').toMatch(/sides=\{3\}/);
      // The Group must own the bbox (x, y, width, height) so the
      // Transformer attaches correctly.
      expect(triangleBranch?.[0] ?? '').toMatch(/x=\{x\}/);
      expect(triangleBranch?.[0] ?? '').toMatch(/y=\{y\}/);
      expect(triangleBranch?.[0] ?? '').toMatch(/width=\{width\}/);
      expect(triangleBranch?.[0] ?? '').toMatch(/height=\{height\}/);
      // The inner RegularPolygon sits at the Group's local center.
      expect(triangleBranch?.[0] ?? '').toMatch(
        /<RegularPolygon[\s\S]*?x=\{width\s*\/\s*2\}/,
      );
      expect(triangleBranch?.[0] ?? '').toMatch(
        /radius=\{Math\.min\(width,\s*height\)\s*\/\s*2\}/,
      );
    });

    it('source: ellipse uses radiusX / radiusY (half the bbox dimensions)', () => {
      // Ellipse is centered in the bbox with radiusX / radiusY = w/2
      // and h/2 respectively. Konva.Ellipse's geometry requires both.
      //
      // Round 12 (2026-09-27) — fix regex window.
      // The previous 1500-char window was sized for the bare
      // `<Ellipse ... />` JSX; Round 12 added a hit-target Rect +
      // comment block (~400 chars) inside the same Group, pushing
      // `<Ellipse` past the 1500-char boundary. We anchor on the
      // JSX's own `x` attribute (a unique signature of the
      // actual Ellipse element, not its comment-text mention) to
      // find the element regardless of how much preceding text is
      // inside the Group.
      const ellipseEl = src.match(
        /<Ellipse\s+x=\{width\s*\/\s*2\}[\s\S]*?\/>/,
      );
      expect(ellipseEl).not.toBeNull();
      expect(ellipseEl?.[0] ?? '').toMatch(/radiusX=\{width\s*\/\s*2\}/);
      expect(ellipseEl?.[0] ?? '').toMatch(/radiusY=\{height\s*\/\s*2\}/);
    });

    it('source: polygon branch uses Line with closed (true, not false)', () => {
      // Polygon is a closed shape; the renderer must use
      // `closed` (which evaluates to `true`) — never `closed={false}`.
      // Polygon Line uses self-closing `<Line ... />` (no closing tag).
      // Round 11 — destructured `pts = el.points ?? []` so the
      // regex checks for `points={pts}` instead of `points={el.points}.
      //
      // Round 18 (2026-09-27) — `points={pts}` (raw mm) was a unit
      // bug: Konva.Line treats `points` as canvas-px offsets. The
      // fix converts each value via `mmToPx(...)` before passing.
      // We assert the converted form is present so a future
      // regression that drops the conversion is caught.
      const polygonBranch = src.match(
        /el\.shape\s*===\s*'polygon'[\s\S]{0,3000}?(?:<Line[\s\S]{0,3000}?\/>|<\/Line>)/,
      );
      expect(polygonBranch).not.toBeNull();
      expect(polygonBranch?.[0] ?? '').toMatch(/closed(?!\s*=\s*\{\s*false)/);
      // Either `points={ptsPx}` (post-Round 18 fix) or
      // `points={pts.map(...)}` is acceptable, but `points={pts}`
      // alone (raw mm) is NOT — it triggers the regression.
      const ptsLine = polygonBranch?.[0] ?? '';
      const usesPtsRaw = /points=\{pts\}(?!\.map)/.test(ptsLine);
      const usesPtsPxOrMap = /points=\{ptsPx\}|points=\{pts\.map\(/.test(ptsLine);
      expect(usesPtsPxOrMap).toBe(true);
      expect(usesPtsRaw).toBe(false);
    });

    it('source: polygon onTransformEnd scales points by scaleX / scaleY', () => {
      // When the user resizes a polygon via the Transformer, the
      // stored `points` array must be scaled proportionally to the
      // new bbox. Without this scaling, subsequent renders would
      // squash the polygon visually.
      const polygonBranch = src.match(
        /el\.shape\s*===\s*'polygon'[\s\S]{0,3000}?(?:<Line[\s\S]{0,3000}?\/>|<\/Line>)/,
      );
      expect(polygonBranch).not.toBeNull();
      expect(polygonBranch?.[0] ?? '').toMatch(/scaleX\(\)/);
      expect(polygonBranch?.[0] ?? '').toMatch(/scaleY\(\)/);
      expect(polygonBranch?.[0] ?? '').toMatch(/newPts/);
    });

    it('source: polygon preview helper renders vertex markers + connecting dashed line', () => {
      // Round 11 — vertex markers moved out of `renderPolygonPreview`
      // into a dedicated `renderPolygonVertexMarkers` helper that's
      // called by both the preview (creation mode) and the
      // finished-polygon renderer (when selected). Assert on the
      // helper's signature + usage sites so a future refactor
      // doesn't drop the per-vertex feature.
      expect(src).toMatch(/function renderPolygonVertexMarkers/);
      // Round 19 — preview-side callsite passes `isMobile` as the
      // 3rd argument so the marker geometry scales on mobile.
      expect(src).toMatch(
        /renderPolygonVertexMarkers\(\s*vertices,\s*markerOpts,\s*isMobile\s*\)/,
      );
      // Round 19 — finished-polygon side passes `isMobile` too.
      // The multi-line shape with the nested arrow function makes
      // a strict regex brittle; instead, anchor on the surrounding
      // `el.shape === 'polygon'` branch (the only place where the
      // callsite lives) and just verify `isMobile` appears within
      // its body.
      const polygonBranch = src.match(
        /el\.shape\s*===\s*'polygon'[\s\S]{0,4500}?<\/Group>/,
      );
      expect(polygonBranch).not.toBeNull();
      expect(polygonBranch?.[0] ?? '').toMatch(/renderPolygonVertexMarkers\(/);
      expect(polygonBranch?.[0] ?? '').toMatch(/isMobile/);
      // Connecting dashed line stays in renderPolygonPreview.
      expect(src).toMatch(/function renderPolygonPreview/);
      // Round 14 — bumped the main preview strokeWidth 1.5 → 3 and
      // dash [6,4] → [10,6] so the in-progress outline reads
      // clearly on the printed A4 preview.
      expect(src).toMatch(/strokeWidth=\{3\}/);
      expect(src).toMatch(/dash=\{\[\s*10,\s*6\s*\]\}/);
      // Cursor-following dashed line.
      expect(src).toMatch(/cursorPosMm/);
    });
  });

  // ============================================================
  // Round 10 — polygon creation mode wiring (canvas intercepts
  // pointer events while polygonCreation is non-null)
  // ============================================================
  describe('Round 10 — polygon creation mode stage handlers', () => {
    let src: string;
    beforeEach(() => {
      src = readFileSync(
        resolve(__dirname, 'Step7TableCardCanvas.web.tsx'),
        'utf8',
      );
    });

    it('source: Stage onMouseDown routes to appendPolygonVertex when drawing', () => {
      // When polygonCreation is non-null, onMouseDown should call
      // appendPolygonVertex with the local pointer position rather
      // than clearing selection.
      const mousedown = src.match(
        /onMouseDown=\{[\s\S]{0,2000}?\}\s*\}/,
      );
      expect(mousedown).not.toBeNull();
      expect(mousedown?.[0] ?? '').toMatch(/isDrawingPolygon/);
      expect(mousedown?.[0] ?? '').toMatch(/appendPolygonVertex/);
    });

    it('source: canvas finish button triggers finishPolygonCreation + addElement (Round 11→14)', () => {
      // Round 11 — Enter / double-click were removed from the canvas
      // (they didn't fire reliably under React 19 strict mode and
      // dblclick would also push two unwanted vertices before the
      // second click). The replacement is an on-canvas "Finish
      // polygon" button next to the last placed vertex. The handler
      // invokes `finishPolygonCreation` + the shared polygon
      // builder (previously an inline `finishPolygonDrawing`
      // wrapper; Round 14 extracted it to
      // `./Step7TableCard.polygonElement` so the Inspector can
      // produce identical elements — see the Inspector test for the
      // completion-via-button coverage).
      //
      // We assert structural invariants individually rather than one
      // giant regex (the surrounding JSX is large and brittle).
      // `cancelBubble` prevents the click from bubbling to the
      // Stage's onMouseDown (which would add another vertex). Round
      // 14 adds a belt-and-suspenders `onMouseDown` + `onTouchStart`
      // on the button Group so the Stage's mousedown handler is
      // suppressed even if a future refactor loosens its target-gate
      // check.
      expect(src).toMatch(/finishPolygonCreation\(\)/);
      // Round 14 — shared builder replaces the inline
      // `finishPolygonDrawing`. Both the Canvas and the Inspector
      // call this from the same module, so the canvas's on-canvas
      // Finish button and the Inspector's 完成多邊形 button produce
      // byte-identical elements (no more Round 14 Bug 2 where the
      // Inspector path hardcoded x=50, y=50, width=60, height=40).
      expect(src).toMatch(/buildPolygonElementFromVertices\(/);
      expect(src).toMatch(/nextPolygonZIndex\(/);
      // Round 12 — text is now i18n-driven (was hardcoded
      // `"完成多邊形"`). The key lives in
      // `tableCard.shape.polygonFinish` (zh-TW: '完成多邊形',
      // en: 'Finish polygon'). The mirror i18n test in
      // Step7TableCard.i18n.test.ts pins both locales' values.
      expect(src).toMatch(/text=\{t\(['"]shape\.polygonFinish['"]\)\}/);
      // cancelBubble is invoked from BOTH the click handler and the
      // Round 14 mousedown / touchstart belt-and-suspenders. We
      // assert it appears at least twice to pin both call sites.
      const cancelBubbleCount = (src.match(/e\.cancelBubble\s*=\s*true/g) ?? []).length;
      expect(cancelBubbleCount).toBeGreaterThanOrEqual(2);
      // The button's mousedown + touchstart handlers must each
      // cancel bubble. Without them, Stage's onMouseDown would
      // (Round 14) push a stray vertex before the click fires.
      expect(src).toMatch(/onMouseDown=\{stopPointer\}/);
      expect(src).toMatch(/onTouchStart=\{stopPointer\}/);
      // The button is gated on >=3 vertices (vertices.length >= 6).
      expect(src).toMatch(/polygonCreation\.vertices\.length\s*>=\s*6/);
    });

    it('source: Stage onMouseDown is gated on direct stage hit (Round 14 — Bug 1 fix)', () => {
      // Round 14 — clicking the on-canvas Finish button used to push
      // a stray vertex because the Stage's onMouseDown fired for ANY
      // node-inside-stage click. The fix gates the drawing branch on
      // `e.target === e.target.getStage()` so only direct stage
      // clicks (empty canvas) become vertices. Anything else
      // (overlay nodes like the Finish button, existing elements
      // with their own handlers) is left alone.
      const mousedown = src.match(/onMouseDown=\{[\s\S]{0,2400}?\}\s*\}/);
      expect(mousedown).not.toBeNull();
      // Must gate on `e.target !== stage` (early-return) inside the
      // drawing branch.
      expect(mousedown?.[0] ?? '').toMatch(/e\.target\s*!==\s*stage/);
      // Must still call appendPolygonVertex for direct stage hits.
      expect(mousedown?.[0] ?? '').toMatch(/appendPolygonVertex/);
    });

    it('source: Escape keyboard handler cancels polygon creation (Enter removed Round 11)', () => {
      // Round 11 — Enter handler was removed because the on-canvas
      // Finish button is more discoverable. Esc still cancels the
      // polygon so the user has an escape hatch without using the
      // mouse. The handler is bound only when isDrawingPolygon is
      // true to avoid stealing focus from inputs when not drawing.
      expect(src).toMatch(/window\.addEventListener\(\s*'keydown'/);
      expect(src).toMatch(/e\.key\s*===\s*'Escape'/);
      // No Enter branch — make sure a future refactor doesn't
      // re-add the unreliable Enter-finishes-polygon behavior.
      expect(src).not.toMatch(/e\.key\s*===\s*'Enter'/);
    });

    it('source: existing elements render as non-interactive during polygon creation', () => {
      // While drawing, clicks on existing elements must fall through
      // to the Stage so they become vertex pushes. The renderElement
      // call wraps each existing element in a freeze group with
      // listening={false}.
      expect(src).toMatch(/isDrawingPolygon\s*\?\s*[\s\S]*?listening:\s*false/);
    });

    it('source: Transformer is hidden during polygon creation', () => {
      // The Transformer's `visible` prop must be set to
      // !isDrawingPolygon so the existing element's transformer box
      // doesn't compete with the new polygon preview for visual
      // attention.
      expect(src).toMatch(/visible=\{!isDrawingPolygon\}/);
    });
  });

  // ============================================================
  // Round 11 (2026-09-27) — 7 項修正 regression tests
  // Source + structural assertions; jsdom has no real canvas
  // hit testing, so most assertions are pinned to the source.
  // ============================================================
  describe('Round 11 — Step7 shape-tool 7-fix regression tests', () => {
    let src: string;
    beforeEach(() => {
      src = readFileSync(
        resolve(__dirname, './Step7TableCardCanvas.web.tsx'),
        'utf8',
      );
    });

    // ---- Issue 1: triangle/ellipse resize 双方向 ----
    it('Issue 1: triangle/ellipse render inside <Group> with bbox math (regression — only-enlarges bug)', () => {
      // Round 10 put RegularPolygon / Ellipse at the bbox CENTER
      // (`x + width/2, y + height/2`), but Konva's `node.width()` /
      // `node.height()` for those primitives returns 0 (they're
      // radius-driven), so `newW = 0 * scaleX = 0` after resize —
      // the triangle would collapse to a point. The drag end math
      // also depended on closure-captured `width / height`, which
      // was stale after the previous resize.
      //
      // Round 11 fix: both shapes are wrapped in a <Group> whose
      // bbox math matches the rect branch (node.width() * scaleX,
      // node.x() directly as top-left).
      //
      // Structural assertions: triangle + ellipse branches both
      // contain `<Group ...>` wrappers with `x={x} y={y}` (top-left
      // bbox coordinates) and `width={width} height={height}`.
      const triangleBranch = src.match(
        /el\.shape\s*===\s*'triangle'[\s\S]{0,3500}?<\/Group>/,
      );
      expect(triangleBranch).not.toBeNull();
      expect(triangleBranch?.[0] ?? '').toMatch(/x=\{x\}/);
      expect(triangleBranch?.[0] ?? '').toMatch(/y=\{y\}/);
      expect(triangleBranch?.[0] ?? '').toMatch(/width=\{width\}/);
      expect(triangleBranch?.[0] ?? '').toMatch(/height=\{height\}/);
      const ellipseBranch = src.match(
        /el\.shape\s*===\s*'ellipse'[\s\S]{0,3500}?<\/Group>/,
      );
      expect(ellipseBranch).not.toBeNull();
      expect(ellipseBranch?.[0] ?? '').toMatch(/x=\{x\}/);
      expect(ellipseBranch?.[0] ?? '').toMatch(/y=\{y\}/);
      expect(ellipseBranch?.[0] ?? '').toMatch(/width=\{width\}/);
      expect(ellipseBranch?.[0] ?? '').toMatch(/height=\{height\}/);
    });

    it('Issue 1: triangle/ellipse onDragEnd uses node.x() / node.y() directly (no center-offset math)', () => {
      // Round 10 had `x: e.target.x() / PREVIEW_SCALE - width / 2`
      // (subtracts half the bbox because the node was at the bbox
      // center). Round 11 drops that compensation since the Group
      // sits at the bbox top-left.
      const triangleBranch = src.match(
        /el\.shape\s*===\s*'triangle'[\s\S]{0,3500}?<\/Group>/,
      );
      // Allow either `...,` (next property) or `}` (final property)
      // to follow `PREVIEW_SCALE` — the source uses the comma form.
      expect(triangleBranch?.[0] ?? '').toMatch(
        /onDragEnd=\{[\s\S]*?e\.target\.x\(\)\s*\/\s*PREVIEW_SCALE[,}]/,
      );
      expect(triangleBranch?.[0] ?? '').not.toMatch(
        /e\.target\.x\(\)\s*\/\s*PREVIEW_SCALE\s*-\s*width\s*\/\s*2/,
      );
    });

    // ---- Issue 2: drag 不跳 (covered by Issue 1 same fix) ----
    it('Issue 2: triangle/ellipse onTransformEnd uses node.width() * scaleX (real bbox math)', () => {
      // Round 11 — the Group's width()/height() return the bbox
      // dimensions (not 0), so `node.width() * scaleX` gives the
      // post-transform width in px. Round 10 used `width * scaleX`
      // (closure value), which broke after multiple resizes.
      const triangleBranch = src.match(
        /el\.shape\s*===\s*'triangle'[\s\S]{0,3500}?<\/Group>/,
      );
      expect(triangleBranch?.[0] ?? '').toMatch(
        /onTransformEnd=\{[\s\S]*?node\.width\(\)\s*\*\s*scaleX/,
      );
      expect(triangleBranch?.[0] ?? '').toMatch(
        /node\.height\(\)\s*\*\s*scaleY/,
      );
    });

    // ---- Issue 3: 頂點編號標籤 ----
    it('Issue 3: renderPolygonVertexMarkers emits KonvaText with vertex numbers (1, 2, 3...)', () => {
      // Each vertex marker should render a KonvaText label with
      // `String(vertexIndex + 1)` so the user can identify vertex
      // order on the canvas. Assert the structural regex matches
      // both `String(...)` call + fontStyle="bold" + listening=false
      // (so the label doesn't swallow click events).
      expect(src).toMatch(
        /<KonvaText[\s\S]*?text=\{String\(vertexIndex\s*\+\s*1\)\}/,
      );
      expect(src).toMatch(
        /<KonvaText[\s\S]*?fontStyle="bold"[\s\S]*?listening=\{false\}/,
      );
    });

    // ---- Issue 4: 頂點拖曳 ----
    it('Issue 4: renderPolygonVertexMarkers wires onDragVertex for both creation + finished polygon', () => {
      // The marker helper must accept an onDragVertex callback that's
      // invoked on drag end. Both call sites (creation preview +
      // finished polygon when selected) must pass this callback so
      // the user can fine-tune vertices in both states.
      //
      // Round 19 — both call sites also take an `isMobile` arg.
      // The preview-side is single-line; the finished-polygon side
      // is multi-line. Use the single-line callsite to verify both
      // `markerOpts` (which carries `draggable: true, onDragVertex:`)
      // and `isMobile` are present, and use a branch-anchored
      // check for the multi-line callsite.
      expect(src).toMatch(
        /renderPolygonVertexMarkers\(\s*vertices,\s*markerOpts,\s*isMobile\s*\)/,
      );
      const polygonBranch = src.match(
        /el\.shape\s*===\s*'polygon'[\s\S]{0,4500}?<\/Group>/,
      );
      expect(polygonBranch).not.toBeNull();
      expect(polygonBranch?.[0] ?? '').toMatch(
        /draggable:\s*true,\s*onDragVertex:/,
      );
      expect(polygonBranch?.[0] ?? '').toMatch(/isMobile/);
      // onDragMove fires the callback then snaps the marker back to
      // its stored position to avoid Konva visual lag during drag.
      // The actual source uses an early-return guard pattern:
      //   `if (!opts.onDragVertex) return; opts.onDragVertex(vertexIndex, ...)`
      // instead of the optional-chaining `opts.onDragVertex?(...)`. Both
      // expressions are functionally identical; we accept either.
      expect(src).toMatch(
        /(?:opts\.onDragVertex\??|onDragVertex)\(\s*vertexIndex,\s*node\.x\(\)\s*\/\s*PREVIEW_SCALE,\s*node\.y\(\)\s*\/\s*PREVIEW_SCALE/,
      );
      expect(src).toMatch(/node\.position\(\{\s*x:\s*px,\s*y:\s*py\s*\}\)/);
    });

    it('Issue 4: store has updatePolygonVertex action wired to vertices (in-creation-mode patch)', () => {
      // The store must expose `updatePolygonVertex(vertexIndex, x, y)`
      // and the canvas must call it from the marker onDragVertex
      // callback so the in-progress polygon's vertices stay in sync
      // with the marker positions.
      expect(src).toMatch(/updatePolygonVertex\(vertexIndex,\s*localX,\s*localY\)/);
    });

    // ---- Issue 5: 跟隨游標虛線 ----
    it('Issue 5: Stage tracks cursorPosMm via onMouseMove + clears via onMouseLeave', () => {
      // The Stage must call setCursorPosMm on pointer move (while
      // drawing a polygon) so the preview helper can draw a dashed
      // line from the last vertex to the cursor. onMouseLeave clears
      // it so the line doesn't linger when the cursor exits the canvas.
      expect(src).toMatch(/onMouseMove=\{[\s\S]*?setCursorPosMm\(/);
      expect(src).toMatch(/onMouseLeave=\{[\s\S]*?setCursorPosMm\(null\)/);
      // The preview helper must consume cursorPosMm to draw the line.
      expect(src).toMatch(/cursorPosMm\s*!==\s*null\s*&&\s*vertices\.length\s*>=\s*2/);
    });

    // ---- Issue 6: 畫布完成按鈕 ----
    it('Issue 6: canvas finish button text is i18n-driven (tableCard.shape.polygonFinish)', () => {
      // Round 12 — text source moved from hardcoded `"完成多邊形"`
      // to the i18n key `tableCard.shape.polygonFinish`. The actual
      // translation lives in `apps/frontend/src/i18n/locales/tableCard.{zh-TW,en}.ts`
      // and is pinned by `Step7TableCard.i18n.test.ts`. Asserting
      // the `t('shape.polygonFinish')` call here keeps the canvas
      // → i18n binding alive in the canvas test suite.
      expect(src).toMatch(/text=\{t\(['"]shape\.polygonFinish['"]\)\}/);
      expect(src).toMatch(/useTranslation\(['"]tableCard['"]\)/);
      // Anti-regression: the hardcoded literal must NOT appear anymore.
      expect(src).not.toMatch(/text="完成多邊形"/);
    });

    it('Issue 6: canvas finish button is gated on >=3 vertices (vertices.length >= 6 flat-array entries)', () => {
      // The button must NOT appear when <3 vertices exist (the
      // store would discard the polygon anyway).
      expect(src).toMatch(
        /polygonCreation\.vertices\.length\s*>=\s*6\s*&&\s*\(\(\)\s*=>\s*\{/,
      );
    });
  });

  // ============================================================
  // Round 12 (2026-09-27) — 5-bug regression cluster:
  //   Cluster A — triangle / ellipse can't be selected
  //               (hit region missing on the wrapping Group)
  //   Cluster B — polygon preview line / vertex numbers /
  //               finish button all invisible
  //               (conditional Layer between elements + transformer
  //               confused React-Konva's reconciler)
  //   Fix C    — finish button text moved from hardcoded
  //               "完成多邊形" to i18n key `tableCard.shape.polygonFinish`.
  //
  // 8 source-level assertions below pin the structural invariants.
  // Real Konva behavior (hit detection + Layer reconciliation) is
  // covered by manual smoke + integration tests in dev.
  // ============================================================
  describe('Round 12 — triangle/ellipse hit-region + polygon preview layer fix', () => {
    // All Round 12 tests are source-level structural assertions.
    // Hoist `src` to the describe level so each test doesn't have
    // to re-read the file (faster + DRY). Other describes in this
    // file define `src` per-`it`; we follow the same pattern but
    // at the describe level since all 8 tests use the same source.
    let src: string;
    beforeAll(() => {
      src = readFileSync(
        resolve(__dirname, './Step7TableCardCanvas.web.tsx'),
        'utf8',
      );
    });

    // ---- Fix A: triangle hit-target Rect ----
    it('Fix A: triangle branch adds a transparent hit-target Rect before <RegularPolygon>', () => {
      // Konva.Group's hit detection comes entirely from listening
      // children. <RegularPolygon listening={false}> does not
      // contribute a hit region, so without the transparent Rect
      // the Group is click-through. The Rect fills the full
      // Group-local bbox (x=0, y=0, w=width, h=height).
      //
      // Round 12 (2026-09-27) — fix indexOf comment bleed.
      // The previous assertion used `branch.indexOf('<Rect')` /
      // `branch.indexOf('<RegularPolygon')`. The Round 12 comment
      // block (inside the same Group) explicitly mentions
      // `<RegularPolygon listening={false}>` as documentation,
      // so the indexOf found the COMMENT text first, returning an
      // inverted order. Fix: anchor each match on its unique
      // opening-attribute signature (`x={0}` for the Rect,
      // `x={width / 2}` for the RegularPolygon). These patterns
      // cannot appear inside the prose comment.
      const triangleBranch = src.match(
        /el\.shape\s*===\s*'triangle'[\s\S]{0,3500}?<\/Group>/,
      );
      expect(triangleBranch).not.toBeNull();
      const branch = triangleBranch?.[0] ?? '';
      // The hit-target Rect must exist with the right fill + bbox.
      expect(branch).toMatch(
        /<Rect[\s\S]*?fill="rgba\(0,0,0,0\)"[\s\S]*?\/>/,
      );
      // And the Rect's x/y/width/height must cover the full bbox.
      const hitRectMatch = branch.match(
        /<Rect[\s\S]*?x=\{0\}[\s\S]*?y=\{0\}[\s\S]*?width=\{width\}[\s\S]*?height=\{height\}[\s\S]*?\/>/,
      );
      expect(hitRectMatch).not.toBeNull();
      // The hit-target Rect must appear BEFORE <RegularPolygon>
      // (Konva reverse-traversal hit detection needs the listening
      // child to be deeper in the tree than the visual primitives).
      // Use attribute-anchored regex to avoid comment-text bleed.
      const hitRectIdx = branch.search(
        /<Rect\s+x=\{0\}\s+y=\{0\}\s+width=\{width\}/,
      );
      const regPolyIdx = branch.search(
        /<RegularPolygon\s+x=\{width\s*\/\s*2\}/,
      );
      expect(hitRectIdx).toBeGreaterThan(-1);
      expect(regPolyIdx).toBeGreaterThan(-1);
      expect(hitRectIdx).toBeLessThan(regPolyIdx);
      // Anti-regression: <RegularPolygon> stays `listening={false}`
      // so the hit-region comes solely from the Rect (matches image
      // Round 9 invariant).
      expect(branch).toMatch(/<RegularPolygon[\s\S]*?listening=\{false\}/);
    });

    // ---- Fix A: ellipse hit-target Rect ----
    it('Fix A: ellipse branch adds a transparent hit-target Rect before <Ellipse>', () => {
      // Same root cause as triangle. <Ellipse listening={false}> is
      // not hit-testable, so the Group needs a transparent Rect to
      // catch pointer events.
      //
      // Round 12 (2026-09-27) — fix indexOf comment bleed.
      // The Round 12 comment block mentions `<Ellipse listening={false}>`
      // as documentation, which `branch.indexOf('<Ellipse')` would
      // find before the actual JSX. Anchor on the unique attribute
      // signatures (x={0} for Rect, x={width / 2} for Ellipse).
      const ellipseBranch = src.match(
        /el\.shape\s*===\s*'ellipse'[\s\S]{0,3500}?<\/Group>/,
      );
      expect(ellipseBranch).not.toBeNull();
      const branch = ellipseBranch?.[0] ?? '';
      expect(branch).toMatch(
        /<Rect[\s\S]*?fill="rgba\(0,0,0,0\)"[\s\S]*?\/>/,
      );
      const hitRectMatch = branch.match(
        /<Rect[\s\S]*?x=\{0\}[\s\S]*?y=\{0\}[\s\S]*?width=\{width\}[\s\S]*?height=\{height\}[\s\S]*?\/>/,
      );
      expect(hitRectMatch).not.toBeNull();
      // Attribute-anchored search to skip the comment's `<Ellipse>`
      // mention.
      const hitRectIdx = branch.search(
        /<Rect\s+x=\{0\}\s+y=\{0\}\s+width=\{width\}/,
      );
      const ellipseIdx = branch.search(
        /<Ellipse\s+x=\{width\s*\/\s*2\}/,
      );
      expect(hitRectIdx).toBeGreaterThan(-1);
      expect(ellipseIdx).toBeGreaterThan(-1);
      expect(hitRectIdx).toBeLessThan(ellipseIdx);
      // Anti-regression: <Ellipse> stays `listening={false}`.
      expect(branch).toMatch(/<Ellipse[\s\S]*?listening=\{false\}/);
    });

    // ---- Fix A: hit-target Rect bbox math ----
    it('Fix A: triangle/ellipse hit-target Rect spans the full bbox (no under/over-fill)', () => {
      // The Rect's x/y/width/height MUST equal `0/0/width/height`
      // (Group-local coords). Any other value would create a hit
      // region offset from the visible shape and confuse the user.
      // We assert the pattern appears in BOTH branches.
      const triangleBranch = src.match(
        /el\.shape\s*===\s*'triangle'[\s\S]{0,2500}?<\/Group>/,
      );
      const ellipseBranch = src.match(
        /el\.shape\s*===\s*'ellipse'[\s\S]{0,2500}?<\/Group>/,
      );
      const bboxPattern =
        /<Rect[\s\S]*?x=\{0\}[\s\S]*?y=\{0\}[\s\S]*?width=\{width\}[\s\S]*?height=\{height\}[\s\S]*?\/>/;
      expect(triangleBranch?.[0] ?? '').toMatch(bboxPattern);
      expect(ellipseBranch?.[0] ?? '').toMatch(bboxPattern);
    });

    // ---- Fix B: no conditional Layer for polygon preview ----
    it('Fix B: Stage children no longer mount a conditional <Layer> for polygon preview', () => {
      // Before Round 12, the Stage had 5 conditional children
      // (bg Layer / bleed Layer / elements Layer / **conditional
      // preview Layer** / transformer Layer). The conditional Layer
      // sat between two non-conditional ones, breaking React-Konva's
      // Layer index accounting.
      //
      // The structural invariant for the fix: there must be exactly
      // ONE `polygonCreation.vertices.length >= 6` check that gates
      // the in-Layer finish button — not a `(<Layer>...</Layer>)`
      // outer wrapper. We assert there's no `<Layer>` wrapper that
      // is itself conditionally mounted with `polygonCreation` as
      // the guard.
      expect(src).not.toMatch(
        /\{isDrawingPolygon\s*&&\s*polygonCreation\s*&&\s*\(\s*<Layer>/,
      );
      expect(src).not.toMatch(
        /\{isDrawingPolygon\s*&&\s*polygonCreation\s*&&\s*\(\s*\(\)\s*=>\s*\{[\s\S]*?<Layer>/,
      );
    });

    // ---- Fix B: renderPolygonPreview lives inside elements Layer ----
    it('Fix B: renderPolygonPreview call site is inside the elements Layer, not a sibling', () => {
      // The call must be a child of the elements Layer (the Layer
      // that maps sortedElements). We assert structural proximity
      // by checking the call appears AFTER the `sortedElements.map`
      // and BEFORE the Transformer Layer's `transformerRef`.
      //
      // Round 12 (2026-09-27) — fix function-definition vs call-site.
      // The previous `src.match(/renderPolygonPreview\(/)` returned
      // the FIRST occurrence, which is the function definition at
      // line 599 — NOT the JSX call site at line 1017. Use
      // matchAll + filter to locate the actual call site (the one
      // preceded by `polygonCreation &&`).
      const allMatches = [...src.matchAll(/renderPolygonPreview\(/g)];
      expect(allMatches.length).toBeGreaterThanOrEqual(2);
      // The call site is the one preceded by `polygonCreation &&`
      // (the JSX guard). The function definition has no such prefix.
      const callSite = allMatches.find((m) => {
        const before = src.slice(Math.max(0, m.index - 200), m.index);
        return /polygonCreation\s*&&/.test(before);
      });
      expect(callSite).toBeDefined();
      if (!callSite?.index) return;
      const before = src.slice(Math.max(0, callSite.index - 2000), callSite.index);
      // The elements Layer must be the active Layer context — i.e.
      // the most-recently-opened <Layer> tag before the call must
      // be the elements Layer (which contains sortedElements.map).
      // We assert that `sortedElements.map` appears between the
      // last `<Layer>` open and our call.
      const lastLayerOpen = before.lastIndexOf('<Layer>');
      const sortedMapIdx = before.lastIndexOf('sortedElements.map(');
      expect(lastLayerOpen).toBeGreaterThan(-1);
      expect(sortedMapIdx).toBeGreaterThan(-1);
      // sortedElements.map must come AFTER the Layer open (inside
      // the Layer), and BEFORE the call site.
      expect(sortedMapIdx).toBeGreaterThan(lastLayerOpen);
      // And our call must be AFTER sortedMapIdx (same Layer).
      const callRelativeIdx = before.length; // call is right at this offset
      expect(callRelativeIdx).toBeGreaterThan(sortedMapIdx);
    });

    // ---- Fix B: canvas finish button lives inside elements Layer ----
    it('Fix B: canvas finish button is rendered as a sibling of the elements, not a separate Layer', () => {
      // The finish button's outer gate is now
      // `polygonCreation.vertices.length >= 6 && (() => { ... })()`
      // — the IIFE returns a <Group> that lives INSIDE the elements
      // Layer. There's no `<Layer>` wrapper around it.
      //
      // Structural assertion: the `polygonCreation.vertices.length >= 6`
      // guard appears exactly once and is NOT inside a `{... && (<Layer>...)}`
      // block (anti-regression for the old conditional Layer pattern).
      const guardMatches = src.match(/polygonCreation\.vertices\.length\s*>=\s*6/g);
      expect(guardMatches).not.toBeNull();
      expect(guardMatches?.length).toBe(1);
      // The single occurrence must be wrapped in a conditional that
      // uses && (() => { ... })() IIFE returning a <Group>, NOT a
      // <Layer> wrapper.
      const guardContext = src.match(
        /polygonCreation\.vertices\.length\s*>=\s*6[\s\S]{0,200}?\(\(\)\s*=>\s*\{/,
      );
      expect(guardContext).not.toBeNull();
      // No `<Layer>` may appear within 200 chars AFTER the guard.
      const guardIdx = src.search(/polygonCreation\.vertices\.length\s*>=\s*6/);
      const window = src.slice(guardIdx, guardIdx + 500);
      expect(window).not.toMatch(/<Layer>/);
    });

    // ---- Fix C: finish button text is i18n-driven ----
    it('Fix C: finish button text reads from t("shape.polygonFinish"), not hardcoded', () => {
      // Round 12 — moved from `text="完成多邊形"` (hardcoded zh-TW) to
      // `text={t('shape.polygonFinish')}`. The actual translation
      // lives in `apps/frontend/src/i18n/locales/tableCard.zh-TW.ts`
      // and `tableCard.en.ts`; both are pinned by
      // `Step7TableCard.i18n.test.ts`.
      expect(src).toMatch(/text=\{t\(['"]shape\.polygonFinish['"]\)\}/);
      expect(src).toMatch(/useTranslation\(['"]tableCard['"]\)/);
      // Anti-regression: hardcoded literal must NOT exist.
      expect(src).not.toMatch(/text="完成多邊形"/);
    });

    // ============================================================
  // Round 19 (2026-09-27) — line hit region + polygon vertex
  // badge orange + mobile scaling
  // ============================================================
  //
  // Two issues addressed together (both surface on mobile):
  //
  //   (1) Line tool hard to select on mobile.
  //       Konva.Line only does hit detection on the 1D stroke
  //       path; at the default strokeWidth=2 mm, the rendered
  //       stroke is ≈ 5.7 CSS px on the 595-px stage, even
  //       less after the mobile scale-to-fit. Users on mobile
  //       had to pixel-hunt to tap a line. Fix: wrap the Konva
  //       `<Line>` in a `<Group>` and add a transparent hit
  //       `<Rect>` spanning the full local bbox, identical to
  //       the pattern already used for image / triangle / ellipse
  //       shape branches (Rounds 9 / 11 / 12).
  //
  //   (2) Polygon vertex badge.
  //       Round 17 (the latest in this file) settled on a 20×20
  //       blue chip with fontSize=11. The user wants:
  //         - badge fill changed to the "main visual" orange
  //           (#f97316 / orange-500 — the same color used by the
  //           bleed overlay + active button outlines, so the
  //           polygon tool's UI language reads as one cohesive
  //           design)
  //         - badge enlarged on mobile (28×28 chip, 44×44 hit
  //           area, fontSize=14) so the numbers are readable +
  //           finger-tappable on small viewports
  //
  // The implementation routes a single `isMobile: boolean` from
  // `useIsMobile()` through both `renderPolygonVertexMarkers` and
  // `renderPolygonPreview`. Source-level tests pin both behaviours
  // because jsdom cannot run real Konva hit testing or letter
  // measurement.
  describe('Round 19 — line hit region + polygon vertex badge', () => {
    let src: string;
    beforeEach(() => {
      src = readFileSync(
        resolve(__dirname, './Step7TableCardCanvas.web.tsx'),
        'utf8',
      );
    });

    // ----------------------------------------------------------------
    // Issue 1: line element hit region
    // ----------------------------------------------------------------

    it('Issue 1: line element is wrapped in a <Group> with id={el.id} (Transformer attach target)', () => {
      // The bare Konva.Line cannot act as a Transformer attach
      // target reliably — drag handles snap to the bbox on a
      // Group but Konva.Line's bbox math gives 0×0 for rotations
      // outside [0,1]. Wrapping in a Group lets the existing
      // `stage.findOne('#${selectedId}')` resolve to the Group
      // (which carries the bbox).
      const lineBranch = src.match(
        /el\.shape\s*===\s*'line'[\s\S]{0,3500}?(?:<\/Group>|return\s*\(\s*<Line)/,
      );
      expect(lineBranch).not.toBeNull();
      expect(lineBranch?.[0] ?? '').toMatch(/<Group[\s\S]*?id=\{el\.id\}/);
      // The Group must own bbox math (same pattern as triangle /
      // ellipse / image branches).
      expect(lineBranch?.[0] ?? '').toMatch(/<Group[\s\S]*?draggable/);
      expect(lineBranch?.[0] ?? '').toMatch(
        /onClick=\{\(\) => onSelect\(el\.id\)\}/,
      );
      expect(lineBranch?.[0] ?? '').toMatch(
        /onTap=\{\(\) => onSelect\(el\.id\)\}/,
      );
    });

    it('Issue 1: line element Group contains a transparent hit-target Rect (regression — Konva.Line 1D hit detection)', () => {
      // Without the hit Rect, Konva.Line only hit-tests along the
      // 1D stroke path (~2 CSS px wide on mobile after scale-to-fit).
      // The transparent Rect spans the full local bbox so taps
      // anywhere on the line select it.
      const lineBranch = src.match(
        /el\.shape\s*===\s*'line'[\s\S]{0,3500}?<\/Group>/,
      );
      expect(lineBranch).not.toBeNull();
      expect(lineBranch?.[0] ?? '').toMatch(/<Rect[\s\S]*?fill="rgba\(0,0,0,0\)"/);
      // Rect must span the full local bbox (x=0..width, y=0..height).
      expect(lineBranch?.[0] ?? '').toMatch(/<Rect[\s\S]*?x=\{0\}[\s\S]*?y=\{0\}/);
      expect(lineBranch?.[0] ?? '').toMatch(
        /<Rect[\s\S]*?width=\{width\}[\s\S]*?height=\{height\}/,
      );
    });

    it('Issue 1: inner <Konva.Line> has listening={false} (events bubble to Group via hit Rect)', () => {
      // The inner Line stays non-listening; events reach the Group
      // via the transparent hit Rect. If we ever flip this back to
      // listening={true}, mobile users would re-experience the
      // "can't tap the line" bug.
      const lineBranch = src.match(
        /el\.shape\s*===\s*'line'[\s\S]{0,3500}?<\/Group>/,
      );
      expect(lineBranch).not.toBeNull();
      // There's an inner Konva.Line with listening={false}.
      expect(lineBranch?.[0] ?? '').toMatch(
        /<Line[\s\S]*?listening=\{false\}/,
      );
      // Anti-regression: there should NOT be a bare <Line> with
      // id={el.id} (the old pre-Round-19 setup that 1D-hit-detected).
      const oldBareLine = lineBranch?.[0]?.match(
        /<Line[\s\S]{0,200}?id=\{el\.id\}/,
      );
      expect(oldBareLine).toBeNull();
    });

    // ----------------------------------------------------------------
    // Issue 2: polygon vertex badge — orange + mobile scaling
    // ----------------------------------------------------------------

    it('Issue 2: canvas imports useIsMobile hook (Rule 024 mobile-aware rendering)', () => {
      expect(src).toMatch(/import\s*\{\s*useIsMobile\s*\}\s*from\s*['"]@\/hooks\/useIsMobile['"]/);
    });

    it('Issue 2: canvas component calls useIsMobile() at top level (provides isMobile to helpers)', () => {
      // useIsMobile() must be called inside the React component so
      // its return re-renders the canvas when the viewport crosses
      // the breakpoint. The return value is threaded through both
      // `renderPolygonVertexMarkers` (and `renderPolygonPreview`).
      expect(src).toMatch(/const isMobile\s*=\s*useIsMobile\(\)/);
    });

    it('Issue 2: vertex badge fill changed from blue #3b82f6 to orange #f97316 (main visual color)', () => {
      // The user explicitly asked for the badge to use the
      // "main visual" orange (the same color used by the bleed
      // overlay and active-tool button borders — design-system
      // orange-500). Verify the chip fill is the orange literal.
      //
      // Negative regression: the old blue must NOT survive inside
      // the vertex-marker block (other blue uses — e.g. preview
      // stroke, finish button — are still legitimate).
      expect(src).toMatch(/fill="#f97316"/);
      // The chip's blue fill must be gone inside the marker body.
      // Pin: the round 17 marker used `fill="#3b82f6"` directly on
      // the inner chip Rect. We allow `stroke="#3b82f6"` (still
      // used elsewhere, e.g. finish button stroke + preview line).
      const markerChipRegex =
        /function renderPolygonVertexMarkers[\s\S]*?\n\}/;
      const markerChipBlock = src.match(markerChipRegex);
      expect(markerChipBlock).not.toBeNull();
      expect(markerChipBlock?.[0] ?? '').not.toMatch(/fill="#3b82f6"/);
      expect(markerChipBlock?.[0] ?? '').toMatch(/fill="#f97316"/);
    });

    it('Issue 2: renderPolygonVertexMarkers signature accepts isMobile: boolean (mobile scaling param)', () => {
      // The helper must accept a 3rd `isMobile` parameter so the
      // chip geometry can change between desktop (20×20) and
      // mobile (28×28 + 44-pt hit area + fontSize 14).
      expect(src).toMatch(
        /function renderPolygonVertexMarkers\([\s\S]*?isMobile:\s*boolean[\s\S]*?\)/,
      );
    });

    it('Issue 2: chip geometry adapts to isMobile (chipSize / hitSize / fontSize variables)', () => {
      // When isMobile is true, chipSize / hitSize / fontSize must be
      // larger than the desktop defaults. The implementation is
      // expected to use a single conditional block at the top of
      // the helper that picks geometry constants.
      const markerBlock = src.match(
        /function renderPolygonVertexMarkers[\s\S]*?\n\}/,
      );
      expect(markerBlock).not.toBeNull();
      const body = markerBlock?.[0] ?? '';
      // Mobile path: chipSize = 28, hitSize = 44, fontSize = 14
      // (28 × 4 grid + 11 × 4 grid alignment). At least the mobile
      // literals must appear; the desktop path can use the existing
      // constants or inline values too.
      expect(body).toMatch(/chipSize/);
      expect(body).toMatch(/hitSize/);
      expect(body).toMatch(/fontSize/);
      // The mobile geometry picks 28 / 44 / 14.
      // Allow either a ternary or an if-statement; the distinctive
      // feature is the literal triplet (28, 44, 14) appearing
      // together, optionally as `28, \s*44, \s*14` or as a destructure.
      expect(body).toMatch(/28[\s\S]*?44[\s\S]*?14/);
    });

    it('Issue 2: callsites of renderPolygonVertexMarkers pass the isMobile argument', () => {
      // Both call sites (creation preview + finished polygon when
      // selected) must pass `isMobile` as the third argument so the
      // mobile scaling actually reaches the helper.
      //
      // The finished-polygon callsite is multi-line with nested
      // arrow-function braces, so we can't use a single lazy regex
      // without backtracking blowups. Instead: pin each call site
      // by a near-unique signature:
      //
      //   1. preview-side callsite has `vertices, markerOpts, isMobile`
      //      on a single line — easy regex.
      //   2. finished-polygon callsite lives inside the
      //      `el.shape === 'polygon'` branch, which is the only
      //      place `{ draggable: true, onDragVertex: (` appears
      //      with `isMobile` after it within ~400 chars.
      expect(src).toMatch(
        /renderPolygonVertexMarkers\(\s*vertices,\s*markerOpts,\s*isMobile\s*\)/,
      );
      // Anchor the multi-line callsite test on its enclosing
      // branch: the only polygon-with-vertex-markers block whose
      // body contains `isMobile` within the next ~20 lines is the
      // finished-polygon renderElement branch.
      const polygonBranch = src.match(
        /el\.shape\s*===\s*'polygon'[\s\S]{0,4500}?<\/Group>/,
      );
      expect(polygonBranch).not.toBeNull();
      expect(polygonBranch?.[0] ?? '').toMatch(/isMobile/);
      // Pin the actual call shape inside the branch.
      expect(polygonBranch?.[0] ?? '').toMatch(/renderPolygonVertexMarkers\(/);
    });

    it('Issue 2: renderPolygonPreview is called with isMobile (mobile passes scaling down to preview markers)', () => {
      // The on-stage preview (renderPolygonPreview) is invoked from
      // the main canvas body, which is where isMobile lives.
      //
      // The regex spans a callback + multi-line body; lazy matching
      // across deeply nested content causes performance hits. Split
      // into two structural assertions instead — both must be true.
      //   (a) the call opens with `polygonCreation, cursorPosMm,`
      //   (b) isMobile appears near the call's closing `)`
      expect(src).toMatch(
        /renderPolygonPreview\(\s*polygonCreation,\s*cursorPosMm,/,
      );
      // `isMobile` plus a closing paren within ~700 chars of the
      // opening paren — tight enough to land on the callsite, not
      // unrelated text.
      expect(src).toMatch(
        /renderPolygonPreview\(\s*polygonCreation,\s*cursorPosMm,[\s\S]{0,700}?isMobile[\s\S]{0,40}?\)/,
      );
    });
  });

  // ============================================================
  // Round 19 — existing Round 11 invariants still hold
  // (sanity check — make sure the new signature doesn't drop
  // other parts of the implementation)
  // ============================================================
  describe('Round 19 — earlier round invariants still hold (no regression)', () => {
    let src: string;
    beforeEach(() => {
      src = readFileSync(
        resolve(__dirname, './Step7TableCardCanvas.web.tsx'),
        'utf8',
      );
    });

    it('renderPolygonVertexMarkers helper still exists and is exported via test surface', () => {
      expect(src).toMatch(/function renderPolygonVertexMarkers/);
    });

    it('renderPolygonPreview helper still exists', () => {
      expect(src).toMatch(/function renderPolygonPreview/);
    });

    it('KonvaText vertex label uses String(vertexIndex + 1) (numbers 1, 2, 3, …)', () => {
      expect(src).toMatch(
        /<KonvaText[\s\S]*?text=\{String\(vertexIndex\s*\+\s*1\)\}/,
      );
    });

    it('Stage onMouseMove still tracks cursorPosMm', () => {
      expect(src).toMatch(/onMouseMove=\{[\s\S]*?setCursorPosMm\(/);
    });

    it('Esc still cancels polygon creation', () => {
      expect(src).toMatch(/onKey[\s\S]*?cancelPolygonCreation/);
    });

    it('Round 14 — preview strokeWidth 3 + dash [10,6] still set (avoids silent regression on Round 19 chip refactor)', () => {
      expect(src).toMatch(/strokeWidth=\{3\}/);
      expect(src).toMatch(/dash=\{\[\s*10,\s*6\s*\]\}/);
    });
  });

    // ---- Regression: existing Round 11 structural invariants still hold ----
    it('Round 11 invariants still hold after Round 12 (preview/vertex markers/finish wiring intact)', () => {
      // Sanity-check the Round 11 fixes haven't regressed. We re-run
      // the regex shape of the key structural assertions; if any of
      // these change, it means Round 12's edits accidentally removed
      // a structural piece.
      // renderPolygonVertexMarkers helper still exists.
      expect(src).toMatch(/function renderPolygonVertexMarkers/);
      // Helper is called from both call sites. Round 19 added the
      // `isMobile` argument; the preview-side is single-line, the
      // finished-polygon side is multi-line with nested arrow
      // function. Anchor the multi-line case on its enclosing
      // `el.shape === 'polygon'` branch.
      expect(src).toMatch(
        /renderPolygonVertexMarkers\(\s*vertices,\s*markerOpts,\s*isMobile\s*\)/,
      );
      const polygonBranch = src.match(
        /el\.shape\s*===\s*'polygon'[\s\S]{0,4500}?<\/Group>/,
      );
      expect(polygonBranch).not.toBeNull();
      expect(polygonBranch?.[0] ?? '').toMatch(/renderPolygonVertexMarkers\(/);
      expect(polygonBranch?.[0] ?? '').toMatch(/isMobile/);
      // KonvaText vertex label still exists.
      expect(src).toMatch(
        /<KonvaText[\s\S]*?text=\{String\(vertexIndex\s*\+\s*1\)\}/,
      );
      // Stage onMouseMove still tracks cursorPosMm.
      expect(src).toMatch(/onMouseMove=\{[\s\S]*?setCursorPosMm\(/);
      // Esc still cancels polygon creation.
      expect(src).toMatch(/onKey[\s\S]*?cancelPolygonCreation/);
    });
  });
});
