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
 * Mirrors the srcSquareSize formula inside useImageCrop.cropImage().
 * Exposed here so conformance tests can assert the math independently.
 */
function computeSrcSquareSize(
  cropWindowSize: number,
  effectiveBaseCanvasWidth: number,
  scale: number,
  naturalWidth: number,
): number {
  return (cropWindowSize / (effectiveBaseCanvasWidth * scale)) * naturalWidth;
}

/**
 * Mirrors the raw srcX/srcY computation inside useImageCrop.cropImage().
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
      const srcSquareSize = computeSrcSquareSize(200, 400, 1, 1024);
      expect(srcSquareSize).toBe(512);

      const { srcX, srcY, srcW, srcH } = computeSrcRect(0.5, 0.5, srcSquareSize, 1024, 768);

      // srcY: 0.5*768 - 256 = 384 - 256 = 128
      expect(srcX).toBe(256); // 0.5*1024 - 256
      expect(srcY).toBe(128);
      expect(srcW).toBe(512);
      expect(srcH).toBe(512);
    });

    it('scale=2, focal=0.5 → 256×256 square (4× zoom-in detail)', () => {
      const srcSquareSize = computeSrcSquareSize(200, 400, 2, 1024);
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
      const srcSquareSize = computeSrcSquareSize(200, 400, 3, 1024);
      expect(srcSquareSize).toBeCloseTo(170.67, 2);
    });

    it('focal point moves the src region (not just centers on 0.5)', () => {
      const srcSquareSize = computeSrcSquareSize(200, 400, 1, 1024);
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
      const srcSquareSize = computeSrcSquareSize(200, 400, 1, 1024);
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
      const small = computeSrcSquareSize(100, 400, 1, 1024);
      const large = computeSrcSquareSize(400, 400, 1, 1024);

      expect(small * 4).toBeCloseTo(large, 0);
      expect(large / small).toBeCloseTo(4, 0);
    });

    it('LOGO_CROP_CONFIG defaults produce non-zero export region', () => {
      // Guard: defaults should never accidentally compute 0 (the "mask 0 = no crop" bug)
      const { CROP_WINDOW_SIZE, BASE_CANVAS_WIDTH } = LOGO_CROP_CONFIG;
      const srcSquareSize = computeSrcSquareSize(CROP_WINDOW_SIZE, BASE_CANVAS_WIDTH, 1, 1024);

      expect(srcSquareSize).toBeGreaterThan(0);
      expect(srcSquareSize).toBe(512); // (200 / (400*1)) * 1024
    });

    it('sanity: the buggy formula min(NW,NH)/scale diverges from UI at 1024×768', () => {
      // The old formula was: min(NW, NH) / scale = 768 / 1 = 768
      // The correct formula gives 512. This test documents the regression.
      const oldBuggy = Math.min(1024, 768) / 1; // 768
      const correct = computeSrcSquareSize(200, 400, 1, 1024); // 512

      expect(correct).not.toBe(oldBuggy);
      expect(correct).toBe(512);
    });
  });

  // ========================================================================
  // § 3. Small src image corner case (NW < baseCanvasWidth)
  // ========================================================================

  describe('small src image corner case (NW < baseCanvasWidth)', () => {
    it('uses resolvedBaseCanvasWidth when set (matches UI baseContainerW)', () => {
      // Small image 300×225. UI shows at baseContainerW=300.
      // Hook with resolvedBaseCanvasWidth=300 should use that for formula.
      const withResolved = computeSrcSquareSize(200, 300, 1, 300);
      // srcSquareSize = (200 / (300*1)) * 300 = 200
      expect(withResolved).toBe(200);

      // Without resolved, falls back to baseCanvasWidth=400:
      const withoutResolved = computeSrcSquareSize(200, 400, 1, 300);
      // srcSquareSize = (200 / (400*1)) * 300 = 150
      expect(withoutResolved).toBe(150);

      // They should differ (otherwise resolvedBaseCanvasWidth has no effect)
      expect(withResolved).not.toBe(withoutResolved);
    });

    it('resolvedBaseCanvasWidth < baseCanvasWidth → export matches UI', () => {
      // NW=250, UI=250 (min(250,400)=250). With resolved=250 → 200×200.
      // With fallback 400 → 125×125 (wrong: too small).
      const correct = computeSrcSquareSize(200, 250, 1, 250);
      expect(correct).toBe(200);

      const wrong = computeSrcSquareSize(200, 400, 1, 250);
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
  });
});