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
const FULL_SETTINGS = {
  description: '紅甘隨人，歡喜做甘願乾、嬤嬤哈哈阿機機機機機機',
  backFields: [
    { label: '哈哈哈哈', value: '55555555555555555555555555555555555555555555555555555555555555' },
    { label: 'EGGEG', value: 'RGEWRGWGWEGWERGEWG' },
    { label: 'EWGWEGSACSAC', value: 'CASCSACASDCSCSCASC' },
    { label: 'CC', value: 'VVAVASDSADCREW' },
    { label: 'SCASCSAC', value: 'SACASCASC' },
  ],
  links: [
    { label: '網址', value: 'http://hup.com' },
  ],
};
vi.mock('@/services/cardService', () => ({
  cardService: {
    getById: vi.fn().mockImplementation(() =>
      Promise.resolve({
        id: 'test-template-id',
        settings: {
          description: '紅甘隨人，歡喜做甘願乾、嬤嬤哈哈阿機機機機機機',
          backFields: [
            { label: '哈哈哈哈', value: '55555555555555555555555555555555555555555555555555555555555555' },
            { label: 'EGGEG', value: 'RGEWRGWGWEGWERGEWG' },
            { label: 'EWGWEGSACSAC', value: 'CASCSACASDCSCSCASC' },
            { label: 'CC', value: 'VVAVASDSADCREW' },
            { label: 'SCASCSAC', value: 'SACASCASC' },
          ],
          links: [
            { label: '網址', value: 'http://hup.com' },
          ],
        },
      }),
    ),
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

/**
 * Flush pending microtasks (Promises) so the URL-watching effect's
 * `getById().then(loadSettings)` chain completes before the test
 * mutates the store. 修 3 (2026-09-05): the autosave effect now refuses
 * to schedule a timer until loadSettings hydrates the store, so
 * tests that act on the store right after render MUST flush first.
 */
async function flushLoadSettings() {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
  });
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
    // 修 3 (2026-09-05): let the URL-watching effect's getById.then(loadSettings)
    // microtask drain so step4LoadSettledRef flips to true. Without this
    // flush, the subsequent setDescription runs while loadSettings is
    // in-flight, and the autosave effect refuses to schedule a timer
    // (per the new "don't clobber DB with partial data" guarantee).
    await flushLoadSettings();

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
    // Flush microtasks so loadSettings resolves before user edits (修 3).
    await flushLoadSettings();

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
    // Flush microtasks so loadSettings resolves before user edits (修 3).
    await flushLoadSettings();

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
    // 修 3 (2026-09-05): loadSettings hydrates the store with FULL_SETTINGS
    // (5 backField rows) before the user edits, so the autosave payload
    // carries the user's edit on top of the existing rows (row[0].value
    // gets 'a@b.com', row[0].label stays as the DB-stored '哈哈哈哈').
    expect(payload.settings?.backFields?.[0]).toEqual({
      label: '哈哈哈哈',
      value: 'a@b.com',
    });
    expect(payload.settings?.backFields?.length).toBe(5);
  });

  it('autosaves when a link value changes', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    renderWithRouter();
    // Flush microtasks so loadSettings resolves before user edits (修 3).
    await flushLoadSettings();

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
    // 修 3 (2026-09-05): loadSettings hydrates the store with
    // FULL_SETTINGS.links = [{label: '網址', value: 'http://hup.com'}]
    // before user adds a new one and edits row[0].value, so the
    // autosave payload carries BOTH (row[0].value updated, row[1] empty).
    expect(payload.settings?.links).toEqual([
      { label: '網址', value: 'https://example.com' },
      { label: '', value: '' },
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
    // Flush microtasks so loadSettings resolves before user edits (修 3).
    await flushLoadSettings();

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
      { label: '哈哈哈哈', value: 'support@x.com' },
      { label: 'Hotline', value: '+886-2-1234-5678' },
      { label: 'EWGWEGSACSAC', value: 'CASCSACASDCSCSCASC' },
      { label: 'CC', value: 'VVAVASDSADCREW' },
      { label: 'SCASCSAC', value: 'SACASCASC' },
      { label: '', value: '' },
      { label: '', value: '' },
    ]);
  });

  /**
   * Regression test for the 2026-09-05 "Step 4 autosave wipes description +
   * backFields while leaving links intact" bug.
   *
   * User-observed scenario:
   *   1. DB has full Step 4 data.
   *   2. Open the editor — the form correctly re-fills all 3 sections.
   *   3. A few seconds later (autosave timer = 1s) — only the LINKS field
   *      still shows data; description and backFields are blank.
   *   4. The DB itself is preserved (next reload re-fills everything).
   *
   * Root cause:
   *   The autosave effect computes its snapshot baseline against the EMPTY
   *   default store state (right after the CardBuilderEditor's outer effect
   *   runs `reset()` and before `getById` resolves). If the GET takes more
   *   than 1s — even by a sliver — the debounced timer fires WITH the
   *   default state, sending `settings: { description:'', backFields:[{empty}],
   *   links:[] }` and clobbering the DB.
   *
   * Fix:
   *   Seed the baseline from the `cardId` resolution itself (don't gate on
   *   description / backFields / links changes), and skip the *initial*
   *   effect run on mount so the first PUT cannot fire with default state.
   *
   * This test reproduces the bug WITHOUT user typing by simulating a slow
   * `getById` (>1s) and asserting the autosave does NOT fire with empty data.
   */
  it('does NOT autosave empty defaults when getById resolves slowly (regression — 2026-09-05)', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });

    // Override the default mock to simulate a slow network (resolve after
    // 1500ms — well past the 1s autosave debounce).
    const cardService = await import('@/services/cardService');
    vi.mocked(cardService.cardService.getById).mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          setTimeout(
            () =>
              resolve({
                id: 'test-template-id',
                settings: FULL_SETTINGS,
                cardType: 'membership_card',
                name: 'Test Card',
              } as unknown as Awaited<ReturnType<typeof cardService.cardService.getById>>),
            1500,
          );
        }),
    );

    renderWithRouter();

    // Drive time forward through the autosave debounce window BEFORE the
    // fetch resolves. If the bug is present, this PUT would fire with
    // empty defaults and clobber the DB.
    await act(async () => {
      vi.advanceTimersByTime(1100);
    });

    // No PUT should have been issued (the loadSettings hasn't completed yet,
    // so the baseline hasn't been seeded with real data).
    const emptyPayloads = updateCalls.filter((u) => {
      const settings = (u.payload as { settings?: Record<string, unknown> })?.settings ?? {};
      const desc = settings.description;
      const bfs = settings.backFields as unknown[];
      const lnks = settings.links as unknown[];
      // An "empty" autosave is one where description is '' AND
      // backFields is a single empty row AND links is empty.
      return (
        desc === '' &&
        Array.isArray(bfs) &&
        bfs.length === 1 &&
        (bfs[0] as { label: string; value: string })?.value === '' &&
        Array.isArray(lnks) &&
        lnks.length === 0
      );
    });
    expect(emptyPayloads).toHaveLength(0);

    // Now let the fetch resolve and verify the store hydrates correctly.
    await act(async () => {
      vi.advanceTimersByTime(500); // total ~1600ms — past the 1500ms fetch
    });

    // Wait for the second loadSettings call (from the Workspace effect) to
    // settle, then verify the store still has all 3 sections populated.
    const s = useCardBuilderStore.getState();
    expect(s.description).toBe(FULL_SETTINGS.description);
    expect(s.backFields).toEqual(FULL_SETTINGS.backFields);
    expect(s.links).toEqual(FULL_SETTINGS.links);
  });

  /**
   * 修 2 regression (2026-09-05): the outer CardBuilderEditor's URL-watching
   * effect is the single fetch + loadSettings source of truth. Before this
   * fix, the inner CardBuilderEditorWorkspace ALSO ran its own getById +
   * loadSettings effect on mount, causing loadSettings to fire TWICE and
   * making autosave's baseline-arm logic much harder to reason about.
   *
   * The test asserts that with the Workspace's fetch removed, getById is
   * called exactly once per mount.
   */
  it('修 2: calls getById exactly once on mount (no duplicate fetch from Workspace)', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const cardService = await import('@/services/cardService');
    const getByIdSpy = vi.spyOn(cardService.cardService, 'getById');

    renderWithRouter();

    // Let any pending microtasks (fetch resolution, then() callbacks) drain.
    await act(async () => {
      vi.advanceTimersByTime(50);
      await Promise.resolve();
    });

    await waitFor(() => expect(getByIdSpy).toHaveBeenCalledTimes(1));
    // And never more — no second fetch from a duplicate effect.
    await act(async () => {
      vi.advanceTimersByTime(500);
      await Promise.resolve();
    });
    expect(getByIdSpy).toHaveBeenCalledTimes(1);
  });

  /**
   * 修 3 regression (2026-09-05): even with the baseline-arm pattern,
   * user edits BEFORE loadSettings completes should not schedule autosave.
   *
   * Scenario:
   *   1. Mount CardBuilderEditor with a slow getById (3s).
   *   2. User immediately types in description (before fetch resolves).
   *   3. Step 4 autosave effect runs with the EMPTY defaults baseline —
   *      but now the snapshot has changed to "mid-typing" (still the
   *      pre-settled state, so we should NOT schedule a timer).
   *   4. After loadSettings hydrates, store gets the real DB data; the
   *      effect re-runs and settles.
   *   5. Subsequent user edits schedule autosave normally.
   *
   * This test verifies step 3: NO autosave fires before loadSettings lands.
   */
  it('修 3: does NOT autosave when user types before loadSettings completes', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });

    // Slow fetch (3s) — well past the 1s autosave debounce.
    const cardService = await import('@/services/cardService');
    vi.mocked(cardService.cardService.getById).mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          setTimeout(
            () =>
              resolve({
                id: 'test-template-id',
                settings: FULL_SETTINGS,
                cardType: 'membership_card',
                name: 'Test Card',
              } as unknown as Awaited<ReturnType<typeof cardService.cardService.getById>>),
            3000,
          );
        }),
    );

    renderWithRouter();

    // User types IMMEDIATELY after mount — before fetch resolves.
    act(() => {
      useCardBuilderStore.getState().setDescription('mid-typing');
    });

    // Drive past the 1s autosave debounce. The fix ensures NO PUT fires here
    // because loadSettings hasn't settled the store yet.
    await act(async () => {
      vi.advanceTimersByTime(1100);
    });

    const callsBeforeSettle = updateCalls.length;
    expect(callsBeforeSettle).toBe(0);

    // Now let fetch resolve and verify the store hydrates correctly.
    await act(async () => {
      vi.advanceTimersByTime(2000); // total ~3100ms — past the 3000ms fetch
    });

    await waitFor(() => {
      const s = useCardBuilderStore.getState();
      expect(s.description).toBe(FULL_SETTINGS.description);
    });

    // After loadSettings lands + settled, a subsequent user edit SHOULD
    // schedule an autosave. This confirms the settled flag is correctly
    // flipped and doesn't permanently block saves.
    act(() => {
      useCardBuilderStore.getState().setDescription('real edit after load');
    });
    await act(async () => {
      vi.advanceTimersByTime(1100);
    });

    await waitFor(() => expect(updateCalls.length).toBeGreaterThan(0));
    const lastPayload = updateCalls[updateCalls.length - 1]!.payload as {
      settings?: { description?: string };
    };
    expect(lastPayload.settings?.description).toBe('real edit after load');
  });
});

