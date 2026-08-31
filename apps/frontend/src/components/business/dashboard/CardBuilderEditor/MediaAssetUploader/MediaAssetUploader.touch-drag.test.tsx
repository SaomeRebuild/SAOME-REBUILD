/**
 * Test: When user drags, does the <img> element's transform actually change?
 *
 * This verifies the user's concern: "?��?不能?��??��??��??��??��?�?.
 * The momentum tests verify the rAF logic. This test verifies that during
 * touch drag, the image element's CSS transform is updated ??what the user
 * SEES on screen.
 *
 * Event model (20260830 refactor):
 *   - Touch: onTouchStart / onTouchMove / onTouchEnd ??direct DOM transform writes
 *   - Mouse / Pen: onPointerDown / onPointerMove / onPointerUp ??1:1, no momentum
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, createEvent, cleanup } from '@testing-library/react';
import { MediaAssetUploader } from './MediaAssetUploader';
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

function mockImageCropReturn(
  imgElement: { current: HTMLImageElement | null } | null,
  overrides: Record<string, unknown> = {},
) {
  const baseOnImageLoad = vi.fn((el: HTMLImageElement | null) => {
    if (imgElement) imgElement.current = el;
  });
  // Spread overrides BEFORE the fixed fields so callers can override setCropState etc.
  return {
    cropState: { ...baseCropState, ...(overrides.cropState as object ?? {}) },
    imageUrl: 'data:image/png;base64,iVBORw0KGgo=',
    imageRef: imgElement ?? { current: null },
    setCropState: vi.fn(),
    onImageLoad: baseOnImageLoad,
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

async function setupCropping(imgElement: { current: HTMLImageElement | null }) {
  polyfillPointerCapture();
  vi.mocked(useImageCrop).mockReturnValue(mockImageCropReturn(imgElement));
  render(<MediaAssetUploader templateId="t1" variant="logo" onUploaded={vi.fn()} />);
  const input = document.querySelector('input[type="file"]') as HTMLInputElement;
  const file = new File(['x'], 'logo.png', { type: 'image/png' });
  Object.defineProperty(input, 'files', { value: [file], configurable: true });
  fireEvent.change(input);
  await waitFor(() => {
    expect(screen.getByText(/拖曳調整顯示區域/i)).toBeInTheDocument();
  });
  await waitFor(() => {
    expect(imgElement.current).not.toBeNull();
  }, { timeout: 2000 });
}

/**
 * Helper: simulate a touch drag using TouchEvent API (onTouchStart / onTouchMove / onTouchEnd).
 */
function touchDrag(
  stage: HTMLElement,
  steps: Array<{ x: number; y: number; type: 'start' | 'move' | 'end' }>,
) {
  for (const step of steps) {
    const touchObj = { clientX: step.x, clientY: step.y, identifier: 0 } as unknown as React.Touch;
    if (step.type === 'start') {
      fireEvent.touchStart(stage, { touches: [touchObj], changedTouches: [touchObj] });
    } else if (step.type === 'move') {
      fireEvent.touchMove(stage, { touches: [touchObj], changedTouches: [touchObj] });
    } else {
      fireEvent.touchEnd(stage, { touches: [], changedTouches: [touchObj] });
    }
  }
}

