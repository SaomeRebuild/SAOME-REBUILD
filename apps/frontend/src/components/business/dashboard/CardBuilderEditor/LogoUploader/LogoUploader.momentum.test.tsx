/**
 * Regression tests: LogoUploader drag pan momentum / inertia (mobile UX).
 *
 * Background (feedback 20260830):
 * - On phones, releasing the finger after a quick drag should "flick" the
 *   image onward (iOS / Android photo crop standard). Without this:
 *     - User drags 50px, releases → image stops immediately.
 *     - To reach the desired position, user must re-grab and drag again
 *       (often many times for a large image) → "一次只能移動一點，要滑好幾次".
 *
 * Event model (20260830 refactor):
 *   - Touch: onTouchStart / onTouchMove / onTouchEnd → handles momentum
 *   - Mouse / Pen: onPointerDown / onPointerMove / onPointerUp → NO momentum
 *
 * Strategy:
 *   - Mock requestAnimationFrame so we can deterministically advance the
 *     momentum loop without relying on real timers / jsdom timing.
 *   - Drive the momentum rAF loop manually via tickOneFrame().
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import { LogoUploader } from './LogoUploader';
import { useImageCrop } from '@/hooks/useImageCrop';

vi.mock('@/services/cardService', () => ({
  cardService: {
    generateLogoUploadUrl: vi.fn().mockResolvedValue({
      uploadUrl: 'https://r2.example.com/upload',
      key: 'k',
    }),
    update: vi.fn().mockResolvedValue({}),
    getById: vi.fn().mockResolvedValue({ settings: {} }),
  },
}));

vi.mock('@/hooks/useImageCrop', () => ({
  useImageCrop: vi.fn(),
}));

const baseCropState = {
  focalX: 0.5,
  focalY: 0.5,
  scale: 1.0,
  naturalWidth: 1920,
  naturalHeight: 1080,
  offsetX: 0,
  offsetY: 0,
  resolvedBaseCanvasWidth: 400,
};

function mockImageCropReturn(overrides: Record<string, unknown> = {}) {
  return {
    cropState: { ...baseCropState, ...(overrides.cropState ?? {}) },
    imageUrl: null,
    imageRef: { current: null },
    setCropState: vi.fn(),
    onImageLoad: vi.fn(),
    loadImage: vi.fn().mockResolvedValue(undefined),
    setFocalPoint: vi.fn(),
    setScale: vi.fn(),
    cropImage: vi.fn().mockResolvedValue(new Blob()),
    resetCrop: vi.fn(),
    hasImage: true,
    originalFile: null,
    outputDimensions: { width: 960, height: 540 },
    ...overrides,
  };
}

function setViewport(width: number) {
  Object.defineProperty(window, 'innerWidth', { value: width, configurable: true });
  window.dispatchEvent(new Event('resize'));
}

function polyfillPointerCapture() {
  if (typeof Element !== 'undefined' && !Element.prototype.setPointerCapture) {
    Element.prototype.setPointerCapture = function () {};
  }
  if (typeof Element !== 'undefined' && !Element.prototype.releasePointerCapture) {
    Element.prototype.releasePointerCapture = function () {};
  }
}

async function enterCroppingState() {
  polyfillPointerCapture();
  render(<LogoUploader templateId="t1" onLogoUploaded={vi.fn()} />);
  const input = document.querySelector('input[type="file"]') as HTMLInputElement;
  const file = new File(['x'], 'logo.png', { type: 'image/png' });
  Object.defineProperty(input, 'files', { value: [file], configurable: true });
  fireEvent.change(input);
  await waitFor(() => {
    expect(screen.getByText(/拖曳調整顯示區域/i)).toBeInTheDocument();
  });
}

describe('LogoUploader drag momentum (mobile UX)', () => {
  // rAF callback tracker — replaced by beforeEach so tests can drive the
  // momentum loop manually without depending on real time or jsdom timing quirks.
  let rafCallbacks: FrameRequestCallback[] = [];
  const originalRaf = globalThis.requestAnimationFrame;

  beforeEach(() => {
    vi.clearAllMocks();
    rafCallbacks = [];

    // Test stub: rAF stores the callback for manual driving; cAF drops the last one.
    // The DOM lib declares rAF as (handle: number) => void but browser runtime
    // is (callback) => number — our stub uses the runtime signature (no @ts-expect-error needed,
    // the variable type from `originalRaf` resolves the conflict).
    globalThis.requestAnimationFrame = (cb: FrameRequestCallback): number => {
      rafCallbacks.push(cb);
      return rafCallbacks.length;
    };
    globalThis.cancelAnimationFrame = (_id: number): void => {
      rafCallbacks.pop();
    };
  });

  afterEach(() => {
    cleanup();
    globalThis.requestAnimationFrame = originalRaf;
    globalThis.cancelAnimationFrame = (_id: number): void => {};
  });

  /** Drive the momentum loop one frame: pop the last queued rAF and invoke it. */
  function tickOneFrame() {
    const cb = rafCallbacks.pop();
    if (!cb) return false;
    cb(performance.now());
    return true;
  }

  /**
   * Simulate a touch drag sequence using onTouchStart / onTouchMove / onTouchEnd.
   *
   * TouchEvent requires touches[0] with clientX/clientY. fireEvent.touchStart
   * doesn't automatically populate touches; we build a synthetic Touch with
   * clientX/clientY and attach it.
   */
  async function simulateTouchDrag(
    stage: HTMLElement,
    events: Array<{ x: number; y: number; type: 'start' | 'move' | 'end'; delayMs?: number }>,
  ): Promise<void> {
    for (const ev of events) {
      if (ev.delayMs) {
        // Real-time delay so performance.now() advances enough to produce
        // a meaningful velocity for the momentum calculation. We can't use
        // fake timers here because waitFor() and the rest of the test
        // pipeline rely on real setTimeout / ResizeObserver behavior.
        await new Promise<void>((r) => setTimeout(r, ev.delayMs));
      }

      if (ev.type === 'start') {
        const touchObj = { clientX: ev.x, clientY: ev.y, identifier: 0 } as unknown as React.Touch;
        fireEvent.touchStart(stage, {
          touches: [touchObj],
          changedTouches: [touchObj],
        });
      } else if (ev.type === 'move') {
        const touchObj = { clientX: ev.x, clientY: ev.y, identifier: 0 } as unknown as React.Touch;
        fireEvent.touchMove(stage, {
          touches: [touchObj],
          changedTouches: [touchObj],
        });
      } else {
        const touchObj = { clientX: ev.x, clientY: ev.y, identifier: 0 } as unknown as React.Touch;
        fireEvent.touchEnd(stage, {
          touches: [],
          changedTouches: [touchObj],
        });
      }
    }
  }

  // =======================================================================
  // Touch / momentum tests
  // =======================================================================

  it('touch drag fires setCropState (sanity: touch handlers wired up)', async () => {
    setViewport(1024);
    const setCropState = vi.fn();
    vi.mocked(useImageCrop).mockReturnValue(mockImageCropReturn({ setCropState }));
    await enterCroppingState();
    const stage = screen.getByTestId('logo-crop-stage') as HTMLElement;

    // Touch start + immediate end with no moves.
    // handleTouchEnd will hit the "no momentum" branch and call setCropState
    // once (focal sync).
    await simulateTouchDrag(stage, [{ type: 'start', x: 200, y: 200 }, { type: 'end', x: 200, y: 200 }]);

    expect(setCropState).toHaveBeenCalled();
  });

  it('fast touch swipe schedules momentum rAF on touch end', async () => {
    setViewport(1024);
    const setCropState = vi.fn();
    vi.mocked(useImageCrop).mockReturnValue(mockImageCropReturn({ setCropState }));
    await enterCroppingState();
    const stage = screen.getByTestId('logo-crop-stage') as HTMLElement;

    // Fast swipe: 10px per 16ms → velocity ≈ 0.625 px/ms. × TOUCH_SENSITIVITY 3.0
    // → ≈ 1.875 px/ms, way above MOMENTUM_MIN_VELOCITY 0.012.
    await simulateTouchDrag(stage, [
      { type: 'start', x: 200, y: 200 },
      { type: 'move', x: 210, y: 200, delayMs: 16 },
      { type: 'move', x: 220, y: 200, delayMs: 16 },
      { type: 'move', x: 230, y: 200, delayMs: 16 },
      { type: 'move', x: 240, y: 200, delayMs: 16 },
      { type: 'move', x: 250, y: 200, delayMs: 16 },
      { type: 'end', x: 250, y: 200 },
    ]);

    // One rAF should be scheduled for the momentum loop start.
    expect(rafCallbacks.length).toBe(1);

    // Tick one frame — setCropState should be called (momentum tick syncs offset).
    const callsBefore = setCropState.mock.calls.length;
    tickOneFrame();
    expect(setCropState.mock.calls.length).toBeGreaterThan(callsBefore);
  });

  it('slow touch drag does NOT schedule momentum — no rAF queued', async () => {
    setViewport(1024);
    const setCropState = vi.fn();
    vi.mocked(useImageCrop).mockReturnValue(mockImageCropReturn({ setCropState }));
    await enterCroppingState();
    const stage = screen.getByTestId('logo-crop-stage') as HTMLElement;

    // Truly slow: 0.5px per 500ms → velocity ≈ 0.001 px/ms.
    // × TOUCH_SENSITIVITY 5.0 → 0.005 px/ms, right at MOMENTUM_MIN_VELOCITY 0.005.
    // Slightly below: 0.4px per 500ms → 0.0008 × 5.0 = 0.004 < 0.005. No rAF fires.
    await simulateTouchDrag(stage, [
      { type: 'start', x: 200, y: 200 },
      { type: 'move', x: 200.4, y: 200, delayMs: 500 },
      { type: 'move', x: 200.8, y: 200, delayMs: 500 },
      { type: 'end', x: 200.8, y: 200 },
    ]);

    expect(rafCallbacks.length).toBe(0);
    // Final focal sync should have run synchronously
    expect(setCropState).toHaveBeenCalled();
  });

  it('new touch start during momentum cancels it — no surprise continuation', async () => {
    setViewport(1024);
    const setCropState = vi.fn();
    vi.mocked(useImageCrop).mockReturnValue(mockImageCropReturn({ setCropState }));
    await enterCroppingState();
    const stage = screen.getByTestId('logo-crop-stage') as HTMLElement;

    // Fast swipe to start momentum.
    await simulateTouchDrag(stage, [
      { type: 'start', x: 200, y: 200 },
      { type: 'move', x: 210, y: 200, delayMs: 16 },
      { type: 'move', x: 220, y: 200, delayMs: 16 },
      { type: 'move', x: 230, y: 200, delayMs: 16 },
      { type: 'move', x: 240, y: 200, delayMs: 16 },
      { type: 'move', x: 250, y: 200, delayMs: 16 },
      { type: 'end', x: 250, y: 200 },
    ]);

    expect(rafCallbacks.length).toBe(1);

    // User grabs again — touch start should cancel the rAF.
    const touchObj = { clientX: 250, clientY: 200, identifier: 0 } as unknown as React.Touch;
    fireEvent.touchStart(stage, { touches: [touchObj], changedTouches: [touchObj] });

    expect(rafCallbacks.length).toBe(0);

    // Drive a frame — setCropState should NOT have been called by momentum.
    const callsBefore = setCropState.mock.calls.length;
    tickOneFrame();
    expect(setCropState.mock.calls.length).toBe(callsBefore);
  });

  it('unmount cancels in-flight momentum — no setState after unmount', async () => {
    setViewport(1024);
    const setCropState = vi.fn();
    vi.mocked(useImageCrop).mockReturnValue(mockImageCropReturn({ setCropState }));
    polyfillPointerCapture();
    const rendered = render(<LogoUploader templateId="t1" onLogoUploaded={vi.fn()} />);
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    const file = new File(['x'], 'logo.png', { type: 'image/png' });
    Object.defineProperty(input, 'files', { value: [file], configurable: true });
    fireEvent.change(input);
    await waitFor(() => {
      expect(screen.getByText(/拖曳調整顯示區域/i)).toBeInTheDocument();
    });
    const stage = screen.getByTestId('logo-crop-stage') as HTMLElement;

    // Start a fast swipe + release to begin momentum.
    await simulateTouchDrag(stage, [
      { type: 'start', x: 200, y: 200 },
      { type: 'move', x: 210, y: 200, delayMs: 16 },
      { type: 'move', x: 220, y: 200, delayMs: 16 },
      { type: 'move', x: 230, y: 200, delayMs: 16 },
      { type: 'move', x: 240, y: 200, delayMs: 16 },
      { type: 'end', x: 240, y: 200 },
    ]);

    expect(rafCallbacks.length).toBe(1);

    // Unmount — the useEffect cleanup cancels the rAF.
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    rendered.unmount();

    expect(rafCallbacks.length).toBe(0);

    // Drive a frame — the cancelled callback must not fire.
    const callsBefore = setCropState.mock.calls.length;
    tickOneFrame();
    expect(setCropState.mock.calls.length).toBe(callsBefore);
    expect(errorSpy).not.toHaveBeenCalledWith(
      expect.stringContaining("Can't perform a React state update"),
    );
    errorSpy.mockRestore();
  });

  // =======================================================================
  // Mouse / pen tests (NO momentum)
  // =======================================================================

  it('mouse drag calls setCropState but does NOT schedule rAF (no momentum)', async () => {
    setViewport(1024);
    const setCropState = vi.fn();
    vi.mocked(useImageCrop).mockReturnValue(mockImageCropReturn({ setCropState }));
    await enterCroppingState();
    const stage = screen.getByTestId('logo-crop-stage') as HTMLElement;

    // Simulate mouse drag using pointer events (pointerType = 'mouse').
    fireEvent.pointerDown(stage, { clientX: 200, clientY: 200, pointerId: 1, pointerType: 'mouse' });
    fireEvent.pointerMove(stage, { clientX: 250, clientY: 200, pointerId: 1, pointerType: 'mouse' });
    fireEvent.pointerUp(stage, { clientX: 250, clientY: 200, pointerId: 1, pointerType: 'mouse' });

    // Focal sync should have run (setCropState called).
    expect(setCropState).toHaveBeenCalled();
    // NO rAF for momentum on mouse.
    expect(rafCallbacks.length).toBe(0);
  });

  it('pen drag calls setCropState but does NOT schedule rAF (no momentum)', async () => {
    setViewport(1024);
    const setCropState = vi.fn();
    vi.mocked(useImageCrop).mockReturnValue(mockImageCropReturn({ setCropState }));
    await enterCroppingState();
    const stage = screen.getByTestId('logo-crop-stage') as HTMLElement;

    fireEvent.pointerDown(stage, { clientX: 200, clientY: 200, pointerId: 1, pointerType: 'pen' });
    fireEvent.pointerMove(stage, { clientX: 250, clientY: 200, pointerId: 1, pointerType: 'pen' });
    fireEvent.pointerUp(stage, { clientX: 250, clientY: 200, pointerId: 1, pointerType: 'pen' });

    expect(setCropState).toHaveBeenCalled();
    expect(rafCallbacks.length).toBe(0);
  });

  it('mouse pointerDown during touch momentum cancels it', async () => {
    setViewport(1024);
    const setCropState = vi.fn();
    vi.mocked(useImageCrop).mockReturnValue(mockImageCropReturn({ setCropState }));
    await enterCroppingState();
    const stage = screen.getByTestId('logo-crop-stage') as HTMLElement;

    // Start touch momentum.
    await simulateTouchDrag(stage, [
      { type: 'start', x: 200, y: 200 },
      { type: 'move', x: 210, y: 200, delayMs: 16 },
      { type: 'move', x: 220, y: 200, delayMs: 16 },
      { type: 'move', x: 230, y: 200, delayMs: 16 },
      { type: 'move', x: 240, y: 200, delayMs: 16 },
      { type: 'move', x: 250, y: 200, delayMs: 16 },
      { type: 'end', x: 250, y: 200 },
    ]);

    expect(rafCallbacks.length).toBe(1);

    // User switches to mouse — pointerDown should cancel momentum.
    fireEvent.pointerDown(stage, { clientX: 250, clientY: 200, pointerId: 2, pointerType: 'mouse' });

    expect(rafCallbacks.length).toBe(0);
  });
});
