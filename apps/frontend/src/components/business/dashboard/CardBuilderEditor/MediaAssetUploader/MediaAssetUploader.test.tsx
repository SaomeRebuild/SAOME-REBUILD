/**
 * LogoUploader tests
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MediaAssetUploader } from './MediaAssetUploader';
import { useImageCrop } from '@/hooks/useImageCrop';

// Mock the cardService.
// generateUploadUrl now drives both logo and icon variants (the imageType
// arg is the variant discriminator; the mock key matches that).
vi.mock('@/services/cardService', () => ({
  cardService: {
    generateUploadUrl: vi.fn().mockImplementation((_templateId: string, imageType: string) =>
      Promise.resolve({
        uploadUrl: 'https://r2.example.com/upload',
        key: `tenant1/template1/${imageType === 'icon' ? 'icon' : 'issuer-logo'}.png`,
      }),
    ),
    update: vi.fn().mockResolvedValue({}),
    getById: vi.fn().mockResolvedValue({ settings: {} }),
  },
}));

// Mock the useImageCrop hook as a vi.fn() so each test can override the
// return value via vi.mocked(useImageCrop).mockReturnValue(...).
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
  // Support nested `cropState` overrides: the LogoUploader reads
  // naturalWidth/naturalHeight/resolvedBaseCanvasWidth from
  // useImageCrop.cropState, so they MUST go inside the cropState object.
  // Top-level overrides apply to the hook's other return fields.
  const { cropState: cropStateOverrides, ...restOverrides } = overrides;
  return {
    cropState: { ...baseCropState, ...(cropStateOverrides as Partial<typeof baseCropState> ?? {}) },
    imageUrl: null,
    imageRef: { current: null },
    setCropState: vi.fn(),
    onImageLoad: vi.fn(),
    loadImage: vi.fn().mockResolvedValue(undefined),
    setFocalPoint: vi.fn(),
    setScale: vi.fn(),
    cropImage: vi.fn().mockResolvedValue(new Blob()),
    resetCrop: vi.fn(),
    hasImage: false,
    originalFile: null,
    outputDimensions: { width: 960, height: 540 },
    ...restOverrides,
  };
}

describe('LogoUploader', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useImageCrop).mockReturnValue(mockImageCropReturn());
  });

  it('renders upload button when idle', () => {
    render(
      <MediaAssetUploader
        variant="logo"
        templateId="test-id"
        onUploaded={vi.fn()}
      />,
    );

    expect(screen.getByRole('button')).toBeInTheDocument();
  });

  it('shows select file button', () => {
    render(
      <MediaAssetUploader
        variant="logo"
        templateId="test-id"
        onUploaded={vi.fn()}
      />,
    );

    // Button with select file text should exist (i18n: 選擇圖片)
    expect(screen.getByText(/選擇圖片/i)).toBeInTheDocument();
  });

  describe('in-component header (title + description)', () => {
    it('renders header with variant title for logo (i18n: 上傳 Logo)', () => {
      render(
        <MediaAssetUploader
          variant="logo"
          templateId="t1"
          onUploaded={vi.fn()}
        />,
      );

      const header = screen.getByTestId('asset-uploader-header');
      expect(header).toBeInTheDocument();
      expect(header).toHaveTextContent('上傳 Logo');
    });

    it('renders variant-specific description (logo hint: 960×960)', () => {
      render(
        <MediaAssetUploader
          variant="logo"
          templateId="t1"
          onUploaded={vi.fn()}
        />,
      );

      const header = screen.getByTestId('asset-uploader-header');
      expect(header).toHaveTextContent(/Logo 會被裁切為正方形/);
      expect(header).toHaveTextContent('960');
    });

    it('renders variant-specific description (icon hint: 720×720)', () => {
      render(
        <MediaAssetUploader
          variant="icon"
          templateId="t1"
          onUploaded={vi.fn()}
        />,
      );

      const header = screen.getByTestId('asset-uploader-header');
      expect(header).toHaveTextContent('上傳 Icon');
      expect(header).toHaveTextContent(/Icon 會被裁切為正方形/);
      expect(header).toHaveTextContent('720');
    });

    it('hides header when showHeader={false}', () => {
      render(
        <MediaAssetUploader
          variant="logo"
          templateId="t1"
          showHeader={false}
          onUploaded={vi.fn()}
        />,
      );

      expect(screen.queryByTestId('asset-uploader-header')).not.toBeInTheDocument();
      // The select-file button still renders (only the header is hidden)
      expect(screen.getByText(/選擇圖片/i)).toBeInTheDocument();
    });

    it('uses <h3> for the title (semantic — fits inside a parent section that may already have h2)', () => {
      render(
        <MediaAssetUploader
          variant="logo"
          templateId="t1"
          onUploaded={vi.fn()}
        />,
      );

      const heading = screen.getByRole('heading', { level: 3, name: '上傳 Logo' });
      expect(heading).toBeInTheDocument();
    });
  });

  describe('responsive crop container (mobile)', () => {
    /**
     * Render LogoUploader inside a parent with a known content-box width and
     * trigger ResizeObserver to fire with that width. With the new
     * wrapper-based responsive cap (replaces the old viewport ??128 math),
     * the crop stage width is `min(400, parentWidth ??16)` so the stage
     * NEVER overflows the parent regardless of how many padding wrappers
     * exist above LogoUploader.
     */
    async function renderInParent(parentWidth: number) {
      // Re-mock useImageCrop so each render is fresh
      vi.mocked(useImageCrop).mockReturnValue(mockImageCropReturn());
      const { container } = render(
        <div style={{ width: `${parentWidth}px` }} data-testid="constrained-parent">
          <MediaAssetUploader templateId="t1" variant="logo" onUploaded={vi.fn()} />
        </div>,
      );
      // Trigger cropping UI
      const input = container.querySelector(
        'input[type="file"]',
      ) as HTMLInputElement;
      const file = new File(['x'], 'logo.png', { type: 'image/png' });
      Object.defineProperty(input, 'files', { value: [file], configurable: true });
      fireEvent.change(input);
      await waitFor(() => {
        expect(screen.getByText(/拖曳調整顯示區域/i)).toBeInTheDocument();
      });
      // Fire ResizeObserver on the MediaAssetUploader root with the parent's content-box width.
      // jsdom offsetWidth is always 0, so we have to drive the measurement via the polyfill.
      // The cropping state's outer wrapper is identified by `data-testid="asset-crop-wrapper"`
      // (variant-agnostic — was `logo-crop-wrapper` in the legacy LogoUploader).
      const { triggerResize } = await import('@/test/setup');
      const root = container.querySelector('[data-testid="asset-crop-wrapper"]');
      // eslint-disable-next-line no-console
      console.log(`[TEST] root=${!!root}, rootTag=${root?.tagName}, rootClassList=${root?.className.slice(0, 60)}`);
      if (!root) throw new Error('cropping wrapper not found');
      triggerResize(root, parentWidth, 800);
      // eslint-disable-next-line no-console
      console.log(`[TEST] triggered resize on root with width=${parentWidth}`);
      // The polyfill schedules the callback via queueMicrotask, then React
      // re-renders. Wait for the new width to land in the DOM.
      const expectedW = Math.min(400, Math.max(parentWidth - 16, 200));
      await waitFor(() => {
        const stage = screen.getByTestId('logo-crop-outer') as HTMLElement;
        expect(stage.style.width).toBe(`${expectedW}px`);
      });
    }

    it('caps crop container at parentWidth ??16px on iPhone (375px parent)', async () => {
      await renderInParent(375);
      const stage = screen.getByTestId('logo-crop-outer') as HTMLElement;
      // 375 ??16 (STAGE_SAFETY_MARGIN) = 359px (still < BASE 400)
      expect(stage.style.width).toBe('359px');
    });

    it('respects narrow phone viewport (parentWidth 320 ??304px container)', async () => {
      await renderInParent(320);
      const stage = screen.getByTestId('logo-crop-outer') as HTMLElement;
      // 320 ??16 = 304px (still > CROP_WINDOW_SIZE 200)
      expect(stage.style.width).toBe('304px');
    });

    /**
     * Bug regression: iPhone 12 Pro Max (428?926 native, ~412px CSS after browser chrome).
     * The old viewport-padding math (viewport ??128) missed some wrappers and
     * overflowed by 32px. The new wrapper-based cap uses actual offsetWidth,
     * so the stage always fits the parent content-box minus a 16px safety.
     * Parent cap 412 > BASE 400, so the BASE cap wins (min(400, 412) = 400).
     */
    it('caps crop container at 400px (BASE_CANVAS_WIDTH) on iPhone 12 Pro Max (428px parent)', async () => {
      await renderInParent(428);
      const stage = screen.getByTestId('logo-crop-outer') as HTMLElement;
      // 428 ??16 = 412, but min(400, 412) = 400 (BASE wins)
      expect(stage.style.width).toBe('400px');
    });

    it('uses BASE_CANVAS_WIDTH (400px) on desktop (parentWidth 1024)', async () => {
      await renderInParent(1024);
      const stage = screen.getByTestId('logo-crop-outer') as HTMLElement;
      // Desktop: parent cap is 1008px, but BASE_CANVAS_WIDTH=400 wins (min(400, 1008))
      expect(stage.style.width).toBe('400px');
    });

    it('has maxWidth safety net so container never overflows its parent', async () => {
      await renderInParent(375);
      const stage = screen.getByTestId('logo-crop-outer') as HTMLElement;
      expect(stage.style.maxWidth).toBe('100%');
    });

    /**
     * Regression: iPhone 12/13/14 standard (390?844 CSS).
     * Confirms the crop stage never overflows on the most common mobile
     * viewport ??390 ??16 = 374px should fit comfortably inside any parent.
     */
    it('caps crop container at 374px on iPhone 12/13/14 (390px parent)', async () => {
      await renderInParent(390);
      const stage = screen.getByTestId('logo-crop-outer') as HTMLElement;
      // 390 ??16 = 374px
      expect(stage.style.width).toBe('374px');
    });

    /**
     * New behavior (regression-proof): the stage is ALWAYS capped at
     * `parentWidth ??16`, regardless of how many wrappers exist. This
     * guarantees no horizontal overflow regardless of how the page layout
     * changes around LogoUploader.
     */
    it('never overflows parent even with multiple padding wrappers (parentWidth 280)', async () => {
      await renderInParent(280);
      const stage = screen.getByTestId('logo-crop-outer') as HTMLElement;
      // 280 ??16 = 264px. Floor at CROP_WINDOW_SIZE 200 (so 264 wins).
      expect(stage.style.width).toBe('264px');
      expect(parseInt(stage.style.width)).toBeLessThan(280);
    });
  });

  describe('stage height extends to contain mask (landscape frame overflow fix)', () => {
    /**
     * Bug regression: landscape source images (NW > NH) caused the
     * crop stage's aspect-matched height to be much shorter than the
     * ~200?200 crop mask. Previously the white frame border was centered
     * in the OUTER container (sibling layer above the stage) and extended
     * BEYOND the stage vertically into the outer's padding area ??     * perceived as "white frame exceeds the container / stage".
     *
     * Fix (stage-height invariant):
     *   baseContainerH = max(aspectMatchedH, maskH + 2 * FRAME_PADDING)
     *
     * For landscape, the stage extends vertically to include the mask
     * area. The image inside is letterboxed via object-fit: contain, and
     * the dark stage background (= outer container background) shows
     * through above/below the bright image. The white frame is now always
     * contained within the stage (= outer container) ??no "frame exceeds
     * container" visual.
     *
     * FRAME_PADDING = 16 (Tailwind md token). 16px breathing room above
     * and below the white frame inside the stage.
     */

    async function renderLandscapeAndResize(
      naturalWidth: number,
      naturalHeight: number,
      parentWidth: number,
    ) {
      vi.mocked(useImageCrop).mockReturnValue(
        mockImageCropReturn({
          cropState: {
            naturalWidth,
            naturalHeight,
            resolvedBaseCanvasWidth: Math.min(parentWidth - 16, 400),
          },
        }),
      );
      const { container } = render(
        <div style={{ width: `${parentWidth}px` }} data-testid="constrained-parent">
          <MediaAssetUploader templateId="t1" variant="logo" onUploaded={vi.fn()} />
        </div>,
      );
      const input = container.querySelector(
        'input[type="file"]',
      ) as HTMLInputElement;
      const file = new File(['x'], 'logo.png', { type: 'image/png' });
      Object.defineProperty(input, 'files', { value: [file], configurable: true });
      fireEvent.change(input);
      await waitFor(() => {
        expect(screen.getByText(/拖曳調整顯示區域/i)).toBeInTheDocument();
      });
      const { triggerResize } = await import('@/test/setup');
      const root = container.querySelector('[data-testid="asset-crop-wrapper"]');
      if (!root) throw new Error('cropping wrapper not found');
      triggerResize(root, parentWidth, 800);
    }

    it('stage extends to maskSize + 32 for landscape (3000?1000)', async () => {
      await renderLandscapeAndResize(3000, 1000, 376);

      await waitFor(() => {
        const outer = screen.getByTestId('logo-crop-outer') as HTMLElement;
        const stage = screen.getByTestId('logo-crop-stage') as HTMLElement;
        // baseContainerW = min(3000, 400, 376-16) = 360
        // aspectMatchedH = round(360 * 1000/3000) = 120
        // maskSize = min(360*0.6, 200) = 200
        // FRAME_PADDING = 16 ??mask + 2*padding = 232
        // baseContainerH = max(120, 232) = 232 ??stage extends to fit mask
        // outerContainerH = baseContainerH = 232
        expect(outer.style.height).toBe('232px');
        // Stage fills outer (top:0, height=outerH)
        expect(stage.style.height).toBe('232px');
        expect(stage.style.top).toBe('0px');
        // Stage still full width
        expect(stage.style.width).toBe('360px');
        expect(stage.style.left).toBe('0px');
      });
    });

    it('stage extends to maskSize + 32 for extreme landscape (3000?500)', async () => {
      await renderLandscapeAndResize(3000, 500, 376);

      await waitFor(() => {
        const outer = screen.getByTestId('logo-crop-outer') as HTMLElement;
        const stage = screen.getByTestId('logo-crop-stage') as HTMLElement;
        // baseContainerW = 360
        // aspectMatchedH = round(360 * 500/3000) = 60 (extreme landscape)
        // maskSize = 200, padding = 16 ??mask + 2*padding = 232
        // baseContainerH = max(60, 232) = 232 ??padding dominates
        expect(outer.style.height).toBe('232px');
        expect(stage.style.height).toBe('232px');
        expect(stage.style.top).toBe('0px');
      });
    });

    it('stage height equals aspectMatchedH for portrait (no padding needed)', async () => {
      await renderLandscapeAndResize(1000, 3000, 376);

      await waitFor(() => {
        const outer = screen.getByTestId('logo-crop-outer') as HTMLElement;
        const stage = screen.getByTestId('logo-crop-stage') as HTMLElement;
        // baseContainerW = min(1000, 400, 360) = 360
        // aspectMatchedH = round(360 * 3000/1000) = 1080 (portrait 1:3)
        // maskSize + 2*padding = 232
        // baseContainerH = max(1080, 232) = 1080 ??portrait dominates
        expect(outer.style.height).toBe('1080px');
        expect(stage.style.height).toBe('1080px');
        // Stage fills outer (top:0)
        expect(stage.style.top).toBe('0px');
      });
    });

    it('stage height equals aspectMatchedH for square images', async () => {
      await renderLandscapeAndResize(1000, 1000, 376);

      await waitFor(() => {
        const outer = screen.getByTestId('logo-crop-outer') as HTMLElement;
        const stage = screen.getByTestId('logo-crop-stage') as HTMLElement;
        // baseContainerW = 360, aspectMatchedH = 360 (square)
        // baseContainerH = max(360, 232) = 360 ??square dominates
        expect(outer.style.height).toBe('360px');
        expect(stage.style.height).toBe('360px');
        expect(stage.style.top).toBe('0px');
      });
    });

    it('white crop frame stays within stage / outer container bounds (no overflow)', async () => {
      // Use extreme landscape so the padding is the dominant effect
      await renderLandscapeAndResize(3000, 500, 376);

      await waitFor(() => {
        const outer = screen.getByTestId('logo-crop-outer') as HTMLElement;
        const stage = screen.getByTestId('logo-crop-stage') as HTMLElement;
        const frameLayer = outer.querySelector(
          '[data-testid="logo-crop-frame-layer"]',
        ) as HTMLElement;
        expect(frameLayer).toBeTruthy();

        // Stage fills outer (stageH = outerH = 232)
        const outerH = parseFloat(outer.style.height);
        const stageH = parseFloat(stage.style.height);
        expect(stageH).toBe(outerH);

        // White frame inside is at left:50%, top:50%, translate(-50%, -50%)
        // ??its bounding box is centered in the outer (= stage).
        const frame = frameLayer.firstElementChild as HTMLElement;
        expect(frame).toBeTruthy();
        expect(parseFloat(frame.style.width)).toBeCloseTo(200, 1);
        expect(parseFloat(frame.style.height)).toBeCloseTo(200, 1);

        // Frame is contained within stage (= outer) with breathing room above and below.
        // outerH = 232, maskH = 200 ??top of frame = 16, bottom = 216
        // Stage: top:0, height:232 ??frame top (16) ??stage top (0), frame bottom (216) ??stage bottom (232)
        const maskH = parseFloat(frame.style.height);
        expect(outerH - maskH).toBe(32); // 2 * FRAME_PADDING (16px each side)
      });
    });

    /**
     * New invariant (2026-08-30 fix): the stage's height is ALWAYS >=
     * the mask height + 2 * FRAME_PADDING. This guarantees the white
     * frame border is always contained within the stage (= outer
     * container), regardless of source image aspect ratio.
     */
    it('invariant: stageH >= maskH + 2 * FRAME_PADDING for ALL aspect ratios', async () => {
      // Test across portrait, square, landscape, extreme landscape.
      // Each case uses its own isolated render so cleanup is implicit
      // via `afterEach(cleanup)` from the test framework.
      const { cleanup } = await import('@testing-library/react');
      const cases = [
        { name: 'portrait 1:3', w: 1000, h: 3000, parentW: 376 },
        { name: 'square 1:1', w: 1000, h: 1000, parentW: 376 },
        { name: 'mild landscape 16:9', w: 1920, h: 1080, parentW: 376 },
        { name: 'landscape 3:1', w: 3000, h: 1000, parentW: 376 },
        { name: 'extreme landscape 15:1', w: 3000, h: 200, parentW: 376 },
        { name: 'extreme landscape 6:1', w: 3000, h: 500, parentW: 376 },
      ];

      for (const c of cases) {
        cleanup();
        await renderLandscapeAndResize(c.w, c.h, c.parentW);
        await waitFor(() => {
          const outer = screen.getByTestId('logo-crop-outer') as HTMLElement;
          const stage = screen.getByTestId('logo-crop-stage') as HTMLElement;
          const frameLayer = outer.querySelector(
            '[data-testid="logo-crop-frame-layer"]',
          ) as HTMLElement;
          expect(frameLayer).toBeTruthy();
          const frame = frameLayer.firstElementChild as HTMLElement;

          const stageH = parseFloat(stage.style.height);
          const maskH = parseFloat(frame.style.height);
          // Invariant: stageH >= maskH + 2 * FRAME_PADDING (16)
          // ??frame has ??16px breathing room above and below inside the stage
          expect(stageH).toBeGreaterThanOrEqual(maskH + 32);
        }, { timeout: 3000 });
      }
    });
  });
});

