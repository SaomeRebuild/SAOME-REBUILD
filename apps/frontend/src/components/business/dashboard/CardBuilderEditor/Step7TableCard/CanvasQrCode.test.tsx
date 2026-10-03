/**
 * CanvasQrCode — conformance + regression tests (2026-10-04).
 *
 * @module components/business/dashboard/CardBuilderEditor/Step7TableCard/CanvasQrCode.test
 * @description
 *
 * Locks down the hit region fix that resolves the bug:
 *   "畫布上的 QR code 不能點選" (QR code on canvas can't be clicked)
 *
 * The root cause was the same one that Round 8/9 (2026-09-27) fixed
 * for `CanvasKonvaImage`: Konva.Group's hit detection comes entirely
 * from its listening children. The QR element shipped 2026-10-04
 * with the same `<Group><KonvaImage listening={false} /></Group>`
 * pattern but without the transparent hit-target Rect, so the Group
 * had no hit region and clicks fell through to the Stage.
 *
 * Why these tests matter:
 *   - jsdom has no canvas context → Konva's actual hit detection
 *     can't be observed. The structural source-level assertions below
 *     are the only reliable way to catch a future regression of this
 *     exact bug (we learned this the hard way with Round 8, which
 *     only checked structural pattern and missed the Group's
 *     hit-region requirement).
 *   - The fix is identical to Round 9's `CanvasKonvaImage` fix, so
 *     the test pattern is also identical. Anchoring on
 *     `id={element.id}` (which the prose comments don't contain)
 *     ensures we match the actual JSX, not the comment block.
 *
 * Strategy:
 *   1. Source-level structural tests (5) — pin the hit-target Rect,
 *      its position / dimensions, the inner KonvaImage's
 *      `listening={false}`, and the onClick / onTap handlers being
 *      wired to the Group.
 *   2. Direct test of the placeholder Rects (3) — verify the
 *      loading / failed placeholder Rects have their own onClick
 *      handlers (no Group wrapper, so the hit-region bug doesn't
 *      apply to them). This confirms the bug is specific to the
 *      loaded Konva.Image branch.
 *
 * @see runs/improvements/feedback/20261004-step7-qrcode-canvas-hit-region.md
 * @see runs/improvements/feedback/20260927-step7-round9-group-hit-region.md
 *      (Round 9 — same fix for the image variant)
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const SRC = readFileSync(
  resolve(__dirname, './CanvasQrCode.tsx'),
  'utf8',
);

describe('CanvasQrCode — hit region (regression — 2026-10-04)', () => {
  // -----------------------------------------------------------------
  // 1. Source-level structural assertions (the fix itself).
  //
  // These are the equivalent of Round 9's 4 image-side tests,
  // adapted for the QR variant. Anchoring on `id={element.id}` to
  // match the actual JSX Group, not the comment block.
  // -----------------------------------------------------------------

  it('source: Group contains a transparent hit-target Rect (regression — Konva.Group needs listening children for hit region)', () => {
    // Konva.Group's hit detection comes entirely from its children.
    // With only a Konva.Image that has listening={false}, the Group
    // has NO hit region — clicks on the QR's bounding box fall
    // through to the Stage (which clears selection via onMouseDown).
    //
    // The fix: add a transparent <Rect> as a listening child to
    // give the Group a hit region. fill="rgba(0,0,0,0)" keeps the
    // visual output unchanged (Rect is invisible) but the shape
    // path is still hit-testable.
    expect(SRC).toMatch(/<Rect[\s\S]*?fill="rgba\(0,0,0,0\)"/);
  });

  it('source: hit-target Rect is nested inside the Group wrapper (not a sibling)', () => {
    // The hit Rect must be INSIDE the Group (between <Group ...>
    // and </Group>), not just somewhere else in the file. The
    // Group wrapper is uniquely identifiable by `id={element.id}`
    // (which the prose comments don't contain — anchors the match
    // to the actual JSX and prevents matching the comment block).
    const groupMatch = SRC.match(
      /<Group[\s\S]*?id=\{element\.id\}[\s\S]*?<\/Group>/,
    );
    expect(groupMatch).not.toBeNull();
    expect(groupMatch?.[0] ?? '').toMatch(
      /<Rect[\s\S]*?fill="rgba\(0,0,0,0\)"/,
    );
  });

  it('source: hit-target Rect spans the full bbox (x=0, y=0, width=width, height=height)', () => {
    // The hit Rect must cover the Group's local coordinate system
    // (origin at top-left of the bbox, dimensions matching the
    // QR's width / height). Without this, some portion of the
    // bbox would not be hit-testable, reintroducing the bug for
    // that region.
    const groupMatch = SRC.match(
      /<Group[\s\S]*?id=\{element\.id\}[\s\S]*?<\/Group>/,
    );
    expect(groupMatch).not.toBeNull();
    const groupBody = groupMatch?.[0] ?? '';
    expect(groupBody).toMatch(/<Rect[\s\S]*?x=\{0\}[\s\S]*?y=\{0\}/);
    expect(groupBody).toMatch(
      /<Rect[\s\S]*?width=\{width\}[\s\S]*?height=\{height\}/,
    );
  });

  it('source: inner Konva.Image still has listening={false} (events bubble to Group via hit Rect)', () => {
    // Defensive: the inner Konva.Image stays listening={false}
    // even with the hit Rect in place. This ensures events on the
    // visible QR pixels bubble up to the Group via the Rect
    // (consistent path), not via the Konva.Image's built-in
    // pixel-based hit detection. If we ever flip this back to
    // listening={true}, QR codes would regress to the original
    // bug because ~70% of a QR's surface is the white background
    // (bgColor) — Konva.Image's pixel-based hit detection would
    // require the click to land on an opaque pixel.
    const groupMatch = SRC.match(
      /<Group[\s\S]*?id=\{element\.id\}[\s\S]*?<\/Group>/,
    );
    expect(groupMatch).not.toBeNull();
    const groupBody = groupMatch?.[0] ?? '';
    expect(groupBody).toMatch(/<KonvaImage[\s\S]*?listening=\{false\}/);
  });

  it('source: Group has onClick and onTap handlers (events fire from the hit Rect to the Group)', () => {
    // The Group (not the Konva.Image) must own the onClick / onTap
    // handlers. Events hit the transparent Rect first (because
    // Konva traverses children in reverse order for hit detection),
    // then bubble up to the Group, which fires onSelect.
    const groupMatch = SRC.match(
      /<Group[\s\S]*?id=\{element\.id\}[\s\S]*?<\/Group>/,
    );
    expect(groupMatch).not.toBeNull();
    const groupBody = groupMatch?.[0] ?? '';
    expect(groupBody).toMatch(/onClick=\{\(\) => onSelect\(element\.id\)\}/);
    expect(groupBody).toMatch(/onTap=\{\(\) => onSelect\(element\.id\)\}/);
  });

  // -----------------------------------------------------------------
  // 2. Placeholder Rect branches — verify they are NOT affected by
  //    the Group hit-region bug.
  //
  // The loading and failed states render a bare <Rect> with
  // onClick / onTap directly on it. Konva.Rect has its own
  // built-in hit detection (rectangular), so these branches
  // work without any Group wrapper. This test confirms the bug
  // is unique to the loaded-Konva.Image branch.
  // -----------------------------------------------------------------

  it('source: loading placeholder Rect has its own onClick handler (not affected by Group hit-region bug)', () => {
    // The loading branch uses a bare Konva.Rect with built-in hit
    // detection — no Group wrapper, no listening={false} issue.
    // This is the historical "placeholder is clickable" path from
    // Round 7 (image variant). The same fix doesn't apply here
    // because there's no Group to break hit detection.
    //
    // Note: the Rect is self-closing (`<Rect ... />`), so the regex
    // anchors on `/>` rather than `</Rect>`.
    const loadingBranch = SRC.match(
      /status === 'loading'[\s\S]*?\/>/,
    );
    expect(loadingBranch).not.toBeNull();
    const branchBody = loadingBranch?.[0] ?? '';
    expect(branchBody).toMatch(/onClick=\{\(\) => onSelect\(element\.id\)\}/);
    expect(branchBody).toMatch(/onTap=\{\(\) => onSelect\(element\.id\)\}/);
    // Defensive: no Group wrapper (which would be the bug
    // reintroduced for this branch).
    expect(branchBody).not.toMatch(/<Group/);
  });

  it('source: failed placeholder Rect has its own onClick handler (not affected by Group hit-region bug)', () => {
    // Same as the loading branch — bare Konva.Rect with built-in
    // hit detection, clickable on its own.
    const failedBranch = SRC.match(
      /status === 'failed'[\s\S]*?\/>/,
    );
    expect(failedBranch).not.toBeNull();
    const branchBody = failedBranch?.[0] ?? '';
    expect(branchBody).toMatch(/onClick=\{\(\) => onSelect\(element\.id\)\}/);
    expect(branchBody).toMatch(/onTap=\{\(\) => onSelect\(element\.id\)\}/);
    expect(branchBody).not.toMatch(/<Group/);
  });

  // -----------------------------------------------------------------
  // 3. Cross-reference to the existing Round 9 image fix.
  //    Documents that the QR fix is intentionally parallel.
  // -----------------------------------------------------------------

  it('source: file header documents the connection to Round 9 (CanvasKonvaImage fix)', () => {
    // The file's JSDoc header explicitly references Round 9 (the
    // same fix for the image variant) and explains the parallel.
    // This is documentation; the structural tests above pin the
    // actual code shape. The cross-reference is here so a future
    // reader can find the original fix's trace without
    // re-deriving the reasoning.
    expect(SRC).toMatch(/Round 9/);
    expect(SRC).toMatch(/CanvasKonvaImage/);
    // The feedback doc path is also referenced in the header so
    // the trail is discoverable.
    expect(SRC).toMatch(
      /runs\/improvements\/feedback\/20261004-step7-qrcode-canvas-hit-region\.md/,
    );
  });
});
