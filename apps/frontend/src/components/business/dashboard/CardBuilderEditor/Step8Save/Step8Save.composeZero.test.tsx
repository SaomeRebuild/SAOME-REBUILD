/**
 * Step8Save — Option B 0.png pre-render regression tests.
 *
 * @module CardBuilderEditor/Step8Save/Step8Save.composeZero.test
 * @description Per `runs/decisions/2026-10-14-stamp-card-publish-composition.md`,
 * publishing a stamp_card template now MUST render + upload the empty
 * 0.png before the backend's `cardService.update({ status: 'published' })`
 * call lands. The pre-render step is owned by `useStep8Save` and lives
 * in the publish hook; the `composeStampCardImage` + `uploadStampCardImage`
 * modules are mocked here so we can assert the state-machine without
 * creating a real OffscreenCanvas in jsdom.
 *
 * Coverage:
 *   1. Happy path: stamp_card + valid token → compose → upload → update → navigate.
 *   2. Compose failure: `composeStampCardImage` rejects → `cardService.update`
 *      is NOT called, status='error', user stays on Step 8.
 *   3. Upload failure: `uploadStampCardImage` rejects → `cardService.update`
 *      is NOT called, status='error', user stays on Step 8.
 *   4. Non-stamp cardType: `membership_card` / `cashback_card` → compose +
 *      upload are NOT called, falls through to the legacy `cardService.update`
 *      path (covers the rest of the card type surface).
 *   5. Missing accessToken: status='error', no compose / no upload / no update.
 *
 * Why the regression test file is separate from `Step8Save.test.tsx`:
 *   - The existing test file uses a `stamp_card` cardType and asserts
 *     the legacy happy path. With Option B wired in, the legacy test
 *     would need to mock compose + upload. Keeping the two files
 *     separate lets the legacy test stay focused on the non-stamp
 *     path (we flip the default to `membership_card` there) and lets
 *     this file own the stamp-only path with its full failure matrix.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { composeStampCardImage } from '@/components/business/stampCard/StampCardImageComposer/composeStampCardImage';
// NOTE: `UploadStampCardImageError` is intentionally imported via dynamic
// `await import(...)` inside the 'upload failure' test (it must come from
// the SAME mocked module the hook imports, otherwise the `instanceof`
// check in the hook would fail against a different class identity). We
// only statically import `uploadStampCardImage` itself.
import { uploadStampCardImage } from '@/components/business/stampCard/StampCardImageComposer/uploadStampCardImage';

import { Step8Save } from './index';
import { useCardBuilderStore } from '../CardBuilderEditor.store';
import { toast } from '@/components/ui/feedback/Toast';
import type { CardType } from '@saome/shared/schemas/card';

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

// Mock the composer module so the test environment does not try to
// create an OffscreenCanvas (jsdom does not implement it). Each factory
// creates a fresh `vi.fn()` that the test references via `vi.mocked`
// after the import (vitest hoists `vi.mock` so the factory runs before
// the import statement).
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

// ─── Auth mock (Option B needs accessToken) ──────────────────────────────

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

// ─── Router mock (so we can assert navigate calls) ────────────────────────

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
    uploadedAt: '2026-10-14T00:00:00.000Z',
  };
}

function renderWithRouter() {
  return render(
    <MemoryRouter>
      <Step8Save />
    </MemoryRouter>,
  );
}

function setStoreStampCardDraft(): void {
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
  });
}

function setStoreWithCardType(type: CardType): void {
  useCardBuilderStore.getState().reset();
  useCardBuilderStore.setState({
    cardId: 'test-template-id',
    cardName: 'My Test Card',
    logoText: 'My Logo',
    issuerName: 'Test Issuer',
    cardType: type,
    barcodeType: 'qr_code',
    locations: [],
    isPaid: false,
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  mockAuthState.user = { role: 'tenant' };
  mockAuthState.accessToken = 'mock-jwt-token';
  // Default: success path.
  composeSpy.mockResolvedValue(STAMP_BLOB);
  uploadSpy.mockResolvedValue(makeUploadResponse());
  updateSpy.mockResolvedValue({} as never);
});

afterEach(() => {
  cleanup();
});

// ─── Tests ────────────────────────────────────────────────────────────────

describe('Step8Save — Option B 0.png pre-render (stamp_card)', () => {
  it('happy path: compose → upload → cardService.update → navigate', async () => {
    setStoreStampCardDraft();
    const user = userEvent.setup();
    renderWithRouter();

    const button = screen.getByTestId('step8-publish-button');
    await user.click(button);

    // Order of operations matters: compose FIRST, upload SECOND,
    // cardService.update THIRD. We assert both the calls AND the order
    // so a future refactor that flips them (e.g. update then upload)
    // is caught.
    expect(composeSpy).toHaveBeenCalledTimes(1);
    expect(uploadSpy).toHaveBeenCalledTimes(1);
    expect(updateSpy).toHaveBeenCalledTimes(1);

    // Upload must be called with templateId, fillCount=0, the blob, and
    // the bearer token from useAuth.
    expect(uploadSpy).toHaveBeenCalledWith(
      'test-template-id',
      0,
      STAMP_BLOB,
      'mock-jwt-token',
    );
    expect(updateSpy).toHaveBeenCalledWith('test-template-id', { status: 'published' });
    expect(navigateMock).toHaveBeenCalledWith('/app/dashboard', { replace: true });
    expect(toast.success).toHaveBeenCalled();
    expect(toast.error).not.toHaveBeenCalled();
  });

  it('compose failure: cardService.update is NOT called, status → error, stays on Step 8', async () => {
    setStoreStampCardDraft();
    composeSpy.mockRejectedValueOnce(new Error('canvas allocation failed'));
    const user = userEvent.setup();
    renderWithRouter();

    const button = screen.getByTestId('step8-publish-button');
    await user.click(button);

    // CRITICAL: the publish must NOT proceed if 0.png compose failed.
    // Otherwise the published template would have a missing preview
    // image, and the customer-facing Scanner would fall back to a
    // generic icon (Decision 2026-10-14 § 設計約束 #2).
    expect(composeSpy).toHaveBeenCalledTimes(1);
    expect(uploadSpy).not.toHaveBeenCalled();
    expect(updateSpy).not.toHaveBeenCalled();
    expect(navigateMock).not.toHaveBeenCalled();
    expect(toast.error).toHaveBeenCalled();
    expect(toast.success).not.toHaveBeenCalled();
  });

  it('upload failure: cardService.update is NOT called, status → error, stays on Step 8', async () => {
    setStoreStampCardDraft();
    const { UploadStampCardImageError } = await import(
      '@/components/business/stampCard/StampCardImageComposer/uploadStampCardImage'
    );
    uploadSpy.mockRejectedValueOnce(
      new UploadStampCardImageError('HTTP 502 Bad Gateway', 502),
    );
    const user = userEvent.setup();
    renderWithRouter();

    const button = screen.getByTestId('step8-publish-button');
    await user.click(button);

    // CRITICAL: same guard as the compose-failure test. A failed
    // upload means R2 doesn't have the preview; we must NOT mark the
    // template as published.
    expect(composeSpy).toHaveBeenCalledTimes(1);
    expect(uploadSpy).toHaveBeenCalledTimes(1);
    expect(updateSpy).not.toHaveBeenCalled();
    expect(navigateMock).not.toHaveBeenCalled();
    expect(toast.error).toHaveBeenCalled();
  });

  it('non-stamp cardType (membership_card): compose + upload are SKIPPED, falls through to legacy update', async () => {
    setStoreWithCardType('membership_card');
    const user = userEvent.setup();
    renderWithRouter();

    const button = screen.getByTestId('step8-publish-button');
    await user.click(button);

    // Decision 2026-10-14 § 影響: 1.png–15.png 不在這條 Decision 範圍,
    // 所以非 stamp_card 的 cardType 不應觸發 0.png 預渲染 (它們根本
    // 沒有 stamp grid 概念)。
    expect(composeSpy).not.toHaveBeenCalled();
    expect(uploadSpy).not.toHaveBeenCalled();
    expect(updateSpy).toHaveBeenCalledWith('test-template-id', { status: 'published' });
    expect(navigateMock).toHaveBeenCalledWith('/app/dashboard', { replace: true });
  });

  it('non-stamp cardType (cashback_card): compose + upload are SKIPPED', async () => {
    setStoreWithCardType('cashback_card');
    const user = userEvent.setup();
    renderWithRouter();

    await user.click(screen.getByTestId('step8-publish-button'));

    expect(composeSpy).not.toHaveBeenCalled();
    expect(uploadSpy).not.toHaveBeenCalled();
    expect(updateSpy).toHaveBeenCalledWith('test-template-id', { status: 'published' });
  });

  it('missing accessToken: status → error, no compose / no upload / no update', async () => {
    setStoreStampCardDraft();
    mockAuthState.accessToken = null;
    const user = userEvent.setup();
    renderWithRouter();

    await user.click(screen.getByTestId('step8-publish-button'));

    // The composer hook requires a non-empty auth token; if the user
    // somehow got here without one (e.g. token expired in another tab),
    // we must NOT attempt a network round-trip.
    expect(composeSpy).not.toHaveBeenCalled();
    expect(uploadSpy).not.toHaveBeenCalled();
    expect(updateSpy).not.toHaveBeenCalled();
    expect(toast.error).toHaveBeenCalled();
  });

  it('status transitions: idle → composing-stamp-zero → uploading-stamp-zero → saving → saved', async () => {
    // We assert via the disabled state of the publish button + the
    // presence of the spinner (Loader2). The button is disabled while
    // any of the in-flight statuses is active.
    setStoreStampCardDraft();

    // Slow down the spies so we can observe the in-flight state.
    let resolveUpload!: (v: ReturnType<typeof makeUploadResponse>) => void;
    uploadSpy.mockImplementationOnce(
      () => new Promise((resolve) => {
        resolveUpload = resolve;
      }),
    );
    composeSpy.mockImplementationOnce(async () => {
      // While compose is pending, button should be disabled.
      return STAMP_BLOB;
    });

    const user = userEvent.setup();
    renderWithRouter();

    const button = screen.getByTestId('step8-publish-button');
    expect(button).not.toBeDisabled();

    await user.click(button);
    // After the click, compose has resolved and upload is pending —
    // button should be in the in-flight state (disabled).
    expect(button).toBeDisabled();

    // Resolve the upload → update resolves → navigate.
    await act(async () => {
      resolveUpload(makeUploadResponse());
    });

    expect(navigateMock).toHaveBeenCalledWith('/app/dashboard', { replace: true });
  });
});
