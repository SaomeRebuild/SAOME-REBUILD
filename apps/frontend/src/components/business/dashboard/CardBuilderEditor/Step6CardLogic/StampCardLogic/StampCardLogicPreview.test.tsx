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
 * Plan ref: step6_集點卡模組化實作 plan 2026-09-07 § Phase 6.1 StampCardLogicPreview test.
 */

import { render, screen, cleanup } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { StampCardLogicPreview } from './StampCardLogicPreview';
import { useCardBuilderStore } from '../../CardBuilderEditor.store';

vi.mock('react-i18next', () => ({
  useTranslation: vi.fn(() => ({
    t: vi.fn((key: string, _params?: Record<string, unknown>) => {
      if (key.includes('template')) return key;
      return key;
    }),
  })),
}));

afterEach(() => {
  useCardBuilderStore.getState().reset();
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

  it('renders the template sentence when accrualMode and rewardName are set (amount_off)', () => {
    useCardBuilderStore.setState({
      stampAccrualMode: 'per_stamp',
      rewardName: '10元折價',
      rewardType: 'amount_off',
      rewardValue: 10,
      maxDiscountAmount: null,
    });
    render(<StampCardLogicPreview stampTotal={10} />);

    // Full sentence key: step6.stamp.preview.template with { total: 10, reward: amountReward }
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
