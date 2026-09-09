/**
 * MaxDiscountAmountField — Vitest + RTL Tests (Rule 003 TDD)
 *
 * Verifies:
 *   - Renders ONLY when rewardType === 'percent_off'
 *   - Returns null otherwise (hidden)
 *   - Updates store.maxDiscountAmount
 *   - Empty input → store null (= 無上限)
 *   - 0 in input → "輸入 0 = 無上限" helper shown
 *   - max=MAX_DISCOUNT_AMOUNT_MAX
 *
 * Plan ref: step6_集點卡模組化實作 plan 2026-09-07 § Phase 6.1 MaxDiscountAmountField test.
 */

import { render, screen, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { MaxDiscountAmountField } from './MaxDiscountAmountField';
import { useCardBuilderStore } from '../../CardBuilderEditor.store';
import { MAX_DISCOUNT_AMOUNT_MAX } from '@saome/shared/constants';

// 2026-09-10 currency-aware: MaxDiscountAmountField uses `i18n.language`
// to decide whether the unit renders as a prefix (en / ZAR) or suffix
// (zh-TW TWD). The mock now exposes `i18n.language` so the suffix
// branch can be tested deterministically.
vi.mock('react-i18next', () => ({
  useTranslation: vi.fn(() => ({
    t: vi.fn((key: string) => key),
    i18n: { language: 'zh-TW' },
  })),
}));

afterEach(() => {
  useCardBuilderStore.getState().reset();
  cleanup();
});

describe('MaxDiscountAmountField (Step 6 section 5 — CONDITIONAL)', () => {
  it('returns null when rewardType is null', () => {
    useCardBuilderStore.setState({ rewardType: null });
    const { container } = render(<MaxDiscountAmountField showValidation={false} />);
    expect(container.firstChild).toBeNull();
  });

  it('returns null when rewardType is amount_off', () => {
    useCardBuilderStore.setState({ rewardType: 'amount_off' });
    const { container } = render(<MaxDiscountAmountField showValidation={false} />);
    expect(container.firstChild).toBeNull();
  });

  it('renders when rewardType is percent_off', () => {
    useCardBuilderStore.setState({ rewardType: 'percent_off' });
    render(<MaxDiscountAmountField showValidation={false} />);

    expect(screen.getByText('step6.stamp.maxDiscountTitle')).toBeInTheDocument();
    // Input is found by its placeholder.
    expect(
      screen.getByPlaceholderText('step6.stamp.maxDiscountPlaceholder'),
    ).toBeInTheDocument();
  });

  it('input has max={MAX_DISCOUNT_AMOUNT_MAX} (UI safeguard)', () => {
    useCardBuilderStore.setState({ rewardType: 'percent_off' });
    render(<MaxDiscountAmountField showValidation={false} />);

    const input = screen.getByPlaceholderText('step6.stamp.maxDiscountPlaceholder') as HTMLInputElement;
    expect(input.max).toBe(String(MAX_DISCOUNT_AMOUNT_MAX));
    expect(input.max).toBe('1000000');
  });

  it('typing a number updates store.maxDiscountAmount', async () => {
    const user = userEvent.setup();
    useCardBuilderStore.setState({ rewardType: 'percent_off' });
    render(<MaxDiscountAmountField showValidation={false} />);
    const input = screen.getByPlaceholderText('step6.stamp.maxDiscountPlaceholder');

    await user.clear(input);
    await user.type(input, '50');

    expect(useCardBuilderStore.getState().maxDiscountAmount).toBe(50);
  });

  it('clearing the input sets store.maxDiscountAmount to null (無上限)', async () => {
    const user = userEvent.setup();
    useCardBuilderStore.setState({ rewardType: 'percent_off', maxDiscountAmount: 50 });
    render(<MaxDiscountAmountField showValidation={false} />);
    const input = screen.getByPlaceholderText('step6.stamp.maxDiscountPlaceholder');

    await user.clear(input);

    expect(useCardBuilderStore.getState().maxDiscountAmount).toBeNull();
  });

  it('shows "無上限" helper when value is null', () => {
    useCardBuilderStore.setState({ rewardType: 'percent_off', maxDiscountAmount: null });
    render(<MaxDiscountAmountField showValidation={false} />);

    expect(screen.getByText('step6.stamp.maxDiscountOptional')).toBeInTheDocument();
  });

  it('shows "輸入 0 = 無上限" helper when value is 0', () => {
    useCardBuilderStore.setState({ rewardType: 'percent_off', maxDiscountAmount: 0 });
    render(<MaxDiscountAmountField showValidation={false} />);

    expect(screen.getByText('step6.stamp.maxDiscountZeroIsNoCap')).toBeInTheDocument();
  });

  it('does NOT show the zero=cap helper when value is positive', () => {
    useCardBuilderStore.setState({ rewardType: 'percent_off', maxDiscountAmount: 50 });
    render(<MaxDiscountAmountField showValidation={false} />);

    expect(screen.queryByText('step6.stamp.maxDiscountZeroIsNoCap')).not.toBeInTheDocument();
  });

  it('reflects pre-existing store value in the input', () => {
    useCardBuilderStore.setState({ rewardType: 'percent_off', maxDiscountAmount: 200 });
    render(<MaxDiscountAmountField showValidation={false} />);

    const input = screen.getByPlaceholderText('step6.stamp.maxDiscountPlaceholder') as HTMLInputElement;
    expect(input.value).toBe('200');
  });

  // 2026-09-10 currency-aware rendering: the unit's position changes
  // based on `store.currency` and `i18n.language`.
  it('zh-TW TWD → renders unit 元 as a SUFFIX after the input', () => {
    useCardBuilderStore.setState({ rewardType: 'percent_off', currency: 'TWD' });
    render(<MaxDiscountAmountField showValidation={false} />);

    const input = screen.getByPlaceholderText('step6.stamp.maxDiscountPlaceholder');
    // The unit span must come AFTER the input in DOM order.
    expect(
      input.compareDocumentPosition(
        screen.getByText('step6.stamp.maxDiscountUnitTWD'),
      ) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });

  it('ZAR → renders unit R as a PREFIX before the input', () => {
    useCardBuilderStore.setState({ rewardType: 'percent_off', currency: 'ZAR' });
    render(<MaxDiscountAmountField showValidation={false} />);

    const input = screen.getByPlaceholderText('step6.stamp.maxDiscountPlaceholder');
    expect(
      input.compareDocumentPosition(
        screen.getByText('step6.stamp.maxDiscountUnitZAR'),
      ) & Node.DOCUMENT_POSITION_PRECEDING,
    ).toBeTruthy();
  });
});