describe('LogoUploader drag actually moves the image', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // =======================================================================
  // Touch drag tests (via onTouchStart / onTouchMove / onTouchEnd)
  // =======================================================================

  it('touch drag updates img.style.transform with 3.0 sensitivity', async () => {
    setViewport(412);
    const imgElement: { current: HTMLImageElement | null } = { current: null };
    await setupCropping(imgElement);
    const stage = screen.getByTestId('logo-crop-stage') as HTMLElement;
    const img = imgElement.current!;

    // 50px screen drag ? TOUCH_SENSITIVITY 3.0 ??150px translate
    touchDrag(stage, [
      { type: 'start', x: 200, y: 200 },
      { type: 'move', x: 210, y: 200 },
      { type: 'move', x: 220, y: 200 },
      { type: 'move', x: 230, y: 200 },
      { type: 'move', x: 240, y: 200 },
      { type: 'move', x: 250, y: 200 },
    ]);

    const transformStr = img.style.transform;
    expect(transformStr).toContain('translate');
    const match = transformStr.match(/translate\(([-\d.]+)px/);
    expect(match).not.toBeNull();
    const dx = parseFloat(match![1]);
    // 50px ? 3.0 = 150px
    expect(dx).toBeGreaterThan(130);
    expect(dx).toBeLessThan(180);
    cleanup();
  });

  it('many touch moves stay smooth ??no React reconciliation lag', async () => {
    setViewport(412);
    const imgElement: { current: HTMLImageElement | null } = { current: null };
    await setupCropping(imgElement);
    const stage = screen.getByTestId('logo-crop-stage') as HTMLElement;
    const img = imgElement.current!;

    touchDrag(stage, [{ type: 'start', x: 200, y: 200 }]);
    for (let i = 1; i <= 20; i++) {
      touchDrag(stage, [{ type: 'move', x: 200 + i, y: 200 + i }]);
    }

    // 20px drag ? 3.0 = 60px translate
    const finalTransform = img.style.transform;
    expect(finalTransform).toContain('translate');
    const match = finalTransform.match(/translate\(([-\d.]+)px,\s*([-\d.]+)px\)/);
    expect(match).not.toBeNull();
    const dx = parseFloat(match![1]);
    const dy = parseFloat(match![2]);
    expect(dx).toBeGreaterThan(50);
    expect(dy).toBeGreaterThan(50);
    cleanup();
  });

  it('touch drag moves image then end syncs state', async () => {
    setViewport(412);
    const setCropState = vi.fn();
    const imgElement: { current: HTMLImageElement | null } = { current: null };
    vi.mocked(useImageCrop).mockReturnValue(mockImageCropReturn(imgElement, { setCropState }));
    await setupCropping(imgElement);
    const stage = screen.getByTestId('logo-crop-stage') as HTMLElement;
    const img = imgElement.current!;

    // Verify drag actually moves the image (the focal-sync coverage is in
    // the momentum.test.tsx suite ??here we focus on the visual transform).
    touchDrag(stage, [
      { type: 'start', x: 100, y: 100 },
      { type: 'move', x: 150, y: 100 },
      { type: 'move', x: 200, y: 100 },
      { type: 'end', x: 200, y: 100 },
    ]);

    const match = img.style.transform.match(/translate\(([-\d.]+)px,\s*([-\d.]+)px\)/);
    expect(match).not.toBeNull();
    const dx = parseFloat(match![1]);
    // 100px drag ? 3.0 = 300px translate
    expect(dx).toBeGreaterThan(250);
    cleanup();
  });

  // =======================================================================
  // Mouse / pen tests (via onPointerDown / onPointerMove / onPointerUp)
  // =======================================================================

  it('mouse drag applies 1.0 sensitivity (1:1 pixel mapping)', async () => {
    setViewport(1280);
    const imgElement: { current: HTMLImageElement | null } = { current: null };
    await setupCropping(imgElement);
    const stage = screen.getByTestId('logo-crop-stage') as HTMLElement;
    const img = imgElement.current!;

    // Use createEvent + Object.defineProperty so React's synthetic event sees
    // pointerType='mouse' on nativeEvent (fireEvent.pointerDown with init dict
    // does not propagate pointerType into React SyntheticEvent in jsdom).
    const downEvent = createEvent.pointerDown(stage);
    Object.defineProperty(downEvent, 'clientX', { value: 200, configurable: true });
    Object.defineProperty(downEvent, 'clientY', { value: 200, configurable: true });
    Object.defineProperty(downEvent, 'pointerId', { value: 1, configurable: true });
    Object.defineProperty(downEvent, 'pointerType', { value: 'mouse', configurable: true });
    fireEvent(stage, downEvent);

    const moveEvent = createEvent.pointerMove(stage);
    Object.defineProperty(moveEvent, 'clientX', { value: 250, configurable: true });
    Object.defineProperty(moveEvent, 'clientY', { value: 200, configurable: true });
    Object.defineProperty(moveEvent, 'pointerId', { value: 1, configurable: true });
    Object.defineProperty(moveEvent, 'pointerType', { value: 'mouse', configurable: true });
    fireEvent(stage, moveEvent);

    const dx = parseFloat((img.style.transform.match(/translate\(([-\d.]+)px/) ?? [, '0'])[1]);
    // 50px ? 1.0 = 50px
    expect(dx).toBeGreaterThan(45);
    expect(dx).toBeLessThan(55);
    cleanup();
  });

  it('mouse drag does NOT auto-slide after release', async () => {
    setViewport(1280);
    const imgElement: { current: HTMLImageElement | null } = { current: null };
    await setupCropping(imgElement);
    const stage = screen.getByTestId('logo-crop-stage') as HTMLElement;
    const img = imgElement.current!;

    const fireMouse = (x: number, y: number, type: 'down' | 'move' | 'up') => {
      const evt = createEvent[`pointer${type === 'down' ? 'Down' : type === 'move' ? 'Move' : 'Up'}`](stage);
      Object.defineProperty(evt, 'clientX', { value: x, configurable: true });
      Object.defineProperty(evt, 'clientY', { value: y, configurable: true });
      Object.defineProperty(evt, 'pointerId', { value: 1, configurable: true });
      Object.defineProperty(evt, 'pointerType', { value: 'mouse', configurable: true });
      fireEvent(stage, evt);
    };

    fireMouse(200, 200, 'down');
    fireMouse(210, 200, 'move');
    fireMouse(220, 200, 'move');
    fireMouse(230, 200, 'move');
    fireMouse(240, 200, 'move');
    fireMouse(250, 200, 'move');
    fireMouse(250, 200, 'up');

    const dxBeforeRelease = parseFloat((img.style.transform.match(/translate\(([-\d.]+)px/) ?? [, '0'])[1]);

    // Simulate time passing ??image should NOT drift after release
    await new Promise((r) => setTimeout(r, 600));

    const dxAfterRelease = parseFloat((img.style.transform.match(/translate\(([-\d.]+)px/) ?? [, '0'])[1]);
    // Position must not change after mouse release (no momentum)
    expect(Math.abs(dxAfterRelease - dxBeforeRelease)).toBeLessThan(2);
    cleanup();
  });

  it('pen drag applies 1.0 sensitivity (between mouse and touch ??pen is precise)', async () => {
    setViewport(1280);
    const imgElement: { current: HTMLImageElement | null } = { current: null };
    await setupCropping(imgElement);
    const stage = screen.getByTestId('logo-crop-stage') as HTMLElement;
    const img = imgElement.current!;

    const firePen = (x: number, y: number, type: 'down' | 'move' | 'up') => {
      const evt = createEvent[`pointer${type === 'down' ? 'Down' : type === 'move' ? 'Move' : 'Up'}`](stage);
      Object.defineProperty(evt, 'clientX', { value: x, configurable: true });
      Object.defineProperty(evt, 'clientY', { value: y, configurable: true });
      Object.defineProperty(evt, 'pointerId', { value: 1, configurable: true });
      Object.defineProperty(evt, 'pointerType', { value: 'pen', configurable: true });
      fireEvent(stage, evt);
    };

    firePen(200, 200, 'down');
    firePen(240, 200, 'move');
    firePen(240, 200, 'up');

    // 40px ? 1.0 (mouse baseline) = ~40px. Pen is treated as precise,
    // no extra sensitivity, no momentum.
    const dx = parseFloat((img.style.transform.match(/translate\(([-\d.]+)px/) ?? [, '0'])[1]);
    expect(dx).toBeGreaterThan(35);
    expect(dx).toBeLessThan(50);
    cleanup();
  });

  it('empty pointerType treated as mouse (safe default)', async () => {
    setViewport(1280);
    const imgElement: { current: HTMLImageElement | null } = { current: null };
    await setupCropping(imgElement);
    const stage = screen.getByTestId('logo-crop-stage') as HTMLElement;
    const img = imgElement.current!;

    const fireEmpty = (x: number, y: number, type: 'down' | 'move' | 'up') => {
      const evt = createEvent[`pointer${type === 'down' ? 'Down' : type === 'move' ? 'Move' : 'Up'}`](stage);
      Object.defineProperty(evt, 'clientX', { value: x, configurable: true });
      Object.defineProperty(evt, 'clientY', { value: y, configurable: true });
      Object.defineProperty(evt, 'pointerId', { value: 1, configurable: true });
      Object.defineProperty(evt, 'pointerType', { value: '', configurable: true });
      fireEvent(stage, evt);
    };

    fireEmpty(200, 200, 'down');
    fireEmpty(250, 200, 'move');
    fireEmpty(250, 200, 'up');

    const dx = parseFloat((img.style.transform.match(/translate\(([-\d.]+)px/) ?? [, '0'])[1]);
    // Empty ??mouse ??1.0 sensitivity ??50px
    expect(dx).toBeGreaterThan(45);
    expect(dx).toBeLessThan(55);
    cleanup();
  });
});
