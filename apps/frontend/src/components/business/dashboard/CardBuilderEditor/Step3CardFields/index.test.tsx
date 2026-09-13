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
import { useCardBuilderStore } from '../CardBuilderEditor.store';

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

describe('filterCARD_FIELDS_BY_CARD_TYPE — membership_card hides memberName', () => {
  /**
   * 2026-09-13 membership_card Step 3 display-field opt-out.
   *
   * `memberName` carries `hideOnCardTypes: ['membership_card']` on
   * `CardFieldDefinition`. The filter must drop it when
   * `cardType === 'membership_card'`, but it must still appear for
   * every other card type (regression — preserving the original
   * "always-on common field" behavior).
   *
   * Plan: membership_card_conditional_ui_hide (2026-09-13).
   * Rationale: the pass record name is already surfaced via the SQL
   * `templates.name` column (also rendered in the editor header as
   * the "Logo Text" via the 2026-09-13 semantic swap), so re-displaying
   * it as a Step 3 left/right face field on a membership card is
   * redundant.
   */

  it('returns common fields but EXCLUDES memberName for membership_card', () => {
    const fields = filterCARD_FIELDS_BY_CARD_TYPE('membership_card');
    const keys = fields.map((f) => f.key);

    // Common group still shown (minus the excluded one).
    expect(keys).toContain('phone');
    expect(keys).toContain('email');
    expect(keys).toContain('memberLevel');
    expect(keys).toContain('birthday');
    expect(keys).toContain('visitCount');

    // memberName hidden for membership_card.
    expect(keys).not.toContain('memberName');
  });

  it('INCLUDES memberName for non-membership card types (regression guard)', () => {
    const nonMembershipTypes = ['stamp_card', 'reward_card', 'cashback_card', 'multipass'] as const;
    for (const ct of nonMembershipTypes) {
      const keys = filterCARD_FIELDS_BY_CARD_TYPE(ct).map((f) => f.key);
      expect(keys, `cardType=${ct} should include memberName`).toContain('memberName');
    }
  });

  it('INCLUDES memberName when cardType is null (Step 1 not yet selected)', () => {
    const keys = filterCARD_FIELDS_BY_CARD_TYPE(null).map((f) => f.key);
    // Step 1 not completed → no exclusions apply (hideOnCardTypes only
    // fires when cardType !== null and is in the exclusion list).
    expect(keys).toContain('memberName');
  });

  it('does NOT exclude unrelated common fields for membership_card', () => {
    const fields = filterCARD_FIELDS_BY_CARD_TYPE('membership_card');
    const keys = fields.map((f) => f.key);

    // phone/email/memberLevel/birthday/visitCount must still be visible
    // (only memberName is in hideOnCardTypes for membership_card).
    expect(keys).toContain('phone');
    expect(keys).toContain('email');
    expect(keys).toContain('memberLevel');
    expect(keys).toContain('birthday');
    expect(keys).toContain('visitCount');
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

describe('Step3CardFields — membership_card hides memberName option in dropdown', () => {
  /**
   * 2026-09-13 membership_card Step 3 conditional render.
   *
   * Mirror of the cashback_card memberLevel override describe block above,
   * but for the membership_card → memberName exclusion. The store mock is
   * swapped per-test via `vi.mocked(useCardBuilderStore).mockImplementation`
   * so the existing cashback_card assertions stay unaffected.
   *
   * Plan: membership_card_conditional_ui_hide (2026-09-13).
   */
  beforeEach(() => {
    vi.mocked(useCardBuilderStore).mockImplementation((selector) => {
      if (typeof selector !== 'function') return undefined;
      return selector({
        // Only the keys actually read by Step3CardFields matter; other
        // store slices are omitted because the component doesn't read them.
        leftField: null,
        rightField: null,
        setLeftField: vi.fn(),
        setRightField: vi.fn(),
        cardType: 'membership_card',
      } as never);
    });
  });

  it('does NOT render memberName option in the LEFT dropdown', () => {
    render(<Step3CardFields />);

    const selects = screen.getAllByRole('combobox');
    const leftSelect = selects[0];

    const memberNameOption = leftSelect.querySelector('option[value="memberName"]');
    expect(memberNameOption).toBeNull();
  });

  it('does NOT render memberName option in the RIGHT dropdown', () => {
    render(<Step3CardFields />);

    const selects = screen.getAllByRole('combobox');
    const rightSelect = selects[1];

    const memberNameOption = rightSelect.querySelector('option[value="memberName"]');
    expect(memberNameOption).toBeNull();
  });

  it('still renders other common fields in the dropdown (regression — only memberName is excluded)', () => {
    render(<Step3CardFields />);

    const selects = screen.getAllByRole('combobox');
    const leftSelect = selects[0];

    // phone / email / memberLevel / birthday / visitCount must remain.
    expect(leftSelect.querySelector('option[value="phone"]')).not.toBeNull();
    expect(leftSelect.querySelector('option[value="email"]')).not.toBeNull();
    expect(leftSelect.querySelector('option[value="memberLevel"]')).not.toBeNull();
    expect(leftSelect.querySelector('option[value="birthday"]')).not.toBeNull();
    expect(leftSelect.querySelector('option[value="visitCount"]')).not.toBeNull();
  });
});
