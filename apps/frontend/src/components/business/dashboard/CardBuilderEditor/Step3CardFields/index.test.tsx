/**
 * Step3CardFields — Vitest + RTL Tests
 *
 * Covers the Step 3 "顯示欄位" left/right field selector:
 *   1. filterCARD_FIELDS_BY_CARD_TYPE returns cashback-only fields for cashback_card
 *   2. filterCARD_FIELDS_BY_CARD_TYPE returns common + cashback fields for cashback_card
 *   3. filterCARD_FIELDS_BY_CARD_TYPE does NOT return reward-only fields for cashback_card
 *   4. resolveOptionLabelKey renders "獎勵" for memberLevel when cardType === 'cashback_card'
 *   5. Dropdown renders all available fields for cashback_card (common + cashback groups)
 *
 * Conventions:
 *   - vi.mock('react-i18next') returns `t: key => key`
 *   - vi.mock('../CardBuilderEditor.store') provides minimal store state
 *   - Tests use RTL `render` with the component under test
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { Step3CardFields } from './index';
import { filterCARD_FIELDS_BY_CARD_TYPE, CASHBACK_CARD_TYPES } from './filterCARD_FIELDS_BY_CARD_TYPE';

// Mock i18n — vi.fn(key => key) makes t() return the key as text.
// This lets us assert against key paths directly without depending on the
// actual translation strings (those are guarded by verify-i18n-keys.mjs).
vi.mock('react-i18next', () => ({
  useTranslation: vi.fn(() => ({
    t: vi.fn((key: string) => key),
  })),
}));

// Mock the card builder store — provide minimal state needed by Step3CardFields.
vi.mock('../CardBuilderEditor.store', () => ({
  useCardBuilderStore: vi.fn((selector) => {
    if (typeof selector !== 'function') return undefined;
    return selector({
      leftField: null,
      rightField: null,
      setLeftField: vi.fn(),
      setRightField: vi.fn(),
      cardType: 'cashback_card',
    });
  }),
}));

beforeEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe('filterCARD_FIELDS_BY_CARD_TYPE — cashback_card group isolation', () => {
  /**
   * 2026-09-12 cashback card Step 3 display-field extension.
   *
   * CASHBACK_CARD_TYPES = { cashback_card }.
   * cashback group fields (pointsToNextTierCashback, accumulatedSpendCashback)
   * must appear ONLY when cardType === 'cashback_card'.
   * They must NOT appear for any other card type.
   */

  it('returns cashback-only fields when cardType === cashback_card', () => {
    const fields = filterCARD_FIELDS_BY_CARD_TYPE('cashback_card');
    const keys = fields.map((f) => f.key);

    // Cashback group must be visible.
    expect(keys).toContain('pointsToNextTierCashback');
    expect(keys).toContain('accumulatedSpendCashback');
  });

  it('returns common fields alongside cashback fields for cashback_card', () => {
    const fields = filterCARD_FIELDS_BY_CARD_TYPE('cashback_card');
    const keys = fields.map((f) => f.key);

    // Common group: always shown.
    expect(keys).toContain('phone');
    expect(keys).toContain('email');
    expect(keys).toContain('memberLevel');
    expect(keys).toContain('birthday');
    expect(keys).toContain('visitCount');
    expect(keys).toContain('memberName');
  });

  it('does NOT return reward-only fields for cashback_card (group isolation)', () => {
    const fields = filterCARD_FIELDS_BY_CARD_TYPE('cashback_card');
    const keys = fields.map((f) => f.key);

    // Reward-only group must NOT be visible for cashback_card.
    expect(keys).not.toContain('pointsToNextTier');
    expect(keys).not.toContain('currentPoints');
  });

  it('does NOT return stamp-only fields for cashback_card', () => {
    const fields = filterCARD_FIELDS_BY_CARD_TYPE('cashback_card');
    const keys = fields.map((f) => f.key);

    expect(keys).not.toContain('availableRewards');
    expect(keys).not.toContain('totalStamps');
    expect(keys).not.toContain('stampsRemaining');
  });

  it('returns only common fields when cardType is null', () => {
    const fields = filterCARD_FIELDS_BY_CARD_TYPE(null);
    const keys = fields.map((f) => f.key);

    // Only common fields when cardType is null.
    expect(keys).toContain('phone');
    expect(keys).toContain('memberLevel');
    expect(keys).not.toContain('pointsToNextTierCashback');
    expect(keys).not.toContain('accumulatedSpendCashback');
    expect(keys).not.toContain('pointsToNextTier');
    expect(keys).not.toContain('availableRewards');
  });

  it('returns common + stamp fields for stamp_card (stamp group visibility)', () => {
    const fields = filterCARD_FIELDS_BY_CARD_TYPE('stamp_card');
    const keys = fields.map((f) => f.key);

    expect(keys).toContain('availableRewards');
    expect(keys).toContain('totalStamps');
    expect(keys).toContain('stampsRemaining');
    expect(keys).not.toContain('pointsToNextTierCashback');
    expect(keys).not.toContain('accumulatedSpendCashback');
  });

  it('returns common + reward fields for reward_card (reward group visibility)', () => {
    const fields = filterCARD_FIELDS_BY_CARD_TYPE('reward_card');
    const keys = fields.map((f) => f.key);

    expect(keys).toContain('pointsToNextTier');
    expect(keys).toContain('currentPoints');
    expect(keys).not.toContain('pointsToNextTierCashback');
    expect(keys).not.toContain('accumulatedSpendCashback');
  });

  it('cashback group fields do NOT appear for reward_card', () => {
    const fields = filterCARD_FIELDS_BY_CARD_TYPE('reward_card');
    const keys = fields.map((f) => f.key);

    expect(keys).not.toContain('pointsToNextTierCashback');
    expect(keys).not.toContain('accumulatedSpendCashback');
  });

  it('cashback group fields do NOT appear for stamp_card', () => {
    const fields = filterCARD_FIELDS_BY_CARD_TYPE('stamp_card');
    const keys = fields.map((f) => f.key);

    expect(keys).not.toContain('pointsToNextTierCashback');
    expect(keys).not.toContain('accumulatedSpendCashback');
  });

  it('cashback group fields do NOT appear for multipass', () => {
    const fields = filterCARD_FIELDS_BY_CARD_TYPE('multipass');
    const keys = fields.map((f) => f.key);

    expect(keys).not.toContain('pointsToNextTierCashback');
    expect(keys).not.toContain('accumulatedSpendCashback');
  });

  it('cashback group fields do NOT appear for membership_card', () => {
    const fields = filterCARD_FIELDS_BY_CARD_TYPE('membership_card');
    const keys = fields.map((f) => f.key);

    expect(keys).not.toContain('pointsToNextTierCashback');
    expect(keys).not.toContain('accumulatedSpendCashback');
  });

  it('CASHBACK_CARD_TYPES constant contains exactly cashback_card', () => {
    expect(CASHBACK_CARD_TYPES.size).toBe(1);
    expect(CASHBACK_CARD_TYPES.has('cashback_card')).toBe(true);
    expect(CASHBACK_CARD_TYPES.has('stamp_card')).toBe(false);
    expect(CASHBACK_CARD_TYPES.has('reward_card')).toBe(false);
  });
});

