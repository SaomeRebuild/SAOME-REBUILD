/**
 * Step8Save — v17 background cache-bust regression test.
 *
 * @module CardBuilderEditor/Step8Save/Step8Save.backgroundCacheBust.test
 * @description 2026-10-15 user-reported bug:
 *
 *   - 換背景圖 → R2 stamp-0.png 背景仍是舊的
 *   - 換 grid 格數 → R2 stamp-0.png 「只有格子變了」背景仍是舊的
 *   - Passcreator 模板 strip image 持續顯示「好幾版之前」的圖
 *
 * Root cause: `apps/backend/src/modules/pass-templates/routes/getTemplateImage.ts`
 * sets `Cache-Control: public, max-age=31536000, immutable` on the
 * public background proxy at `/api/pass-templates/:id/background`.
 * When the user re-uploads a background, R2 overwrites the same key
 * (`{tenantId}/{templateId}/background.png`) — so the URL stays
 * identical, the browser keeps serving the cached stale bytes, and
 * the composer paints the old background onto the new 0.png.
 *
 * The `CardBuilderEditorPreview.tsx` preview side already defeats
 * this with `?v=${backgroundImageVersion}`, but the composer-side
 * URL (`resolveBackgroundImageUrl` in `Step8Save.hooks.ts`) didn't
 * — leaving every publish downstream of a stale-cache PNG.
 *
 * v17 fix: `resolveBackgroundImageUrl` now appends `?v=${version}`
 * to the public URL, sourcing from `state.backgroundImageVersion`
 * (which `setBackgroundImage` bumps on every upload — see
 * `CardBuilderEditor.store.ts::setBackgroundImage`).
 *
 * Why a separate test file (vs. appending to Step8Save.composeZero.test):
 *   - Step8Save.composeZero.test covers the path / happy / failure matrix;
 *     this file targets a single wire-format invariant (the cache-bust
 *     query string and its source value).
 *   - Future regression: if someone strips the `?v=` from the URL
 *     (e.g. to "simplify" the URL pattern), this test fires the
 *     exact symptom that user reported 2026-10-15.
 *
 * Coverage:
 *   1. backgroundImageVersion=0 → URL has `?v=0`
 *   2. After `setBackgroundImage` bumps version → URL has the new version
 *   3. Consecutive re-uploads → URL changes (browser-cache invalidates)
 *   4. No backgroundImage (color-only path) → no `?v=` query (avoids
 *      `?v=0` on color-only stamps; matches the existing
 *      `resolveBackgroundImageUrl(null) === null` contract).
 *
 * Rule references:
 *   - Rule 000 § A.4 — service has hard contract on inputs.
 *   - Rule 030 — first run not trustworthy; we don't actually mount
 *     here so the loadSettled guard isn't relevant, but the version
 *     value IS the loadSettled-equivalent for the background image.
 *   - Rule 031 — long timer + async fetch; the composer fetches the
 *     public URL, and immutable cache makes this a stale-data trap
 *     exactly like a slow getById.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { composeStampCardImage } from '@/components/business/stampCard/StampCardImageComposer/composeStampCardImage';
import { uploadStampCardImage } from '@/components/business/stampCard/StampCardImageComposer/uploadStampCardImage';

import { Step8Save } from './index';
import { useCardBuilderStore } from '../CardBuilderEditor.store';

const composeSpy = vi.mocked(composeStampCardImage);
const uploadSpy = vi.mocked(uploadStampCardImage);

// ─── Spies ────────────────────────────────────────────────────────────────

const updateSpy = vi.fn();

// ─── Module mocks ─────────────────────────────────────────────────────────

vi.mock('@/services/cardService', () => ({
  cardService: {
    update: (...args: unknown[]) => updateSpy(...args),
  },
}));

vi.mock(
  '@/components/business/stampCard/StampCardImageComposer/composeStampCardImage',
  () => ({
    composeStampCardImage: vi.fn(),
  }),
);
vi.mock(
  '@/components/business/stampCard/StampCardImageComposer/uploadStampCardImage',
  () => ({
    uploadStampCardImage: vi.fn(),
    UploadStampCardImageError: class extends Error {
      constructor(message: string, public readonly status: number) {
        super(message);
        this.name = 'UploadStampCardImageError';
      }
    },
  }),
);

vi.mock('@/components/ui/feedback/Toast', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock('react-i18next', () => ({
  useTranslation: vi.fn(() => ({
    t: vi.fn((key: string) => key),
  })),
}));

// ─── Auth + router mocks (shared pattern with Step8Save.composeZero.test) ─

const mockAuthState: {
  user: { role: string } | null;
  tenant: unknown;
  accessToken: string | null;
} = {
  user: { role: 'tenant' },
  tenant: null,
  accessToken: 'mock-jwt-token',
};
vi.mock('@/hooks/useAuth', () => ({
  useAuth: () => ({ state: mockAuthState }),
}));

const navigateMock = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return {
    ...actual,
    useNavigate: () => navigateMock,
  };
});

// ─── Fixtures ─────────────────────────────────────────────────────────────

const STAMP_BLOB = new Blob([new Uint8Array([0x89, 0x50, 0x4e, 0x47])], {
  type: 'image/png',
});

function makeUploadResponse() {
  return {
    r2Key: 'tenants/t1/templates/test-template-id/stamp-0.png',
    byteHash: 'a'.repeat(64),
    byteLength: 4,
    uploadedAt: '2026-10-15T00:00:00.000Z',
  };
}

function renderWithRouter() {
  return render(
    <MemoryRouter>
      <Step8Save />
    </MemoryRouter>,
  );
}

/**
 * Set up a stamp_card draft with a `backgroundImage` key + a known
 * `backgroundImageVersion`. Mirrors the Step 3 uploader's effect: after
 * `MediaAssetUploader::handleApplyCrop` finishes, store has both fields
 * updated in lock-step (the uploader sets them via
 * `setBackgroundImage(key)` which bumps version to Date.now()).
 */
