/**
 * Shared imageCrop conformance tests.
 *
 * These tests pin the pure-function contracts of `syncFocalFromOffset`,
 * `applyScaleChange`, `computeSrcSquareSize`, and `validateLogoFile`.
 * They replace the conformance tests previously in
 * `apps/frontend/src/hooks/useImageCrop.test.ts` — moved here as part of
 * the LogoUploader pure-logic extraction (Phase A / P0).
 *
 * We test the pure geometry directly — no DOM, no Canvas, no React.
 * This avoids jsdom canvas limitations and gives deterministic numeric
 * results regardless of test environment.
 *
 * See `.cursor/skills/saome-image-upload/SKILL.md` § Crop Window Invariant.
 */

import { describe, it, expect } from 'vitest';
import {
  syncFocalFromOffset,
  applyScaleChange,
  computeSrcSquareSize,
  validateLogoFile,
} from './imageCrop';
import { LOGO_CROP_CONFIG } from '../constants/card-images';
import type { CropState } from '../types/imageCrop';

// ---------------------------------------------------------------------------
// Pure geometry helper — mirrors what cropImage() does internally
// (focal→srcX/srcY math lives only in test-side assertion geometry, not in
// production code, so conformance tests can independently verify the export
// rectangle math without circular references.)
// ---------------------------------------------------------------------------

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
// § 1. srcSquareSize formula
// ---------------------------------------------------------------------------

describe('imageCrop — §1 srcSquareSize formula (UI mask ↔ export crop region alignment)', () => {
  it('scale=1, focal=0.5, src 1024×768, baseW=400, mask=200 → 512×512 square centered', () => {
    const srcSquareSize = computeSrcSquareSize(200, 400, 1, 1024, 768);
    expect(srcSquareSize).toBe(512);

    const { srcX, srcY, srcW, srcH } = computeSrcRect(0.5, 0.5, srcSquareSize, 1024, 768);

    expect(srcX).toBe(256); // 0.5*1024 - 256
    expect(srcY).toBe(128); // 0.5*768 - 256
    expect(srcW).toBe(512);
    expect(srcH).toBe(512);
  });

  it('scale=2, focal=0.5 → 256×256 square (4× zoom-in detail)', () => {
    const srcSquareSize = computeSrcSquareSize(200, 400, 2, 1024, 768);
    expect(srcSquareSize).toBe(256);

    const { srcX, srcY, srcW, srcH } = computeSrcRect(0.5, 0.5, srcSquareSize, 1024, 768);

    expect(srcX).toBe(384); // 0.5*1024 - 128
    expect(srcY).toBe(256); // 0.5*768 - 128
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

    const { srcX, srcY, srcW } = computeSrcRect(0.25, 0.75, srcSquareSize, 1024, 1024);

    expect(srcX).toBe(0); // 0.25*1024 - 256 = 0
    expect(srcY).toBe(512); // 0.75*1024 - 256 = 512
    expect(srcW).toBe(512);
  });

  it('clamps srcX/srcY when focal pushes the region past image bounds', () => {
    const srcSquareSize = computeSrcSquareSize(200, 400, 1, 1024, 1024);
    const { srcX, srcY, srcW, srcH } = computeSrcRect(0, 0, srcSquareSize, 1024, 1024);

    expect(srcX).toBe(0);
    expect(srcY).toBe(0);
    expect(srcW).toBe(512);
    expect(srcH).toBe(512);
  });
});

// ---------------------------------------------------------------------------
// § 2. UI mask size binding (silent-drift guard)
// ---------------------------------------------------------------------------

