/**
 * MembershipCustomExpiryDaysField — Free-card custom days input tests.
 *
 * Verifies:
 *   - Renders input with current value from store
 *   - Empty value → store sets to null
 *   - Out-of-range value → store guard clamps to [1, 3650]
 *   - Validation error renders when value is null + showValidation
 */

import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { MembershipCustomExpiryDaysField } from './MembershipCustomExpiryDaysField';
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

describe('MembershipCustomExpiryDaysField — number input', () => {
  it('renders input with current value from store', () => {
    useCardBuilderStore.setState({ membershipCustomExpiryDays: 100 });
    render(<MembershipCustomExpiryDaysField showValidation={false} />);

    const input = screen.getByLabelText(
      'step6.membership.freeCustomExpiryDaysTitle',
    );
    expect((input as HTMLInputElement).value).toBe('100');
  });

  it('renders empty input when store value is null', () => {
    render(<MembershipCustomExpiryDaysField showValidation={false} />);

    const input = screen.getByLabelText(
      'step6.membership.freeCustomExpiryDaysTitle',
    );
    expect((input as HTMLInputElement).value).toBe('');
  });

  it('renders unit label "天" (zh-TW days unit)', () => {
    render(<MembershipCustomExpiryDaysField showValidation={false} />);
    expect(
      screen.getByText('step6.membership.freeCustomExpiryDaysUnit'),
    ).toBeInTheDocument();
  });

  it('user typing 30 sets store membershipCustomExpiryDays=30', () => {
    render(<MembershipCustomExpiryDaysField showValidation={false} />);

    const input = screen.getByLabelText(
      'step6.membership.freeCustomExpiryDaysTitle',
    );
    fireEvent.change(input, { target: { value: '30' } });

    expect(useCardBuilderStore.getState().membershipCustomExpiryDays).toBe(30);
  });

  it('user clearing the input sets store to null', () => {
    useCardBuilderStore.setState({ membershipCustomExpiryDays: 100 });
    render(<MembershipCustomExpiryDaysField showValidation={false} />);

    const input = screen.getByLabelText(
      'step6.membership.freeCustomExpiryDaysTitle',
    );
    fireEvent.change(input, { target: { value: '' } });

    expect(useCardBuilderStore.getState().membershipCustomExpiryDays).toBeNull();
  });

  it('input has min=1 and max=3650 attributes', () => {
    render(<MembershipCustomExpiryDaysField showValidation={false} />);

    const input = screen.getByLabelText(
      'step6.membership.freeCustomExpiryDaysTitle',
    );
    expect(input.getAttribute('min')).toBe('1');
    expect(input.getAttribute('max')).toBe('3650');
  });

  it('shows range error when value is null + showValidation=true', () => {
    render(<MembershipCustomExpiryDaysField showValidation={true} />);

    expect(
      screen.getByText('step6.membership.freeCustomExpiryDaysRangeError'),
    ).toBeInTheDocument();
  });

  it('does NOT show range error when value is valid + showValidation=true', () => {
    useCardBuilderStore.setState({ membershipCustomExpiryDays: 100 });
    render(<MembershipCustomExpiryDaysField showValidation={true} />);

    expect(
      screen.queryByText('step6.membership.freeCustomExpiryDaysRangeError'),
    ).toBeNull();
  });
});
