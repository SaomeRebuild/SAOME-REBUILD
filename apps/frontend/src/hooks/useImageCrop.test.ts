/**
 * useImageCrop Conformance Tests
 *
 * These tests pin the srcSquareSize formula and the contract between the UI
 * mask window and the exported crop region. They are NOT regular "feature works"
 * tests — they are **conformance tests** that guard against silent drift
 * between the LogoUploader UI, the LOGO_CROP_CONFIG constants, and the
 * srcSquareSize math inside cropImage().
 *
 * We test the pure geometry by directly invoking the formulas from useImageCrop
 * logic — no DOM, no canvas. This avoids jsdom canvas limitations and gives
 * deterministic numeric results.
 *
 * See `.cursor/skills/saome-image-upload/SKILL.md` § Crop Window Invariant
 * and `.cursor/rules/028-image-uploader-pattern.mdc` § 11.
 */
import { describe, it, expect } from 'vitest';
import { syncFocalFromOffset } from '@/components/business/dashboard/CardBuilderEditor/LogoUploader/LogoUploader';
import { computeSrcSquareSize } from '@/hooks/useImageCrop';
import { LOGO_CROP_CONFIG } from '@saome/shared/constants/card-images';

/** Minimal CropState shape needed by conformance tests — mirrors useImageCrop.CropState */
type CropState = {
  focalX: number;
  focalY: number;
  scale: number;
  naturalWidth: number;
  naturalHeight: number;
  offsetX?: number;
  offsetY?: number;
  resolvedBaseCanvasWidth?: number;
};

// ---------------------------------------------------------------------------
// Pure geometry helper — mirrors what cropImage() does internally
// ---------------------------------------------------------------------------

/**
 * Mirrors the raw srcX/srcY computation inside useImageCrop.cropImage().
 *
 * `computeSrcSquareSize` itself is imported from useImageCrop so the test
 * pins the production-side formula (no local duplicate that could drift).
 * The focal→srcX/srcY math stays local because it lives only as test-side
 * assertion geometry, not as production code.
 */
function computeSrcRect(
  focalX: number,
  focalY: number,
  srcSquareSize: number,
  naturalWidth: number,
  naturalHeight: number,
): { srcX: number; srcY: number; srcW: number; srcH: number } {
  const rawX = focalX * naturalWidth - srcSquareSize / 2;
  const rawY = focalY * naturalHeight - srcSquareSize / 2;
  const srcX = Math.max(0, rawX);
  const srcY = Math.max(0, rawY);
  const srcW = Math.min(srcSquareSize, naturalWidth - srcX);
  const srcH = Math.min(srcSquareSize, naturalHeight - srcY);
  return { srcX, srcY, srcW, srcH };
}

// ---------------------------------------------------------------------------
// Conformance Tests
// ---------------------------------------------------------------------------