describe('imageCrop — §2 UI mask size must bind to cropWindowSize (no silent drift)', () => {
  it('changing cropWindowSize changes the exported src region proportionally', () => {
    const small = computeSrcSquareSize(100, 400, 1, 1024, 1024);
    const large = computeSrcSquareSize(400, 400, 1, 1024, 1024);

    expect(small * 4).toBeCloseTo(large, 0);
    expect(large / small).toBeCloseTo(4, 0);
  });

  it('LOGO_CROP_CONFIG defaults produce non-zero export region', () => {
    const { CROP_WINDOW_SIZE, BASE_CANVAS_WIDTH } = LOGO_CROP_CONFIG;
    const srcSquareSize = computeSrcSquareSize(CROP_WINDOW_SIZE, BASE_CANVAS_WIDTH, 1, 1024, 1024);

    expect(srcSquareSize).toBeGreaterThan(0);
    expect(srcSquareSize).toBe(512);
  });

  it('sanity: the buggy formula min(NW,NH)/scale diverges from UI at 1024×768', () => {
    const oldBuggy = Math.min(1024, 768) / 1;
    const correct = computeSrcSquareSize(200, 400, 1, 1024, 768);
    expect(correct).not.toBe(oldBuggy);
    expect(correct).toBe(512);
  });
});

// ---------------------------------------------------------------------------
// § 2.5 Landscape srcW===srcH invariant (no squash bug)
// ---------------------------------------------------------------------------

describe('imageCrop — §2.5 Landscape image: src region must remain square', () => {
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
    const srcSquareSize = computeSrcSquareSize(200, 400, 1, 1920, 1080);
    expect(srcSquareSize).toBe(960);
    const { srcW, srcH } = computeSrcRect(0.5, 0.5, srcSquareSize, 1920, 1080);
    expect(srcW).toBe(srcH);
    expect(srcW).toBe(960);
  });

  it('portrait (600×2000): cap does NOT activate (square is achievable)', () => {
    const srcSquareSize = computeSrcSquareSize(200, 400, 1, 600, 2000);
    expect(srcSquareSize).toBe(300);
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
    const srcSquareSize = computeSrcSquareSize(200, 400, 2, 2000, 600);
    expect(srcSquareSize).toBe(500);
    const { srcW, srcH } = computeSrcRect(0.5, 0.5, srcSquareSize, 2000, 600);
    expect(srcW).toBe(srcH);
  });

  it('landscape + heavy zoom (scale=3, 2000×200): cap takes effect at scale', () => {
    const srcSquareSize = computeSrcSquareSize(200, 400, 3, 2000, 200);
    expect(srcSquareSize).toBe(200);
  });
});

// ---------------------------------------------------------------------------
// § 3. Small src image corner case (NW < baseCanvasWidth)
// ---------------------------------------------------------------------------

describe('imageCrop — §3 Small src image corner case (NW < baseCanvasWidth)', () => {
  it('uses resolvedBaseCanvasWidth when set (matches UI baseContainerW)', () => {
    const withResolved = computeSrcSquareSize(200, 300, 1, 300, 225);
    expect(withResolved).toBe(200);

    const withoutResolved = computeSrcSquareSize(200, 400, 1, 300, 225);
    expect(withoutResolved).toBe(150);

    expect(withResolved).not.toBe(withoutResolved);
  });

  it('resolvedBaseCanvasWidth < baseCanvasWidth → export matches UI', () => {
    const correct = computeSrcSquareSize(200, 250, 1, 250, 250);
    expect(correct).toBe(200);

    const wrong = computeSrcSquareSize(200, 400, 1, 250, 250);
    expect(wrong).toBe(125);
    expect(correct).not.toBe(wrong);
  });
});

// ---------------------------------------------------------------------------
// § 4. syncFocalFromOffset direction correctness
// ---------------------------------------------------------------------------

