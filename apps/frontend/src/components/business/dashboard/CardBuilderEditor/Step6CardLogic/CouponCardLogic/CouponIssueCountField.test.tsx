/**
 * CouponIssueCountField — Vitest + RTL Tests (Rule 003 TDD)
 *
 * Verifies:
 *   - Always renders (no conditional)
 *   - Store guard: integer ≥ 1 accepted, others rejected (no upper cap)
 *   - Validation: showValidation=true + invalid → red border + error
 *   - Helper text below input explains the ≥ 1 rule
 *   - Empty input does NOT clear store (always keep ≥ 1)
 */

import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { CouponIssueCountField } from './CouponIssueCountField';
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

describe('CouponIssueCountField — always rendered, ≥ 1 guard', () => {
  it('renders input + 張 unit suffix + helper text', () => {
    render(<CouponIssueCountField showValidation={false} />);
    expect(screen.getByLabelText('step6.coupon.issueCountTitle')).toBeInTheDocument();
    expect(screen.getByText('step6.coupon.issueCountUnit')).toBeInTheDocument();
    expect(screen.getByText('step6.coupon.issueCountHint')).toBeInTheDocument();
  });

  it('always renders regardless of couponDiscountType (no conditional)', () => {
    // amount_off (default)
    const { rerender } = render(<CouponIssueCountField showValidation={false} />);
    expect(screen.getByLabelText('step6.coupon.issueCountTitle')).toBeInTheDocument();

    // percent_off
    useCardBuilderStore.setState({ couponDiscountType: 'percent_off' });
    rerender(<CouponIssueCountField showValidation={false} />);
    expect(screen.getByLabelText('step6.coupon.issueCountTitle')).toBeInTheDocument();
  });

  it('defaults to 1 (single coupon per transaction)', () => {
    render(<CouponIssueCountField showValidation={false} />);
    const input = screen.getByLabelText('step6.coupon.issueCountTitle') as HTMLInputElement;
    expect(input.value).toBe('1');
    expect(useCardBuilderStore.getState().couponIssueCount).toBe(1);
  });

  it('typing a valid integer (e.g. 5) writes to the store', () => {
    render(<CouponIssueCountField showValidation={false} />);
    const input = screen.getByLabelText('step6.coupon.issueCountTitle') as HTMLInputElement;
    fireEvent.change(input, { target: { value: '5' } });
    expect(useCardBuilderStore.getState().couponIssueCount).toBe(5);
  });

  it('typing 0 is rejected by store (≥ 1 required)', () => {
    render(<CouponIssueCountField showValidation={false} />);
    const input = screen.getByLabelText('step6.coupon.issueCountTitle') as HTMLInputElement;
    fireEvent.change(input, { target: { value: '0' } });
    expect(useCardBuilderStore.getState().couponIssueCount).toBe(1);
  });

  it('typing a large value is accepted (no upper cap per user decision 2026-09-19)', () => {
    render(<CouponIssueCountField showValidation={false} />);
    const input = screen.getByLabelText('step6.coupon.issueCountTitle') as HTMLInputElement;
    fireEvent.change(input, { target: { value: '9999' } });
    expect(useCardBuilderStore.getState().couponIssueCount).toBe(9999);
  });

  it('clearing the input does NOT clear store (always keep ≥ 1)', () => {
    useCardBuilderStore.setState({ couponIssueCount: 3 });
    render(<CouponIssueCountField showValidation={false} />);
    const input = screen.getByLabelText('step6.coupon.issueCountTitle') as HTMLInputElement;
    fireEvent.change(input, { target: { value: '' } });
    // The setter is never called for empty input — store keeps previous value.
    expect(useCardBuilderStore.getState().couponIssueCount).toBe(3);
  });

  it('showValidation=true + value < 1 → error message "invalid"', () => {
    // Force the store to 0 (the setter rejects this; we bypass to verify the
    // field-level validation flag catches invalid values regardless).
    useCardBuilderStore.setState({ couponIssueCount: 0 });
    render(<CouponIssueCountField showValidation={true} />);
    expect(screen.getByText('step6.coupon.issueCountInvalidError')).toBeInTheDocument();
  });

  it('showValidation=false does NOT show any error', () => {
    render(<CouponIssueCountField showValidation={false} />);
    expect(
      screen.queryByText('step6.coupon.issueCountInvalidError'),
    ).not.toBeInTheDocument();
  });

  it('decimal input rounds to nearest integer (Math.round)', () => {
    render(<CouponIssueCountField showValidation={false} />);
    const input = screen.getByLabelText('step6.coupon.issueCountTitle') as HTMLInputElement;
    fireEvent.change(input, { target: { value: '3.7' } });
    expect(useCardBuilderStore.getState().couponIssueCount).toBe(4);
  });
});
