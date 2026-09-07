/**
 * RewardNameField — Vitest + RTL Tests (Rule 003 TDD)
 *
 * Verifies:
 *   - 40-char max (REWARD_NAME_MAX_LENGTH)
 *   - Live character counter
 *   - showValidation=true + empty → error message visible
 *   - showValidation=false + empty → error NOT shown
 *   - HTML `maxLength` attribute enforces the cap
 *
 * Plan ref: step6_集點卡模組化實作 plan 2026-09-07 § Phase 6.1 RewardNameField test.
 */

import { render, screen, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { RewardNameField } from './RewardNameField';
import { useCardBuilderStore } from '../../CardBuilderEditor.store';
import { REWARD_NAME_MAX_LENGTH } from '@saome/shared/constants';

vi.mock('react-i18next', () => ({
  useTranslation: vi.fn(() => ({
    t: vi.fn((key: string, params?: Record<string, unknown>) => {
      // Mock i18next interpolation. For rewardNameCounter use {{count}} interpolation.
      if (key === 'step6.stamp.rewardNameCounter' && params?.count !== undefined) {
        return `${params.count} / 40`;
      }
      return key;
    }),
  })),
}));

afterEach(() => {
  useCardBuilderStore.getState().reset();
  cleanup();
});

describe('RewardNameField (Step 6 section 2)', () => {
  it('renders title and helper text', () => {
    render(<RewardNameField showValidation={false} />);

    expect(screen.getByText('step6.stamp.rewardNameTitle')).toBeInTheDocument();
    expect(screen.getByText('step6.stamp.rewardNameHelper')).toBeInTheDocument();
  });

  it('renders an empty input initially', () => {
    render(<RewardNameField showValidation={false} />);
    const input = screen.getByPlaceholderText('step6.stamp.rewardNamePlaceholder') as HTMLInputElement;
    expect(input.value).toBe('');
  });

  it('input has maxLength={REWARD_NAME_MAX_LENGTH=40}', () => {
    render(<RewardNameField showValidation={false} />);
    const input = screen.getByPlaceholderText('step6.stamp.rewardNamePlaceholder') as HTMLInputElement;
    expect(input.maxLength).toBe(REWARD_NAME_MAX_LENGTH);
    expect(input.maxLength).toBe(40);
  });

  it('typing into the input updates store.rewardName', async () => {
    const user = userEvent.setup();
    render(<RewardNameField showValidation={false} />);
    const input = screen.getByPlaceholderText('step6.stamp.rewardNamePlaceholder');

    await user.type(input, '10元折價');

    expect(useCardBuilderStore.getState().rewardName).toBe('10元折價');
  });

  it('counter updates as user types', async () => {
    const user = userEvent.setup();
    render(<RewardNameField showValidation={false} />);
    const input = screen.getByPlaceholderText('step6.stamp.rewardNamePlaceholder');

    await user.type(input, 'Hello');

    // i18next may render interpolations as fragments, so use a regex matcher.
    expect(screen.getByText(/5.*40/)).toBeInTheDocument();
  });

  it('does NOT show validation error when showValidation=false even if empty', () => {
    render(<RewardNameField showValidation={false} />);

    expect(
      screen.queryByText('step6.stamp.rewardNameEmptyError'),
    ).not.toBeInTheDocument();
  });

  it('shows validation error when showValidation=true AND input is empty', () => {
    render(<RewardNameField showValidation={true} />);

    expect(
      screen.getByText('step6.stamp.rewardNameEmptyError'),
    ).toBeInTheDocument();
  });

  it('does NOT show validation error when showValidation=true but input has value', async () => {
    const user = userEvent.setup();
    render(<RewardNameField showValidation={true} />);
    const input = screen.getByPlaceholderText('step6.stamp.rewardNamePlaceholder');

    await user.type(input, 'Discount');

    expect(
      screen.queryByText('step6.stamp.rewardNameEmptyError'),
    ).not.toBeInTheDocument();
  });

  it('reflects pre-existing store value', () => {
    useCardBuilderStore.setState({ rewardName: '8% off coupon' }); // 13 chars
    render(<RewardNameField showValidation={false} />);

    const input = screen.getByPlaceholderText('step6.stamp.rewardNamePlaceholder') as HTMLInputElement;
    expect(input.value).toBe('8% off coupon');
    expect(screen.getByText(/13.*40/)).toBeInTheDocument();
  });

  it('whitespace-only value is treated as empty (validation error shown)', async () => {
    const user = userEvent.setup();
    render(<RewardNameField showValidation={true} />);
    const input = screen.getByPlaceholderText('step6.stamp.rewardNamePlaceholder');

    await user.type(input, '   ');

    // store gets '   '; trim() === '' so validation still surfaces.
    expect(
      screen.getByText('step6.stamp.rewardNameEmptyError'),
    ).toBeInTheDocument();
  });
});
