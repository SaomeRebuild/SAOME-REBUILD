/**
 * composeStampCardImage.web.ts — web binding unit tests (Phase 2, 2026-10-13).
 *
 * Per the plan § 2.3, this file verifies the **canvas drawing pipeline** end to
 * end:
 *   - OffscreenCanvas + 2D context are exercised
 *   - The renderer reads `fillCount` and stamps the first `fillCount` cells
 *     with the stamped variant; the rest get the unstamped variant
 *   - The grid line color is the literal `rgba(0,0,0,0)` (transparent)
 *   - The output blob is a PNG (mime type `image/png`)
 *   - The composition reacts to `iconId` (unknown ids yield a clear error)
 *
 * jsdom does not implement `OffscreenCanvas` / `createImageBitmap` / `Image()`,
 * so we provide lightweight mocks. The mocks are intentionally minimal —
 * we only verify the **calls** (strokeStyle, drawImage) not the rendered pixels.
 *
 * The stamp icon manifest module is also mocked so the test does not depend
 * on real PNG assets being present in `assets/icons/stamps/`.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

// === Mock the manifest ===============================================
vi.mock('@/assets/icons/stamps/manifest', () => ({
  getStampIcon: vi.fn((id: string) => {
    if (id === 'unknown') return undefined;
    return {
      id,
      stampedUrl: `/mocked/stamps/stamped/${id}.png`,
      unstampedUrl: `/mocked/stamps/unstamped/${id}.png`,
    };
  }),
}));

// === Mocks: OffscreenCanvas + Image ==================================
type DrawSource = 'stamped' | 'unstamped' | 'background' | 'unknown';
interface DrawRecord {
  x: number;
  y: number;
  w: number;
  h: number;
  source: DrawSource;
}
interface StrokeRecord {
  x: number;
  y: number;
  w: number;
  h: number;
  style: string;
}

class FakeContext {
  fillStyleChanges: string[] = [];
  strokeStyleChanges: string[] = [];
  strokes: StrokeRecord[] = [];
  draws: DrawRecord[] = [];
  fillRect = vi.fn();
  strokeRect = vi.fn((x: number, y: number, w: number, h: number) => {
    this.strokes.push({
      x,
      y,
      w,
      h,
      style: this.strokeStyleChanges[this.strokeStyleChanges.length - 1] ?? '',
    });
  });
  drawImage = vi.fn(
    (
      img: { __source?: DrawSource },
      x: number,
      y: number,
      w: number,
      h: number,
    ) => {
      this.draws.push({
        x,
        y,
        w,
        h,
        source: img.__source ?? 'unknown',
      });
    },
  );
  // fillStyle / strokeStyle setters — pure property assignments, no getter trap.
  set fillStyle(v: string) {
    this.fillStyleChanges.push(v);
  }
  set strokeStyle(v: string) {
    this.strokeStyleChanges.push(v);
  }
}

class FakeImage {
  public __source: DrawSource = 'unknown';
  decode = () => Promise.resolve();
  set src(v: string) {
    if (v.includes('/stamped/')) this.__source = 'stamped';
    else if (v.includes('/unstamped/')) this.__source = 'unstamped';
    else if (v.includes('bg') || v.includes('mocked')) this.__source = 'background';
  }
  get src() {
    return '';
  }
}

let currentCtx: FakeContext;

beforeEach(() => {
  // Capture the latest FakeContext created by the binding for assertions.
  globalThis.OffscreenCanvas = class {
    width = 0;
    height = 0;
    ctx: FakeContext;
    constructor(w: number, h: number) {
      this.width = w;
      this.height = h;
      this.ctx = new FakeContext();
      currentCtx = this.ctx;
    }
    getContext() {
      return currentCtx;
    }
    convertToBlob(opts: { type: string }) {
      return Promise.resolve(new Blob([new Uint8Array(8)], { type: opts.type }));
    }
  } as unknown as typeof OffscreenCanvas;
  globalThis.Image = FakeImage as unknown as typeof Image;
  if (!globalThis.createImageBitmap) {
    globalThis.createImageBitmap = vi.fn(async () => ({} as ImageBitmap));
  }
});

// === Subject under test ==============================================
import { composeStampCardImageOnWeb } from './composeStampCardImage.web';
import type { StampCardImageInput } from '@saome/shared/schemas/stampCard';
import { STAMP_FILL_CAP, STAMP_GRID_LINE_COLOR } from '@saome/shared/constants/stampCard';

const baseInput: StampCardImageInput = {
  rows: 3,
  cols: 5,
  gridColor: 'transparent',
  iconId: 'bell',
  iconColor: '#FF0000',
  background: { type: 'color', value: '#FFFFFF' },
  fillCount: 0,
};

describe('composeStampCardImageOnWeb — fillCount contract', () => {
  it('fillCount=0 → 15 unstamped draws, 0 stamped draws (3×5 grid)', async () => {
    const blob = await composeStampCardImageOnWeb(baseInput);
    expect(blob.type).toBe('image/png');
    const cellDraws = currentCtx.draws.filter((d) => d.source !== 'background');
    expect(cellDraws).toHaveLength(15);
    expect(cellDraws.filter((d) => d.source === 'stamped')).toHaveLength(0);
    expect(cellDraws.filter((d) => d.source === 'unstamped')).toHaveLength(15);
  });

  it('fillCount=5 → first 5 cells stamped, last 10 cells unstamped (row-major order)', async () => {
    await composeStampCardImageOnWeb({ ...baseInput, fillCount: 5 });
    const cellDraws = currentCtx.draws.filter((d) => d.source !== 'background');
    expect(cellDraws.filter((d) => d.source === 'stamped')).toHaveLength(5);
    expect(cellDraws.filter((d) => d.source === 'unstamped')).toHaveLength(10);

    const stamped = cellDraws.filter((d) => d.source === 'stamped');
    expect(stamped[0].x).toBeLessThan(stamped[4].x); // cell 0 left of cell 4
    expect(stamped[0].y).toBe(stamped[4].y); // row 0 = same y
  });

  it('fillCount=STAMP_FILL_CAP (15) → all 15 cells stamped', async () => {
    await composeStampCardImageOnWeb({ ...baseInput, fillCount: STAMP_FILL_CAP });
    const cellDraws = currentCtx.draws.filter((d) => d.source !== 'background');
    expect(cellDraws.filter((d) => d.source === 'stamped')).toHaveLength(15);
    expect(cellDraws.filter((d) => d.source === 'unstamped')).toHaveLength(0);
  });

  it('fillCount=STAMP_FILL_CAP+1 → throws RangeError (defense-in-depth beyond schema)', async () => {
    const input = { ...baseInput, fillCount: STAMP_FILL_CAP + 1 };
    await expect(composeStampCardImageOnWeb(input)).rejects.toThrow(/out of range/);
  });
});

describe('composeStampCardImageOnWeb — background image', () => {
  it('falls back to solid white when background image fetch fails (expired R2 pre-signed URL)', async () => {
    // Mock fetch: R2 returns 403 (expired pre-signed URL), so
    // loadImageBitmap's `response.ok` check throws BEFORE createImageBitmap.
    const originalFetch = globalThis.fetch;
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 403,
    });

    const bgInput: StampCardImageInput = {
      rows: 3,
      cols: 5,
      gridColor: 'transparent',
      iconId: 'bell',
      iconColor: '#FF0000',
      background: { type: 'image', url: 'https://r2.expired-presigned-url/background.png' },
      fillCount: 0,
    };

    // Must NOT throw — should fall back to solid white.
    const blob = await composeStampCardImageOnWeb(bgInput);
    expect(blob).toBeInstanceOf(Blob);
    expect(blob.type).toBe('image/png');

    // Fallback path: fillRect called with white.
    expect(currentCtx.fillStyleChanges).toContain('#ffffff');
    expect(currentCtx.draws.some((d) => d.source === 'background')).toBe(false);

    globalThis.fetch = originalFetch;
  });

  it('falls back to solid white when createImageBitmap throws InvalidStateError (expired / corrupted URL)', async () => {
    // Mock fetch: 200 OK with a non-image blob (simulating R2 returning
    // an HTML error page or corrupted data for an expired pre-signed URL).
    // createImageBitmap then throws InvalidStateError — the exact error
    // the user reported on 2026-10-14.
    const originalFetch = globalThis.fetch;
    const originalCreateImageBitmap = globalThis.createImageBitmap;
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      blob: async () => new Blob(['<html>error</html>'], { type: 'text/html' }),
    });
    globalThis.createImageBitmap = vi
      .fn()
      .mockRejectedValue(new DOMException('The source image could not be decoded.', 'InvalidStateError'));

    const bgInput: StampCardImageInput = {
      rows: 3,
      cols: 5,
      gridColor: 'transparent',
      iconId: 'bell',
      iconColor: '#FF0000',
      background: { type: 'image', url: 'https://r2.expired-presigned-url/background.png' },
      fillCount: 0,
    };

    // Must NOT throw — should fall back to solid white.
    const blob = await composeStampCardImageOnWeb(bgInput);
    expect(blob).toBeInstanceOf(Blob);
    expect(blob.type).toBe('image/png');
    expect(currentCtx.fillStyleChanges).toContain('#ffffff');
    expect(currentCtx.draws.some((d) => d.source === 'background')).toBe(false);

    globalThis.fetch = originalFetch;
    globalThis.createImageBitmap = originalCreateImageBitmap;
  });

  it('uses the image when background URL loads successfully', async () => {
    // Mock fetch: returns valid image blob + createImageBitmap succeeds.
    const originalFetch = globalThis.fetch;
    const originalCreateImageBitmap = globalThis.createImageBitmap;
    const fakeBitmap = {} as ImageBitmap;
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      blob: async () => new Blob(['fake-png-data'], { type: 'image/png' }),
    });
    globalThis.createImageBitmap = vi.fn().mockResolvedValue(fakeBitmap);

    const bgInput: StampCardImageInput = {
      rows: 3,
      cols: 5,
      gridColor: 'transparent',
      iconId: 'bell',
      iconColor: '#FF0000',
      background: { type: 'image', url: 'https://r2.example.com/bg.png' },
      fillCount: 0,
    };

    await composeStampCardImageOnWeb(bgInput);
    // 2026-10-15 (v15) — canvas dimensions aligned to Passcreator strip
    // spec (1860×738). The background drawImage call fills the entire
    // canvas at (0, 0, canvas.width, canvas.height) — the smoking gun
    // is the (0, 0, 1860, 738) coordinate pattern, NOT the old 1024×640.
    const bgDraw = currentCtx.draws.find(
      (d) => d.x === 0 && d.y === 0 && d.w === 1860 && d.h === 738,
    );
    expect(bgDraw).toBeDefined();
    expect(currentCtx.fillStyleChanges).not.toContain('#ffffff');

    globalThis.fetch = originalFetch;
    globalThis.createImageBitmap = originalCreateImageBitmap;
  });
});

describe('composeStampCardImageOnWeb — design contract', () => {
  it('uses the literal transparent grid color (STAMP_GRID_LINE_COLOR)', async () => {
    await composeStampCardImageOnWeb(baseInput);
    expect(currentCtx.strokeStyleChanges).toContain(STAMP_GRID_LINE_COLOR);
    expect(currentCtx.strokeStyleChanges[0]).toBe('rgba(0,0,0,0)');
    for (const stroke of currentCtx.strokes) {
      expect(stroke.style).toBe('rgba(0,0,0,0)');
    }
  });

  it('throws a clear error when iconId is unknown', async () => {
    await expect(
      composeStampCardImageOnWeb({ ...baseInput, iconId: 'unknown' }),
    ).rejects.toThrow(/unknown stamp icon "unknown"/);
  });

  it('output is an image/png blob', async () => {
    const blob = await composeStampCardImageOnWeb(baseInput);
    expect(blob).toBeInstanceOf(Blob);
    expect(blob.type).toBe('image/png');
  });

  it('different iconIds route to different stamped/unstamped src URLs', async () => {
    // First call: capture the stamped URL when iconId="bell"
    let bellStampedSrc = '';
    globalThis.Image = class {
      public __source: DrawSource = 'unknown';
      decode = () => Promise.resolve();
      set src(v: string) {
        if (v.includes('/stamped/') && !bellStampedSrc) {
          bellStampedSrc = v;
          this.__source = 'stamped';
        } else if (v.includes('/unstamped/')) {
          this.__source = 'unstamped';
        }
      }
      get src() {
        return '';
      }
    } as unknown as typeof Image;

    await composeStampCardImageOnWeb({ ...baseInput, iconId: 'bell' });
    expect(bellStampedSrc).toContain('bell');

    // Second call: capture when iconId="sun"
    let sunStampedSrc = '';
    globalThis.Image = class {
      public __source: DrawSource = 'unknown';
      decode = () => Promise.resolve();
      set src(v: string) {
        if (v.includes('/stamped/') && !sunStampedSrc) {
          sunStampedSrc = v;
          this.__source = 'stamped';
        } else if (v.includes('/unstamped/')) {
          this.__source = 'unstamped';
        }
      }
      get src() {
        return '';
      }
    } as unknown as typeof Image;

    await composeStampCardImageOnWeb({ ...baseInput, iconId: 'sun' });
    expect(sunStampedSrc).toContain('sun');
    expect(sunStampedSrc).not.toBe(bellStampedSrc);
  });
});
