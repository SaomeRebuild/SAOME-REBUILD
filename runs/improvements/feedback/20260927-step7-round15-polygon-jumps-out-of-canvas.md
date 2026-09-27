# 20260927-step7-round15-polygon-jumps-out-of-canvas

**Date**: 2026-09-27 (Sun) ~22:00
**Reporter**: user (during Step 7 manual QA after Round 14)
**Severity**: SEV-3 (correctness bug; user-blocking for "draw polygon near canvas boundary", workaround = stay near canvas center)
**Round**: 15

## Symptom (verbatim from user)

> 我知道為什麼完成的多邊形會跳出畫布了
> 因為端點圍成的大小跟實際產出形狀的大小不一樣
> 端點也沒有在實際的形狀上的端點上，所以建立的地方如果比較靠近邊界，形狀就會跳出去

User confirmed root-cause hypothesis: **the bbox formed by the user's clicks does not match the bbox of the produced shape**; **the click endpoints are not on the actual shape's endpoints**; therefore when the click area is close to the canvas boundary, the produced shape "jumps out of the canvas" (gets clipped / rendered outside the visible A4).

## Root cause

`buildPolygonElementFromVertices(vertices, nextZ, idFactory)` (Round 14) computed `el.x = localBbox.x, el.y = localBbox.y` — i.e. coordinates in the **LOCAL frame** (relative to `polygonCreation.bboxOrigin`). But the Konva renderer treats `el.x / el.y` as **CANVAS-ABSOLUTE mm**:

```ts
// Step7TableCardCanvas.web.tsx — renderElementInner for shape='polygon'
const x = mmToPx(el.x);  // canvas-mm (renderer reads this directly)
const y = mmToPx(el.y);  // canvas-mm
return <Line x={x} y={y} width={width} height={height} points={pts} ... />;
```

When the user clicked within bboxOrigin (e.g. Inspector default `(50, 50)`) and the local bbox was `(10, 20) → (60, 50)`:
- preview rendering (`renderPolygonPreview`) showed the polygon at canvas-mm `(60, 70) → (110, 100)` ✓
- final stored element was `el.x = 10, el.y = 20, width = 50, height = 30`
- final rendered shape appeared at canvas-mm `(10, 20) → (60, 50)` — **40 mm short of where the user clicked**

When the user clicked near the canvas boundary (e.g. canvas-mm `(5, 5)` with bboxOrigin `(50, 50)`):
- local coords were `(-45, -45)` etc.
- `el.x = -45, el.y = -45`
- Konva rendered the polygon at canvas-mm `(-45, -45)` — completely **outside the visible A4** (canvas is 210×297 mm)

This is precisely the symptom the user described: drawing near the boundary makes the shape jump out of the canvas.

## Why Round 14's test passed despite the bug

`Step7TableCardInspector.test.tsx` Round 14 test asserted:
```ts
expect(poly.x).toBe(10);  // localMinX
expect(poly.y).toBe(20);  // localMinY
```

The test only checked that the bbox **span** was correct (computed from actual vertices), not that the bbox **position** was in canvas-absolute mm. The Round 14 fix was *half right*: width/height correct, x/y wrong.

## Fix

Add `bboxOrigin` parameter to `buildPolygonElementFromVertices`. Both callers (Inspector + Canvas finish button) now pass `polygonCreation.bboxOrigin`. The helper translates local-mm bbox → canvas-absolute-mm bbox before returning:

```ts
export function buildPolygonElementFromVertices(
  vertices: readonly number[],
  nextZ: number,
  bboxOrigin: { x: number; y: number },  // NEW: required
  idFactory: () => string = () => crypto.randomUUID(),
): TableCardElement {
  const localBbox = computePolygonBbox(vertices);
  const localPts = rebasePolygonPointsToBboxLocal(vertices);
  return {
    ...
    x: localBbox.x + bboxOrigin.x,   // canvas-absolute mm
    y: localBbox.y + bboxOrigin.y,   // canvas-absolute mm
    width: localBbox.width,          // same in both frames
    height: localBbox.height,
    ...
    points: localPts,                // still bbox-local
    ...
  };
}
```

`points` stays rebased to bbox-local because the renderer's `<Line x={mmToPx(el.x)} points={pts} />` math = `el.x + pts[i]` = `(bboxOrigin.x + localBbox.x) + (vertex[i] - localBbox.x)` = `bboxOrigin.x + vertex[i]` — exactly where the preview rendered the vertex.

## Why a dedicated unit test file was added

Round 14 conflated "Inspector default bboxOrigin = (50, 50)" with "the math itself". A dedicated `Step7TableCard.polygonElement.test.ts` makes the bboxOrigin offset explicit and lets future callers verify input shape without going through a full React render.

