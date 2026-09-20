/**
 * MultipassCardLogic — Vitest + RTL Tests (Rule 003 TDD)
 *
 * Verifies the main component renders its 1 sub-component:
 *   - <MultipassTierList /> — list of up to 5 multipass tiers
 *
 * Mirrors the DiscountCardLogic test pattern (2026-09-18):
 *   - Empty tier array (after manual clear) → auto-add useEffect reseeds 1 row
 *   - 1 tier with valid data → list renders
 *   - 5 tiers (cap reached) → list shows maxTiersReached
 */

import { render, screen, cleanup, act } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { MultipassCardLogic } from './MultipassCardLogic';
import { useCardBuilderStore } from '../../CardBuilderEditor.store';
import { MAX_MULTIPASS_TIERS } from '@saome/shared/constants';

vi.mock('react-i18next', () => ({
  useTranslation: vi.fn(() => ({
    t: vi.fn((key: string) => key),
  })),
}));

// Mock the sub-components so the test focuses on composition + auto-add.
//
// Mock structure (PR-5, 2026-09-20): the new <MultipassAccrualModeField>
// mock captures its call timing via a data-testid, while the existing
// <MultipassTierList> mock also has a data-testid. We assert that BOTH
// are rendered in the order: AccrualModeField → TierList. We also
// capture a per-tier render log to count how many rows are emitted.
//
// To keep timing deterministic (renders happen synchronously in jsdom +
// RTL), each mock records a `renderLog` entry via `console.log` — but
// vitest mocks `console.log` by default? No, we use a module-scoped
// array that the mocks push to. That's reliable enough.

const renderOrderLog: string[] = [];

vi.mock('./MultipassAccrualModeField', () => ({
  MultipassAccrualModeField: () => {
    renderOrderLog.push('MultipassAccrualModeField');
    return <div data-testid="multipass-accrual-mode-field" />;
  },
}));
vi.mock('./MultipassTierList', () => ({
  MultipassTierList: () => {
    renderOrderLog.push('MultipassTierList');
    return <div data-testid="multipass-tier-list" />;
  },
}));

afterEach(() => {
  useCardBuilderStore.getState().reset();
  cleanup();
});

describe('MultipassCardLogic — main component (Rule 000 § A.1)', () => {
  it('renders the MultipassTierList sub-component', () => {
    render(<MultipassCardLogic showValidation={false} />);
    expect(screen.getByTestId('multipass-tier-list')).toBeInTheDocument();
  });

  it('renders the MultipassAccrualModeField sub-component (PR-5 2026-09-20)', () => {
    render(<MultipassCardLogic showValidation={false} />);
    expect(screen.getByTestId('multipass-accrual-mode-field')).toBeInTheDocument();
  });

  it('renders MultipassAccrualModeField BEFORE MultipassTierList (PR-5 render-order)', () => {
    // ★ PR-5 conformance: the card-wide accrual mode radio (top of editor)
    // must render BEFORE the tier list (mirrors StampCardLogic composition:
    // StampAccrualModeField → StampTierList). Verified by inspecting the
    // captured render order log.
    renderOrderLog.length = 0;
    render(<MultipassCardLogic showValidation={false} />);

    // jsdom renders synchronously: at least one of each in the log.
    const accrualIdx = renderOrderLog.indexOf('MultipassAccrualModeField');
    const tierListIdx = renderOrderLog.indexOf('MultipassTierList');
    expect(accrualIdx).toBeGreaterThanOrEqual(0);
    expect(tierListIdx).toBeGreaterThanOrEqual(0);
    expect(accrualIdx).toBeLessThan(tierListIdx);
  });

  it('auto-add useEffect reseeds 1 tier when array is empty', () => {
    // Clear the seeded default out of the store to force a 0-length array,
    // then mount the component and verify the auto-add useEffect reseeds.
    useCardBuilderStore.setState({ multipassTiers: [] });
    expect(useCardBuilderStore.getState().multipassTiers.length).toBe(0);

    act(() => {
      render(<MultipassCardLogic showValidation={false} />);
    });

    // After mount, the auto-add useEffect should have appended 1 default
    // tier so the array is no longer empty.
    expect(useCardBuilderStore.getState().multipassTiers.length).toBe(1);
    expect(useCardBuilderStore.getState().multipassTiers[0]).toMatchObject({
      name: '',
      stampsNeeded: 0,
      rewardType: null,
      rewardValue: null,
    });
  });

  it('renders the seeded default-multipass-tier on first mount (1 row already)', () => {
    // reset() seeds 1 default tier; component should not double-seed.
    render(<MultipassCardLogic showValidation={false} />);

    expect(useCardBuilderStore.getState().multipassTiers.length).toBe(1);
    expect(useCardBuilderStore.getState().multipassTiers[0].id).toBe(
      'default-multipass-tier',
    );
  });

  it('still renders MultipassTierList when at MAX_MULTIPASS_TIERS=5', () => {
    // Fill the store to cap (5 tiers). Component renders unchanged.
    const tiers = Array.from({ length: MAX_MULTIPASS_TIERS }, (_, i) => ({
      id: `t-${i}`,
      name: `T${i}`,
      stampsNeeded: i,
      rewardType: 'amount_off' as const,
      rewardValue: 1,
      perVisitCount: null,
      perVisitStamps: null,
      perSpendAmount: null,
      perSpendStamps: null,
    }));
    useCardBuilderStore.setState({ multipassTiers: tiers });

    render(<MultipassCardLogic showValidation={false} />);

    expect(screen.getByTestId('multipass-tier-list')).toBeInTheDocument();
    expect(useCardBuilderStore.getState().multipassTiers.length).toBe(5);
  });
});
