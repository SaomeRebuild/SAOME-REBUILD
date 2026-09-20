/**
 * MultipassTierList — Vitest + RTL Tests (Rule 003 TDD)
 *
 * Mirrors DiscountTierList test pattern (2026-09-18). Verifies:
 *   - Renders one MultipassTierRow per multipass tier.
 *   - "新增獎勵級距" button appends a new tier via addMultipassTier.
 *   - Button is disabled at MAX_MULTIPASS_TIERS=5.
 *   - "maxTiersReached" hint is shown when at cap.
 *   - Renders the seeded default-multipass-tier on first mount (1 row).
 */

import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { MultipassTierList } from './MultipassTierList';
import { useCardBuilderStore } from '../../CardBuilderEditor.store';
import { MAX_MULTIPASS_TIERS } from '@saome/shared/constants';

vi.mock('react-i18next', () => ({
  useTranslation: vi.fn(() => ({
    t: vi.fn((key: string) => key),
  })),
}));

// Mock MultipassTierRow to count renders without depending on sub-fields.
// PR-4 (2026-09-19): must forward duplicateStampsNeeded prop (now required
// on RowProps). Also renders a sentinel testid matching the warning the
// REAL MultipassTierStampsNeededField emits so existing CRUD tests
// remain isolated from sub-component rendering.
//
// Note: We normalize `undefined` → null because the production code may
// not always pass the prop (e.g. early in development before the derived
// selector lands). This keeps the mock semantically aligned with the
// type contract (number | null).
let tierRowRenderCount = 0;
vi.mock('./MultipassTierRow', () => ({
  MultipassTierRow: ({
    tierId,
    duplicateStampsNeeded,
  }: {
    tierId: string;
    duplicateStampsNeeded: number | null;
  }) => {
    tierRowRenderCount += 1;
    const dup: number | null =
      duplicateStampsNeeded === undefined || duplicateStampsNeeded === null
        ? null
        : duplicateStampsNeeded;
    return (
      <div
        data-testid={`multipass-tier-row-${tierId}`}
        data-duplicate-stamps-needed={dup ?? 'null'}
      >
        TierRow
        {dup !== null && (
          <span
            data-testid={`step6-multipass-${tierId}-stamps-duplicate-warning`}
          />
        )}
      </div>
    );
  },
}));

afterEach(() => {
  tierRowRenderCount = 0;
  useCardBuilderStore.getState().reset();
  cleanup();
});

describe('MultipassTierList — CRUD', () => {
  it('renders one MultipassTierRow per tier', () => {
    useCardBuilderStore.setState({
      multipassTiers: [
        { id: 'a', name: 'A', stampsNeeded: 0, rewardType: 'amount_off', rewardValue: 10, perVisitCount: null, perVisitStamps: null, perSpendAmount: null, perSpendStamps: null },
        { id: 'b', name: 'B', stampsNeeded: 5, rewardType: 'percent_off', rewardValue: 5, perVisitCount: null, perVisitStamps: null, perSpendAmount: null, perSpendStamps: null },
      ],
    });
    render(<MultipassTierList showValidation={false} />);

    expect(screen.getByTestId('multipass-tier-row-a')).toBeInTheDocument();
    expect(screen.getByTestId('multipass-tier-row-b')).toBeInTheDocument();
    expect(tierRowRenderCount).toBe(2);
  });

  it('renders the seeded default-multipass-tier on first mount', () => {
    // After reset() the store seeds 1 default tier with id='default-multipass-tier'.
    render(<MultipassTierList showValidation={false} />);
    expect(screen.getByTestId('multipass-tier-row-default-multipass-tier')).toBeInTheDocument();
    expect(tierRowRenderCount).toBe(1);
  });

  it('"新增獎勵級距" button appends a new tier', () => {
    // Start with 1 tier (default seed).
    render(<MultipassTierList showValidation={false} />);

    const addBtn = screen.getByRole('button', { name: 'step6.multipass.addTier' });
    fireEvent.click(addBtn);

    expect(useCardBuilderStore.getState().multipassTiers.length).toBe(2);
  });

  it('button is disabled at MAX_MULTIPASS_TIERS=5', () => {
    // Fill up to MAX_MULTIPASS_TIERS
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

    render(<MultipassTierList showValidation={false} />);

    const addBtn = screen.getByRole('button', { name: 'step6.multipass.addTier' });
    expect(addBtn).toBeDisabled();
  });

  it('shows maxTiersReached hint when at cap', () => {
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

    render(<MultipassTierList showValidation={false} />);

    expect(
      screen.getByText('step6.multipass.maxTiersReached'),
    ).toBeInTheDocument();
  });
});

