/**
 * MembershipSpecificExpiryDateField — Free-card specific date input tests.
 *
 * Verifies:
 *   - Renders input with current value from store
 *   - min attribute is today's ISO date
 *   - User picks a date → store sets membershipSpecificExpiryDate
 *   - User clears → store sets to null
 *   - Validation error renders when value is null + showValidation
 */

import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { MembershipSpecificExpiryDateField } from './MembershipSpecificExpiryDateField';
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

describe('MembershipSpecificExpiryDateField — date input', () => {
  it('renders input with current value from store', () => {
    useCardBuilderStore.setState({
      membershipSpecificExpiryDate: '2026-12-31',
    });
    render(<MembershipSpecificExpiryDateField showValidation={false} />);

    const input = screen.getByLabelText(
      'step6.membership.freeSpecificExpiryDateTitle',
    );
    expect((input as HTMLInputElement).value).toBe('2026-12-31');
  });

  it('renders empty input when store value is null', () => {
    render(<MembershipSpecificExpiryDateField showValidation={false} />);

    const input = screen.getByLabelText(
      'step6.membership.freeSpecificExpiryDateTitle',
    );
    expect((input as HTMLInputElement).value).toBe('');
  });

  it('input has min attribute = today (ISO YYYY-MM-DD)', () => {
    render(<MembershipSpecificExpiryDateField showValidation={false} />);

    const input = screen.getByLabelText(
      'step6.membership.freeSpecificExpiryDateTitle',
    );
    const today = new Date();
    const expectedIso = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    expect(input.getAttribute('min')).toBe(expectedIso);
  });

  it('user picks 2026-12-31 → store sets membershipSpecificExpiryDate=2026-12-31', () => {
    render(<MembershipSpecificExpiryDateField showValidation={false} />);

    const input = screen.getByLabelText(
      'step6.membership.freeSpecificExpiryDateTitle',
    );
    fireEvent.change(input, { target: { value: '2026-12-31' } });

    expect(useCardBuilderStore.getState().membershipSpecificExpiryDate).toBe(
      '2026-12-31',
    );
  });

  it('user clears the input → store sets to null', () => {
    useCardBuilderStore.setState({ membershipSpecificExpiryDate: '2026-12-31' });
    render(<MembershipSpecificExpiryDateField showValidation={false} />);

    const input = screen.getByLabelText(
      'step6.membership.freeSpecificExpiryDateTitle',
    );
    fireEvent.change(input, { target: { value: '' } });

    expect(
      useCardBuilderStore.getState().membershipSpecificExpiryDate,
    ).toBeNull();
  });

  it('shows required error when value is null + showValidation=true', () => {
    render(<MembershipSpecificExpiryDateField showValidation={true} />);

    expect(
      screen.getByText('step6.membership.freeSpecificExpiryDateRequiredError'),
    ).toBeInTheDocument();
  });

  it('does NOT show error when valid date is set + showValidation=true', () => {
    // Pick a future date so it's not flagged as "past".
    const futureDate = new Date();
    futureDate.setFullYear(futureDate.getFullYear() + 1);
    const futureIso = `${futureDate.getFullYear()}-${String(futureDate.getMonth() + 1).padStart(2, '0')}-${String(futureDate.getDate()).padStart(2, '0')}`;

    useCardBuilderStore.setState({
      membershipSpecificExpiryDate: futureIso,
    });
    render(<MembershipSpecificExpiryDateField showValidation={true} />);

    expect(
      screen.queryByText(
        'step6.membership.freeSpecificExpiryDateRequiredError',
      ),
    ).toBeNull();
    expect(
      screen.queryByText(
        'step6.membership.freeSpecificExpiryDatePastError',
      ),
    ).toBeNull();
  });
});
