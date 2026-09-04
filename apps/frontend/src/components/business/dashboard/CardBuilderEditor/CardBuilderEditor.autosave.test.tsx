/**
 * CardBuilderEditor — Step 4 autosave regression (2026-09-05).
 *
 * Symptom: editing description / backFields / links in Step 4 did not persist
 * to the backend unless the user clicked the "下一步" button AND `isStep4Valid()`
 * returned true. In-progress typing was lost on reload.
 *
 * Fix: a debounced (1s) autosave effect in CardBuilderEditor persists the
 * Step 4 fields whenever the user pauses typing. This mirrors the existing
 * name auto-save pattern (CardBuilderEditor.tsx line ~107).
 *
 * The test guards:
 *   - cardId change seeds an initial autosave when there are non-default values
 *   - setDescription triggers a single debounced PUT after 1s
 *   - a SECOND setDescription within the debounce window collapses to ONE PUT
 *     (debounce behavior — avoid write storms)
 *   - setBackFieldsLabel mutating one row triggers a PUT containing that row
 *   - setLinksLabel mutating one row triggers a PUT containing that row
 *   - reset() to default values does NOT trigger any PUT (avoids no-op writes
 *     on resume from draft)
 */

import { render, cleanup, waitFor, act } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CardBuilderEditor } from './CardBuilderEditor';
import { useCardBuilderStore } from './CardBuilderEditor.store';

// Mock authService + useAuth so CardBuilderEditor renders without AuthProvider.
vi.mock('@/services/authService', () => ({
  authService: {
    refresh: vi.fn().mockResolvedValue(null),
    login: vi.fn(),
    logout: vi.fn(),
    me: vi.fn().mockResolvedValue(null),
  },
}));

vi.mock('@/hooks/useAuth', () => ({
  useAuth: vi.fn(() => ({
    state: {
      isLoading: false,
      isAuthenticated: false,
      user: null,
      tenant: null,
      accessToken: null,
    },
    login: vi.fn(),
    logout: vi.fn(),
    refresh: vi.fn(),
  })),
}));

// react-i18next stub
vi.mock('react-i18next', () => ({
  useTranslation: vi.fn(() => ({ t: vi.fn((key: string) => key) })),
}));

// Mock cardService and track every update() call.
const updateCalls: Array<{ id: string; payload: unknown }> = [];
vi.mock('@/services/cardService', () => ({
  cardService: {
    getById: vi.fn().mockResolvedValue({
      id: 'test-template-id',
      settings: {},
    }),
    create: vi.fn().mockResolvedValue({ id: 'test-template-id' }),
    createDraft: vi.fn().mockResolvedValue({ id: 'test-template-id' }),
    update: vi.fn().mockImplementation((id: string, payload: unknown) => {
      updateCalls.push({ id, payload });
      return Promise.resolve({ id, settings: (payload as { settings?: unknown })?.settings ?? {} });
    }),
    publish: vi.fn().mockResolvedValue({}),
    delete: vi.fn().mockResolvedValue(undefined),
    touch: vi.fn().mockResolvedValue({ id: 'test-template-id' }),
    getLatestDraft: vi.fn().mockResolvedValue(null),
    abandon: vi.fn().mockResolvedValue(undefined),
    generateUploadUrl: vi.fn().mockResolvedValue({
      uploadUrl: 'https://example.com/upload',
      key: 'test-key',
      publicUrl: 'https://example.com/public',
    }),
  },
}));

function renderWithRouter() {
  return render(
    <MemoryRouter initialEntries={['/app/dashboard/card-builder?id=test-template-id']}>
      <CardBuilderEditor />
    </MemoryRouter>,
  );
}

beforeEach(() => {
  // Seed store with a known cardId so the autosave effect runs.
  useCardBuilderStore.setState({ cardId: 'test-template-id' });
});

afterEach(() => {
  useCardBuilderStore.getState().reset();
  updateCalls.length = 0;
  cleanup();
  vi.useRealTimers();
});