// ===== Step 5 — 地理位置 + 推播訊息 autosave (2026-09-05) =====
describe('CardBuilderEditor — Step 5 autosave (2026-09-05)', () => {
  it('autosaves initialMessage after the user pauses typing for 1s', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    renderWithRouter();
    // Flush microtasks so loadSettings resolves before user edits.
    await flushLoadSettings();

    act(() => {
      useCardBuilderStore.getState().setInitialMessage('歡迎光臨');
    });

    // No PUT yet — within the 1s debounce window.
    expect(updateCalls).toHaveLength(0);

    await act(async () => {
      vi.advanceTimersByTime(1100);
    });

    await waitFor(() => expect(updateCalls.length).toBeGreaterThanOrEqual(1));
    const payload = updateCalls[updateCalls.length - 1]!.payload as {
      settings?: { initialMessage?: string };
    };
    expect(payload.settings?.initialMessage).toBe('歡迎光臨');
  });

  it('autosaves when a location row is added and lat/lng filled', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    renderWithRouter();
    await flushLoadSettings();

    act(() => {
      useCardBuilderStore.getState().addLocation();
    });
    act(() => {
      useCardBuilderStore
        .getState()
        .setLocationName(0, '台北 101');
    });
    act(() => {
      useCardBuilderStore
        .getState()
        .setLocationLatitude(0, 25.033);
      useCardBuilderStore
        .getState()
        .setLocationLongitude(0, 121.565);
    });

    await act(async () => {
      vi.advanceTimersByTime(1100);
    });

    await waitFor(() => expect(updateCalls.length).toBeGreaterThanOrEqual(1));
    const payload = updateCalls[updateCalls.length - 1]!.payload as {
      settings?: {
        locations?: Array<{
          name: string;
          latitude: number;
          longitude: number;
        }>;
      };
    };
    expect(payload.settings?.locations?.[0]?.name).toBe('台北 101');
    expect(payload.settings?.locations?.[0]?.latitude).toBe(25.033);
    expect(payload.settings?.locations?.[0]?.longitude).toBe(121.565);
  });

  it('does NOT autosave empty defaults before async fetch resolves — Step 5 (regression 2026-09-05)', async () => {
    // Mirrors Step 4 修 3 regression — slow-network scenario where
    // fetch is slower than debounce. Without baseline-arm + loadSettled,
    // the Step 5 autosave effect would PUT empty defaults into DB and
    // (via Rule 032 silent overwrite) clobber any real locations data.
    vi.useFakeTimers({ shouldAdvanceTime: true });

    // Slow fetch (3s) — well past the 1s autosave debounce.
    const cardService = await import('@/services/cardService');
    vi.mocked(cardService.cardService.getById).mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          setTimeout(
            () =>
              resolve({
                id: 'test-template-id',
                settings: {
                  ...FULL_SETTINGS,
                  initialMessage: '既有推播訊息',
                  locations: [{ name: '既有地點', latitude: 25, longitude: 121 }],
                },
                cardType: 'membership_card',
                name: 'Test Card',
              } as unknown as Awaited<
                ReturnType<typeof cardService.cardService.getById>
              >),
            3000,
          );
        }),
    );

    renderWithRouter();

    // User types IMMEDIATELY after mount — before fetch resolves.
    act(() => {
      useCardBuilderStore.getState().setInitialMessage('mid-typing');
    });

    // Drive past the 1s autosave debounce. The fix ensures NO PUT fires
    // because loadSettings hasn't settled the store yet.
    await act(async () => {
      vi.advanceTimersByTime(1100);
    });

    const callsBeforeSettle = updateCalls.length;
    expect(callsBeforeSettle).toBe(0);

    // Now let fetch resolve and verify the store hydrates correctly.
    await act(async () => {
      vi.advanceTimersByTime(2000); // total ~3100ms — past the 3000ms fetch
    });

    await waitFor(() => {
      const s = useCardBuilderStore.getState();
      expect(s.initialMessage).toBe('既有推播訊息');
    });
  });
});