function setStoreStampCardDraftWithBackground(opts: {
  backgroundImageKey: string | null;
  backgroundImageVersion: number;
}): void {
  useCardBuilderStore.getState().reset();
  useCardBuilderStore.setState({
    cardId: 'test-template-id',
    cardName: 'My Test Card',
    logoText: 'My Logo',
    issuerName: 'Test Issuer',
    cardType: 'stamp_card',
    barcodeType: 'qr_code',
    locations: [],
    isPaid: false,
    backgroundImage: opts.backgroundImageKey ?? '',
    backgroundImageVersion: opts.backgroundImageVersion,
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  mockAuthState.user = { role: 'tenant' };
  mockAuthState.accessToken = 'mock-jwt-token';
  composeSpy.mockResolvedValue(STAMP_BLOB);
  uploadSpy.mockResolvedValue(makeUploadResponse());
  updateSpy.mockResolvedValue({} as never);
});

afterEach(() => {
  cleanup();
});

// ─── Tests ────────────────────────────────────────────────────────────────

describe('Step8Save — v17 background cache-bust (2026-10-15)', () => {
  /**
   * Test 1: with a known backgroundImageVersion, the composer mock
   * receives a StampCardImageInput whose `background.url` carries
   * `?v=<version>`. Pin the wire-format invariant that the composer
   * fetches a versioned URL (so the browser cache of the public proxy
   * can be invalidated when the user re-uploads).
   */
  it('composer receives StampCardImageInput with background URL carrying ?v=<backgroundImageVersion> (v17 cache-bust)', async () => {
    setStoreStampCardDraftWithBackground({
      backgroundImageKey: 'tenants/t1/templates/test-template-id/background.png',
      backgroundImageVersion: 1734567890123, // arbitrary ms timestamp
    });
    const user = userEvent.setup();
    renderWithRouter();

    await user.click(screen.getByTestId('step8-publish-button'));

    expect(composeSpy).toHaveBeenCalledTimes(1);
    const input = composeSpy.mock.calls[0]?.[0] as {
      background: { type: 'image'; url: string };
    };
    expect(input.background).toEqual({
      type: 'image',
      url: expect.stringContaining('?v=1734567890123'),
    });
    // Pin the FULL canonical URL so a future refactor that changes the
    // path or query-key trips this regression test.
    expect(input.background.url).toBe(
      `${''}/api/pass-templates/test-template-id/background?v=1734567890123`,
    );
  });

  /**
   * Test 2 — the actual root-cause regression: a fresh `backgroundImage`
   * upload bumps `backgroundImageVersion`, so the URL emitted to the
   * composer differs from the previous publish. Without this, the
   * browser cache would serve stale bytes and the new background
   * would never appear in 0.png (the symptom user reported).
   */
  it('after setBackgroundImage bumps version, the composer URL carries the NEW version (cache invalidates)', async () => {
    // First publish: version = 1734567890000
    setStoreStampCardDraftWithBackground({
      backgroundImageKey: 'tenants/t1/templates/test-template-id/background.png',
      backgroundImageVersion: 1734567890000,
    });
    const user = userEvent.setup();
    const { unmount } = renderWithRouter();

    await user.click(screen.getByTestId('step8-publish-button'));

    const firstCallInput = composeSpy.mock.calls[0]?.[0] as {
      background: { type: 'image'; url: string };
    };
    expect(firstCallInput.background.url).toContain('?v=1734567890000');
    expect(firstCallInput.background.url).not.toContain('?v=1734567899999');
    unmount();

    // Second render simulates the user re-uploading the background
    // (step 1: clamp time so Date.now() differs from the first value).
    const before = Date.now();
    // We don't actually upload — we directly call setBackgroundImage,
    // which is the same setter MediaAssetUploader uses (and bumps
    // `backgroundImageVersion` to Date.now() under the hood).
    useCardBuilderStore.getState().setBackgroundImage(
      'tenants/t1/templates/test-template-id/background.png',
    );
    const after = Date.now();
    const newVersion = useCardBuilderStore.getState().backgroundImageVersion;
    // Pin: new version must be strictly greater than the first publish.
    expect(newVersion).toBeGreaterThan(1734567890000);
    expect(newVersion).toBeGreaterThanOrEqual(before);
    expect(newVersion).toBeLessThanOrEqual(after);

    // Reset spies so we only observe the SECOND compose call.
    vi.clearAllMocks();
    composeSpy.mockResolvedValue(STAMP_BLOB);
    uploadSpy.mockResolvedValue(makeUploadResponse());
    updateSpy.mockResolvedValue({} as never);

    const user2 = userEvent.setup();
    renderWithRouter();
    await user2.click(screen.getByTestId('step8-publish-button'));

    const secondCallInput = composeSpy.mock.calls[0]?.[0] as {
      background: { type: 'image'; url: string };
    };
    expect(secondCallInput.background.url).toContain(`?v=${newVersion}`);
    // CRITICAL: the URL must DIFFER from the first publish so the
    // browser cache hit cannot happen.
    expect(secondCallInput.background.url).not.toEqual(
      firstCallInput.background.url,
    );
  });

  /**
   * Test 3 — color-only path (no background image). The URL must NOT
   * be emitted at all (the background union switches to `type: 'color'`)
   * so we don't ship a `?v=0` placeholder. Mirrors the existing
   * `resolveBackgroundImageUrl(undefined) === null` contract.
   */
  it('color-only path (no backgroundImage) → no background URL, no ?v= query', async () => {
    setStoreStampCardDraftWithBackground({
      backgroundImageKey: null,
      backgroundImageVersion: 999,
    });
    const user = userEvent.setup();
    renderWithRouter();

    await user.click(screen.getByTestId('step8-publish-button'));

    expect(composeSpy).toHaveBeenCalledTimes(1);
    const input = composeSpy.mock.calls[0]?.[0] as {
      background: { type: 'color'; value: string };
    };
    expect(input.background.type).toBe('color');
  });

  /**
   * Test 4 — wire-format smoke: the URL does NOT leak the bearer token
   * (no `?token=`). The composer runs in the browser before publish,
   * so it has access to the accessToken via localStorage; but the
   * public proxy at `/api/pass-templates/:id/background` is
   * intentionally UNAUTHENTICATED (Passcreator consumes it). We
   * intentionally keep the URL token-free so future Scanner /
   * server-to-server clients can fetch the same URL.
   */
  it('background URL stays public (no bearer token in query string)', async () => {
    setStoreStampCardDraftWithBackground({
      backgroundImageKey: 'tenants/t1/templates/test-template-id/background.png',
      backgroundImageVersion: 1734567890123,
    });
    const user = userEvent.setup();
    renderWithRouter();

    await user.click(screen.getByTestId('step8-publish-button'));

    const input = composeSpy.mock.calls[0]?.[0] as {
      background: { type: 'image'; url: string };
    };
    expect(input.background.url).not.toMatch(/token=/i);
    expect(input.background.url).not.toMatch(/authorization/i);
  });
});
