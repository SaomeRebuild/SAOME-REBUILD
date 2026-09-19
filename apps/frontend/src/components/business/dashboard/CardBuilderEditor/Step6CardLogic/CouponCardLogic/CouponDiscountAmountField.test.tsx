/**
 * CouponDiscountAmountField — Vitest + RTL Tests (Rule 003 TDD)
 *
 * Verifies:
 *   - Conditional render: only shown when couponDiscountType === 'amount_off'
 *   - Currency-aware unit placement (mirror CashbackTierThresholdField)
 *   - Store guard: null allowed, value ≥ 1 accepted, < 1 silently rejected
 *   - Validation: showValidation=true + null OR < 1 → red border + error
 */

import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { CouponDiscountAmountField } from './CouponDiscountAmountField';
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

describe('CouponDiscountAmountField — conditional render + currency', () => {
  it('renders nothing when couponDiscountType !== amount_off', () => {
    useCardBuilderStore.setState({ couponDiscountType: 'percent_off' });
    const { container } = render(<CouponDiscountAmountField showValidation={false} />);
    expect(container.firstChild).toBeNull();
  });

  it('renders input when couponDiscountType === amount_off', () => {
    render(<CouponDiscountAmountField showValidation={false} />);
    expect(screen.getByLabelText('step6.coupon.amountTitle')).toBeInTheDocument();
  });

  it('shows currency-aware unit suffix for TWD zh-TW (元 suffix)', () => {
    useCardBuilderStore.setState({ currency: 'TWD' });
    render(<CouponDiscountAmountField showValidation={false} />);
    // Both labels exist (amountUnitTWD used as both prefix/suffix label)
    expect(screen.getAllByText('step6.coupon.amountUnitTWD').length).toBeGreaterThan(0);
  });

  it('shows currency-aware unit prefix for ZAR (R prefix)', () => {
    useCardBuilderStore.setState({ currency: 'ZAR' });
    render(<CouponDiscountAmountField showValidation={false} />);
    expect(screen.getByText('step6.coupon.amountUnitZAR')).toBeInTheDocument();
  });

  it('typing a valid number writes to the store', () => {
    render(<CouponDiscountAmountField showValidation={false} />);
    const input = screen.getByLabelText('step6.coupon.amountTitle') as HTMLInputElement;
    fireEvent.change(input, { target: { value: '50' } });
    expect(useCardBuilderStore.getState().couponDiscountAmount).toBe(50);
  });

  it('typing 0 sets store to 0 but showValidation=true triggers error (≥ 1 required)', () => {
    render(<CouponDiscountAmountField showValidation={true} />);
    const input = screen.getByLabelText('step6.coupon.amountTitle') as HTMLInputElement;
    fireEvent.change(input, { target: { value: '0' } });
    // Store guard rejects < 1 → store stays at null
    expect(useCardBuilderStore.getState().couponDiscountAmount).toBe(null);
    expect(screen.getByText('step6.coupon.amountRequiredError')).toBeInTheDocument();
  });

  it('typing -10 is rejected by store (NaN / negative)', () => {
    render(<CouponDiscountAmountField showValidation={false} />);
    const input = screen.getByLabelText('step6.coupon.amountTitle') as HTMLInputElement;
    fireEvent.change(input, { target: { value: '-10' } });
    // -10 < 1 → store rejects, stays at null
    expect(useCardBuilderStore.getState().couponDiscountAmount).toBe(null);
  });

  it('clearing the input sets store to null', () => {
    useCardBuilderStore.setState({ couponDiscountAmount: 50 });
    render(<CouponDiscountAmountField showValidation={false} />);
    const input = screen.getByLabelText('step6.coupon.amountTitle') as HTMLInputElement;
    fireEvent.change(input, { target: { value: '' } });
    expect(useCardBuilderStore.getState().couponDiscountAmount).toBe(null);
  });

  it('large value is accepted (no upper cap per user decision 2026-09-19)', () => {
    render(<CouponDiscountAmountField showValidation={false} />);
    const input = screen.getByLabelText('step6.coupon.amountTitle') as HTMLInputElement;
    fireEvent.change(input, { target: { value: '999999' } });
    expect(useCardBuilderStore.getState().couponDiscountAmount).toBe(999999);
  });

  it('showValidation=true + null value → error message "required"', () => {
    render(<CouponDiscountAmountField showValidation={true} />);
    expect(screen.getByText('step6.coupon.amountRequiredError')).toBeInTheDocument();
  });

  it('showValidation=true + value < 1 → error message "invalid"', () => {
    // Bypass the setter via setState (the setter would reject < 1; here
    // we simulate a stale DB load that somehow surfaces an out-of-bounds
    // value). The field-level validation flag should still catch it.
    useCardBuilderStore.setState({ couponDiscountAmount: 0 });
    render(<CouponDiscountAmountField showValidation={true} />);
    // Value is 0 (not null), so the error message is "invalid" not "required".
    expect(useCardBuilderStore.getState().couponDiscountAmount).toBe(0);
    expect(screen.getByText('step6.coupon.amountInvalidError')).toBeInTheDocument();
  });

  it('showValidation=false does NOT show any error', () => {
    render(<CouponDiscountAmountField showValidation={false} />);
    expect(
      screen.queryByText('step6.coupon.amountRequiredError'),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByText('step6.coupon.amountInvalidError'),
    ).not.toBeInTheDocument();
  });
});
