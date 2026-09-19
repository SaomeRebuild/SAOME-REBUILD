/**
 * CouponDiscountPercentField — Vitest + RTL Tests (Rule 003 TDD)
 *
 * Verifies:
 *   - Conditional render: only shown when couponDiscountType === 'percent_off'
 *   - Store guard: null allowed, integer ∈ [1, 100] accepted, others rejected
 *   - Validation: showValidation=true + invalid → red border + error
 */

import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { CouponDiscountPercentField } from './CouponDiscountPercentField';
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

describe('CouponDiscountPercentField — conditional render + guard', () => {
  it('renders nothing when couponDiscountType !== percent_off', () => {
    useCardBuilderStore.setState({ couponDiscountType: 'amount_off' });
    const { container } = render(<CouponDiscountPercentField showValidation={false} />);
    expect(container.firstChild).toBeNull();
  });

  it('renders input + % unit suffix when couponDiscountType === percent_off', () => {
    useCardBuilderStore.setState({ couponDiscountType: 'percent_off' });
    render(<CouponDiscountPercentField showValidation={false} />);
    expect(screen.getByLabelText('step6.coupon.percentTitle')).toBeInTheDocument();
    expect(screen.getByText('step6.coupon.percentUnit')).toBeInTheDocument();
  });

  it('typing a valid integer (e.g. 25) writes to the store', () => {
    useCardBuilderStore.setState({ couponDiscountType: 'percent_off' });
    render(<CouponDiscountPercentField showValidation={false} />);
    const input = screen.getByLabelText('step6.coupon.percentTitle') as HTMLInputElement;
    fireEvent.change(input, { target: { value: '25' } });
    expect(useCardBuilderStore.getState().couponDiscountPercent).toBe(25);
  });

  it('typing 0 is rejected by store (≥ 1 required)', () => {
    useCardBuilderStore.setState({ couponDiscountType: 'percent_off' });
    render(<CouponDiscountPercentField showValidation={false} />);
    const input = screen.getByLabelText('step6.coupon.percentTitle') as HTMLInputElement;
    fireEvent.change(input, { target: { value: '0' } });
    expect(useCardBuilderStore.getState().couponDiscountPercent).toBe(null);
  });

  it('typing 101 is rejected by store (> 100 not allowed)', () => {
    useCardBuilderStore.setState({ couponDiscountType: 'percent_off' });
    render(<CouponDiscountPercentField showValidation={false} />);
    const input = screen.getByLabelText('step6.coupon.percentTitle') as HTMLInputElement;
    fireEvent.change(input, { target: { value: '101' } });
    expect(useCardBuilderStore.getState().couponDiscountPercent).toBe(null);
  });

  it('typing 100 is accepted (upper bound inclusive)', () => {
    useCardBuilderStore.setState({ couponDiscountType: 'percent_off' });
    render(<CouponDiscountPercentField showValidation={false} />);
    const input = screen.getByLabelText('step6.coupon.percentTitle') as HTMLInputElement;
    fireEvent.change(input, { target: { value: '100' } });
    expect(useCardBuilderStore.getState().couponDiscountPercent).toBe(100);
  });

  it('clearing the input sets store to null', () => {
    useCardBuilderStore.setState({
      couponDiscountType: 'percent_off',
      couponDiscountPercent: 25,
    });
    render(<CouponDiscountPercentField showValidation={false} />);
    const input = screen.getByLabelText('step6.coupon.percentTitle') as HTMLInputElement;
    fireEvent.change(input, { target: { value: '' } });
    expect(useCardBuilderStore.getState().couponDiscountPercent).toBe(null);
  });

  it('showValidation=true + null value → error message "required"', () => {
    useCardBuilderStore.setState({ couponDiscountType: 'percent_off' });
    render(<CouponDiscountPercentField showValidation={true} />);
    expect(screen.getByText('step6.coupon.percentRequiredError')).toBeInTheDocument();
  });

  it('showValidation=true + value 0 (forced via store) → error "invalid"', () => {
    // The store would normally reject 0 from input. We force it here to verify
    // the field-level validation flag catches invalid values regardless.
    useCardBuilderStore.setState({
      couponDiscountType: 'percent_off',
      couponDiscountPercent: 0,
    });
    render(<CouponDiscountPercentField showValidation={true} />);
    expect(screen.getByText('step6.coupon.percentInvalidError')).toBeInTheDocument();
  });

  it('showValidation=false does NOT show any error', () => {
    useCardBuilderStore.setState({ couponDiscountType: 'percent_off' });
    render(<CouponDiscountPercentField showValidation={false} />);
    expect(
      screen.queryByText('step6.coupon.percentRequiredError'),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByText('step6.coupon.percentInvalidError'),
    ).not.toBeInTheDocument();
  });
});