17 new tests covering:
- `computePolygonBbox` (5 tests): empty / 3-vertex positive / 3-vertex negative / degenerate (clamped to 1×1) / non-numeric NaN
- `rebasePolygonPointsToBboxLocal` (3 tests): empty / positive / negative
- `nextPolygonZIndex` (3 tests): empty / mixed zIndex / all -1
- `buildPolygonElementFromVertices` (6 tests, all pinned against Round 15 Bug 3):
  - positive-coord triangle → canvas-absolute bbox
  - **REGRESSION**: polygon drawn near boundary (negative local coords) lands at correct canvas-mm position
  - bboxOrigin (0, 0) → local coords === canvas coords
  - deterministic IDs via idFactory
  - default blue fill / zero stroke / zero rotation
  - right-edge case: polygon stays inside 210×297 canvas

## Files touched

| File | Change |
|------|--------|
| `apps/frontend/src/components/business/dashboard/CardBuilderEditor/Step7TableCard/Step7TableCard.polygonElement.ts` | `buildPolygonElementFromVertices` adds `bboxOrigin` parameter; docstring updated with Round 15 Bug 3 explanation |
| `apps/frontend/src/components/business/dashboard/CardBuilderEditor/Step7TableCard/Step7TableCard.polygonElement.test.ts` | NEW — 17 unit tests pinning down the math |
| `apps/frontend/src/components/business/dashboard/CardBuilderEditor/Step7TableCard/Step7TableCardInspector.tsx` | `handleFinishPolygon` passes `polygonCreation.bboxOrigin` to the shared builder |
| `apps/frontend/src/components/business/dashboard/CardBuilderEditor/Step7TableCard/Step7TableCardCanvas.web.tsx` | In-canvas finish button click handler passes `polygonCreation.bboxOrigin`; docstring updated with Round 15 note |
| `apps/frontend/src/components/business/dashboard/CardBuilderEditor/Step7TableCard/Step7TableCardInspector.test.tsx` | Round 14 test expected values updated (local 10/20 → canvas-absolute 60/70); NEW Round 15 regression test for negative-coord case |
| `apps/frontend/src/i18n/locales/tableCard.zh-TW.ts` | `polygonFinish: '完成多邊形'` → `'完成'`; hint copy synced |
| `apps/frontend/src/i18n/locales/tableCard.en.ts` | `polygonFinish: 'Finish polygon'` → `'Done'`; hint copy synced |

## Verification

```
Step 7 test suite (Round 15):
  Test Files  6 passed (6)
  Tests       116 passed (116)
  Duration    9.00s

Breakdown:
  Step7TableCard.i18n.test.ts                    6 tests
  Step7TableCard.polygonElement.test.ts         17 tests (NEW)
  Step7TableCardInspector.test.tsx              15 tests (+1 NEW regression)
  Step7TableCardCanvas.test.tsx                  67 tests (unchanged)
  Step7TableCard.hooks.test.ts                   7 tests
  Step7MobileToolbar.test.tsx                    4 tests
```

Pre-Round-15 Step 7 had **98** passing tests; Round 15 adds **18** new tests, all green.

CardBuilderEditor-wide: **1334 passed, 4 failed** — the 4 failures are pre-existing Step 4 i18n tests with `ENOENT` on locale file path (`Step4CardInfo.i18n.test.ts`), confirmed via `git stash` test that they fail on the clean main branch too. **Not caused by Round 15.**

Typecheck: no new errors introduced by Round 15 changes. Pre-existing errors in `MediaAssetUploader/*` + `useImageCrop.*` + `hooks/index.ts` + `detectLanguage.web.ts` are unrelated.

## Cross-reference

- Round 14 introduced `buildPolygonElementFromVertices` but missed the local → canvas translation. See `runs/improvements/feedback/20260927-step7-round14-shape-7-fixes.md` § Bug 2 fix.
- Round 13 (preview line off-canvas) had the SAME coordinate-space class of bug (canvas-px vs local-mm). See `runs/improvements/feedback/20260927-step7-round13-polygon-click-coordinate-conversion.md`. **Pattern**: any helper that bridges "local" coords to a Konva `<Line>` / `<Group>` must explicitly translate through bboxOrigin.
- The 5 places that own polygon-creation state (`Step7TableCardCanvas.web.tsx`, `Step7TableCardInspector.tsx`, `CardBuilderEditor.store.ts`, `Step7TableCard.polygonElement.ts`, and the i18n namespace) now share the same canonical docstring: "vertices are local mm; element x/y are canvas-absolute mm; points are bbox-local". Anyone introducing a 6th caller will trip the type signature change and be forced to thread bboxOrigin correctly.
