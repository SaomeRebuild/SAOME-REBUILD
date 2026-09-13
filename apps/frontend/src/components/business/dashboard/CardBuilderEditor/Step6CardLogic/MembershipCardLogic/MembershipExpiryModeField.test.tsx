/**
 * MembershipExpiryModeField — Free-card expiry mode selector tests.
 *
 * Verifies:
 *   - Renders both radio options (custom_days / specific_date)
 *   - aria-checked reflects store.membershipExpiryMode
 *   - Click selects radio and updates store
 *   - Switch mode clears the other field (via store setter)
 *   - Validation error renders when mode is null + showValidation
 */

import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { MembershipExpiryModeField } from './MembershipExpiryModeField';
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

describe('MembershipExpiryModeField — radio group', () => {
  it('renders both radio options', () => {
    render(<MembershipExpiryModeField showValidation={false} />);

    expect(
      screen.getByLabelText('step6.membership.freeExpiryModeCustomDays'),
    ).toBeInTheDocument();
    expect(
      screen.getByLabelText('step6.membership.freeExpiryModeSpecificDate'),
    ).toBeInTheDocument();
  });

  it('aria-checked=false on both radios when membershipExpiryMode is null', () => {
    render(<MembershipExpiryModeField showValidation={false} />);

    const customDays = screen.getByLabelText(
      'step6.membership.freeExpiryModeCustomDays',
    );
    const specificDate = screen.getByLabelText(
      'step6.membership.freeExpiryModeSpecificDate',
    );
    expect((customDays as HTMLInputElement).checked).toBe(false);
    expect((specificDate as HTMLInputElement).checked).toBe(false);
  });

  it('aria-checked=true on custom_days radio when store mode is custom_days', () => {
    useCardBuilderStore.setState({ membershipExpiryMode: 'custom_days' });
    render(<MembershipExpiryModeField showValidation={false} />);

    const customDays = screen.getByLabelText(
      'step6.membership.freeExpiryModeCustomDays',
    );
    expect((customDays as HTMLInputElement).checked).toBe(true);
  });

  it('aria-checked=true on specific_date radio when store mode is specific_date', () => {
    useCardBuilderStore.setState({ membershipExpiryMode: 'specific_date' });
    render(<MembershipExpiryModeField showValidation={false} />);

    const specificDate = screen.getByLabelText(
      'step6.membership.freeExpiryModeSpecificDate',
    );
    expect((specificDate as HTMLInputElement).checked).toBe(true);
  });

  it('click on custom_days radio updates store and sets membershipExpiryMode', () => {
    render(<MembershipExpiryModeField showValidation={false} />);

    fireEvent.click(
      screen.getByLabelText('step6.membership.freeExpiryModeCustomDays'),
    );

    expect(useCardBuilderStore.getState().membershipExpiryMode).toBe(
      'custom_days',
    );
  });

  it('click on specific_date radio updates store', () => {
    render(<MembershipExpiryModeField showValidation={false} />);

    fireEvent.click(
      screen.getByLabelText('step6.membership.freeExpiryModeSpecificDate'),
    );

    expect(useCardBuilderStore.getState().membershipExpiryMode).toBe(
      'specific_date',
    );
  });

  it('switching from custom_days → specific_date clears membershipCustomExpiryDays', () => {
    // 2026-09-14: store setter cross-clears the other field on mode change.
    useCardBuilderStore.setState({
      membershipExpiryMode: 'custom_days',
      membershipCustomExpiryDays: 100,
      membershipSpecificExpiryDate: null,
    });

    render(<MembershipExpiryModeField showValidation={false} />);
    fireEvent.click(
      screen.getByLabelText('step6.membership.freeExpiryModeSpecificDate'),
    );

    const state = useCardBuilderStore.getState();
    expect(state.membershipExpiryMode).toBe('specific_date');
    expect(state.membershipCustomExpiryDays).toBeNull();
  });

  it('switching from specific_date → custom_days clears membershipSpecificExpiryDate', () => {
    useCardBuilderStore.setState({
      membershipExpiryMode: 'specific_date',
      membershipCustomExpiryDays: null,
      membershipSpecificExpiryDate: '2026-12-31',
    });

    render(<MembershipExpiryModeField showValidation={false} />);
    fireEvent.click(
      screen.getByLabelText('step6.membership.freeExpiryModeCustomDays'),
    );

    const state = useCardBuilderStore.getState();
    expect(state.membershipExpiryMode).toBe('custom_days');
    expect(state.membershipSpecificExpiryDate).toBeNull();
  });

  it('shows required error when membershipExpiryMode is null + showValidation=true', () => {
    render(<MembershipExpiryModeField showValidation={true} />);

    expect(
      screen.getByText('step6.membership.freeExpiryModeRequiredError'),
    ).toBeInTheDocument();
  });

  it('does NOT show required error when membershipExpiryMode is set', () => {
    useCardBuilderStore.setState({ membershipExpiryMode: 'custom_days' });
    render(<MembershipExpiryModeField showValidation={true} />);

    expect(
      screen.queryByText('step6.membership.freeExpiryModeRequiredError'),
    ).toBeNull();
  });
});