describe('Step3CardFields — cashback_card memberLevel → 獎勵 label override in dropdown', () => {
  /**
   * 2026-09-12 cashback card member-level → reward refactor.
   *
   * When cardType === 'cashback_card', the `memberLevel` option in the
   * left/right field dropdown must render as "獎勵" / "Reward" (using
   * `step3.fieldsSection.fields.memberLevelStamp`) instead of the original
   * "會員等級" / "Member Level" label.
   *
   * The override mirrors the stamp_card / reward_card behavior:
   *   - stamp_card:    rewardName input value → preview value
   *   - reward_card:   rewardTiers[0].name → preview value
   *   - cashback_card: cashbackTiers[0].name → preview value
   * All three share the same label: `step3.fieldsSection.fields.memberLevelStamp`.
   */

  it('renders the dropdown options when cardType is cashback_card', () => {
    render(<Step3CardFields />);

    // The component should render two <select> elements (left + right).
    const selects = screen.getAllByRole('combobox');
    expect(selects).toHaveLength(2);
  });

  it('renders the memberLevel option with memberLevelStamp label (獎勵) in the left dropdown for cashback_card', () => {
    render(<Step3CardFields />);

    const selects = screen.getAllByRole('combobox');
    const leftSelect = selects[0];

    // The option with value="memberLevel" should have label "獎勵" (from memberLevelStamp key).
    const memberLevelOption = leftSelect.querySelector('option[value="memberLevel"]');
    expect(memberLevelOption).not.toBeNull();
    // The t() mock returns the key as text, so the rendered text should be
    // the full memberLevelStamp key path (the actual Chinese "獎勵" string
    // is provided by the real i18n; the mock returns the key path).
    expect(memberLevelOption?.textContent).toContain('memberLevelStamp');
  });

  it('renders the memberLevel option with memberLevelStamp label (獎勵) in the right dropdown for cashback_card', () => {
    render(<Step3CardFields />);

    const selects = screen.getAllByRole('combobox');
    const rightSelect = selects[1];

    const memberLevelOption = rightSelect.querySelector('option[value="memberLevel"]');
    expect(memberLevelOption).not.toBeNull();
    expect(memberLevelOption?.textContent).toContain('memberLevelStamp');
  });

  it('renders cashback-only field options (pointsToNextTierCashback, accumulatedSpendCashback) in the dropdown', () => {
    render(<Step3CardFields />);

    const selects = screen.getAllByRole('combobox');
    const leftSelect = selects[0];

    // pointsToNextTierCashback option must be present.
    const cashbackOption1 = leftSelect.querySelector('option[value="pointsToNextTierCashback"]');
    expect(cashbackOption1).not.toBeNull();
    expect(cashbackOption1?.textContent).toContain('pointsToNextTierCashback');

    // accumulatedSpendCashback option must be present.
    const cashbackOption2 = leftSelect.querySelector('option[value="accumulatedSpendCashback"]');
    expect(cashbackOption2).not.toBeNull();
    expect(cashbackOption2?.textContent).toContain('accumulatedSpendCashback');
  });

  it('does NOT render reward-only field options in the dropdown for cashback_card', () => {
    render(<Step3CardFields />);

    const selects = screen.getAllByRole('combobox');
    const leftSelect = selects[0];

    // pointsToNextTier (reward group) must NOT be an option.
    const rewardOption = leftSelect.querySelector('option[value="pointsToNextTier"]');
    expect(rewardOption).toBeNull();

    // currentPoints (reward group) must NOT be an option.
    const currentPointsOption = leftSelect.querySelector('option[value="currentPoints"]');
    expect(currentPointsOption).toBeNull();
  });
});
