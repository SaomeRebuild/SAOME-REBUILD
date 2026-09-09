/**
 * RewardTypeField — Vitest + RTL Tests (Rule 003 TDD)
 *
 * Verifies:
 *   - Two options in <select>: amount_off / percent_off
 *   - Selecting amount_off / percent_off updates store.rewardType
 *   - Selecting the placeholder option (empty string) clears store.rewardType
 *   - Contextual hint text shows for the selected type
 *   - Switching type CLEARS rewardValue + maxDiscountAmount (per store setter contract)
 *
 * Plan ref: step6_集點卡模組化實作 plan 2026-09-07 § Phase 6.1 RewardTypeField test.
 */

import { render, screen, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { RewardTypeField } from './RewardTypeField';
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

describe('RewardTypeField (Step 6 section 3)', () => {
  it('renders title', () => {
    render(<RewardTypeField showValidation={false} />);
    expect(screen.getByText('step6.stamp.rewardTypeTitle')).toBeInTheDocument();
  });

  it('renders select with placeholder option + amount_off + percent_off', () => {
    render(<RewardTypeField showValidation={false} />);
    const select = screen.getByRole('combobox') as HTMLSelectElement;

    const optionValues = Array.from(select.options).map((o) => o.value);
    expect(optionValues).toEqual(['', 'amount_off', 'percent_off']);
  });

  it('selecting amount_off updates store.rewardType', async () => {
    const user = userEvent.setup();
    render(<RewardTypeField showValidation={false} />);
    const select = screen.getByRole('combobox');

    await user.selectOptions(select, 'amount_off');

    expect(useCardBuilderStore.getState().rewardType).toBe('amount_off');
  });

  it('selecting percent_off updates store.rewardType', async () => {
    const user = userEvent.setup();
    render(<RewardTypeField showValidation={false} />);
    const select = screen.getByRole('combobox');

    await user.selectOptions(select, 'percent_off');

    expect(useCardBuilderStore.getState().rewardType).toBe('percent_off');
  });

  it('selecting the placeholder (empty value) clears store.rewardType to null', async () => {
    const user = userEvent.setup();
    useCardBuilderStore.setState({ rewardType: 'amount_off' });
    render(<RewardTypeField showValidation={false} />);
    const select = screen.getByRole('combobox');

    await user.selectOptions(select, '');

    expect(useCardBuilderStore.getState().rewardType).toBeNull();
  });

  it('selecting amount_off clears rewardValue + maxDiscountAmount (defensive: old values invalid for new type)', async () => {
    const user = userEvent.setup();
    useCardBuilderStore.setState({
      rewardType: 'percent_off',
      rewardValue: 50,
      maxDiscountAmount: 100,
    });
    render(<RewardTypeField showValidation={false} />);
    const select = screen.getByRole('combobox');

    await user.selectOptions(select, 'amount_off');

    expect(useCardBuilderStore.getState().rewardType).toBe('amount_off');
    expect(useCardBuilderStore.getState().rewardValue).toBeNull();
    expect(useCardBuilderStore.getState().maxDiscountAmount).toBeNull();
  });

  it('selecting percent_off also clears rewardValue + maxDiscountAmount', async () => {
    const user = userEvent.setup();
    useCardBuilderStore.setState({
      rewardType: 'amount_off',
      rewardValue: 100,
      maxDiscountAmount: null,
    });
    render(<RewardTypeField showValidation={false} />);
    const select = screen.getByRole('combobox');

    await user.selectOptions(select, 'percent_off');

    expect(useCardBuilderStore.getState().rewardType).toBe('percent_off');
    expect(useCardBuilderStore.getState().rewardValue).toBeNull();
    expect(useCardBuilderStore.getState().maxDiscountAmount).toBeNull();
  });

  it('shows amount_off hint for TWD (default currency)', () => {
    useCardBuilderStore.setState({ rewardType: 'amount_off', currency: 'TWD' });
    render(<RewardTypeField showValidation={false} />);

    expect(screen.getByText('step6.stamp.rewardTypeAmountHintTWD')).toBeInTheDocument();
    expect(screen.queryByText('step6.stamp.rewardTypePercentHint')).not.toBeInTheDocument();
  });

  // 2026-09-10 currency-aware hint: ZAR shows the R-prefixed hint.
  it('shows amount_off hint for ZAR (prefix-R variant)', () => {
    useCardBuilderStore.setState({ rewardType: 'amount_off', currency: 'ZAR' });
    render(<RewardTypeField showValidation={false} />);

    expect(screen.getByText('step6.stamp.rewardTypeAmountHintZAR')).toBeInTheDocument();
    expect(screen.queryByText('step6.stamp.rewardTypeAmountHintTWD')).not.toBeInTheDocument();
  });

  it('shows percent_off hint when rewardType is percent_off', () => {
    useCardBuilderStore.setState({ rewardType: 'percent_off' });
    render(<RewardTypeField showValidation={false} />);

    expect(screen.getByText('step6.stamp.rewardTypePercentHint')).toBeInTheDocument();
    expect(screen.queryByText('step6.stamp.rewardTypeAmountHintTWD')).not.toBeInTheDocument();
    expect(screen.queryByText('step6.stamp.rewardTypeAmountHintZAR')).not.toBeInTheDocument();
  });

  it('does not show any hint when rewardType is null', () => {
    useCardBuilderStore.setState({ rewardType: null });
    render(<RewardTypeField showValidation={false} />);

    expect(screen.queryByText('step6.stamp.rewardTypeAmountHintTWD')).not.toBeInTheDocument();
    expect(screen.queryByText('step6.stamp.rewardTypeAmountHintZAR')).not.toBeInTheDocument();
    expect(screen.queryByText('step6.stamp.rewardTypePercentHint')).not.toBeInTheDocument();
  });

  it('reflects pre-existing store value in the select', () => {
    useCardBuilderStore.setState({ rewardType: 'percent_off' });
    render(<RewardTypeField showValidation={false} />);

    const select = screen.getByRole('combobox') as HTMLSelectElement;
    expect(select.value).toBe('percent_off');
  });
});

describe('RewardTypeField — dropdown visibility (regression 2026-09-07)', () => {
  /**
   * In dark mode, the body's `color: var(--color-foreground)` (#F8FAFC) was
   * inherited by the OS-native dropdown panel, which renders options on a
   * white background by default — making the text invisible to the user.
   *
   * Same fix pattern as Step3CardFields (see Step3CardFields/index.test.tsx):
   *   1. `<select style={{ colorScheme: 'light' }}>` forces the OS panel
   *      into light color scheme → white background.
   *   2. Each `<option style={{ color: '#000000' }}>` overrides the inherited
   *      body color cascade. `colorScheme: 'light'` alone is NOT enough on
   *      Chrome / Windows — option text still inherits white → invisible.
   */
  it('<select> applies text-foreground on closed state (contrast against themed bg)', () => {
    render(<RewardTypeField showValidation={false} />);
    const select = screen.getByRole('combobox') as HTMLSelectElement;
    expect(select.className).toContain('text-foreground');
  });

  it('<select> forces color-scheme:light so the OS panel renders in light scheme', () => {
    render(<RewardTypeField showValidation={false} />);
    const select = screen.getByRole('combobox') as HTMLSelectElement;
    expect(select.style.colorScheme).toBe('light');
  });

  it('every <option> applies inline color:#000000 so unselected options stay legible', () => {
    render(<RewardTypeField showValidation={false} />);
    const select = screen.getByRole('combobox') as HTMLSelectElement;

    // 1 placeholder + amount_off + percent_off = 3 options
    expect(select.options).toHaveLength(3);

    for (const opt of Array.from(select.options)) {
      expect(
        opt.style.color,
        `option "${opt.value}" must have black text`,
      ).toBe('rgb(0, 0, 0)');
    }
  });
});
