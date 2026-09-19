/**
 * CouponDiscountTypeField — Vitest + RTL Tests (Rule 003 TDD)
 *
 * Verifies the 2-option radio group:
 *   - amount_off | percent_off
 *   - Switching type clears the corresponding other value field (store setter).
 *   - Pattern A: `.radio-card-primary` + `.radio-card-fill` classes drive visuals
 *     via CSS `:has(:checked)` rule (no React conditional).
 */

import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { CouponDiscountTypeField } from './CouponDiscountTypeField';
import { useCardBuilderStore } from '../../CardBuilderEditor.store';

vi.mock('react-i18next', () => ({
  useTranslation: vi.fn(() => ({
    t: vi.fn((key: string) => key),
    i18n: { get language() { return 'zh-TW'; } },
  })),
}));

afterEach(() => {
  useCardBuilderStore.getState().reset();
  cleanup();
});

describe('CouponDiscountTypeField — radio group', () => {
  it('renders 2 radio options with i18n labels (amount_off + percent_off)', () => {
    render(<CouponDiscountTypeField showValidation={false} />);

    // Both options rendered with i18n keys
    expect(screen.getByText('step6.coupon.discountTypeAmount')).toBeInTheDocument();
    expect(screen.getByText('step6.coupon.discountTypePercent')).toBeInTheDocument();
  });

  it('defaults to amount_off (per user decision 2026-09-19)', () => {
    render(<CouponDiscountTypeField showValidation={false} />);

    const amountRadio = screen.getByDisplayValue('amount_off') as HTMLInputElement;
    const percentRadio = screen.getByDisplayValue('percent_off') as HTMLInputElement;
    expect(amountRadio.checked).toBe(true);
    expect(percentRadio.checked).toBe(false);
  });

  it('selecting percent_off sets couponDiscountType to percent_off', () => {
    render(<CouponDiscountTypeField showValidation={false} />);

    const percentRadio = screen.getByDisplayValue('percent_off');
    fireEvent.click(percentRadio);

    expect(useCardBuilderStore.getState().couponDiscountType).toBe('percent_off');
  });

  it('switching type clears the other value field (mutual exclusion, store setter)', () => {
    // Pre-fill couponDiscountAmount, then switch to percent_off → amount should clear.
    useCardBuilderStore.setState({
      couponDiscountType: 'amount_off',
      couponDiscountAmount: 50,
    });
    render(<CouponDiscountTypeField showValidation={false} />);

    const percentRadio = screen.getByDisplayValue('percent_off');
    fireEvent.click(percentRadio);

    const state = useCardBuilderStore.getState();
    expect(state.couponDiscountType).toBe('percent_off');
    expect(state.couponDiscountAmount).toBe(null); // cleared
    // couponDiscountPercent unchanged (still null)
    expect(state.couponDiscountPercent).toBe(null);
  });

  it('switching back to amount_off clears couponDiscountPercent', () => {
    useCardBuilderStore.setState({
      couponDiscountType: 'percent_off',
      couponDiscountPercent: 20,
    });
    render(<CouponDiscountTypeField showValidation={false} />);

    const amountRadio = screen.getByDisplayValue('amount_off');
    fireEvent.click(amountRadio);

    const state = useCardBuilderStore.getState();
    expect(state.couponDiscountType).toBe('amount_off');
    expect(state.couponDiscountPercent).toBe(null); // cleared
    expect(state.couponDiscountAmount).toBe(null); // unchanged
  });

  it('label containers carry the radio-card-primary class (Pattern A — CSS :has(:checked) drives visuals)', () => {
    const { container } = render(<CouponDiscountTypeField showValidation={false} />);
    const labels = container.querySelectorAll('label.radio-card-primary');
    expect(labels.length).toBe(2); // amount_off + percent_off
  });

  it('indicator spans carry the radio-card-fill class (CSS selector flips fill on :has(:checked))', () => {
    const { container } = render(<CouponDiscountTypeField showValidation={false} />);
    const fills = container.querySelectorAll('span.radio-card-fill');
    expect(fills.length).toBe(2);
  });

  it('does NOT show validation error when type is selected (default amount_off)', () => {
    render(<CouponDiscountTypeField showValidation={true} />);
    expect(
      screen.queryByText('step6.coupon.discountTypeRequiredError'),
    ).not.toBeInTheDocument();
  });
});
