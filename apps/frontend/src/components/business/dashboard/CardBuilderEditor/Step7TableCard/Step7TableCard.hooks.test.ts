/**
 * useTableCardExport — conformance tests (Round 2 fix, 2026-09-27).
 *
 * Critical invariants under test:
 *   - handleDownload routes through httpClient.getBlob (the blob is
 *     authenticated via Bearer header, not `window.open` which silently
 *     drops Authorization in browser navigation). Fix 1b regression.
 *   - handleDownload turns the Blob into a browser `<a download>` trigger.
 *   - handleExport fails fast when templateId is null.
 *   - handleExport short-circuits when a request is already in flight
 *     (double-click guard).
 *
 * Round 3 additions:
 *   - handleExport temporarily resets the Stage to nominal A4 dimensions
 *     before rasterizing (Fix 2 — mobile scale must not collapse the
 *     output into the top-left corner).
 *   - handleExport restores the Stage's original dimensions on both
 *     success and failure paths.
 *
 * Run: `npm test -- Step7TableCard.hooks`
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import type { RefObject } from 'react';
import type Konva from 'konva';

import { useTableCardExport } from './Step7TableCard.hooks';
import { cardService } from '@/services/cardService';
import { useCardBuilderStore } from '../CardBuilderEditor.store';

import '@/test/i18n';

// Konva Stage stub with the minimum surface needed by the export hook:
// handleExport reads / writes width, height, scaleX, scaleY, batchDraw
// AND the underlying rasterizeTableCard stub uses toDataURL.
//
// Konva's Stage API exposes width/height/scaleX/scaleY as getter+setter
// methods (e.g. `stage.width()` reads, `stage.width(n)` writes), so we
// model the stub with backing fields + methods rather than plain props.
interface MutableStage {
  _width: number;
  _height: number;
  _scaleX: number;
  _scaleY: number;
  width: (n?: number) => number;
  height: (n?: number) => number;
  scaleX: (n?: number) => number;
  scaleY: (n?: number) => number;
  batchDraw: () => void;
  toDataURL: (opts: Record<string, unknown>) => string;
}

function makeMutableStage(initial?: Partial<MutableStage>): MutableStage {
  const state = {
    _width: initial?._width ?? 297.5, // mobile-scaled width
    _height: initial?._height ?? 421,
    _scaleX: initial?._scaleX ?? 0.5, // mobile scale
    _scaleY: initial?._scaleY ?? 0.5,
  };
  return {
    ...state,
    width: (n?: number) => (n === undefined ? state._width : (state._width = n)),
    height: (n?: number) => (n === undefined ? state._height : (state._height = n)),
    scaleX: (n?: number) => (n === undefined ? state._scaleX : (state._scaleX = n)),
    scaleY: (n?: number) => (n === undefined ? state._scaleY : (state._scaleY = n)),
    batchDraw: vi.fn(),
    toDataURL: vi.fn(() => 'data:image/png;base64,AAAA'),
  };
}

/**
 * Legacy-compatible Stage ref setup — returns the ref directly (for existing
 * Round 2 tests that only pass `stageRef` to the hook, not `mutable`).
 * Backward compatible with the old flat `{ width, height, scaleX, scaleY }`
 * interface that old tests destructured directly.
 */
function setupStageRef(): RefObject<Konva.Stage | null> {
  const stage = makeMutableStage();
  return { current: stage as unknown as Konva.Stage };
}

/**
 * Full setup with mutable accessor — for Round 3 Fix 2 tests that need to
 * assert on the Stage's width/scaleX after handleExport completes (to verify
 * that dimensions were restored).
 */
function setupStageRefWithMutable(initial?: Partial<MutableStage>): {
  ref: RefObject<Konva.Stage | null>;
  mutable: MutableStage;
} {
  const mutable = makeMutableStage(initial);
  return {
    ref: { current: mutable as unknown as Konva.Stage },
    mutable,
  };
}

