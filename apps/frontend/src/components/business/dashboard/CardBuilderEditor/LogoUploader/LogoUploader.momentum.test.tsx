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
 * Strategy:
 *   - Mock requestAnimationFrame so we can deterministically advance the
 *     momentum loop without relying on real timers / jsdom timing. The
 *     global setup.ts installs a setTimeout-based fallback, but capturing
 *     the rAF callback directly lets each test step the loop manually.
 *   - Verify behavior at three checkpoints:
 *       1. handlePointerUp schedules a rAF when velocity > threshold.
 *       2. handlePointerUp does NOT schedule rAF when velocity is low.
 *       3. handlePointerDown cancels an in-flight rAF (no surprise momentum
 *          continuation across consecutive drags).
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup, createEvent } from '@testing-library/react';
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
  let rafCallbacks: FrameRequestCallback[];
  let originalRaf: typeof globalThis.requestAnimationFrame;
  let originalCancel: typeof globalThis.cancelAnimationFrame;

  beforeEach(() => {
    vi.clearAllMocks();
    rafCallbacks = [];

    // Capture every rAF call so tests can drive the momentum loop manually
    // without depending on jsdom timing or the global polyfill.
    originalRaf = globalThis.requestAnimationFrame;
    originalCancel = globalThis.cancelAnimationFrame;
    globalThis.requestAnimationFrame = ((cb: FrameRequestCallback): number => {
      rafCallbacks.push(cb);
      return rafCallbacks.length;
    }) as typeof globalThis.requestAnimationFrame;
    globalThis.cancelAnimationFrame = ((_id: number) => {
      // We keep callbacks in the array but mark them cancelled by clearing
      // the most recent one. Since momentum only ever has one active rAF,
      // "cancel" means drop the last queued callback.
      rafCallbacks.pop();
    }) as typeof globalThis.cancelAnimationFrame;
  });

  afterEach(() => {
    cleanup();
    globalThis.requestAnimationFrame = originalRaf;
    globalThis.cancelAnimationFrame = originalCancel;
  });

  /**
   * Drive the momentum loop one frame: invoke the last queued rAF callback
   * and clear it. This simulates one 16ms frame of momentum.
   */
  function tickOneFrame() {
    const cb = rafCallbacks.pop();
    if (!cb) return false;
    cb(performance.now());
    return true;
  }

  async function simulateDrag(
    stage: HTMLElement,
    events: Array<{ x: number; y: number; type: 'down' | 'move' | 'up'; delayMs?: number }>,
  ) {
    for (const ev of events) {
      if (ev.delayMs) {
        await new Promise((r) => setTimeout(r, ev.delayMs));
      }
      if (ev.type === 'down') {
        fireEvent.pointerDown(stage, { clientX: ev.x, clientY: ev.y, pointerId: 1 });
      } else if (ev.type === 'move') {
        // fireEvent.pointerMove / native PointerEvent in jsdom both fail to
        // populate clientX/clientY on React's synthetic event for pointermove.
        // Workaround: build a synthetic event with createEvent and define
        // clientX/clientY as own properties before dispatching.
        const moveEvent = createEvent.pointerMove(stage);
        Object.defineProperty(moveEvent, 'clientX', { value: ev.x, configurable: true });
        Object.defineProperty(moveEvent, 'clientY', { value: ev.y, configurable: true });
        Object.defineProperty(moveEvent, 'pointerId', { value: 1, configurable: true });
        fireEvent(stage, moveEvent);
      } else {
        fireEvent.pointerUp(stage, { clientX: ev.x, clientY: ev.y, pointerId: 1 });
      }
    }
  }

  it('pointer events fire React handlers (sanity check)', async () => {
    setViewport(1024);
    const setCropState = vi.fn();
    vi.mocked(useImageCrop).mockReturnValue(
      mockImageCropReturn({ setCropState }),
    );
    await enterCroppingState();
    const stage = screen.getByTestId('logo-crop-stage') as HTMLElement;

    // Just down + up with no moves. handlePointerUp should run and, since
    // there's no move history, hit the "no momentum" branch and call
    // setCropState (the focal sync).
    fireEvent.pointerDown(stage, { clientX: 200, clientY: 200, pointerId: 1 });
    fireEvent.pointerUp(stage, { clientX: 200, clientY: 200, pointerId: 1 });

    // setCropState should have been called at least once (focal sync at up).
    expect(setCropState).toHaveBeenCalled();
  });

  it('fast drag schedules momentum — rAF is queued on pointer up', async () => {
    setViewport(1024);
    const setCropState = vi.fn();
    vi.mocked(useImageCrop).mockReturnValue(
      mockImageCropReturn({ setCropState }),
    );
    await enterCroppingState();
    const stage = screen.getByTestId('logo-crop-stage') as HTMLElement;

    // Down at (200, 200). Five quick moves advancing 10px every 16ms.
    await simulateDrag(stage, [
      { type: 'down', x: 200, y: 200 },
      { type: 'move', x: 210, y: 200, delayMs: 16 },
      { type: 'move', x: 220, y: 200, delayMs: 16 },
      { type: 'move', x: 230, y: 200, delayMs: 16 },
      { type: 'move', x: 240, y: 200, delayMs: 16 },
      { type: 'move', x: 250, y: 200, delayMs: 16 },
      { type: 'up', x: 250, y: 200 },
    ]);

    // The momentum loop should have scheduled exactly one rAF (the initial
    // tick that starts the inertia animation).
    expect(rafCallbacks.length).toBe(1);

    // Drive one frame and check that offset keeps updating.
    const callsBefore = setCropState.mock.calls.length;
    tickOneFrame();
    expect(setCropState.mock.calls.length).toBeGreaterThan(callsBefore);

    // Drive more frames; each one should keep updating offset until velocity
    // drops below threshold. With v0 ≈ 0.6 px/ms and friction 0.92, we get
    // ~30 frames before threshold.
    let totalCalls = setCropState.mock.calls.length;
    for (let i = 0; i < 40; i++) {
      if (!tickOneFrame()) break;
      if (setCropState.mock.calls.length === totalCalls) break;
      totalCalls = setCropState.mock.calls.length;
    }
    expect(totalCalls).toBeGreaterThan(callsBefore);
  });

  it('slow drag does NOT schedule momentum — no rAF queued on pointer up', async () => {
    setViewport(1024);
    const setCropState = vi.fn();
    vi.mocked(useImageCrop).mockReturnValue(
      mockImageCropReturn({ setCropState }),
    );
    await enterCroppingState();
    const stage = screen.getByTestId('logo-crop-stage') as HTMLElement;

    // Very slow drag: 1px every 200ms → velocity ≈ 0.005 px/ms. Multiplied
    // by DRAG_SENSITIVITY 3.0 → 0.015, still BELOW the strict `>`
    // MOMENTUM_MIN_VELOCITY 0.015 threshold, so no rAF should fire.
    await simulateDrag(stage, [
      { type: 'down', x: 200, y: 200 },
      { type: 'move', x: 201, y: 200, delayMs: 200 },
      { type: 'move', x: 202, y: 200, delayMs: 200 },
      { type: 'up', x: 202, y: 200 },
    ]);

    // No rAF should have been scheduled — the final focal sync runs
    // immediately instead.
    expect(rafCallbacks.length).toBe(0);
  });

  it('new pointer down during momentum cancels it — no surprise continuation', async () => {
    setViewport(1024);
    const setCropState = vi.fn();
    vi.mocked(useImageCrop).mockReturnValue(
      mockImageCropReturn({ setCropState }),
    );
    await enterCroppingState();
    const stage = screen.getByTestId('logo-crop-stage') as HTMLElement;

    // Fast flick to start momentum.
    await simulateDrag(stage, [
      { type: 'down', x: 200, y: 200 },
      { type: 'move', x: 210, y: 200, delayMs: 16 },
      { type: 'move', x: 220, y: 200, delayMs: 16 },
      { type: 'move', x: 230, y: 200, delayMs: 16 },
      { type: 'move', x: 240, y: 200, delayMs: 16 },
      { type: 'move', x: 250, y: 200, delayMs: 16 },
      { type: 'up', x: 250, y: 200 },
    ]);

    expect(rafCallbacks.length).toBe(1);

    // User grabs again — pointer down should call cancelAnimationFrame and
    // also clear any pending history so the new drag starts clean.
    fireEvent.pointerDown(stage, { clientX: 250, clientY: 200, pointerId: 1 });

    // The queued rAF should be cancelled.
    expect(rafCallbacks.length).toBe(0);

    // Drive a frame to confirm nothing fires (i.e. the cancelled callback
    // was actually removed from our queue).
    const callsBefore = setCropState.mock.calls.length;
    tickOneFrame();
    expect(setCropState.mock.calls.length).toBe(callsBefore);
  });

  it('unmount cancels in-flight momentum — no setState after unmount warnings', async () => {
    setViewport(1024);
    const setCropState = vi.fn();
    vi.mocked(useImageCrop).mockReturnValue(
      mockImageCropReturn({ setCropState }),
    );
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

    // Start a fast drag + release to begin momentum.
    await simulateDrag(stage, [
      { type: 'down', x: 200, y: 200 },
      { type: 'move', x: 210, y: 200, delayMs: 16 },
      { type: 'move', x: 220, y: 200, delayMs: 16 },
      { type: 'move', x: 230, y: 200, delayMs: 16 },
      { type: 'move', x: 240, y: 200, delayMs: 16 },
      { type: 'up', x: 240, y: 200 },
    ]);

    expect(rafCallbacks.length).toBe(1);

    // Unmount. The useEffect cleanup should cancel the in-flight rAF.
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    rendered.unmount();

    // The cleanup cancels the rAF, so no callback should remain queued.
    expect(rafCallbacks.length).toBe(0);

    // Drive a frame to ensure the cancelled callback doesn't fire.
    const callsBefore = setCropState.mock.calls.length;
    tickOneFrame();
    expect(setCropState.mock.calls.length).toBe(callsBefore);
    expect(errorSpy).not.toHaveBeenCalledWith(
      expect.stringContaining("Can't perform a React state update"),
    );
    errorSpy.mockRestore();
  });
});