// =====================================================================
// PR-4 (2026-09-19) — duplicate stampsNeeded warning UI conformance
// =====================================================================
// Non-blocking warning (純 UI 提示). The list derives which rows have
// duplicate stampsNeeded via useMemo and forwards the count to each
// MultipassTierRow → MultipassTierStampsNeededField, which renders a
// warning icon (data-testid pattern: `step6-multipass-{tierId}-stamps-duplicate-warning`).

describe('MultipassTierList — PR-4 duplicate stampsNeeded warning', () => {
  const TIER_ID_A = 'tier-a';
  const TIER_ID_B = 'tier-b';
  const TIER_ID_C = 'tier-c';

  const seedTiers = (values: Array<{ id: string; stampsNeeded: number }>) => {
    useCardBuilderStore.setState({
      multipassTiers: values.map((v) => ({
        id: v.id,
        name: `Tier ${v.id}`,
        stampsNeeded: v.stampsNeeded,
        rewardType: 'amount_off' as const,
        rewardValue: 10,
        perVisitCount: null,
        perVisitStamps: null,
        perSpendAmount: null,
        perSpendStamps: null,
      })),
    });
  };

  it('shows warning on BOTH rows when 2 tiers share stampsNeeded=5', () => {
    seedTiers([
      { id: TIER_ID_A, stampsNeeded: 5 },
      { id: TIER_ID_B, stampsNeeded: 5 },
    ]);
    render(<MultipassTierList showValidation={false} />);

    expect(
      screen.getByTestId(`step6-multipass-${TIER_ID_A}-stamps-duplicate-warning`),
    ).toBeInTheDocument();
    expect(
      screen.getByTestId(`step6-multipass-${TIER_ID_B}-stamps-duplicate-warning`),
    ).toBeInTheDocument();
  });

  it('does NOT show warning when only 1 tier has stampsNeeded=5', () => {
    seedTiers([{ id: TIER_ID_A, stampsNeeded: 5 }]);
    render(<MultipassTierList showValidation={false} />);

    expect(
      screen.queryByTestId(`step6-multipass-${TIER_ID_A}-stamps-duplicate-warning`),
    ).not.toBeInTheDocument();
  });

  it('does NOT show warning for welcome-gift (stampsNeeded=0) paired with stampsNeeded=10', () => {
    // stampsNeeded=0 (歡迎禮) + stampsNeeded=10 → 兩者都唯一，無警告
    seedTiers([
      { id: TIER_ID_A, stampsNeeded: 0 },
      { id: TIER_ID_B, stampsNeeded: 10 },
    ]);
    render(<MultipassTierList showValidation={false} />);

    expect(
      screen.queryByTestId(`step6-multipass-${TIER_ID_A}-stamps-duplicate-warning`),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByTestId(`step6-multipass-${TIER_ID_B}-stamps-duplicate-warning`),
    ).not.toBeInTheDocument();
  });

  it('shows warning on ALL 3 rows when 3 tiers share stampsNeeded=5', () => {
    seedTiers([
      { id: TIER_ID_A, stampsNeeded: 5 },
      { id: TIER_ID_B, stampsNeeded: 5 },
      { id: TIER_ID_C, stampsNeeded: 5 },
    ]);
    render(<MultipassTierList showValidation={false} />);

    expect(
      screen.getByTestId(`step6-multipass-${TIER_ID_A}-stamps-duplicate-warning`),
    ).toBeInTheDocument();
    expect(
      screen.getByTestId(`step6-multipass-${TIER_ID_B}-stamps-duplicate-warning`),
    ).toBeInTheDocument();
    expect(
      screen.getByTestId(`step6-multipass-${TIER_ID_C}-stamps-duplicate-warning`),
    ).toBeInTheDocument();
  });
});
