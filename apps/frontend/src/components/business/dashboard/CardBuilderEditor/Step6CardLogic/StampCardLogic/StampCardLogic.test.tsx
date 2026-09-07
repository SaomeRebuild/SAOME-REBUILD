/**
 * StampCardLogic — Vitest + RTL Integration Test (Rule 003 TDD)
 *
 * Verifies:
 *   - All 6 sub-components are rendered in order
 *   - stampGridRows × 5 = stampTotal prop passed to preview
 *   - showValidation is forwarded to all sub-components
 *
 * Plan ref: step6_集點卡模組化實作 plan 2026-09-07 § Phase 6.1 StampCardLogic integration test.
 */

import { render, screen, cleanup } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { StampCardLogic } from './StampCardLogic';
import { useCardBuilderStore } from '../../CardBuilderEditor.store';

// Mock all sub-components so we can assert their presence without rendering their internals.
const renderLog: string[] = [];

vi.mock('./StampAccrualModeField', () => ({
  StampAccrualModeField: ({ showValidation }: { showValidation: boolean }) => {
    renderLog.push(`StampAccrualModeField(showValidation=${showValidation})`);
    return <div data-testid="sub-stamp-accrual-mode">StampAccrualModeField</div>;
  },
}));

vi.mock('./RewardNameField', () => ({
  RewardNameField: ({ showValidation }: { showValidation: boolean }) => {
    renderLog.push(`RewardNameField(showValidation=${showValidation})`);
    return <div data-testid="sub-reward-name">RewardNameField</div>;
  },
}));

vi.mock('./RewardTypeField', () => ({
  RewardTypeField: ({ showValidation }: { showValidation: boolean }) => {
    renderLog.push(`RewardTypeField(showValidation=${showValidation})`);
    return <div data-testid="sub-reward-type">RewardTypeField</div>;
  },
}));

vi.mock('./RewardValueField', () => ({
  RewardValueField: ({ showValidation }: { showValidation: boolean }) => {
    renderLog.push(`RewardValueField(showValidation=${showValidation})`);
    return <div data-testid="sub-reward-value">RewardValueField</div>;
  },
}));

vi.mock('./MaxDiscountAmountField', () => ({
  MaxDiscountAmountField: ({ showValidation }: { showValidation: boolean }) => {
    renderLog.push(`MaxDiscountAmountField(showValidation=${showValidation})`);
    return <div data-testid="sub-max-discount">MaxDiscountAmountField</div>;
  },
}));

vi.mock('./StampCardLogicPreview', () => ({
  StampCardLogicPreview: ({
    stampTotal,
  }: {
    stampTotal: number;
  }) => {
    renderLog.push(`StampCardLogicPreview(stampTotal=${stampTotal})`);
    return <div data-testid="sub-preview">StampCardLogicPreview</div>;
  },
}));

vi.mock('react-i18next', () => ({
  useTranslation: vi.fn(() => ({
    t: vi.fn((key: string) => key),
  })),
}));

afterEach(() => {
  renderLog.length = 0;
  useCardBuilderStore.getState().reset();
  cleanup();
});

describe('StampCardLogic — integration (6 sub-components)', () => {
  it('renders all 6 sub-components in order', () => {
    render(<StampCardLogic showValidation={false} />);

    expect(screen.getByTestId('sub-stamp-accrual-mode')).toBeInTheDocument();
    expect(screen.getByTestId('sub-reward-name')).toBeInTheDocument();
    expect(screen.getByTestId('sub-reward-type')).toBeInTheDocument();
    expect(screen.getByTestId('sub-reward-value')).toBeInTheDocument();
    expect(screen.getByTestId('sub-max-discount')).toBeInTheDocument();
    expect(screen.getByTestId('sub-preview')).toBeInTheDocument();

    expect(renderLog).toEqual([
      'StampAccrualModeField(showValidation=false)',
      'RewardNameField(showValidation=false)',
      'RewardTypeField(showValidation=false)',
      'RewardValueField(showValidation=false)',
      'MaxDiscountAmountField(showValidation=false)',
      'StampCardLogicPreview(stampTotal=5)',
    ]);
  });

  it('forwards showValidation=true to field sub-components (5 of 6; Preview has no showValidation prop)', () => {
    render(<StampCardLogic showValidation={true} />);

    expect(renderLog).toContain('StampAccrualModeField(showValidation=true)');
    expect(renderLog).toContain('RewardNameField(showValidation=true)');
    expect(renderLog).toContain('RewardTypeField(showValidation=true)');
    expect(renderLog).toContain('RewardValueField(showValidation=true)');
    expect(renderLog).toContain('MaxDiscountAmountField(showValidation=true)');
    // StampCardLogicPreview receives only stampTotal, not showValidation.
    expect(renderLog).toContain('StampCardLogicPreview(stampTotal=5)');
  });

  it('passes stampTotal = stampGridRows × 5 to StampCardLogicPreview', () => {
    useCardBuilderStore.setState({ stampGridRows: 2 });
    render(<StampCardLogic showValidation={false} />);

    expect(renderLog).toContain('StampCardLogicPreview(stampTotal=10)');
  });

  it('stampTotal reflects the current stampGridRows from store', () => {
    useCardBuilderStore.setState({ stampGridRows: 4 });
    render(<StampCardLogic showValidation={false} />);

    expect(renderLog).toContain('StampCardLogicPreview(stampTotal=20)');
  });
});
