/**
 * CardBuilderEditor.store — tableCard slice tests (2026-09-27).
 *
 * Verifies:
 *   - 5-state export machine transitions
 *   - Stale detection: editing after 'ready' flips to 'stale'
 *   - Element CRUD via store setters
 *   - zod parse guard on `setTableCard`
 *   - Reset clears all tableCard state
 *
 * Run: `npm test -- CardBuilderEditor.tableCard.store.test`
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { useCardBuilderStore } from './CardBuilderEditor.store';
import type {
  TableCardElement,
  TableCardSettings,
} from '@saome/shared/schemas/card';

const textEl: TableCardElement = {
  id: '11111111-1111-1111-1111-111111111111',
  type: 'text',
  x: 10,
  y: 10,
  width: 50,
  height: 12,
  rotation: 0,
  zIndex: 0,
  text: 'Hello',
  fontSize: 12,
  fontWeight: 'normal',
  color: '#000000',
};

const baseSettings: TableCardSettings = {
  elements: [],
  background: { type: 'solid', color: '#ffffff' },
  bleedMm: 3,
};

describe('CardBuilderEditor.store — tableCard slice', () => {
  beforeEach(() => {
    useCardBuilderStore.getState().reset();
  });

  afterEach(() => {
    useCardBuilderStore.getState().reset();
  });

  describe('initial state', () => {
    it('starts with empty elements + solid white background + 3mm bleed', () => {
      const s = useCardBuilderStore.getState();
      expect(s.tableCard.elements).toEqual([]);
      expect(s.tableCard.background).toEqual({ type: 'solid', color: '#ffffff' });
      expect(s.tableCard.bleedMm).toBe(3);
      expect(s.tableCardExportState).toBe('idle');
      expect(s.tableCardLastEditedAt).toBeNull();
      expect(s.tableCardLastExportedAt).toBeNull();
      expect(s.tableCardExportError).toBeNull();
    });
  });

  describe('addTableCardElement', () => {
    it('appends element and bumps lastEditedAt', () => {
      const before = useCardBuilderStore.getState().tableCardLastEditedAt;
      useCardBuilderStore.getState().addTableCardElement({ ...textEl, zIndex: 0 });
      const s = useCardBuilderStore.getState();
      expect(s.tableCard.elements).toHaveLength(1);
      expect(s.tableCard.elements[0]?.id).toBe(textEl.id);
      expect(s.tableCardLastEditedAt).not.toBe(before);
    });

    it('refuses to add when at MAX_ELEMENTS=50', () => {
      const store = useCardBuilderStore.getState();
      // Manually push 50 elements
      for (let i = 0; i < 50; i++) {
        useCardBuilderStore.setState({
          tableCard: {
            ...store.tableCard,
            elements: [
              ...useCardBuilderStore.getState().tableCard.elements,
              { ...textEl, id: `el-${i}`, zIndex: i },
            ],
          },
        });
      }
      expect(useCardBuilderStore.getState().tableCard.elements).toHaveLength(50);
      // 51st should be a no-op
      useCardBuilderStore.getState().addTableCardElement({ ...textEl, id: 'el-50' });
      expect(useCardBuilderStore.getState().tableCard.elements).toHaveLength(50);
    });
  });

  describe('updateTableCardElement', () => {
    it('patches matching element by id', () => {
      useCardBuilderStore.getState().addTableCardElement(textEl);
      useCardBuilderStore.getState().updateTableCardElement(textEl.id, { text: 'Updated' });
      const updated = useCardBuilderStore
        .getState()
        .tableCard.elements.find((e) => e.id === textEl.id);
      // Type narrow: `find` returns the union; `text` is only on 'text' kind.
      if (updated?.type !== 'text') throw new Error('expected text element');
      expect(updated.text).toBe('Updated');
    });

    it('is a no-op for unknown id', () => {
      useCardBuilderStore.getState().addTableCardElement(textEl);
      const before = useCardBuilderStore.getState().tableCard.elements.length;
      useCardBuilderStore.getState().updateTableCardElement('non-existent', { text: 'X' });
      expect(useCardBuilderStore.getState().tableCard.elements.length).toBe(before);
    });

    it('refuses to change element kind via patch.type', () => {
      useCardBuilderStore.getState().addTableCardElement(textEl);
      useCardBuilderStore
        .getState()
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .updateTableCardElement(textEl.id, { type: 'image' } as any);
      const after = useCardBuilderStore
        .getState()
        .tableCard.elements.find((e) => e.id === textEl.id);
      expect(after?.type).toBe('text'); // unchanged
    });
  });

  describe('removeTableCardElement', () => {
    it('removes by id', () => {
      useCardBuilderStore.getState().addTableCardElement(textEl);
      useCardBuilderStore.getState().removeTableCardElement(textEl.id);
      expect(useCardBuilderStore.getState().tableCard.elements).toHaveLength(0);
    });

    it('is a no-op for unknown id', () => {
      useCardBuilderStore.getState().addTableCardElement(textEl);
      useCardBuilderStore.getState().removeTableCardElement('non-existent');
      expect(useCardBuilderStore.getState().tableCard.elements).toHaveLength(1);
    });
  });

  describe('reorderTableCardElement — Round 4 swap-with-neighbor', () => {
    /**
     * Round 4 — the store action now takes a direction ('up' | 'down')
     * and swaps zIndex with the immediate neighbor in the sorted panel
     * order (zIndex DESC). This guarantees every successful click
     * moves the element by exactly one visual position in the layers
     * panel, regardless of zIndex gaps or collisions.
     */

    function withElements(elements: TableCardElement[]) {
      useCardBuilderStore.setState({
        tableCard: { ...baseSettings, elements },
      });
    }

    /** Read the current panel display order (zIndex DESC, stable). */
    function panelOrder(): string[] {
      const elements = useCardBuilderStore.getState().tableCard.elements;
      return [...elements]
        .sort((a, b) => b.zIndex - a.zIndex)
        .map((e) => e.id);
    }

    function zIndexOf(id: string): number | undefined {
      return useCardBuilderStore
        .getState()
        .tableCard.elements.find((e) => e.id === id)?.zIndex;
    }

    it('swap zIndex with neighbor when bring forward (↑)', () => {
      // Setup: 3 elements stacked bottom→top.
      // Panel order (zIndex DESC): c (2), b (1), a (0)
      withElements([
        { ...textEl, id: 'a', zIndex: 0 },
        { ...textEl, id: 'b', zIndex: 1 },
        { ...textEl, id: 'c', zIndex: 2 },
      ]);
      expect(panelOrder()).toEqual(['c', 'b', 'a']);

      useCardBuilderStore.getState().reorderTableCardElement('a', 'up');

      // 'a' should swap with its immediate panel-up neighbor 'b'.
      expect(panelOrder()).toEqual(['c', 'a', 'b']);
      expect(zIndexOf('a')).toBe(1);
      expect(zIndexOf('b')).toBe(0);
      expect(zIndexOf('c')).toBe(2);
    });

    it('swap zIndex with neighbor when send backward (↓)', () => {
      // Panel order (zIndex DESC): c (2), b (1), a (0)
      withElements([
        { ...textEl, id: 'a', zIndex: 0 },
        { ...textEl, id: 'b', zIndex: 1 },
        { ...textEl, id: 'c', zIndex: 2 },
      ]);

      useCardBuilderStore.getState().reorderTableCardElement('c', 'down');

      // 'c' should swap with its immediate panel-down neighbor 'b'.
      expect(panelOrder()).toEqual(['b', 'c', 'a']);
      expect(zIndexOf('b')).toBe(2);
      expect(zIndexOf('c')).toBe(1);
      expect(zIndexOf('a')).toBe(0);
    });

    it('no-op at top boundary when ↑ (idx === 0 in sorted order)', () => {
      // 'c' is at the top of the panel.
      withElements([
        { ...textEl, id: 'a', zIndex: 0 },
        { ...textEl, id: 'b', zIndex: 1 },
        { ...textEl, id: 'c', zIndex: 2 },
      ]);

      useCardBuilderStore.getState().reorderTableCardElement('c', 'up');

      // Order must be unchanged.
      expect(panelOrder()).toEqual(['c', 'b', 'a']);
      // Also: editedAt should NOT be bumped on a no-op (no stale flip).
      const s = useCardBuilderStore.getState();
      // Either null (never touched) or unchanged from before — must NOT
      // be a fresh ISO string from this call. The store uses `set` and
      // returns `{}` for no-ops, so tableCardLastEditedAt is whatever
      // it was previously (null on a fresh setup).
      expect(s.tableCardLastEditedAt).toBeNull();
    });

    it('no-op at bottom boundary when ↓ (idx === length-1 in sorted order)', () => {
      withElements([
        { ...textEl, id: 'a', zIndex: 0 },
        { ...textEl, id: 'b', zIndex: 1 },
        { ...textEl, id: 'c', zIndex: 2 },
      ]);

      useCardBuilderStore.getState().reorderTableCardElement('a', 'down');

      expect(panelOrder()).toEqual(['c', 'b', 'a']);
      expect(useCardBuilderStore.getState().tableCardLastEditedAt).toBeNull();
    });

    it('every successful click moves the element by exactly one visual position (regression — 2026-09-27)', () => {
      // Reproduces the original bug: with zIndex gaps (e.g. [0,1,3,4]
      // from deleting element at zIndex=2), the previous integer-arithmetic
      // implementation could produce 0-position or 2-position jumps
      // because it operated on raw zIndex integers instead of sorted
      // panel neighbors.
      //
      // The new swap-with-neighbor logic operates on the sorted panel
      // order, so it correctly:
      //   - Skips zIndex gaps without leaving the element stuck
      //   - Resolves zIndex collisions via the swap (both elements take
      //     each other's slot)
      //
      // The test walks the bottom element ('a') up the entire panel,
      // asserting the panel order after each click.
      withElements([
        { ...textEl, id: 'a', zIndex: 0 },
        { ...textEl, id: 'b', zIndex: 1 },
        { ...textEl, id: 'c', zIndex: 3 }, // gap at zIndex=2
        { ...textEl, id: 'd', zIndex: 4 },
      ]);
      expect(panelOrder()).toEqual(['d', 'c', 'b', 'a']);

      // Step 1 — ↑ on bottom 'a' → swap with 'b' (immediate neighbor)
      useCardBuilderStore.getState().reorderTableCardElement('a', 'up');
      expect(panelOrder()).toEqual(['d', 'c', 'a', 'b']);

      // Step 2 — ↑ on new bottom 'b' → swap back with 'a'
      useCardBuilderStore.getState().reorderTableCardElement('b', 'up');
      expect(panelOrder()).toEqual(['d', 'c', 'b', 'a']);

      // Step 3 — ↑ on 'a' (bottom) → swap with 'b' (NOT skip the gap)
      // This is exactly the previous bug: integer arithmetic would
      // have moved 'a' to zIndex=2 (the gap slot) producing a visible
      // 0-position jump. The swap-with-neighbor instead moves 'a' one
      // row up by swapping with its immediate neighbor 'b'.
      useCardBuilderStore.getState().reorderTableCardElement('a', 'up');
      expect(panelOrder()).toEqual(['d', 'c', 'a', 'b']);

      // Step 4 — ↑ on 'a' (now 3rd slot) → swap with 'c' (skipping the
      // gap in zIndex). The swap is on sorted-panel neighbors, NOT on
      // zIndex integers, so the gap is correctly handled.
      useCardBuilderStore.getState().reorderTableCardElement('a', 'up');
      expect(panelOrder()).toEqual(['d', 'a', 'c', 'b']);

      // Step 5 — ↑ on 'a' (now 2nd slot) → swap with 'd'
      useCardBuilderStore.getState().reorderTableCardElement('a', 'up');
      expect(panelOrder()).toEqual(['a', 'd', 'c', 'b']);

      // Step 6 — ↑ on 'a' (top of panel) → no-op
      useCardBuilderStore.getState().reorderTableCardElement('a', 'up');
      expect(panelOrder()).toEqual(['a', 'd', 'c', 'b']);
    });

    it('unknown direction value is a no-op', () => {
      // Defensive: forward-compatible API guard. If a caller passes
      // a typo (e.g. 'UP', 'left', undefined), the store must not
      // mutate state.
      withElements([
        { ...textEl, id: 'a', zIndex: 0 },
        { ...textEl, id: 'b', zIndex: 1 },
      ]);
      // Cast to bypass TS narrowing for the test; the runtime guard
      // should still reject it.
      useCardBuilderStore
        .getState()
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .reorderTableCardElement('a', 'sideways' as any);
      expect(panelOrder()).toEqual(['b', 'a']);
    });

    it('flips exportState from ready to stale on successful swap', () => {
      const now = new Date().toISOString();
      withElements([
        { ...textEl, id: 'a', zIndex: 0 },
        { ...textEl, id: 'b', zIndex: 1 },
      ]);
      useCardBuilderStore.getState().setTableCardExport('key', now);
      expect(useCardBuilderStore.getState().tableCardExportState).toBe('ready');

      useCardBuilderStore.getState().reorderTableCardElement('a', 'up');
      expect(useCardBuilderStore.getState().tableCardExportState).toBe('stale');
    });
  });

  /**
   * Round 5 — normalizeZIndex conformance tests.
   *
   * Validates the fix for the "element stuck at same panel slot" bug:
   * the previous `if (currentZ === neighborZ) return {}` guard silently
   * no-op'd when two adjacent elements shared a zIndex (legacy data,
   * race conditions, or Round 3 integer-arithmetic leftovers). The
   * Round 5 fix renumbers all zIndex values to be unique contiguous
   * [0, n-1] after every mutation (add / remove / reorder / load),
   * making the bug impossible to express.
   *
   * Each test below asserts:
   *   1. The operation succeeded (no silent no-op)
   *   2. Post-op zIndex values are unique contiguous [0, n-1]
   *   3. Panel order (sort DESC) is preserved
   */
  describe('Round 5 — normalizeZIndex conformance', () => {
    function withElements(elements: TableCardElement[]) {
      useCardBuilderStore.setState({
        tableCard: { ...baseSettings, elements },
      });
    }

    function zIndexValues(): number[] {
      return useCardBuilderStore
        .getState()
        .tableCard.elements.map((el) => el.zIndex)
        .sort((a, b) => a - b);
    }

    function expectZIndexContiguous(): void {
      const z = zIndexValues();
      expect(z.length).toBeGreaterThan(0);
      expect(z[0]).toBe(0);
      expect(z[z.length - 1]).toBe(z.length - 1);
      // All unique
      const set = new Set(z);
      expect(set.size).toBe(z.length);
    }

    it('every successful click moves the element by exactly one visual position when adjacent zIndex are duplicated (regression — 2026-09-27, Round 5)', () => {
      // Direct reproduction of the user-reported bug: seed two
      // elements with the SAME zIndex (legacy / hand-edited data).
      // Pre-Round-5, the `currentZ === neighborZ` guard would
      // silently no-op and leave the user staring at a stuck element.
      // Post-Round-5, reorderTableCardElement runs normalizeZIndex
      // internally, which collapses duplicates to [0, 1] and produces
      // a clean one-position move.
      //
      // Seed ordering matters: we put idA LAST in the array so the
      // stable sort (zIndex DESC, ties by insertion order) puts idA
      // at panel position 1 (bottom). Then `↑` moves it one slot up
      // (idA → 0, idB → 1).
      const idA = '11111111-1111-1111-1111-11111111111a';
      const idB = '11111111-1111-1111-1111-11111111111b';
      withElements([
        { ...textEl, id: idB, zIndex: 5 },
        { ...textEl, id: idA, zIndex: 5 }, // ← DUPLICATE (intentional)
      ]);

      // Verify the seed really does have duplicates (sanity check).
      const seedEls = useCardBuilderStore.getState().tableCard.elements;
      expect(seedEls.find((e) => e.id === idA)?.zIndex).toBe(5);
      expect(seedEls.find((e) => e.id === idB)?.zIndex).toBe(5);

      // Press ↑ on idA (panel-bottom in stable-sort order).
      useCardBuilderStore.getState().reorderTableCardElement(idA, 'up');

      const afterEls = useCardBuilderStore.getState().tableCard.elements;
      // Post-op, zIndex values must be unique contiguous.
      const z = afterEls.map((el) => el.zIndex).sort((a, b) => a - b);
      expect(z).toEqual([0, 1]);
      // And idA must have moved above idB in panel order (sort DESC).
      const panelOrder = [...afterEls].sort((a, b) => b.zIndex - a.zIndex).map((e) => e.id);
      expect(panelOrder[0]).toBe(idA);
      expect(panelOrder[1]).toBe(idB);
    });

    it('normalizeZIndex is applied on addTableCardElement (new element gets unique zIndex)', () => {
      // Seed: two elements with non-contiguous / colliding zIndex.
      // addTableCardElement runs normalizeZIndex on the new array, so
      // all elements (including the new one) end up with unique
      // contiguous zIndex values.
      withElements([
        { ...textEl, id: 'a', zIndex: 7 },
        { ...textEl, id: 'b', zIndex: 7 }, // duplicate
      ]);

      // Add a third element with an arbitrary zIndex (will be
      // normalized away — only the position in the sorted order
      // matters post-normalize).
      useCardBuilderStore
        .getState()
        .addTableCardElement({ ...textEl, id: 'c', zIndex: 999 });

      // 3 elements → zIndex values should be [0, 1, 2] (unique contiguous).
      expectZIndexContiguous();
      expect(useCardBuilderStore.getState().tableCard.elements).toHaveLength(3);
    });

    it('normalizeZIndex is applied on removeTableCardElement (remaining elements get renumbered)', () => {
      // Seed 4 elements with collision + gap.
      withElements([
        { ...textEl, id: 'a', zIndex: 0 },
        { ...textEl, id: 'b', zIndex: 0 }, // duplicate
        { ...textEl, id: 'c', zIndex: 5 }, // gap
        { ...textEl, id: 'd', zIndex: 10 }, // big gap
      ]);

      // Remove 'b'. The remaining 3 should be renumbered to [0, 1, 2].
      useCardBuilderStore.getState().removeTableCardElement('b');

      const remaining = useCardBuilderStore.getState().tableCard.elements;
      expect(remaining).toHaveLength(3);
      expect(remaining.find((e) => e.id === 'b')).toBeUndefined();
      expectZIndexContiguous();
    });

    it('normalizeZIndex is applied on reorderTableCardElement (post-swap values are contiguous)', () => {
      // Seed with a collision so post-reorder zIndex values are
      // unambiguously unique (not coincidentally so).
      withElements([
        { ...textEl, id: 'a', zIndex: 3 },
        { ...textEl, id: 'b', zIndex: 3 }, // duplicate
        { ...textEl, id: 'c', zIndex: 5 },
      ]);

      // Pre-condition: normalize should already be applied (the seed
      // pattern above shouldn't survive the setState() call — wait, we
      // bypassed addTableCardElement by using setState directly, so
      // the seed retains its collision). The reorderTableCardElement
      // path must then re-normalize.
      //
      // Reorder 'a' up. After the swap, normalize should re-number
      // all zIndex to [0, 1, 2].
      useCardBuilderStore.getState().reorderTableCardElement('a', 'up');
      expectZIndexContiguous();
    });

    it('normalizeZIndex is applied on loadSettings (legacy duplicate zIndex gets fixed)', () => {
      // Simulate legacy / corrupted data: 3 elements with duplicate
      // zIndex values that would have broken the Round 4 swap guard.
      // Note: the zod schema requires `id` to be a UUID, so we seed
      // with proper UUID-formatted IDs.
      useCardBuilderStore.getState().loadSettings({
        tableCard: {
          elements: [
            { ...textEl, id: '11111111-1111-1111-1111-11111111111a', zIndex: 5 },
            { ...textEl, id: '11111111-1111-1111-1111-11111111111b', zIndex: 5 }, // duplicate
            { ...textEl, id: '11111111-1111-1111-1111-11111111111c', zIndex: 5 }, // triple collision
          ],
          background: { type: 'solid', color: '#ffffff' },
          bleedMm: 3,
        },
      });

      // loadSettings runs normalizeZIndex after hydrate.
      const elements = useCardBuilderStore.getState().tableCard.elements;
      expect(elements).toHaveLength(3);
      expectZIndexContiguous();
    });

    it('normalizeZIndex preserves panel order (sort DESC matches pre-normalize sort DESC)', () => {
      // Normalize must be order-preserving for already-correct input:
      // a panel that's already [a(0), b(1), c(2)] should keep the same
      // panel order after normalize, just with possibly-renumbered
      // zIndex values.
      withElements([
        { ...textEl, id: 'a', zIndex: 0 },
        { ...textEl, id: 'b', zIndex: 1 },
        { ...textEl, id: 'c', zIndex: 2 },
      ]);

      const panelBefore = useCardBuilderStore
        .getState()
        .tableCard.elements.sort((a, b) => b.zIndex - a.zIndex)
        .map((e) => e.id);

      // Trigger normalize via add (a no-op-add of a 4th element that
      // gets dropped by the MAX guard) — actually, simpler: just
      // re-add an existing element via setState-like path. Use
      // updateTableCardElement which doesn't normalize, then add a
      // trivial element to force normalize.
      //
      // Simpler: just call addTableCardElement and then remove it —
      // both ops normalize the post-array, which is the contract we're
      // testing.
      useCardBuilderStore
        .getState()
        .addTableCardElement({ ...textEl, id: 'tmp', zIndex: 99 });
      useCardBuilderStore.getState().removeTableCardElement('tmp');

      const panelAfter = useCardBuilderStore
        .getState()
        .tableCard.elements.sort((a, b) => b.zIndex - a.zIndex)
        .map((e) => e.id);

      expect(panelAfter).toEqual(panelBefore);
      expect(panelAfter).toEqual(['c', 'b', 'a']);
      expectZIndexContiguous();
    });
  });

  describe('setTableCardBleed', () => {
    it('accepts valid bleed values (3/5/10)', () => {
      [3, 5, 10].forEach((mm) => {
        useCardBuilderStore.getState().setTableCardBleed(mm as 3 | 5 | 10);
        expect(useCardBuilderStore.getState().tableCard.bleedMm).toBe(mm);
      });
    });

    it('refuses invalid bleed values (1, 7, 100)', () => {
      [1, 7, 100].forEach((mm) => {
        useCardBuilderStore.getState().setTableCardBleed(mm as unknown as 3 | 5 | 10);
        // Stays at the last valid value (3 from initial state)
        expect([3, 5, 10]).toContain(useCardBuilderStore.getState().tableCard.bleedMm);
      });
    });
  });

  describe('setTableCardBackground', () => {
    it('accepts solid background', () => {
      useCardBuilderStore.getState().setTableCardBackground({
        type: 'solid',
        color: '#ff0000',
      });
      expect(useCardBuilderStore.getState().tableCard.background).toEqual({
        type: 'solid',
        color: '#ff0000',
      });
    });

    it('accepts gradient background', () => {
      useCardBuilderStore.getState().setTableCardBackground({
        type: 'gradient',
        gradient: { from: '#000000', to: '#ffffff', angle: 45 },
      });
      expect(useCardBuilderStore.getState().tableCard.background.type).toBe('gradient');
    });
  });

  describe('5-state export machine', () => {
    it('idle → ready via setTableCardExport', () => {
      const now = new Date().toISOString();
      useCardBuilderStore.getState().setTableCardExport('some/r2/key.png', now);
      const s = useCardBuilderStore.getState();
      expect(s.tableCard.exportKey).toBe('some/r2/key.png');
      expect(s.tableCard.lastExportedAt).toBe(now);
      expect(s.tableCardLastExportedAt).toBe(now);
      expect(s.tableCardExportState).toBe('ready');
      expect(s.tableCardExportError).toBeNull();
    });

    it('ready → stale when canvas is edited', () => {
      const now = new Date().toISOString();
      useCardBuilderStore.getState().setTableCardExport('key', now);
      expect(useCardBuilderStore.getState().tableCardExportState).toBe('ready');
      // Now edit (add element)
      useCardBuilderStore.getState().addTableCardElement(textEl);
      expect(useCardBuilderStore.getState().tableCardExportState).toBe('stale');
    });

    it('stale → ready via re-export (setTableCardExport)', () => {
      const now = new Date().toISOString();
      useCardBuilderStore.getState().setTableCardExport('key1', now);
      useCardBuilderStore.getState().addTableCardElement(textEl);
      expect(useCardBuilderStore.getState().tableCardExportState).toBe('stale');
      useCardBuilderStore.getState().setTableCardExport('key2', new Date().toISOString());
      expect(useCardBuilderStore.getState().tableCardExportState).toBe('ready');
    });

    it('idle → error via setTableCardExportState', () => {
      useCardBuilderStore.getState().setTableCardExportState('error', 'tableCard.errors.networkError');
      expect(useCardBuilderStore.getState().tableCardExportState).toBe('error');
      expect(useCardBuilderStore.getState().tableCardExportError).toBe(
        'tableCard.errors.networkError',
      );
    });

    it('error → ready via successful setTableCardExport (clears error)', () => {
      useCardBuilderStore.getState().setTableCardExportState('error', 'some-key');
      useCardBuilderStore.getState().setTableCardExport('key', new Date().toISOString());
      expect(useCardBuilderStore.getState().tableCardExportError).toBeNull();
      expect(useCardBuilderStore.getState().tableCardExportState).toBe('ready');
    });
  });

  describe('setTableCard (zod validation)', () => {
    it('accepts a valid payload and replaces state', () => {
      const payload: TableCardSettings = {
        elements: [{ ...textEl, zIndex: 0 }],
        background: {
          type: 'gradient',
          gradient: { from: '#000000', to: '#ffffff', angle: 0 },
        },
        bleedMm: 5,
      };
      useCardBuilderStore.getState().setTableCard(payload);
      const s = useCardBuilderStore.getState();
      expect(s.tableCard.elements).toHaveLength(1);
      expect(s.tableCard.bleedMm).toBe(5);
      expect(s.tableCard.background.type).toBe('gradient');
    });

    it('rejects invalid payload (keeps current state)', () => {
      useCardBuilderStore.getState().setTableCardBleed(5);
      const before = useCardBuilderStore.getState().tableCard;
      // Invalid: bleedMm=7 not in 3/5/10
      useCardBuilderStore.getState().setTableCard({
        elements: [],
        background: { type: 'solid', color: '#fff' },
        bleedMm: 7 as unknown as 3,
      });
      const after = useCardBuilderStore.getState().tableCard;
      expect(after).toBe(before); // same reference, no change
    });
  });

  describe('loadSettings', () => {
    it('hydrates tableCard + lastExportedAt from server payload', () => {
      const payload = {
        tableCard: {
          elements: [{ ...textEl, zIndex: 0 }],
          background: { type: 'solid', color: '#000000' },
          bleedMm: 5 as const,
          exportKey: 'r2/key.png',
          lastExportedAt: '2026-09-27T10:00:00.000Z',
        },
      };
      useCardBuilderStore.getState().loadSettings(payload);
      const s = useCardBuilderStore.getState();
      expect(s.tableCard.elements).toHaveLength(1);
      expect(s.tableCard.bleedMm).toBe(5);
      expect(s.tableCard.exportKey).toBe('r2/key.png');
      expect(s.tableCardLastExportedAt).toBe('2026-09-27T10:00:00.000Z');
    });

    it('keeps current state on invalid payload (defensive)', () => {
      useCardBuilderStore.getState().setTableCardBleed(5);
      const before = useCardBuilderStore.getState().tableCard;
      // Invalid: text element with invalid color
      useCardBuilderStore.getState().loadSettings({
        tableCard: {
          elements: [{ ...textEl, color: 'not-hex' }],
          background: { type: 'solid' },
          bleedMm: 3,
        },
      });
      expect(useCardBuilderStore.getState().tableCard).toBe(before);
    });
  });

  describe('reset', () => {
    it('clears all tableCard state', () => {
      useCardBuilderStore.getState().addTableCardElement(textEl);
      useCardBuilderStore.getState().setTableCardExport('key', new Date().toISOString());
      useCardBuilderStore.getState().setTableCardExportState('error', 'some-key');
      useCardBuilderStore.getState().reset();
      const s = useCardBuilderStore.getState();
      expect(s.tableCard.elements).toEqual([]);
      expect(s.tableCardExportState).toBe('idle');
      expect(s.tableCardExportError).toBeNull();
      expect(s.tableCardLastEditedAt).toBeNull();
      expect(s.tableCardLastExportedAt).toBeNull();
    });
  });
});