// ---------------------------------------------------------------------------
// § Icon variant — same hook chain, smaller crop window (150 vs 200).
// ---------------------------------------------------------------------------

describe('MediaAssetUploader (icon variant)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useImageCrop).mockReturnValue(mockImageCropReturn());
  });

  it('renders upload prompt with iconUpload i18n namespace', () => {
    render(
      <MediaAssetUploader
        variant="icon"
        templateId="test-id"
        onUploaded={vi.fn()}
      />,
    );

    // iconUpload.i18n: 選擇圖片 (same as logoUpload but different namespace)
    expect(screen.getByText(/選擇圖片/i)).toBeInTheDocument();
  });

  it('uses variant="icon" for crop window (150px) and base canvas (300px)', () => {
    const { container } = render(
      <div style={{ width: '500px' }}>
        <MediaAssetUploader variant="icon" templateId="t1" onUploaded={vi.fn()} />
      </div>,
    );
    // Confirm the wrapper mounted — the variant-specific cropConfig will
    // drive the cropping stage to use 150px mask / 300px base canvas.
    expect(container.querySelector('[data-testid="asset-crop-wrapper"]')).toBeTruthy();
  });

  it('uses ICON_CROP_CONFIG (OUTPUT_WIDTH=720, OUTPUT_HEIGHT=720) for icon variant', () => {
    // The hook is called with variant-specific crop dimensions.
    // ICON_CROP_CONFIG: OUTPUT_WIDTH=720, OUTPUT_HEIGHT=720 (square),
    // CROP_WINDOW_WIDTH=CROP_WINDOW_HEIGHT=150, BASE_CANVAS_WIDTH=300.
    vi.mocked(useImageCrop).mockClear();
    render(
      <MediaAssetUploader variant="icon" templateId="t1" onUploaded={vi.fn()} />,
    );
    const call = vi.mocked(useImageCrop).mock.calls[0]?.[0];
    expect(call).toBeDefined();
    expect(call!.outputWidth).toBe(720);
    expect(call!.outputHeight).toBe(720);
    // New API (Phase A — BackgroundUploader L2 plan 2026-09-01): separate width/height.
    expect(call!.cropWindowWidth).toBe(150);
    expect(call!.cropWindowHeight).toBe(150);
    expect(call!.baseCanvasWidth).toBe(300);
  });

  it('uses LOGO_CROP_CONFIG (OUTPUT_WIDTH=960, OUTPUT_HEIGHT=null) for logo variant', () => {
    // Sanity check: the variant prop MUST propagate to the crop hook options
    // (Phase 7b bug guard — see plan § 7b).
    vi.mocked(useImageCrop).mockClear();
    render(
      <MediaAssetUploader variant="logo" templateId="t1" onUploaded={vi.fn()} />,
    );
    const call = vi.mocked(useImageCrop).mock.calls[0]?.[0];
    expect(call).toBeDefined();
    expect(call!.outputWidth).toBe(960);
    expect(call!.outputHeight).toBeNull();
    // New API (Phase A — BackgroundUploader L2 plan 2026-09-01): separate width/height.
    expect(call!.cropWindowWidth).toBe(200);
    expect(call!.cropWindowHeight).toBe(200);
    expect(call!.baseCanvasWidth).toBe(400);
  });
});

