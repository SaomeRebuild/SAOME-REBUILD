/**
 * Step8Save — multipass dispatch regression test (v15 expansion).
 *
 * @module CardBuilderEditor/Step8Save/Step8Save.hooks.multipass.test
 * @description 2026-10-15 (v15) — the stamp_card 0.png pre-render
 * hook in `useStep8Save` was extended to also trigger for
 * `cardType === 'multipass'`. Per user direction
 *   「Stamp and Multipass are the only two card types that use the
 *    generated image as background」
 * both cardTypes share the same compose + upload + push path.
 *
 * This test pins the two cardType values that take the v15 path:
 *   1. `stamp_card` — pre-existing behavior (covered in
 *      `Step8Save.composeZero.test.tsx`). This file re-pins the
 *      trigger shape (compose → upload → update) for symmetry.
 *   2. `multipass` — NEW v15 trigger. Composes + uploads the empty
 *      0.png just like stamp_card does. Without this regression
 *      test, a future refactor that flips `isStampish` back to
 *      `cardType === 'stamp_card'` only would silently break the
 *      multipass customer-facing preview.
 *
 * Why a separate file (not appended to `composeZero.test.tsx`):
 *   - The composeZero test was written for stamp_card only and
 *     documents the original Option B behavior. The multipass
 *     expansion is a v15 add-on; keeping the test focused on the
 *     dispatch surface (which cardType values take the path) makes
 *     the v15 change visible in code review.
 *   - The two cardTypes share the same `isStampish` branch in
 *     `useStep8Save` — there is no separate code path. So the
 *     regression test asserts the dispatch contract (which cardTypes
 *     take the path) rather than re-testing the full failure matrix
 *     (already covered in composeZero.test.tsx).
 *
 * Decision: runs/decisions/2026-10-15-stamp-card-push-wiring.md
 * (Step 8 hook: `isStampish = cardType === 'stamp_card' || cardType === 'multipass'`).
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { composeStampCardImage } from '@/components/business/stampCard/StampCardImageComposer/composeStampCardImage';
import { uploadStampCardImage } from '@/components/business/stampCard/StampCardImageComposer/uploadStampCardImage';

import { Step8Save } from './index';
import { useCardBuilderStore } from '../CardBuilderEditor.store';
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

// ─── Auth mock ────────────────────────────────────────────────────────────

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

// ─── Router mock ──────────────────────────────────────────────────────────

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
  composeSpy.mockResolvedValue(STAMP_BLOB);
  uploadSpy.mockResolvedValue(makeUploadResponse());
  updateSpy.mockResolvedValue({} as never);
});

afterEach(() => {
  cleanup();
});

// ─── Tests ────────────────────────────────────────────────────────────────

describe('Step8Save — v15 cardType dispatch (stamp_card + multipass)', () => {
  it('stamp_card: takes the 0.png pre-render path (compose + upload + update + navigate)', async () => {
    // Regression — the original v5 Option B behavior must continue
    // to work after the v15 expansion to multipass. If a future
    // refactor accidentally narrows `isStampish` to only `multipass`,
    // this test fails immediately.
    setStoreWithCardType('stamp_card');
    const user = userEvent.setup();
    renderWithRouter();

    await user.click(screen.getByTestId('step8-publish-button'));

    expect(composeSpy).toHaveBeenCalledTimes(1);
    expect(uploadSpy).toHaveBeenCalledTimes(1);
    expect(uploadSpy).toHaveBeenCalledWith(
      'test-template-id',
      0,
      STAMP_BLOB,
      'mock-jwt-token',
    );
    expect(updateSpy).toHaveBeenCalledWith('test-template-id', { status: 'published' });
    expect(navigateMock).toHaveBeenCalledWith('/app/dashboard', { replace: true });
  });

  it('multipass: takes the 0.png pre-render path (compose + upload + update + navigate)', async () => {
    // v15 (2026-10-15) — multipass is the NEW cardType that must
    // take the same Option B path. Per user direction, only stamp_card
    // and multipass are granted this behavior; other cardTypes skip
    // compose/upload and go straight to the legacy update.
    setStoreWithCardType('multipass');
    const user = userEvent.setup();
    renderWithRouter();

    await user.click(screen.getByTestId('step8-publish-button'));

    // The critical assertion: multipass triggers compose + upload.
    expect(composeSpy).toHaveBeenCalledTimes(1);
    expect(uploadSpy).toHaveBeenCalledTimes(1);
    expect(uploadSpy).toHaveBeenCalledWith(
      'test-template-id',
      0,
      STAMP_BLOB,
      'mock-jwt-token',
    );
    expect(updateSpy).toHaveBeenCalledTimes(1);
    expect(updateSpy).toHaveBeenCalledWith('test-template-id', { status: 'published' });
    expect(navigateMock).toHaveBeenCalledWith('/app/dashboard', { replace: true });
  });
});
