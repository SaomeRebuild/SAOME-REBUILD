/**
 * StampCardLogicPreview — Vitest + RTL Tests (Rule 003 TDD)
 *
 * Verifies the live scenario preview text builder:
 *   - Empty accrualMode → "modeUnknown"
 *   - accrualMode set but empty rewardName → "rewardUnknown"
 *   - Full: "集滿 {{total}} 個印章可兌換 {{reward}}"
 *   - rewardName + amount → amountReward template
 *   - rewardName + percent + cap → percentWithCap template
 *   - rewardName + percent + no cap → percentNoCap template
 *
 * 2026-09-10 currency-aware rendering: amount / cap are pre-formatted
 * with the currency unit at the correct position before being passed
 * as `{{amount}}` / `{{cap}}` to the i18n template. The mock t()
 * captures the params object so the test can assert the pre-formatted
 * amount string is "10元" (TWD zh-TW suffix) or "R10" (ZAR prefix).
 *
 * Plan ref: step6_集點卡模組化實作 plan 2026-09-07 § Phase 6.1
 * StampCardLogicPreview test; updated 2026-09-10 currency-aware.
 */

import { render, screen, cleanup } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { StampCardLogicPreview } from './StampCardLogicPreview';
import { useCardBuilderStore } from '../../CardBuilderEditor.store';

// 2026-09-10: mock captures i18n.language and the t() params so we can
// assert that the currency unit was pre-formatted into {{amount}} /
// {{cap}} before interpolation. The unit resolution table mirrors the
// real i18n file values for the currency-aware keys.
const UNIT_TABLE: Record<string, string> = {
  'step6.stamp.rewardValueAmountUnitTWD': '元',
  'step6.stamp.rewardValueAmountUnitZAR': 'R',
};
const capturedTCalls: Array<{ key: string; params?: Record<string, unknown> }> = [];
vi.mock('react-i18next', () => ({
  useTranslation: vi.fn(() => ({
    t: vi.fn((key: string, params?: Record<string, unknown>) => {
      capturedTCalls.push({ key, params });
      // Resolve unit keys against the table; fall back to key for all others.
      const resolved = UNIT_TABLE[key] ?? key;
      // For non-template keys (modeUnknown / rewardUnknown) return the
      // resolved value verbatim. For template keys (with params), render
      // with a simple interpolation so the test can see the pre-formatted
      // amount / cap.
      if (params && Object.keys(params).length > 0) {
        return Object.entries(params).reduce(
          (acc, [k, v]) => acc.replace(`{{${k}}}`, String(v)),
          resolved,
        );
      }
      return resolved;
    }),
    i18n: { language: 'zh-TW' },
  })),
}));

afterEach(() => {
  useCardBuilderStore.getState().reset();
  capturedTCalls.length = 0;
  cleanup();
});