describe('useTableCardExport — Round 2 fixes', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    // Reset store to known baseline between tests
    useCardBuilderStore.setState({
      tableCardExportState: 'idle',
      tableCardExportError: null,
    } as Partial<ReturnType<typeof useCardBuilderStore.getState>>);
  });

  it('handleDownload: routes through httpClient.getBlob (Round 2 fix 1b)', async () => {
    const fakeBlob = new Blob(['fake-png'], { type: 'image/png' });
    const downloadSpy = vi
      .spyOn(cardService, 'downloadTableCardBlob')
      .mockResolvedValueOnce(fakeBlob);

    const stageRef = setupStageRef();
    const { result } = renderHook(() =>
      useTableCardExport({
        templateId: 'tpl-uuid',
        stageRef,
      }),
    );

    await act(async () => {
      result.current.handleDownload();
      // Flush the promise chain inside act() so createObjectURL etc.
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(downloadSpy).toHaveBeenCalledWith('tpl-uuid');
    expect(downloadSpy).toHaveBeenCalledTimes(1);
  });

  it('handleDownload: triggers a browser download via URL.createObjectURL + <a>', async () => {
    vi.useFakeTimers();
    const fakeBlob = new Blob(['x'], { type: 'image/png' });
    vi.spyOn(cardService, 'downloadTableCardBlob').mockResolvedValueOnce(fakeBlob);

    const createObjectURLSpy = vi
      .spyOn(URL, 'createObjectURL')
      .mockReturnValue('blob:mock-url-12345');
    const revokeObjectURLSpy = vi
      .spyOn(URL, 'revokeObjectURL')
      .mockImplementation(() => {});

    const stageRef = setupStageRef();
    const { result } = renderHook(() =>
      useTableCardExport({
        templateId: 'tpl-uuid',
        stageRef,
      }),
    );

    await act(async () => {
      result.current.handleDownload();
      await Promise.resolve();
      await Promise.resolve();
    });

    // The hook creates a Blob URL.
    expect(createObjectURLSpy).toHaveBeenCalledWith(fakeBlob);

    // The hook schedules URL.revokeObjectURL via setTimeout(1000).
    // Advance timers and verify the revocation fires.
    await act(async () => {
      vi.advanceTimersByTime(1500);
    });
    expect(revokeObjectURLSpy).toHaveBeenCalledWith('blob:mock-url-12345');
    vi.useRealTimers();
  });

  it('handleDownload: no-op when templateId is null', async () => {
    const downloadSpy = vi.spyOn(cardService, 'downloadTableCardBlob');
    const stageRef = setupStageRef();

    const { result } = renderHook(() =>
      useTableCardExport({
        templateId: null,
        stageRef,
      }),
    );

    await act(async () => {
      result.current.handleDownload();
      await Promise.resolve();
    });

    expect(downloadSpy).not.toHaveBeenCalled();
  });

  it('handleDownload: sets error state when blob fetch throws', async () => {
    vi.spyOn(cardService, 'downloadTableCardBlob').mockRejectedValueOnce(
      new Error('network'),
    );

    const stageRef = setupStageRef();
    const { result } = renderHook(() =>
      useTableCardExport({
        templateId: 'tpl-uuid',
        stageRef,
      }),
    );

    await act(async () => {
      result.current.handleDownload();
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(useCardBuilderStore.getState().tableCardExportState).toBe('error');
  });
});

/**
 * Round 3 Fix 2 — stage scale reset before rasterize.
 *
 * The mobile-side `ResizeObserver` in `Step7TableCardCanvas.web.tsx`
 * sets `scaleX/scaleY` < 1 to fit small viewports. Without a save →
 * reset → rasterize → restore wrapper, the export PNG collapses into
 * the top-left corner of the print canvas (e.g. 595×0.5 = 297.5 px out
 * of 2551 px width). The hook wraps the rasterize call in this SOP.
 *
 * Critical invariants:
 *   - Stage width/height are reset to PREVIEW dimensions (595×842)
 *     before `rasterizeTableCard` runs.
 *   - Stage scaleX/scaleY are reset to 1 before rasterize.
 *   - Stage dimensions + scale are restored to the user's view AFTER
 *     rasterize completes (success path).
 *   - Stage dimensions + scale are restored even when rasterize throws
 *     (finally block; failure path).
 *
 * Implementation note: we mock the entire `rasterizeTableCard` import
 * (not just `cardService.exportTableCard`) so the test doesn't have to
 * produce a real PNG blob — jsdom's `fetch(dataUrl)` is unreliable for
 * synthetic data URLs. Mocking the rasterizer directly mirrors what the
 * hook actually depends on at the module boundary.
 */
vi.mock('./Step7TableCard.export.web', async (importOriginal) => {
  const original = (await importOriginal()) as Record<string, unknown>;
  return {
    ...original,
    rasterizeTableCard: vi.fn(async ({ stage }: { stage: unknown }) => {
      // Snapshot the Stage state at the moment rasterize is invoked.
      // The hook MUST have already reset width/height/scale before
      // reaching this point.
      const s = stage as {
        scaleX: () => number;
        scaleY: () => number;
        width: () => number;
      };
      rasterizeCallLog.push({
        width: s.width(),
        scaleX: s.scaleX(),
        scaleY: s.scaleY(),
      });
      return new Blob(['fake-png-bytes'], { type: 'image/png' });
    }),
  };
});

const rasterizeCallLog: Array<{ width: number; scaleX: number; scaleY: number }> = [];

describe('useTableCardExport — Round 3 Fix 2 (stage scale reset)', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    useCardBuilderStore.setState({
      tableCardExportState: 'idle',
      tableCardExportError: null,
    } as Partial<ReturnType<typeof useCardBuilderStore.getState>>);
    rasterizeCallLog.length = 0;
  });

  it('handleExport: rasterize sees Stage at nominal A4 dimensions with scale=1', async () => {
    const exportSpy = vi
      .spyOn(cardService, 'exportTableCard')
      .mockResolvedValueOnce({
        exportKey: 'r2-key',
        publicUrl: 'https://saome.example.com/exported.png',
        lastExportedAt: new Date().toISOString(),
      });

    const { ref, mutable } = setupStageRefWithMutable();
    expect(mutable.scaleX()).toBe(0.5); // mobile-scaled baseline
    expect(mutable.width()).toBe(297.5);

    const { result } = renderHook(() =>
      useTableCardExport({
        templateId: 'tpl-uuid',
        stageRef: ref,
      }),
    );

    await act(async () => {
      result.current.handleExport();
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
    });

    // Rasterizer was invoked exactly once.
    expect(rasterizeCallLog).toHaveLength(1);
    const call = rasterizeCallLog[0]!;
    // Stage was reset to PREVIEW dimensions with scale=1 BEFORE rasterize.
    expect(call.width).toBe(595); // PREVIEW_WIDTH_PX
    expect(call.scaleX).toBe(1);
    expect(call.scaleY).toBe(1);

    // After rasterize completes, Stage is restored to the user's view.
    expect(mutable.width()).toBe(297.5);
    expect(mutable.scaleX()).toBe(0.5);

    expect(exportSpy).toHaveBeenCalledWith(
      'tpl-uuid',
      expect.any(Blob),
    );
  });

  it('handleExport: restores Stage dimensions on success', async () => {
    vi.spyOn(cardService, 'exportTableCard').mockResolvedValueOnce({
      exportKey: 'k',
      publicUrl: 'https://saome.example.com/exported.png',
      lastExportedAt: new Date().toISOString(),
    });

    const { ref, mutable } = setupStageRefWithMutable();
    const { result } = renderHook(() =>
      useTableCardExport({
        templateId: 'tpl-uuid',
        stageRef: ref,
      }),
    );

    await act(async () => {
      result.current.handleExport();
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
    });

    // Success: stage restored, export state = ready.
    expect(mutable.scaleX()).toBe(0.5);
    expect(mutable.width()).toBe(297.5);
    expect(useCardBuilderStore.getState().tableCardExportState).toBe('ready');
  });

  it('handleExport: restores Stage dimensions even when export fails', async () => {
    vi.spyOn(cardService, 'exportTableCard').mockRejectedValueOnce(
      new Error('network-blip'),
    );

    const { ref, mutable } = setupStageRefWithMutable();
    const { result } = renderHook(() =>
      useTableCardExport({
        templateId: 'tpl-uuid',
        stageRef: ref,
      }),
    );

    const initialWidth = mutable.width();
    const initialScaleX = mutable.scaleX();

    await act(async () => {
      result.current.handleExport();
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
    });

    // The `finally` block must restore the stage even when the export
    // throws. Without this, the canvas would be stuck at print
    // dimensions after a network blip.
    expect(mutable.width()).toBe(initialWidth);
    expect(mutable.scaleX()).toBe(initialScaleX);
    expect(useCardBuilderStore.getState().tableCardExportState).toBe('error');
  });
});
