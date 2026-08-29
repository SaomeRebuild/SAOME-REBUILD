/**
 * Test: When user drags, does the <img> element's transform actually change?
 *
 * This is the user's actual concern: "手機不能按著圖片拖著圖片到處跑".
 * The momentum tests only verify handlePointerUp logic. This test verifies
 * that during handlePointerMove, the image element's CSS transform is
 * updated — which is what the user SEES on screen.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, createEvent, cleanup } from '@testing-library/react';
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

function mockImageCropReturn(
  imgElement: { current: HTMLImageElement | null } | null,
  overrides: Record<string, unknown> = {},
) {
  const baseOnImageLoad = vi.fn((el: HTMLImageElement | null) => {
    if (imgElement) imgElement.current = el;
  });
  return {
    cropState: { ...baseCropState, ...(overrides.cropState ?? {}) },
    // Non-null imageUrl so the <img> actually renders inside the cropping stage
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

/**
 * Render LogoUploader and bring it into cropping state by simulating file
 * upload. Captures the <img> ref through the onImageLoad callback we wired
 * into the useImageCrop mock.
 */
async function setupCropping(imgElement: { current: HTMLImageElement | null }) {
  polyfillPointerCapture();
  vi.mocked(useImageCrop).mockReturnValue(mockImageCropReturn(imgElement));
  render(<LogoUploader templateId="t1" onLogoUploaded={vi.fn()} />);
  const input = document.querySelector('input[type="file"]') as HTMLInputElement;
  const file = new File(['x'], 'logo.png', { type: 'image/png' });
  Object.defineProperty(input, 'files', { value: [file], configurable: true });
  fireEvent.change(input);
  // Wait for the cropping state to render
  await waitFor(() => {
    expect(screen.getByText(/拖曳調整顯示區域/i)).toBeInTheDocument();
  });
  // Wait for the <img> to mount via the ref callback
  await waitFor(() => {
    expect(imgElement.current).not.toBeNull();
  }, { timeout: 2000 });
}

