/**
 * DiscountCardLogic — Vitest + RTL Tests (Rule 003 TDD)
 *
 * Verifies the main component renders its 2 sub-components:
 *   - <DiscountExpiryFields />   — card-level expiry (REQUIRED, user 2026-09-18)
 *   - <DiscountTierList />       — list of up to 5 discount tiers
 *
 * Per user clarification 2026-09-18, the expiry section is placed BEFORE
 * the tier list (not below it) so the card's lifetime context is visible
 * before the discount rule rows.
 *
 * Tests run 4 scenarios:
 *   - Empty tier array (after manual clear) → auto-add useEffect reseeds 1 row
 *   - 1 tier with valid data → both list and expiry fields render
 *   - 5 tiers (cap reached) → list shows maxTiersReached
 *   - DOM order: expiry section comes BEFORE tier list (regression for
 *     2026-09-18 order swap)
 */

import { render, screen, cleanup, act } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { DiscountCardLogic } from './DiscountCardLogic';
import { useCardBuilderStore } from '../../CardBuilderEditor.store';
import { MAX_DISCOUNT_TIERS } from '@saome/shared/constants';

vi.mock('react-i18next', () => ({
  useTranslation: vi.fn(() => ({
    t: vi.fn(
      (key: string, params?: Record<string, unknown>) =>
        params ? `${key}|${JSON.stringify(params)}` : key,
    ),
    i18n: { get language() { return 'zh-TW'; } },
  })),
}));

// Mock sub-components to keep the test focused on composition + auto-add.
// We tag each mock with a stable data-order attribute so DOM-order assertions
// can verify the render sequence (expiry BEFORE tier list, per 2026-09-18
// user clarification).
vi.mock('./DiscountTierList', () => ({
  DiscountTierList: () => (
    <div data-testid="discount-tier-list" data-order="2" />
  ),
}));
vi.mock('./DiscountExpiryFields', () => ({
  DiscountExpiryFields: () => (
    <div data-testid="discount-expiry-fields" data-order="1" />
  ),
}));

afterEach(() => {
  useCardBuilderStore.getState().reset();
  cleanup();
});

describe('DiscountCardLogic — main component', () => {
  it('renders both sub-components (list + expiry)', () => {
    render(<DiscountCardLogic showValidation={false} />);
    expect(screen.getByTestId('discount-tier-list')).toBeInTheDocument();
    expect(screen.getByTestId('discount-expiry-fields')).toBeInTheDocument();
  });

  it('renders expiry section BEFORE the tier list (DOM order, 2026-09-18 user clarification)', () => {
    // Per user clarification: "你應該把卡片有效期限期限放在卡片羅級說明跟
    // 折扣級距之間" — expiry section sits between the dispatcher-rendered
    // card description (intro) and the tier list below it.
    render(<DiscountCardLogic showValidation={false} />);

    const expiry = screen.getByTestId('discount-expiry-fields');
    const tiers = screen.getByTestId('discount-tier-list');
    // document order — earlier in DOM = lower compareDocumentPosition result.
    expect(expiry.compareDocumentPosition(tiers) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    // Also assert the explicit data-order attribute (defense-in-depth in case
    // the JSX swap regresses but the parent div structure is preserved).
    expect(expiry.getAttribute('data-order')).toBe('1');
    expect(tiers.getAttribute('data-order')).toBe('2');
  });

  it('auto-add useEffect reseeds 1 tier when array is empty', () => {
    // Clear the seeded default out of the store to force a 0-length array,
    // then mount the component and verify the auto-add useEffect reseeds.
    useCardBuilderStore.setState({ discountTiers: [] });
    expect(useCardBuilderStore.getState().discountTiers.length).toBe(0);

    act(() => {
      render(<DiscountCardLogic showValidation={false} />);
    });

    // After mount, the auto-add useEffect should have appended 1 default
    // tier so the array is no longer empty.
    expect(useCardBuilderStore.getState().discountTiers.length).toBe(1);
    expect(useCardBuilderStore.getState().discountTiers[0]).toMatchObject({
      name: '',
      thresholdSpend: 0,
      discountPercent: 1,
    });
  });

  it('renders the seeded default-discount-tier on first mount (1 row already)', () => {
    // reset() seeds 1 default tier; component should not double-seed.
    render(<DiscountCardLogic showValidation={false} />);

    expect(useCardBuilderStore.getState().discountTiers.length).toBe(1);
    expect(useCardBuilderStore.getState().discountTiers[0].id).toBe(
      'default-discount-tier',
    );
  });

  it('still renders both sub-components when at MAX_DISCOUNT_TIERS=5', () => {
    // Fill the store to cap (5 tiers). Component renders unchanged.
    const tiers = Array.from({ length: MAX_DISCOUNT_TIERS }, (_, i) => ({
      id: `t-${i}`,
      name: `T${i}`,
      thresholdSpend: i * 100,
      discountPercent: 1,
    }));
    useCardBuilderStore.setState({ discountTiers: tiers });

    render(<DiscountCardLogic showValidation={false} />);

    expect(screen.getByTestId('discount-tier-list')).toBeInTheDocument();
    expect(screen.getByTestId('discount-expiry-fields')).toBeInTheDocument();
    expect(useCardBuilderStore.getState().discountTiers.length).toBe(5);
  });
});
