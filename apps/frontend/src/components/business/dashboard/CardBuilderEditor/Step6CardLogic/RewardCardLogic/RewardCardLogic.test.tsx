/**
 * RewardCardLogic — Vitest + RTL Integration Test (Rule 003 TDD)
 *
 * 2026-09-09 mixed refactor: `<EarningModeField />` is BACK at the top level
 * (one mode per card), mirroring `StampCardLogic`'s `<StampAccrualModeField />`
 * pattern. The integration test now verifies that:
 *   - EarningModeField is rendered at the top level.
 *   - RewardTierList is rendered (which contains RewardTierRow).
 *   - RewardCardLogicPreview is rendered.
 *
 * Plan ref: step6_reward_card 2026-09-09 § Phase 8 Unit Tests.
 */

import { render, screen, cleanup } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { RewardCardLogic } from './RewardCardLogic';
import { useCardBuilderStore } from '../../CardBuilderEditor.store';

// Mock all sub-components so we can assert their presence without rendering their internals.
const renderLog: string[] = [];

vi.mock('./EarningModeField', () => ({
  EarningModeField: ({ showValidation }: { showValidation: boolean }) => {
    renderLog.push(`EarningModeField(showValidation=${showValidation})`);
    return <div data-testid="sub-earning-mode">EarningModeField</div>;
  },
}));

vi.mock('./RewardTierList', () => ({
  RewardTierList: ({ showValidation }: { showValidation: boolean }) => {
    renderLog.push(`RewardTierList(showValidation=${showValidation})`);
    return <div data-testid="sub-reward-tier-list">RewardTierList</div>;
  },
}));

vi.mock('./RewardCardLogicPreview', () => ({
  RewardCardLogicPreview: () => {
    renderLog.push('RewardCardLogicPreview()');
    return <div data-testid="sub-preview">RewardCardLogicPreview</div>;
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

describe('RewardCardLogic — integration (top-level sub-components)', () => {
  it('renders EarningModeField + RewardTierList + RewardCardLogicPreview (2026-09-09 mixed refactor)', () => {
    render(<RewardCardLogic showValidation={false} />);

    expect(screen.getByTestId('sub-earning-mode')).toBeInTheDocument();
    expect(screen.getByTestId('sub-reward-tier-list')).toBeInTheDocument();
    expect(screen.getByTestId('sub-preview')).toBeInTheDocument();

    expect(renderLog).toEqual([
      'EarningModeField(showValidation=false)',
      'RewardTierList(showValidation=false)',
      'RewardCardLogicPreview()',
    ]);
  });

  it('forwards showValidation=true to both EarningModeField and RewardTierList (Preview takes no showValidation)', () => {
    render(<RewardCardLogic showValidation={true} />);

    expect(renderLog).toContain('EarningModeField(showValidation=true)');
    expect(renderLog).toContain('RewardTierList(showValidation=true)');
    // Preview is a presentational component — it does NOT take showValidation.
    expect(renderLog).toContain('RewardCardLogicPreview()');
  });
});