describe('LogoUploader drag actually moves the image', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('pointerdown + multiple pointermoves update the img.style.transform', async () => {
    setViewport(412);
    const imgElement: { current: HTMLImageElement | null } = { current: null };
    await setupCropping(imgElement);

    const stage = screen.getByTestId('logo-crop-stage') as HTMLElement;
    const img = imgElement.current!;

    console.log('[TEST-1] Initial img.style.transform:', JSON.stringify(img.style.transform));
    console.log('[TEST-1] Initial img.tagName:', img.tagName);
    console.log('[TEST-1] Initial img.classList:', img.className);

    // jsdom PointerEvent polyfill doesn't honor clientX from init dict. Use
    // createEvent + Object.defineProperty so the handler reads real numbers,
    // not undefined (which would NaN out the transform).
    const downEvent = createEvent.pointerDown(stage);
    Object.defineProperty(downEvent, 'clientX', { value: 200, configurable: true });
    Object.defineProperty(downEvent, 'clientY', { value: 200, configurable: true });
    Object.defineProperty(downEvent, 'pointerId', { value: 1, configurable: true });
    fireEvent(stage, downEvent);
    console.log('[TEST-1] After pointerDown, img.style.transform:', JSON.stringify(img.style.transform));

    for (let i = 1; i <= 5; i++) {
      const x = 200 + i * 10;
      const y = 200 + i * 5;
      const moveEvent = createEvent.pointerMove(stage);
      Object.defineProperty(moveEvent, 'clientX', { value: x, configurable: true });
      Object.defineProperty(moveEvent, 'clientY', { value: y, configurable: true });
      Object.defineProperty(moveEvent, 'pointerId', { value: 1, configurable: true });
      fireEvent(stage, moveEvent);
      console.log(`[TEST-1] After move ${i} (clientX=${x}): img.style.transform =`, JSON.stringify(img.style.transform));
    }

    const transformStr = img.style.transform;
    console.log('[TEST-1] Final img.style.transform:', JSON.stringify(transformStr));

    // The transform should reflect the drag distance (DRAG_SENSITIVITY = 3.0).
    // 50 px drag * 3.0 sensitivity = 150 px translate.
    expect(transformStr).toContain('translate');
    const match = transformStr.match(/translate\(([-\d.]+)px/);
    expect(match).not.toBeNull();
    const dx = parseFloat(match![1]);
    console.log(`[TEST-1] Parsed dx = ${dx} (expected ~150 with sensitivity 3.0)`);
    expect(Math.abs(dx)).toBeGreaterThan(100);
    expect(Math.abs(dx)).toBeLessThan(300);

    const upEvent = createEvent.pointerUp(stage);
    Object.defineProperty(upEvent, 'clientX', { value: 250, configurable: true });
    Object.defineProperty(upEvent, 'clientY', { value: 225, configurable: true });
    Object.defineProperty(upEvent, 'pointerId', { value: 1, configurable: true });
    fireEvent(stage, upEvent);
    cleanup();
  });

  it('touch-typed pointer events (pointerType=touch) move the image', async () => {
    setViewport(412);
    const imgElement: { current: HTMLImageElement | null } = { current: null };
    await setupCropping(imgElement);

    const stage = screen.getByTestId('logo-crop-stage') as HTMLElement;
    const img = imgElement.current!;

    // Touch-typed pointer events (pointerType='touch') — what iOS Safari fires
    fireEvent.pointerDown(stage, {
      clientX: 100,
      clientY: 100,
      pointerId: 1,
      isPrimary: true,
      pointerType: 'touch',
    });

    const moveEvent = createEvent.pointerMove(stage);
    Object.defineProperty(moveEvent, 'clientX', { value: 150, configurable: true });
    Object.defineProperty(moveEvent, 'clientY', { value: 150, configurable: true });
    Object.defineProperty(moveEvent, 'pointerId', { value: 1, configurable: true });
    Object.defineProperty(moveEvent, 'pointerType', { value: 'touch', configurable: true });
    fireEvent(stage, moveEvent);

    console.log('[TEST-2] After touch-typed move, img.style.transform =', img.style.transform);
    expect(img.style.transform).toContain('translate');

    fireEvent.pointerUp(stage, { clientX: 150, clientY: 150, pointerId: 1, pointerType: 'touch' });
    cleanup();
  });

  it('drag persists across many frames (no React reconciliation overwriting the transform)', async () => {
    setViewport(412);
    const imgElement: { current: HTMLImageElement | null } = { current: null };
    await setupCropping(imgElement);

    const stage = screen.getByTestId('logo-crop-stage') as HTMLElement;
    const img = imgElement.current!;

    const downEvent = createEvent.pointerDown(stage);
    Object.defineProperty(downEvent, 'clientX', { value: 200, configurable: true });
    Object.defineProperty(downEvent, 'clientY', { value: 200, configurable: true });
    Object.defineProperty(downEvent, 'pointerId', { value: 1, configurable: true });
    fireEvent(stage, downEvent);

    // 20 small pointermoves (simulating a long drag)
    for (let i = 1; i <= 20; i++) {
      const moveEvent = createEvent.pointerMove(stage);
      Object.defineProperty(moveEvent, 'clientX', { value: 200 + i, configurable: true });
      Object.defineProperty(moveEvent, 'clientY', { value: 200 + i, configurable: true });
      Object.defineProperty(moveEvent, 'pointerId', { value: 1, configurable: true });
      fireEvent(stage, moveEvent);
    }

    // After 20 px of drag with sensitivity 3.0 = 60 px translate
    const finalTransform = img.style.transform;
    console.log('[TEST-3] After 20 moves, img.style.transform =', finalTransform);
    expect(finalTransform).toContain('translate');
    const match = finalTransform.match(/translate\(([-\d.]+)px/);
    expect(match).not.toBeNull();
    const dx = parseFloat(match![1]);
    expect(dx).toBeGreaterThan(40); // definitely moved (60 expected)

    const upEvent = createEvent.pointerUp(stage);
    Object.defineProperty(upEvent, 'clientX', { value: 220, configurable: true });
    Object.defineProperty(upEvent, 'clientY', { value: 220, configurable: true });
    Object.defineProperty(upEvent, 'pointerId', { value: 1, configurable: true });
    fireEvent(stage, upEvent);
    cleanup();
  });
});