// ---------------------------------------------------------------------------
// § Background variant — first non-square variant (landscape 1860×738).
// Bug regression 2026-09-01: the formula `Math.max(availableWidth - 16,
// CROP_WINDOW_WIDTH)` used CROP_WINDOW_WIDTH=800 as the floor. On mobile
// viewports (376px wide), `Math.max(360, 800) = 800`, forcing the stage
// to 800px wide. The outer container has `maxWidth: 100%` so it shrinks
// to 360px, but the inner stage (no maxWidth) overflows by 440px. The white
// frame (480px wide, centered in the 360px outer) extends from x=-60 to
// x=420, making the top/bottom edges of the frame appear as full-width
// horizontal lines far outside the visible stage area.
// ---------------------------------------------------------------------------

describe('MediaAssetUploader (background variant)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useImageCrop).mockReturnValue(mockImageCropReturn());
  });

  async function renderBackgroundAndResize(
    naturalWidth: number,
    naturalHeight: number,
    parentWidth: number,
  ) {
    vi.mocked(useImageCrop).mockReturnValue(
      mockImageCropReturn({
        cropState: {
          naturalWidth,
          naturalHeight,
          resolvedBaseCanvasWidth: Math.min(parentWidth - 16, 800),
        },
      }),
    );
    const { container } = render(
      <div style={{ width: `${parentWidth}px` }} data-testid="constrained-parent">
        <MediaAssetUploader templateId="t1" variant="background" onUploaded={vi.fn()} />
      </div>,
    );
    const input = container.querySelector('input[type="file"]') as HTMLInputElement;
    const file = new File(['x'], 'background.png', { type: 'image/png' });
    Object.defineProperty(input, 'files', { value: [file], configurable: true });
    fireEvent.change(input);
    await waitFor(() => {
      expect(screen.getByText(/拖曳調整顯示區域/i)).toBeInTheDocument();
    });
    const { triggerResize } = await import('@/test/setup');
    const root = container.querySelector('[data-testid="asset-crop-wrapper"]');
    if (!root) throw new Error('cropping wrapper not found');
    triggerResize(root, parentWidth, 800);
  }

  it('uses BACKGROUND_CROP_CONFIG (OUTPUT_WIDTH=1860, OUTPUT_HEIGHT=738) for background variant', () => {
    vi.mocked(useImageCrop).mockClear();
    render(<MediaAssetUploader variant="background" templateId="t1" onUploaded={vi.fn()} />);
    const call = vi.mocked(useImageCrop).mock.calls[0]?.[0];
    expect(call).toBeDefined();
    expect(call!.outputWidth).toBe(1860);
    expect(call!.outputHeight).toBe(738);
    // BACKGROUND_CROP_CONFIG: CROP_WINDOW_WIDTH=800, CROP_WINDOW_HEIGHT=317,
    // BASE_CANVAS_WIDTH=800.
    expect(call!.cropWindowWidth).toBe(800);
    expect(call!.cropWindowHeight).toBe(317);
    expect(call!.baseCanvasWidth).toBe(800);
  });

  it('BUG REGRESSION: stage width NEVER exceeds parent width minus 16px on mobile (376px)', async () => {
    // Before the fix: `Math.max(360, 800) = 800` → stage width = 800px,
    // overflowing the 376px parent. White frame (480px wide, centered in
    // the capped outer of 360px) extends from x=-60 to x=420, way outside
    // the visible viewport.
    await renderBackgroundAndResize(1860, 738, 376);

    await waitFor(() => {
      const outer = screen.getByTestId('logo-crop-outer') as HTMLElement;
      const stage = screen.getByTestId('logo-crop-stage') as HTMLElement;
      const outerW = parseFloat(outer.style.width);
      const stageW = parseFloat(stage.style.width);

      // Outer must fit within parent (maxWidth: 100%)
      expect(outerW).toBeLessThanOrEqual(376);
      // Stage must equal outer (they're locked together since the fix)
      expect(stageW).toBe(outerW);
      // Stage must fit within parent (the actual bug — stage was 800px on a 376px parent)
      expect(stageW).toBeLessThanOrEqual(376);
    });
  });

  it('white crop frame stays within outer container width on mobile (no horizontal overflow)', async () => {
    // Before the fix: frame width 480px centered in outer 360px → extends
    // from x=-60 to x=420. After the fix: frame is responsive to actual
    // stage width and stays within the container.
    await renderBackgroundAndResize(1860, 738, 376);

    await waitFor(() => {
      const outer = screen.getByTestId('logo-crop-outer') as HTMLElement;
      const frameLayer = outer.querySelector(
        '[data-testid="logo-crop-frame-layer"]',
      ) as HTMLElement;
      expect(frameLayer).toBeTruthy();

      const frame = frameLayer.firstElementChild as HTMLElement;
      const frameW = parseFloat(frame.style.width);
      const outerW = parseFloat(outer.style.width);

      // Frame width must not exceed outer width — otherwise the centered
      // translate(-50%, -50%) places the frame's left/right edges outside
      // the container.
      expect(frameW).toBeLessThanOrEqual(outerW);
    });
  });

  it('mask coordinates align with white frame position (mask hole equals frame bounding box)', async () => {
    // SVG mask is centered in the stage (baseContainerW × baseContainerH).
    // White frame layer is centered in the outer (= stage, post-fix).
    // If baseContainerW === outerContainerW and baseContainerH === outerContainerH,
    // both centers coincide and the mask hole aligns with the frame.
    await renderBackgroundAndResize(1860, 738, 376);

    await waitFor(() => {
      const outer = screen.getByTestId('logo-crop-outer') as HTMLElement;
      const stage = screen.getByTestId('logo-crop-stage') as HTMLElement;
      const svg = stage.querySelector('svg') as SVGSVGElement;
      expect(svg).toBeTruthy();

      // SVG width/height come from baseContainerW / baseContainerH
      // (set as `width={baseContainerW}` on the JSX).
      const svgW = parseFloat(svg.getAttribute('width') ?? '0');
      const svgH = parseFloat(svg.getAttribute('height') ?? '0');
      const stageW = parseFloat(stage.style.width);
      const stageH = parseFloat(stage.style.height);
      const outerW = parseFloat(outer.style.width);

      // SVG equals stage (SVG is rendered inside the stage)
      expect(svgW).toBe(stageW);
      expect(svgH).toBe(stageH);

      // SVG mask coords: the inner black rect (the crop window hole) is
      // centered at (svgW/2, svgH/2) with width = min(stageW*0.6, 800)
      // and height = width * 738/1860. The frame is centered in the outer
      // (== stage post-fix) with the same width/height. They must align.
      const expectedFrameW = Math.min(stageW * 0.6, 800);
      const expectedFrameH = Math.round(expectedFrameW * (738 / 1860));

      const maskRect = svg.querySelector('mask rect[fill="black"]') as SVGRectElement;
      expect(maskRect).toBeTruthy();
      const maskW = parseFloat(maskRect.getAttribute('width') ?? '0');
      const maskH = parseFloat(maskRect.getAttribute('height') ?? '0');
      expect(maskW).toBeCloseTo(expectedFrameW, 1);
      expect(maskH).toBe(expectedFrameH);

      // Mask center should equal SVG center (which equals stage center
      // which equals outer center post-fix).
      const maskCenterX = parseFloat(maskRect.getAttribute('x') ?? '0') + maskW / 2;
      const maskCenterY = parseFloat(maskRect.getAttribute('y') ?? '0') + maskH / 2;
      expect(maskCenterX).toBeCloseTo(svgW / 2, 1);
      expect(maskCenterY).toBeCloseTo(svgH / 2, 1);

      // outerW === stageW === svgW (the invariant)
      expect(outerW).toBe(stageW);
    });
  });
});