describe('useImageCrop — conformance tests (Crop Window Invariant)', () => {
  // ========================================================================
  // § 1. srcSquareSize formula (UI mask ↔ export crop region alignment)
  // ========================================================================

  describe('srcSquareSize formula', () => {
    it('scale=1, focal=0.5, src 1024×768, baseW=400, mask=200 → 512×512 square centered', () => {
      const srcSquareSize = computeSrcSquareSize(200, 400, 1, 1024, 768);
      expect(srcSquareSize).toBe(512);

      const { srcX, srcY, srcW, srcH } = computeSrcRect(0.5, 0.5, srcSquareSize, 1024, 768);

      // srcY: 0.5*768 - 256 = 384 - 256 = 128
      expect(srcX).toBe(256); // 0.5*1024 - 256
      expect(srcY).toBe(128);
      expect(srcW).toBe(512);
      expect(srcH).toBe(512);
    });

    it('scale=2, focal=0.5 → 256×256 square (4× zoom-in detail)', () => {
      const srcSquareSize = computeSrcSquareSize(200, 400, 2, 1024, 768);
      expect(srcSquareSize).toBe(256);

      const { srcX, srcY, srcW, srcH } = computeSrcRect(0.5, 0.5, srcSquareSize, 1024, 768);

      // srcX: 0.5*1024 - 128 = 512 - 128 = 384
      // srcY: 0.5*768 - 128 = 384 - 128 = 256
      expect(srcX).toBe(384);
      expect(srcY).toBe(256);
      expect(srcW).toBe(256);
      expect(srcH).toBe(256);
    });

    it('scale=3 → ~170.67×170.67 square (9× zoom-in detail)', () => {
      const srcSquareSize = computeSrcSquareSize(200, 400, 3, 1024, 768);
      expect(srcSquareSize).toBeCloseTo(170.67, 2);
    });

    it('focal point moves the src region (not just centers on 0.5)', () => {
      const srcSquareSize = computeSrcSquareSize(200, 400, 1, 1024, 1024);
      expect(srcSquareSize).toBe(512);

      // focalX=0.25 (25% from left), focalY=0.75 (75% from top)
      const { srcX, srcY, srcW } = computeSrcRect(0.25, 0.75, srcSquareSize, 1024, 1024);

      // srcX: 0.25*1024 - 256 = 256 - 256 = 0
      // srcY: 0.75*1024 - 256 = 768 - 256 = 512
      expect(srcX).toBe(0);
      expect(srcY).toBe(512);
      expect(srcW).toBe(512);
    });

    it('clamps srcX/srcY when focal pushes the region past image bounds', () => {
      const srcSquareSize = computeSrcSquareSize(200, 400, 1, 1024, 1024);
      // focal=0 (far left) → rawX = 0 - 256 = -256 → clamp to 0
      const { srcX, srcY, srcW, srcH } = computeSrcRect(0, 0, srcSquareSize, 1024, 1024);

      expect(srcX).toBe(0);
      expect(srcY).toBe(0);
      expect(srcW).toBe(512); // srcSquareSize clamped to available width
      expect(srcH).toBe(512);
    });
  });

  // ========================================================================
  // § 2. UI mask size binding to cropWindowSize (silent drift guard)
  // ========================================================================

  describe('UI mask size must bind to cropWindowSize (no silent drift)', () => {
    it('changing cropWindowSize changes the exported src region proportionally', () => {
      // mask=100 → smaller src region; mask=400 → larger src region; ratio should be 4×
      // (use a square source so naturalHeight cap is a no-op)
      const small = computeSrcSquareSize(100, 400, 1, 1024, 1024);
      const large = computeSrcSquareSize(400, 400, 1, 1024, 1024);

      expect(small * 4).toBeCloseTo(large, 0);
      expect(large / small).toBeCloseTo(4, 0);
    });

    it('LOGO_CROP_CONFIG defaults produce non-zero export region', () => {
      // Guard: defaults should never accidentally compute 0 (the "mask 0 = no crop" bug)
      const { CROP_WINDOW_SIZE, BASE_CANVAS_WIDTH } = LOGO_CROP_CONFIG;
      const srcSquareSize = computeSrcSquareSize(CROP_WINDOW_SIZE, BASE_CANVAS_WIDTH, 1, 1024, 1024);

      expect(srcSquareSize).toBeGreaterThan(0);
      expect(srcSquareSize).toBe(512); // (200 / (400*1)) * 1024
    });

    it('sanity: the buggy formula min(NW,NH)/scale diverges from UI at 1024×768', () => {
      // The old formula was: min(NW, NH) / scale = 768 / 1 = 768
      // The correct formula gives 512. This test documents the regression.
      const oldBuggy = Math.min(1024, 768) / 1; // 768
      const correct = computeSrcSquareSize(200, 400, 1, 1024, 768); // 512

      expect(correct).not.toBe(oldBuggy);
      expect(correct).toBe(512);
    });
  });

  // ========================================================================
  // § 2.5 Landscape srcW===srcH invariant (no squash bug)
  // ========================================================================

  describe('Landscape image: src region must remain square (no export squash)', () => {
    /**
     * Regression: when the conceptual crop window (e.g., 200px) exceeds the
     * stage height for landscape images, the WIDTH-based srcSquareSize formula
     * would exceed naturalHeight. Without the naturalHeight cap, srcW would
     * stay large while srcH gets clamped → Canvas.drawImage stretches the
     * non-square src region into the 960×960 output → visible squash.
     *
     * See `runs/improvements/feedback/20260830-logo-uploader-landscape-squash.md`
     * (full trace).
     */

    it('extreme landscape (2000×200, 10:1): srcSquareSize capped at naturalHeight', () => {
      const srcSquareSize = computeSrcSquareSize(200, 400, 1, 2000, 200);
      expect(srcSquareSize).toBeLessThanOrEqual(200);
      expect(srcSquareSize).toBe(200);
    });

    it('extreme landscape (2000×200): srcW === srcH (square export)', () => {
      const srcSquareSize = computeSrcSquareSize(200, 400, 1, 2000, 200);
      const { srcW, srcH } = computeSrcRect(0.5, 0.5, srcSquareSize, 2000, 200);
      expect(srcW).toBe(srcH);
    });

    it('wide landscape (2000×600): srcSquareSize capped (height is the limit)', () => {
      // Without cap: (200/400)*2000 = 1000 → would clamp srcH to 600 → 1000×600 squash
      // With cap: min(1000, 600) = 600 → 600×600 square
      const srcSquareSize = computeSrcSquareSize(200, 400, 1, 2000, 600);
      expect(srcSquareSize).toBe(600);
    });

    it('wide landscape (2000×600): srcW === srcH', () => {
      const srcSquareSize = computeSrcSquareSize(200, 400, 1, 2000, 600);
      const { srcW, srcH } = computeSrcRect(0.5, 0.5, srcSquareSize, 2000, 600);
      expect(srcW).toBe(srcH);
      expect(srcW).toBe(600);
    });

    it('mild landscape (1920×1080, 16:9): cap does NOT activate (square is achievable)', () => {
      // Width-based: (200/400)*1920 = 960. naturalHeight=1080. min(960, 1080) = 960.
      const srcSquareSize = computeSrcSquareSize(200, 400, 1, 1920, 1080);
      expect(srcSquareSize).toBe(960);
      const { srcW, srcH } = computeSrcRect(0.5, 0.5, srcSquareSize, 1920, 1080);
      expect(srcW).toBe(srcH);
      expect(srcW).toBe(960);
    });

    it('portrait (600×2000): cap does NOT activate (square is achievable)', () => {
      const srcSquareSize = computeSrcSquareSize(200, 400, 1, 600, 2000);
      expect(srcSquareSize).toBe(300); // (200/400)*600 = 300, min(300, 2000) = 300
      const { srcW, srcH } = computeSrcRect(0.5, 0.5, srcSquareSize, 600, 2000);
      expect(srcW).toBe(srcH);
      expect(srcW).toBe(300);
    });

    it('square (500×500): cap does NOT activate', () => {
      const srcSquareSize = computeSrcSquareSize(200, 400, 1, 500, 500);
      expect(srcSquareSize).toBe(250);
      const { srcW, srcH } = computeSrcRect(0.5, 0.5, srcSquareSize, 500, 500);
      expect(srcW).toBe(srcH);
      expect(srcW).toBe(250);
    });

    it('landscape + zoom-in (scale=2, 2000×600): srcSquareSize still capped', () => {
      // Width-based: (200/(400*2))*2000 = 500. min(500, 600) = 500.
      const srcSquareSize = computeSrcSquareSize(200, 400, 2, 2000, 600);
      expect(srcSquareSize).toBe(500);
      const { srcW, srcH } = computeSrcRect(0.5, 0.5, srcSquareSize, 2000, 600);
      expect(srcW).toBe(srcH);
    });

    it('landscape + heavy zoom (scale=3, 2000×200): cap takes effect at scale', () => {
      // Width-based: (200/(400*3))*2000 ≈ 333.33. min(333.33, 200) = 200.
      const srcSquareSize = computeSrcSquareSize(200, 400, 3, 2000, 200);
      expect(srcSquareSize).toBe(200);
    });
  });

  // ========================================================================
  // § 3. Small src image corner case (NW < baseCanvasWidth)
  // ========================================================================

  describe('small src image corner case (NW < baseCanvasWidth)', () => {
    it('uses resolvedBaseCanvasWidth when set (matches UI baseContainerW)', () => {
      // Small image 300×225. UI shows at baseContainerW=300.
      // Hook with resolvedBaseCanvasWidth=300 should use that for formula.
      const withResolved = computeSrcSquareSize(200, 300, 1, 300, 225);
      // srcSquareSize = min((200 / (300*1)) * 300, 225) = min(200, 225) = 200
      expect(withResolved).toBe(200);

      // Without resolved, falls back to baseCanvasWidth=400:
      const withoutResolved = computeSrcSquareSize(200, 400, 1, 300, 225);
      // srcSquareSize = min((200 / (400*1)) * 300, 225) = min(150, 225) = 150
      expect(withoutResolved).toBe(150);

      // They should differ (otherwise resolvedBaseCanvasWidth has no effect)
      expect(withResolved).not.toBe(withoutResolved);
    });

    it('resolvedBaseCanvasWidth < baseCanvasWidth → export matches UI', () => {
      // NW=250, UI=250 (min(250,400)=250). With resolved=250 → 200×200.
      // With fallback 400 → 125×125 (wrong: too small).
      const correct = computeSrcSquareSize(200, 250, 1, 250, 250);
      expect(correct).toBe(200);

      const wrong = computeSrcSquareSize(200, 400, 1, 250, 250);
      expect(wrong).toBe(125);
      expect(correct).not.toBe(wrong);
    });
  });

  // ========================================================================
  // § 4. syncFocalFromOffset direction correctness
  // ========================================================================

  describe('syncFocalFromOffset — drag direction correctness', () => {
    function makeState(overrides: Partial<CropState> = {}): CropState {
      return {
        focalX: 0.5,
        focalY: 0.5,
        scale: 1,
        naturalWidth: 1024,
        naturalHeight: 768,
        offsetX: 0,
        offsetY: 0,
        ...overrides,
      };
    }

    it('drag right (offsetX > 0) → focalX decreases (src appears to shift left)', () => {
      // When user drags image right (offsetX=100), the image visual center moves right
      // in the outer box, so the mask window now sees a point that's MORE to the
      // LEFT in the src → focalX should decrease.
      const result = syncFocalFromOffset(makeState({ offsetX: 100 }), 400, 300);
      expect(result.focalX).toBeLessThan(0.5);
      // 0.5 - 100/400 = 0.25
      expect(result.focalX).toBeCloseTo(0.25, 5);
    });

    it('drag left (offsetX < 0) → focalX increases (src appears to shift right)', () => {
      const result = syncFocalFromOffset(makeState({ offsetX: -100 }), 400, 300);
      expect(result.focalX).toBeGreaterThan(0.5);
      // 0.5 - (-100)/400 = 0.5 + 0.25 = 0.75
      expect(result.focalX).toBeCloseTo(0.75, 5);
    });

    it('drag down (offsetY > 0) → focalY decreases (src appears to shift up)', () => {
      const result = syncFocalFromOffset(makeState({ offsetY: 60 }), 400, 300);
      expect(result.focalY).toBeLessThan(0.5);
      // 0.5 - 60/300 = 0.5 - 0.2 = 0.3
      expect(result.focalY).toBeCloseTo(0.3, 5);
    });

    it('no drag (offsetX=offsetY=0) → focal stays at 0.5', () => {
      const result = syncFocalFromOffset(makeState({ offsetX: 0, offsetY: 0 }), 400, 300);
      expect(result.focalX).toBe(0.5);
      expect(result.focalY).toBe(0.5);
    });

    it('focalX is clamped to [0, 1] even with extreme drag', () => {
      const result = syncFocalFromOffset(makeState({ offsetX: 10000 }), 400, 300);
      expect(result.focalX).toBeGreaterThanOrEqual(0);
      expect(result.focalX).toBeLessThanOrEqual(1);
    });

    it('formula does NOT multiply by scale (Bug-A regression guard)', () => {
      // Bug-A: the formula accidentally used (offsetX * scale) / baseContainerW
      // which doubled the correction at scale=2. The correct formula has no scale factor.
      // Verify by testing at scale=2 — focalX should be the same as at scale=1
      // (same drag distance, same visual shift in outer box).
      const scale1 = syncFocalFromOffset(makeState({ scale: 1, offsetX: 100 }), 400, 300);
      const scale2 = syncFocalFromOffset(makeState({ scale: 2, offsetX: 100 }), 400, 300);

      // Both should give the same focalX (0.25)
      expect(scale1.focalX).toBeCloseTo(scale2.focalX, 5);
      expect(scale1.focalX).toBeCloseTo(0.25, 5);
    });

    it('different baseContainerW values give different focalX (same drag distance)', () => {
      // At baseW=200, drag 100px = half the container → big focal shift
      // At baseW=400, drag 100px = quarter of container → smaller focal shift
      const narrow = syncFocalFromOffset(makeState({ offsetX: 100 }), 200, 150);
      const wide = syncFocalFromOffset(makeState({ offsetX: 100 }), 400, 300);

      expect(narrow.focalX).not.toBe(wide.focalX);
      // narrow: 0.5 - 100/200 = 0.0
      // wide: 0.5 - 100/400 = 0.25
      expect(narrow.focalX).toBeCloseTo(0.0, 5);
      expect(wide.focalX).toBeCloseTo(0.25, 5);
    });

    it('portrait image drag down uses baseContainerH (NOT BASE_CANVAS_WIDTH placeholder) — Bug-φ regression guard', () => {
      // Bug-φ (2026-08-30): LogoUploader's handlePointerUp used a useCallback
      // with empty deps, capturing the placeholder baseContainerW=400 and
      // baseContainerH=400 (initial render, naturalWidth=0). After the image
      // loads, baseContainerH recomputes to the aspect-matched value
      // (portrait 2000×3000 → baseH=600), but the callback was never recreated.
      // Every drag ended up computing focalY with the wrong denominator (400
      // instead of 600), shifting the export crop by ~250 source px on
      // portrait images for a 100 px drag.

      // Portrait 2000×3000 → baseContainerW=400, baseContainerH=600
      const portraitCorrect = syncFocalFromOffset(
        makeState({ naturalWidth: 2000, naturalHeight: 3000, offsetY: 100 }),
        400,
        600,
      );
      // 0.5 - 100/600 = 0.333
      expect(portraitCorrect.focalY).toBeCloseTo(0.333, 3);

      // The buggy version (using BASE_CANVAS_WIDTH=400 placeholder for both)
      // gives a different result:
      const portraitBuggy = syncFocalFromOffset(
        makeState({ naturalWidth: 2000, naturalHeight: 3000, offsetY: 100 }),
        400,
        400,
      );
      // 0.5 - 100/400 = 0.25
      expect(portraitBuggy.focalY).toBeCloseTo(0.25, 3);

      // They must differ — otherwise the bug is undetectable
      expect(portraitCorrect.focalY).not.toBeCloseTo(portraitBuggy.focalY, 2);

      // Export src-side impact: with buggy focalY=0.25 vs correct 0.333,
      // srcY differs by 250 source px for NH=3000
      const correctSrcY = portraitCorrect.focalY * 3000 - 500;
      const buggySrcY = portraitBuggy.focalY * 3000 - 500;
      expect(correctSrcY - buggySrcY).toBeCloseTo(250, 0);
    });

    it('landscape image drag down uses baseContainerH=267 (NOT 400 placeholder) — Bug-φ regression guard', () => {
      // Landscape 3000×2000 → baseContainerW=400, baseContainerH=round(400 * 2000/3000) = 267
      const landscapeCorrect = syncFocalFromOffset(
        makeState({ naturalWidth: 3000, naturalHeight: 2000, offsetY: 100 }),
        400,
        267,
      );
      // 0.5 - 100/267 ≈ 0.125
      expect(landscapeCorrect.focalY).toBeCloseTo(0.125, 3);

      // Buggy version with placeholder baseContainerH=400 gives wrong result
      const landscapeBuggy = syncFocalFromOffset(
        makeState({ naturalWidth: 3000, naturalHeight: 2000, offsetY: 100 }),
        400,
        400,
      );
      // 0.5 - 100/400 = 0.25
      expect(landscapeBuggy.focalY).toBeCloseTo(0.25, 3);

      // They must differ
      expect(landscapeCorrect.focalY).not.toBeCloseTo(landscapeBuggy.focalY, 2);

      // Export src-side impact: with buggy focalY=0.25 vs correct 0.125,
      // srcY differs by ~250 source px for NH=2000
      const correctSrcY = landscapeCorrect.focalY * 2000 - 750;
      const buggySrcY = landscapeBuggy.focalY * 2000 - 750;
      expect(Math.abs(correctSrcY - buggySrcY)).toBeGreaterThan(200);
    });

    it('square image drag down is identical regardless of Bug-φ (no aspect change)', () => {
      // Square images keep baseContainerH = BASE_CANVAS_WIDTH = 400 forever,
      // so the Bug-φ placeholder-vs-actual distinction doesn't apply.
      // This guards against us "fixing" the bug in a way that breaks square.
      const square = syncFocalFromOffset(
        makeState({ naturalWidth: 1000, naturalHeight: 1000, offsetY: 100 }),
        400,
        400,
      );
      // 0.5 - 100/400 = 0.25
      expect(square.focalY).toBeCloseTo(0.25, 3);
    });
  });
});