describe('imageCrop — §4 syncFocalFromOffset — drag direction correctness', () => {
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

  it('drag right (offsetX > 0) → focalX decreases', () => {
    const result = syncFocalFromOffset(makeState({ offsetX: 100 }), 400, 300);
    expect(result.focalX).toBeLessThan(0.5);
    expect(result.focalX).toBeCloseTo(0.25, 5);
  });

  it('drag left (offsetX < 0) → focalX increases', () => {
    const result = syncFocalFromOffset(makeState({ offsetX: -100 }), 400, 300);
    expect(result.focalX).toBeGreaterThan(0.5);
    expect(result.focalX).toBeCloseTo(0.75, 5);
  });

  it('drag down (offsetY > 0) → focalY decreases', () => {
    const result = syncFocalFromOffset(makeState({ offsetY: 60 }), 400, 300);
    expect(result.focalY).toBeLessThan(0.5);
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
    const scale1 = syncFocalFromOffset(makeState({ scale: 1, offsetX: 100 }), 400, 300);
    const scale2 = syncFocalFromOffset(makeState({ scale: 2, offsetX: 100 }), 400, 300);

    expect(scale1.focalX).toBeCloseTo(scale2.focalX, 5);
    expect(scale1.focalX).toBeCloseTo(0.25, 5);
  });

  it('different baseContainerW values give different focalX (same drag distance)', () => {
    const narrow = syncFocalFromOffset(makeState({ offsetX: 100 }), 200, 150);
    const wide = syncFocalFromOffset(makeState({ offsetX: 100 }), 400, 300);

    expect(narrow.focalX).not.toBe(wide.focalX);
    expect(narrow.focalX).toBeCloseTo(0.0, 5);
    expect(wide.focalX).toBeCloseTo(0.25, 5);
  });

  it('portrait image drag down uses baseContainerH (NOT 400 placeholder) — Bug-φ regression guard', () => {
    const portraitCorrect = syncFocalFromOffset(
      makeState({ naturalWidth: 2000, naturalHeight: 3000, offsetY: 100 }),
      400,
      600,
    );
    expect(portraitCorrect.focalY).toBeCloseTo(0.333, 3);

    const portraitBuggy = syncFocalFromOffset(
      makeState({ naturalWidth: 2000, naturalHeight: 3000, offsetY: 100 }),
      400,
      400,
    );
    expect(portraitBuggy.focalY).toBeCloseTo(0.25, 3);

    expect(portraitCorrect.focalY).not.toBeCloseTo(portraitBuggy.focalY, 2);

    const correctSrcY = portraitCorrect.focalY * 3000 - 500;
    const buggySrcY = portraitBuggy.focalY * 3000 - 500;
    expect(correctSrcY - buggySrcY).toBeCloseTo(250, 0);
  });

  it('landscape image drag down uses baseContainerH=267 (NOT 400 placeholder) — Bug-φ regression guard', () => {
    const landscapeCorrect = syncFocalFromOffset(
      makeState({ naturalWidth: 3000, naturalHeight: 2000, offsetY: 100 }),
      400,
      267,
    );
    expect(landscapeCorrect.focalY).toBeCloseTo(0.125, 3);

    const landscapeBuggy = syncFocalFromOffset(
      makeState({ naturalWidth: 3000, naturalHeight: 2000, offsetY: 100 }),
      400,
      400,
    );
    expect(landscapeBuggy.focalY).toBeCloseTo(0.25, 3);

    expect(landscapeCorrect.focalY).not.toBeCloseTo(landscapeBuggy.focalY, 2);

    const correctSrcY = landscapeCorrect.focalY * 2000 - 750;
    const buggySrcY = landscapeBuggy.focalY * 2000 - 750;
    expect(Math.abs(correctSrcY - buggySrcY)).toBeGreaterThan(200);
  });

  it('square image drag down is identical regardless of Bug-φ (no aspect change)', () => {
    const square = syncFocalFromOffset(
      makeState({ naturalWidth: 1000, naturalHeight: 1000, offsetY: 100 }),
      400,
      400,
    );
    expect(square.focalY).toBeCloseTo(0.25, 3);
  });
});

// ---------------------------------------------------------------------------
// § 5. applyScaleChange — explicit signature + clamps + idempotency
// ---------------------------------------------------------------------------