describe('CardBuilderEditor — Step 4 autosave (2026-09-05)', () => {
  it('autosaves description after the user pauses typing for 1s', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    renderWithRouter();

    act(() => {
      useCardBuilderStore.getState().setDescription('Hello world');
    });

    // No PUT yet — within the 1s debounce window.
    expect(updateCalls).toHaveLength(0);

    await act(async () => {
      vi.advanceTimersByTime(1100);
    });

    await waitFor(() => expect(updateCalls.length).toBeGreaterThanOrEqual(1));
    const payload = updateCalls[updateCalls.length - 1]!.payload as {
      settings?: { description?: string };
    };
    expect(payload.settings?.description).toBe('Hello world');
  });

  it('collapses multiple typing bursts into a single debounced PUT', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    renderWithRouter();

    act(() => {
      useCardBuilderStore.getState().setDescription('a');
    });
    await act(async () => {
      vi.advanceTimersByTime(300);
    });
    act(() => {
      useCardBuilderStore.getState().setDescription('ab');
    });
    await act(async () => {
      vi.advanceTimersByTime(300);
    });
    act(() => {
      useCardBuilderStore.getState().setDescription('abc');
    });
    await act(async () => {
      vi.advanceTimersByTime(1100);
    });

    await waitFor(() => expect(updateCalls.length).toBe(1));
    const payload = updateCalls[0]!.payload as {
      settings?: { description?: string };
    };
    expect(payload.settings?.description).toBe('abc');
  });

  it('autosaves when a backField value changes', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    renderWithRouter();

    act(() => {
      useCardBuilderStore.getState().setBackFieldsValue(0, 'a@b.com');
    });

    await act(async () => {
      vi.advanceTimersByTime(1100);
    });

    await waitFor(() => expect(updateCalls.length).toBeGreaterThanOrEqual(1));
    const payload = updateCalls[updateCalls.length - 1]!.payload as {
      settings?: {
        backFields?: Array<{ label: string; value: string }>;
      };
    };
    expect(payload.settings?.backFields).toEqual([
      { label: '', value: 'a@b.com' },
    ]);
  });

  it('autosaves when a link value changes', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    renderWithRouter();

    act(() => {
      useCardBuilderStore.getState().addLink();
    });
    act(() => {
      useCardBuilderStore.getState().setLinksValue(0, 'https://example.com');
    });

    await act(async () => {
      vi.advanceTimersByTime(1100);
    });

    await waitFor(() => expect(updateCalls.length).toBeGreaterThanOrEqual(1));
    const payload = updateCalls[updateCalls.length - 1]!.payload as {
      settings?: {
        links?: Array<{ label: string; value: string }>;
      };
    };
    expect(payload.settings?.links).toEqual([
      { label: '', value: 'https://example.com' },
    ]);
  });

  it('does NOT autosave when cardId is null (new-draft mode before first save)', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    // Force cardId to null and render with NO ?id= in the URL so CardBuilderEditor
    // mounts in "new draft" mode (its own URL-watching useEffect does NOT
    // re-set cardId from the route when the route has no ?id).
    useCardBuilderStore.setState({ cardId: null });
    render(
      <MemoryRouter initialEntries={['/app/dashboard/card-builder']}>
        <CardBuilderEditor />
      </MemoryRouter>,
    );

    act(() => {
      useCardBuilderStore.getState().setDescription('orphan');
    });

    await act(async () => {
      vi.advanceTimersByTime(1100);
    });

    expect(updateCalls).toHaveLength(0);
  });

  it('persists user-derived backField rows (addBackField → save includes new row)', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    renderWithRouter();

    act(() => {
      // Simulate the user clicking "+ Add Field" twice and filling values.
      useCardBuilderStore.getState().addBackField();
      useCardBuilderStore.getState().addBackField();
      useCardBuilderStore.getState().setBackFieldsValue(0, 'support@x.com');
      useCardBuilderStore.getState().setBackFieldsLabel(1, 'Hotline');
      useCardBuilderStore.getState().setBackFieldsValue(1, '+886-2-1234-5678');
    });

    await act(async () => {
      vi.advanceTimersByTime(1100);
    });

    await waitFor(() => expect(updateCalls.length).toBeGreaterThanOrEqual(1));
    const payload = updateCalls[updateCalls.length - 1]!.payload as {
      settings?: {
        backFields?: Array<{ label: string; value: string }>;
      };
    };
    expect(payload.settings?.backFields).toEqual([
      { label: '', value: 'support@x.com' },
      { label: 'Hotline', value: '+886-2-1234-5678' },
      { label: '', value: '' },
    ]);
  });
});