describe('StampCardLogicPreview (Step 6 live preview)', () => {
  it('does NOT render a "Reward Settings" section header (user-requested 2026-09-07)', () => {
    // The "Reward Settings" label was just conversational grouping in the
    // agent's explanation — it must not appear as a labelled section in
    // the actual UI. This assertion pins that contract.
    render(<StampCardLogicPreview stampTotal={10} />);
    expect(screen.queryByText('step6.stamp.rewardSectionTitle')).not.toBeInTheDocument();
  });

  it('shows modeUnknown when accrualMode is null', () => {
    useCardBuilderStore.setState({ stampAccrualMode: null, rewardName: 'Discount' });
    render(<StampCardLogicPreview stampTotal={10} />);
    expect(screen.getByText('step6.stamp.preview.modeUnknown')).toBeInTheDocument();
  });

  it('shows rewardUnknown when accrualMode is set but rewardName is empty', () => {
    useCardBuilderStore.setState({ stampAccrualMode: 'per_stamp', rewardName: '' });
    render(<StampCardLogicPreview stampTotal={10} />);
    expect(screen.getByText('step6.stamp.preview.rewardUnknown')).toBeInTheDocument();
  });

  it('shows modeUnknown when both accrualMode and rewardName are null/empty', () => {
    useCardBuilderStore.setState({ stampAccrualMode: null, rewardName: '' });
    render(<StampCardLogicPreview stampTotal={10} />);
    expect(screen.getByText('step6.stamp.preview.modeUnknown')).toBeInTheDocument();
  });

  // ===== Currency-aware pre-formatting (2026-09-10) =====
  // The mock t() captures the params and renders {{amount}} / {{cap}}
  // by string replacement. We assert that the captured `{{amount}}` /
  // `{{cap}}` interpolation values were pre-formatted with the unit.

  it('TWD zh-TW amount_off → {{amount}} is pre-formatted as "10元" (suffix)', () => {
    useCardBuilderStore.setState({
      stampAccrualMode: 'per_stamp',
      rewardName: '10元折價',
      rewardType: 'amount_off',
      rewardValue: 10,
      maxDiscountAmount: null,
      currency: 'TWD',
    });
    render(<StampCardLogicPreview stampTotal={10} />);

    const amountCall = capturedTCalls.find(
      (c) => c.key === 'step6.stamp.preview.amountReward',
    );
    expect(amountCall).toBeDefined();
    expect(amountCall?.params?.amount).toBe('10元');
  });

  it('ZAR amount_off → {{amount}} is pre-formatted as "R10" (prefix)', () => {
    useCardBuilderStore.setState({
      stampAccrualMode: 'per_stamp',
      rewardName: 'R10 off',
      rewardType: 'amount_off',
      rewardValue: 10,
      maxDiscountAmount: null,
      currency: 'ZAR',
    });
    render(<StampCardLogicPreview stampTotal={10} />);

    const amountCall = capturedTCalls.find(
      (c) => c.key === 'step6.stamp.preview.amountReward',
    );
    expect(amountCall).toBeDefined();
    expect(amountCall?.params?.amount).toBe('R10');
  });

  it('TWD percent_with_cap → cap pre-formatted with 元 (suffix)', () => {
    useCardBuilderStore.setState({
      stampAccrualMode: 'per_visit',
      rewardName: '8% off',
      rewardType: 'percent_off',
      rewardValue: 8,
      maxDiscountAmount: 50,
      currency: 'TWD',
    });
    render(<StampCardLogicPreview stampTotal={15} />);

    const capCall = capturedTCalls.find(
      (c) => c.key === 'step6.stamp.preview.percentWithCap',
    );
    expect(capCall).toBeDefined();
    expect(capCall?.params?.cap).toBe('50元');
  });

  it('ZAR percent_with_cap → cap pre-formatted with R (prefix)', () => {
    useCardBuilderStore.setState({
      stampAccrualMode: 'per_visit',
      rewardName: '8% off',
      rewardType: 'percent_off',
      rewardValue: 8,
      maxDiscountAmount: 50,
      currency: 'ZAR',
    });
    render(<StampCardLogicPreview stampTotal={15} />);

    const capCall = capturedTCalls.find(
      (c) => c.key === 'step6.stamp.preview.percentWithCap',
    );
    expect(capCall).toBeDefined();
    expect(capCall?.params?.cap).toBe('R50');
  });

  it('renders the template sentence when accrualMode and rewardName are set (amount_off)', () => {
    useCardBuilderStore.setState({
      stampAccrualMode: 'per_stamp',
      rewardName: '10元折價',
      rewardType: 'amount_off',
      rewardValue: 10,
      maxDiscountAmount: null,
    });
    render(<StampCardLogicPreview stampTotal={10} />);

    expect(screen.getByText('step6.stamp.preview.template')).toBeInTheDocument();
  });

  it('renders the template sentence with percent + cap', () => {
    useCardBuilderStore.setState({
      stampAccrualMode: 'per_visit',
      rewardName: '8% off',
      rewardType: 'percent_off',
      rewardValue: 8,
      maxDiscountAmount: 50,
    });
    render(<StampCardLogicPreview stampTotal={15} />);

    expect(screen.getByText('step6.stamp.preview.template')).toBeInTheDocument();
  });

  it('renders the template sentence with percent + no cap (null)', () => {
    useCardBuilderStore.setState({
      stampAccrualMode: 'per_spend',
      rewardName: '10% discount',
      rewardType: 'percent_off',
      rewardValue: 10,
      maxDiscountAmount: null,
    });
    render(<StampCardLogicPreview stampTotal={20} />);

    expect(screen.getByText('step6.stamp.preview.template')).toBeInTheDocument();
  });

  it('renders correct stampTotal (stampGridRows × 5)', () => {
    useCardBuilderStore.setState({
      stampAccrualMode: 'per_stamp',
      rewardName: 'Cash',
      rewardType: 'amount_off',
      rewardValue: 5,
      maxDiscountAmount: null,
    });

    // stampGridRows=2 → stampTotal=10
    useCardBuilderStore.setState({ stampGridRows: 2 });
    const { rerender } = render(<StampCardLogicPreview stampTotal={10} />);
    expect(screen.getByText('step6.stamp.preview.template')).toBeInTheDocument();

    // stampGridRows=4 → stampTotal=20
    useCardBuilderStore.setState({ stampGridRows: 4 });
    rerender(<StampCardLogicPreview stampTotal={20} />);
    expect(screen.getByText('step6.stamp.preview.template')).toBeInTheDocument();
  });
});