describe('imageCrop — §5 applyScaleChange (explicit signature, clamps, idempotency)', () => {
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

  it('clamps targetScale to minScale when target is below floor', () => {
    const result = applyScaleChange(makeState({ scale: 1 }), 0.1, 400, 300, 0.5, 3.0);
    expect(result.scale).toBe(0.5);
  });

  it('clamps targetScale to maxScale when target is above ceiling', () => {
    const result = applyScaleChange(makeState({ scale: 1 }), 5, 400, 300, 0.5, 3.0);
    expect(result.scale).toBe(3.0);
  });

  it('passes through targetScale when within range', () => {
    const result = applyScaleChange(makeState({ scale: 1 }), 2.5, 400, 300, 0.5, 3.0);
    expect(result.scale).toBe(2.5);
  });

  it('idempotent: returns same reference when clamped to current scale', () => {
    const state = makeState({ scale: 0.5 });
    const result = applyScaleChange(state, 0.1, 400, 300, 0.5, 3.0);
    // Same reference: callers can rely on React memo bailouts.
    expect(result).toBe(state);
  });

  it('idempotent: returns same reference when target equals current scale', () => {
    const state = makeState({ scale: 1.5 });
    const result = applyScaleChange(state, 1.5, 400, 300, 0.5, 3.0);
    expect(result).toBe(state);
  });

  it('re-derives focal from offset when scale changes (keeps export mask-aligned)', () => {
    // offsetX=80 → focalX before scale change = 0.5 - 80/400 = 0.3
    // After scale change, offset stays, focal must still be 0.3.
    const result = applyScaleChange(
      makeState({ offsetX: 80 }),
      2,
      400,
      300,
      0.5,
      3.0,
    );
    expect(result.scale).toBe(2);
    expect(result.focalX).toBeCloseTo(0.3, 5);
    expect(result.offsetX).toBe(80); // offset is preserved
  });

  it('integrates with syncFocalFromOffset — scale + drag then syncFocal matches manual computation', () => {
    // Drag then scale: focal derived from final offset via applyScaleChange.
    const stateAfterScale = applyScaleChange(
      makeState({ scale: 1, offsetX: 100 }),
      2,
      400,
      300,
      0.5,
      3.0,
    );
    // Expected focal: 0.5 - 100/400 = 0.25 (same regardless of scale)
    expect(stateAfterScale.focalX).toBeCloseTo(0.25, 5);
    expect(stateAfterScale.focalY).toBeCloseTo(0.5, 5);
  });
});

// ---------------------------------------------------------------------------
// § 6. validateLogoFile — pure validation against LOGO_CROP_CONFIG
// ---------------------------------------------------------------------------

describe('imageCrop — §6 validateLogoFile (platform-agnostic)', () => {
  it('PNG file within size limit → null (success)', () => {
    expect(
      validateLogoFile({ type: 'image/png', size: 1024 * 1024 }),
    ).toBeNull();
  });

  it('JPG file within size limit → null (success)', () => {
    expect(
      validateLogoFile({ type: 'image/jpeg', size: 2 * 1024 * 1024 }),
    ).toBeNull();
  });

  it('file larger than MAX_FILE_SIZE → tooLarge error', () => {
    const err = validateLogoFile({
      type: 'image/png',
      size: LOGO_CROP_CONFIG.MAX_FILE_SIZE + 1,
    });
    expect(err).toEqual({
      type: 'tooLarge',
      message: 'validation.tooLarge',
    });
  });

  it('wrong MIME type (e.g. application/pdf) → wrongFormat error', () => {
    const err = validateLogoFile({
      type: 'application/pdf',
      size: 1024,
    });
    expect(err).toEqual({
      type: 'wrongFormat',
      message: 'validation.wrongFormat',
    });
  });

  it('wrong MIME type (e.g. image/gif) → wrongFormat error', () => {
    const err = validateLogoFile({
      type: 'image/gif',
      size: 1024,
    });
    expect(err).toEqual({
      type: 'wrongFormat',
      message: 'validation.wrongFormat',
    });
  });

  it('MIME type is checked BEFORE size (wrong-format files are rejected even if tiny)', () => {
    const err = validateLogoFile({
      type: 'image/svg+xml',
      size: 100,
    });
    expect(err?.type).toBe('wrongFormat');
  });

  it('emits i18n-key messages, not literal strings (platform-agnostic contract)', () => {
    const tooLarge = validateLogoFile({ type: 'image/png', size: 999_999_999 });
    const wrongFormat = validateLogoFile({ type: 'text/plain', size: 100 });
    expect(tooLarge?.message).toBe('validation.tooLarge');
    expect(wrongFormat?.message).toBe('validation.wrongFormat');
    // No literal Chinese / English baked in — UI resolves via i18n key.
    expect(tooLarge?.message).not.toMatch(/[\u4e00-\u9fff]/);
    expect(wrongFormat?.message).not.toMatch(/[\u4e00-\u9fff]/);
  });
});
