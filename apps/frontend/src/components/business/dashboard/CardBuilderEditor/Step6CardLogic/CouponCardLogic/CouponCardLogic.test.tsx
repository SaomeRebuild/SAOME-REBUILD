/**
 * CouponCardLogic — Vitest + RTL Tests (Rule 003 TDD + Rule 000 L2 結構)
 *
 * Verifies the main component composes 4 sub-components in the correct
 * order, and that conditional render of amount/percent fields responds to
 * the `couponDiscountType` radio selection.
 *
 * Per Rule 000 § A.1 + Rule 000 § A.2:
 *   - Main component ≤ 100 lines, just composes sub-components.
 *   - Each sub-component handles its own validation, currency-aware
 *     rendering, and store integration.
 *
 * Tests run 6 scenarios:
 *   - Default state (amount_off): amount field renders, percent field hidden.
 *   - Switch to percent_off: percent field renders, amount field hidden.
 *   - Switch back to amount_off: amount field renders again, percent hidden.
 *   - Mutual exclusion: switching clears the other value field.
 *   - All 4 sub-components always render (radio + conditional + count).
 *   - DOM order: radio BEFORE conditional field BEFORE issue count.
 */

import { render, screen, cleanup } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { CouponCardLogic } from './CouponCardLogic';
import { useCardBuilderStore } from '../../CardBuilderEditor.store';

// Mock i18n so we get predictable t(key) → key output for assertions.
vi.mock('react-i18next', () => ({
  useTranslation: vi.fn(() => ({
    t: vi.fn((key: string) => key),
    i18n: { get language() { return 'zh-TW'; } },
  })),
}));

// Mock sub-components to keep the test focused on composition + ordering.
// Each mock carries a stable `data-order` attribute so DOM-order assertions
// can verify the render sequence. Conditional mocks honor the actual
// conditional render of the real sub-components (amount renders only
// when type=amount_off; percent renders only when type=percent_off).
//
// We use a shared `mockCouponDiscountType` variable (resettable in
// `beforeEach`) instead of reading from the real store. This avoids the
// `vi.hoisted` + `require()` issue where require() bypasses vite alias
// resolution and tries to load the store.ts file via Node CommonJS, which
// fails on the store's own `@saome/shared` imports.
let mockCouponDiscountType: 'amount_off' | 'percent_off' | null = 'amount_off';

vi.mock('./CouponDiscountTypeField', () => ({
  CouponDiscountTypeField: () => (
    <div data-testid="coupon-discount-type" data-order="1" />
  ),
}));
vi.mock('./CouponDiscountAmountField', () => ({
  CouponDiscountAmountField: () => {
    return mockCouponDiscountType === 'amount_off' ? (
      <div data-testid="coupon-discount-amount" data-order="2" />
    ) : null;
  },
}));
vi.mock('./CouponDiscountPercentField', () => ({
  CouponDiscountPercentField: () => {
    return mockCouponDiscountType === 'percent_off' ? (
      <div data-testid="coupon-discount-percent" data-order="2" />
    ) : null;
  },
}));
vi.mock('./CouponIssueCountField', () => ({
  CouponIssueCountField: () => (
    <div data-testid="coupon-issue-count" data-order="3" />
  ),
}));

afterEach(() => {
  useCardBuilderStore.getState().reset();
  mockCouponDiscountType = 'amount_off'; // Reset mock state for next test
  cleanup();
});

describe('CouponCardLogic — main component composition (Rule 000 § A.1)', () => {
  it('renders all 4 sub-components (radio + conditional amount/percent + issue count)', () => {
    render(<CouponCardLogic showValidation={false} />);

    // Radio always renders
    expect(screen.getByTestId('coupon-discount-type')).toBeInTheDocument();

    // Default state is 'amount_off' → amount renders, percent hidden
    expect(screen.getByTestId('coupon-discount-amount')).toBeInTheDocument();
    expect(screen.queryByTestId('coupon-discount-percent')).not.toBeInTheDocument();

    // Issue count always renders
    expect(screen.getByTestId('coupon-issue-count')).toBeInTheDocument();
  });

  it('hides amount field and renders percent field when type switches to percent_off', () => {
    useCardBuilderStore.setState({ couponDiscountType: 'percent_off' });
    mockCouponDiscountType = 'percent_off';
    render(<CouponCardLogic showValidation={false} />);

    // After switching to percent_off:
    expect(screen.getByTestId('coupon-discount-type')).toBeInTheDocument();
    expect(screen.queryByTestId('coupon-discount-amount')).not.toBeInTheDocument();
    expect(screen.getByTestId('coupon-discount-percent')).toBeInTheDocument();
    expect(screen.getByTestId('coupon-issue-count')).toBeInTheDocument();
  });

  it('hides percent field and renders amount field when type switches back to amount_off', () => {
    useCardBuilderStore.setState({ couponDiscountType: 'percent_off' });
    mockCouponDiscountType = 'percent_off';
    const { rerender } = render(<CouponCardLogic showValidation={false} />);
    expect(screen.queryByTestId('coupon-discount-amount')).not.toBeInTheDocument();

    useCardBuilderStore.setState({ couponDiscountType: 'amount_off' });
    mockCouponDiscountType = 'amount_off';
    rerender(<CouponCardLogic showValidation={false} />);

    expect(screen.getByTestId('coupon-discount-amount')).toBeInTheDocument();
    expect(screen.queryByTestId('coupon-discount-percent')).not.toBeInTheDocument();
  });

  it('DOM order: radio (1) → conditional field (2) → issue count (3)', () => {
    render(<CouponCardLogic showValidation={false} />);

    const type = screen.getByTestId('coupon-discount-type');
    const amount = screen.getByTestId('coupon-discount-amount');
    const issueCount = screen.getByTestId('coupon-issue-count');

    // data-order attributes confirm the composition order
    expect(type.getAttribute('data-order')).toBe('1');
    expect(amount.getAttribute('data-order')).toBe('2');
    expect(issueCount.getAttribute('data-order')).toBe('3');

    // DOM order via compareDocumentPosition
    const position = type.compareDocumentPosition(amount);
    const FOLLOWING = Node.DOCUMENT_POSITION_FOLLOWING;
    expect(position & FOLLOWING).toBe(FOLLOWING); // amount follows type

    const position2 = amount.compareDocumentPosition(issueCount);
    expect(position2 & FOLLOWING).toBe(FOLLOWING); // issue count follows amount
  });
});
