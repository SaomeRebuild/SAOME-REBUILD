/**
 * RewardValueField — Vitest + RTL Tests (Rule 003 TDD)
 *
 * Verifies:
 *   - placeholder + unit change with rewardType
 *   - input updates store.rewardValue when positive
 *   - input rejects negative / zero / non-numeric values (UI layer + setter)
 *   - showValidation=true surfaces error if value is null while rewardType selected
 *   - does NOT render the input when rewardType is null
 *
 * Plan ref: step6_集點卡模組化實作 plan 2026-09-07 § Phase 6.1 RewardValueField test.
 */

import { render, screen, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { RewardValueField } from './RewardValueField';
import { useCardBuilderStore } from '../../CardBuilderEditor.store';

vi.mock('react-i18next', () => ({
  useTranslation: vi.fn(() => ({
    t: vi.fn((key: string) => key),
  })),
}));

afterEach(() => {
  useCardBuilderStore.getState().reset();
  cleanup();
});

describe('RewardValueField (Step 6 section 4)', () => {
  it('renders title', () => {
    useCardBuilderStore.setState({ rewardType: 'amount_off' });
    render(<RewardValueField showValidation={false} />);
    expect(screen.getByText('step6.stamp.rewardValueLabel')).toBeInTheDocument();
  });

  it('does NOT render the number input when rewardType is null', () => {
    useCardBuilderStore.setState({ rewardType: null });
    render(<RewardValueField showValidation={false} />);

    // Number input is only rendered when rewardType is selected — look for the placeholder.
    expect(
      screen.queryByPlaceholderText('step6.stamp.rewardValuePlaceholderAmount'),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByPlaceholderText('step6.stamp.rewardValuePlaceholderPercent'),
    ).not.toBeInTheDocument();
    // Placeholder message is shown instead.
    expect(
      screen.getByText('step6.stamp.rewardTypePlaceholder'),
    ).toBeInTheDocument();
  });

  it('uses amount placeholder when rewardType=amount_off (TWD default → suffix unit)', () => {
    useCardBuilderStore.setState({ rewardType: 'amount_off', currency: 'TWD' });
    render(<RewardValueField showValidation={false} />);

    const input = screen.getByPlaceholderText('step6.stamp.rewardValuePlaceholderAmount') as HTMLInputElement;
    expect(input).toBeInTheDocument();
    // 2026-09-10 currency-aware: TWD renders suffix unit 元.
    expect(screen.getByText('step6.stamp.rewardValueAmountUnitTWD')).toBeInTheDocument();
  });

  it('uses amount placeholder when rewardType=amount_off (ZAR → prefix unit)', () => {
    useCardBuilderStore.setState({ rewardType: 'amount_off', currency: 'ZAR' });
    render(<RewardValueField showValidation={false} />);

    const input = screen.getByPlaceholderText('step6.stamp.rewardValuePlaceholderAmount') as HTMLInputElement;
    expect(input).toBeInTheDocument();
    // 2026-09-10 currency-aware: ZAR renders prefix unit R, no suffix unit.
    expect(screen.getByText('step6.stamp.rewardValueAmountUnitZAR')).toBeInTheDocument();
    expect(screen.queryByText('step6.stamp.rewardValueAmountUnitTWD')).not.toBeInTheDocument();
  });

  it('uses percent placeholder when rewardType=percent_off', () => {
    useCardBuilderStore.setState({ rewardType: 'percent_off' });
    render(<RewardValueField showValidation={false} />);

    const input = screen.getByPlaceholderText('step6.stamp.rewardValuePlaceholderPercent') as HTMLInputElement;
    expect(input).toBeInTheDocument();
    expect(screen.getByText('step6.stamp.rewardValuePercentUnit')).toBeInTheDocument();
  });

  it('typing a positive number updates store.rewardValue', async () => {
    const user = userEvent.setup();
    useCardBuilderStore.setState({ rewardType: 'amount_off' });
    render(<RewardValueField showValidation={false} />);
    const input = screen.getByPlaceholderText('step6.stamp.rewardValuePlaceholderAmount');

    await user.clear(input);
    await user.type(input, '10');

    expect(useCardBuilderStore.getState().rewardValue).toBe(10);
  });

  it('typing a percent value updates store.rewardValue', async () => {
    const user = userEvent.setup();
    useCardBuilderStore.setState({ rewardType: 'percent_off' });
    render(<RewardValueField showValidation={false} />);
    const input = screen.getByPlaceholderText('step6.stamp.rewardValuePlaceholderPercent');

    await user.clear(input);
    await user.type(input, '8');

    expect(useCardBuilderStore.getState().rewardValue).toBe(8);
  });

  it('clearing the input sets store.rewardValue to null', async () => {
    const user = userEvent.setup();
    useCardBuilderStore.setState({ rewardType: 'amount_off', rewardValue: 50 });
    render(<RewardValueField showValidation={false} />);
    const input = screen.getByPlaceholderText('step6.stamp.rewardValuePlaceholderAmount');

    await user.clear(input);

    expect(useCardBuilderStore.getState().rewardValue).toBeNull();
  });

  it('rejects 0 (UI silently ignores, setter enforces)', async () => {
    const user = userEvent.setup();
    useCardBuilderStore.setState({ rewardType: 'amount_off' });
    render(<RewardValueField showValidation={false} />);
    const input = screen.getByPlaceholderText('step6.stamp.rewardValuePlaceholderAmount');

    await user.clear(input);
    await user.type(input, '0');

    // The UI's onChange rejects 0; setter also rejects non-positive.
    expect(useCardBuilderStore.getState().rewardValue).toBeNull();
  });

  it('rejects negative numbers', async () => {
    const user = userEvent.setup();
    useCardBuilderStore.setState({ rewardType: 'amount_off' });
    render(<RewardValueField showValidation={false} />);
    const input = screen.getByPlaceholderText('step6.stamp.rewardValuePlaceholderAmount');

    await user.clear(input);
    await user.type(input, '-5');

    expect(useCardBuilderStore.getState().rewardValue).toBeNull();
  });

  it('showValidation=true + rewardType selected + null value shows error', () => {
    useCardBuilderStore.setState({ rewardType: 'amount_off', rewardValue: null });
    render(<RewardValueField showValidation={true} />);

    expect(
      screen.getByText('step6.stamp.rewardValueEmptyError'),
    ).toBeInTheDocument();
  });

  it('showValidation=true + rewardType NOT selected → no error shown', () => {
    useCardBuilderStore.setState({ rewardType: null, rewardValue: null });
    render(<RewardValueField showValidation={true} />);

    expect(
      screen.queryByText('step6.stamp.rewardValueEmptyError'),
    ).not.toBeInTheDocument();
  });

  it('reflects pre-existing store value', () => {
    useCardBuilderStore.setState({ rewardType: 'amount_off', rewardValue: 99 });
    render(<RewardValueField showValidation={false} />);

    const input = screen.getByPlaceholderText('step6.stamp.rewardValuePlaceholderAmount') as HTMLInputElement;
    expect(input.value).toBe('99');
  });
});
