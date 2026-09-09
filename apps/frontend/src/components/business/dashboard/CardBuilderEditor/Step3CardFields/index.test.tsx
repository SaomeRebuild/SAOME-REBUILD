/**
 * Step3CardFields — Vitest + RTL tests
 *
 * Covers (per step3_card_fields_selector_baffa936.plan.md § Test coverage):
 *   1. Renders section title and hint
 *   2. Renders two `<select>` elements with correct aria-labels
 *   3. Each `<select>` has 7 options (1 placeholder + 6 fields)
 *   4. Default value is the placeholder (empty string)
 *   5. Selecting a field on the left updates the store
 *   6. Selecting a field on the right disables the matching option on the LEFT
 *   7. Changing the left selection re-enables the previously disabled option
 *   8. Disabled option text includes the "已選" / "already selected" suffix
 *
 * Conventions follow ColorSwatchPicker.test.tsx:
 *   - vitest + RTL + fireEvent (not userEvent)
 *   - vi.mock('react-i18next') returns `t: key => key`
 *   - vi.mock shared constants to keep test deterministic
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, cleanup, act } from '@testing-library/react';
import { Step3CardFields } from './index';
import { filterCARD_FIELDS_BY_CARD_TYPE } from './filterCARD_FIELDS_BY_CARD_TYPE';
import { useCardBuilderStore } from '../CardBuilderEditor.store';
import { CARD_FIELDS } from '@saome/shared/constants/card-fields';

// Mock i18n — vi.fn(key => key) makes t() return the key as text.
// This lets us assert against key paths directly without depending on the
// actual translation strings (those are guarded by verify-i18n-keys.mjs).
vi.mock('react-i18next', () => ({
  useTranslation: vi.fn(() => ({ t: vi.fn((key: string) => key) })),
}));

beforeEach(() => {
  cleanup();
  useCardBuilderStore.getState().reset();
});

describe('Step3CardFields — section structure', () => {
  it('renders the section title and hint from the cardEditor namespace', () => {
    render(<Step3CardFields />);
    expect(screen.getByText('step3.fieldsSection.title')).toBeInTheDocument();
    expect(screen.getByText('step3.fieldsSection.hint')).toBeInTheDocument();
  });

  it('renders two <select> elements labeled 左欄位 / 右欄位 (leftField / rightField)', () => {
    render(<Step3CardFields />);
    const leftSelect = screen.getByLabelText('step3.fieldsSection.leftField');
    const rightSelect = screen.getByLabelText('step3.fieldsSection.rightField');
    expect(leftSelect.tagName).toBe('SELECT');
    expect(rightSelect.tagName).toBe('SELECT');
  });
});

describe('Step3CardFields — option list', () => {
  it('each <select> has 7 options for a NON-stamp card type: 1 disabled placeholder + 6 common fields (phone, email, memberLevel, birthday, visitCount, memberName)', () => {
    // Default cardType is null (Step 1 not yet picked) → falls into the
    // 'non-stamp' branch, so the 3 stamp-group options are hidden.
    render(<Step3CardFields />);
    const leftSelect = screen.getByLabelText(
      'step3.fieldsSection.leftField',
    ) as HTMLSelectElement;
    const rightSelect = screen.getByLabelText(
      'step3.fieldsSection.rightField',
    ) as HTMLSelectElement;

    expect(leftSelect.options).toHaveLength(7);
    expect(rightSelect.options).toHaveLength(7);

    const commonKeys = ['phone', 'email', 'memberLevel', 'birthday', 'visitCount', 'memberName'];
    for (const key of commonKeys) {
      expect(leftSelect.querySelector(`option[value="${key}"]`)).toBeTruthy();
      expect(rightSelect.querySelector(`option[value="${key}"]`)).toBeTruthy();
    }

    // First option is the disabled placeholder
    expect(leftSelect.options[0]?.value).toBe('');
    expect(leftSelect.options[0]?.disabled).toBe(true);
  });

  it('default value is the empty string (placeholder), not any field', () => {
    render(<Step3CardFields />);
    const leftSelect = screen.getByLabelText(
      'step3.fieldsSection.leftField',
    ) as HTMLSelectElement;
    const rightSelect = screen.getByLabelText(
      'step3.fieldsSection.rightField',
    ) as HTMLSelectElement;
    expect(leftSelect.value).toBe('');
    expect(rightSelect.value).toBe('');
  });
});

describe('Step3CardFields — visibility (unselected options must be readable)', () => {
  /**
   * Regression guard for the 2026-09-04 "白字白底看不到選項" bug.
   *
   * In dark mode, the body's `color: var(--color-foreground)` (#F8FAFC) was
   * inherited by the OS-native dropdown panel, which renders options on a
   * white background by default — making the text invisible.
   *
   * Fix has THREE halves (each necessary; none alone is sufficient):
   *   1. Closed `<select>` text uses `text-foreground` so the visible
   *      selected value contrasts against the themed background.
   *   2. Inline `color-scheme: light` on the `<select>` forces the dropdown
   *      panel to render in light color scheme → white OS-default panel.
   *   3. Inline `color: #000000` on EACH `<option>` overrides the inherited
   *      body color cascade. `colorScheme: 'light'` alone does NOT override
   *      `color` on `<option>` in Chrome on Windows — text still inherits
   *      from body → white-on-white invisible. Setting `color` explicitly on
   *      every `<option>` is the only reliable cross-browser fix.
   */
  it('<select> applies text-foreground (closed state contrast against themed bg)', () => {
    render(<Step3CardFields />);
    const leftSelect = screen.getByLabelText(
      'step3.fieldsSection.leftField',
    ) as HTMLSelectElement;
    const rightSelect = screen.getByLabelText(
      'step3.fieldsSection.rightField',
    ) as HTMLSelectElement;
    expect(leftSelect.className).toContain('text-foreground');
    expect(rightSelect.className).toContain('text-foreground');
  });

  it('<select> forces color-scheme:light so the OS panel renders in light scheme', () => {
    render(<Step3CardFields />);
    const leftSelect = screen.getByLabelText(
      'step3.fieldsSection.leftField',
    ) as HTMLSelectElement;
    const rightSelect = screen.getByLabelText(
      'step3.fieldsSection.rightField',
    ) as HTMLSelectElement;
    expect(leftSelect.style.colorScheme).toBe('light');
    expect(rightSelect.style.colorScheme).toBe('light');
  });

  it('every <option> applies inline color:#000000 so unselected options stay legible', () => {
    render(<Step3CardFields />);
    const leftSelect = screen.getByLabelText(
      'step3.fieldsSection.leftField',
    ) as HTMLSelectElement;
    const rightSelect = screen.getByLabelText(
      'step3.fieldsSection.rightField',
    ) as HTMLSelectElement;

    // placeholder (1) + 6 fields = 7 options per side
    expect(leftSelect.options).toHaveLength(7);
    expect(rightSelect.options).toHaveLength(7);

    for (const opt of Array.from(leftSelect.options)) {
      expect(opt.style.color, `left option "${opt.value}" must be black`).toBe(
        'rgb(0, 0, 0)',
      );
    }
    for (const opt of Array.from(rightSelect.options)) {
      expect(opt.style.color, `right option "${opt.value}" must be black`).toBe(
        'rgb(0, 0, 0)',
      );
    }
  });
});

describe('Step3CardFields — store binding', () => {
  it('selecting 電話 on the left writes leftField="phone" to the store; rightField is untouched', () => {
    render(<Step3CardFields />);
    const leftSelect = screen.getByLabelText(
      'step3.fieldsSection.leftField',
    ) as HTMLSelectElement;

    fireEvent.change(leftSelect, { target: { value: 'phone' } });

    const state = useCardBuilderStore.getState();
    expect(state.leftField).toBe('phone');
    expect(state.rightField).toBeNull();
  });

  it('selecting 會員等級 on the right writes rightField="memberLevel" to the store', () => {
    render(<Step3CardFields />);
    const rightSelect = screen.getByLabelText(
      'step3.fieldsSection.rightField',
    ) as HTMLSelectElement;

    fireEvent.change(rightSelect, { target: { value: 'memberLevel' } });

    const state = useCardBuilderStore.getState();
    expect(state.rightField).toBe('memberLevel');
    expect(state.leftField).toBeNull();
  });
});

describe('Step3CardFields — dedup (disable picked option on the other side)', () => {
  it('option already picked on the LEFT is rendered as disabled on the RIGHT select', () => {
    // Pre-seed the store via the public action (mirror the user flow)
    useCardBuilderStore.getState().setLeftField('phone');

    render(<Step3CardFields />);
    const rightSelect = screen.getByLabelText(
      'step3.fieldsSection.rightField',
    ) as HTMLSelectElement;
    const phoneOptionOnRight = rightSelect.querySelector(
      'option[value="phone"]',
    ) as HTMLOptionElement | null;
    expect(phoneOptionOnRight).toBeTruthy();
    expect(phoneOptionOnRight?.disabled).toBe(true);

    // Other field options remain enabled
    const emailOptionOnRight = rightSelect.querySelector(
      'option[value="email"]',
    ) as HTMLOptionElement | null;
    expect(emailOptionOnRight?.disabled).toBe(false);
  });

  it('option already picked on the RIGHT is rendered as disabled on the LEFT select', () => {
    useCardBuilderStore.getState().setRightField('birthday');

    render(<Step3CardFields />);
    const leftSelect = screen.getByLabelText(
      'step3.fieldsSection.leftField',
    ) as HTMLSelectElement;
    const birthdayOptionOnLeft = leftSelect.querySelector(
      'option[value="birthday"]',
    ) as HTMLOptionElement | null;
    expect(birthdayOptionOnLeft?.disabled).toBe(true);
  });

  it('changing the LEFT selection re-enables the previously disabled option on the RIGHT', () => {
    // Initial: left picks 'phone' → right's 'phone' option is disabled
    useCardBuilderStore.getState().setLeftField('phone');
    render(<Step3CardFields />);
    const rightSelect = screen.getByLabelText(
      'step3.fieldsSection.rightField',
    ) as HTMLSelectElement;
    const leftSelect = screen.getByLabelText(
      'step3.fieldsSection.leftField',
    ) as HTMLSelectElement;
    expect(
      rightSelect.querySelector<HTMLOptionElement>('option[value="phone"]')?.disabled,
    ).toBe(true);

    // User changes left to 'email' → right's 'phone' option is enabled again
    // (leftField is now 'email', so right's disabled option is 'email', not 'phone')
    fireEvent.change(leftSelect, { target: { value: 'email' } });

    // zustand triggers re-render; phone option on right should be re-enabled
    expect(
      rightSelect.querySelector<HTMLOptionElement>('option[value="phone"]')?.disabled,
    ).toBe(false);
  });

  it('disabled option text appends the localized suffix " (已選)" / " (already selected)"', () => {
    useCardBuilderStore.getState().setLeftField('phone');

    render(<Step3CardFields />);
    const rightSelect = screen.getByLabelText(
      'step3.fieldsSection.rightField',
    ) as HTMLSelectElement;
    const phoneOptionOnRight = rightSelect.querySelector<HTMLOptionElement>(
      'option[value="phone"]',
    );
    expect(phoneOptionOnRight?.textContent).toContain(
      ' (step3.fieldsSection.disabledSuffix)',
    );
  });
});

describe('Step3CardFields — conditional visibility (stamp_card / multipass)', () => {
  /**
   * 2026-09-08 — Stamp-specific display fields feature.
   *
   * The 3 new options (availableRewards / totalStamps / stampsRemaining)
   * are tagged with `group: 'stamp'` in CARD_FIELDS and are only shown when
   * the current cardType ∈ {stamp_card, multipass}. This block pins that
   * conditional behavior so future refactors of the filter logic must
   * update these tests too.
   */

  // Card types we expect to be filtered to the 6 common fields.
  const NON_STAMP_CARD_TYPES = [
    'cashback_card',
    'reward_card',
    'membership_card',
    'discount_card',
    'coupon_card',
    'gift_card',
  ] as const;

  const STAMP_KEYS = ['availableRewards', 'totalStamps', 'stampsRemaining'] as const;

  it.each(NON_STAMP_CARD_TYPES)(
    'each <select> has 7 options for non-stamp cardType="%s" (no stamp-group options)',
    (cardType) => {
      useCardBuilderStore.getState().setCardType(cardType);
      render(<Step3CardFields />);
      const leftSelect = screen.getByLabelText(
        'step3.fieldsSection.leftField',
      ) as HTMLSelectElement;
      const rightSelect = screen.getByLabelText(
        'step3.fieldsSection.rightField',
      ) as HTMLSelectElement;
      // 1 placeholder + 6 common = 7
      expect(leftSelect.options).toHaveLength(7);
      expect(rightSelect.options).toHaveLength(7);
      // No stamp keys rendered
      for (const key of STAMP_KEYS) {
        expect(leftSelect.querySelector(`option[value="${key}"]`)).toBeNull();
        expect(rightSelect.querySelector(`option[value="${key}"]`)).toBeNull();
      }
    },
  );

  it('each <select> has 10 options for cardType="stamp_card" (1 placeholder + 6 common + 3 stamp)', () => {
    useCardBuilderStore.getState().setCardType('stamp_card');
    render(<Step3CardFields />);
    const leftSelect = screen.getByLabelText(
      'step3.fieldsSection.leftField',
    ) as HTMLSelectElement;
    const rightSelect = screen.getByLabelText(
      'step3.fieldsSection.rightField',
    ) as HTMLSelectElement;
    // 1 placeholder + 6 common + 3 stamp = 10
    expect(leftSelect.options).toHaveLength(10);
    expect(rightSelect.options).toHaveLength(10);
    for (const key of STAMP_KEYS) {
      expect(leftSelect.querySelector(`option[value="${key}"]`)).toBeTruthy();
      expect(rightSelect.querySelector(`option[value="${key}"]`)).toBeTruthy();
    }
  });

  it('each <select> has 10 options for cardType="multipass" (1 placeholder + 6 common + 3 stamp)', () => {
    useCardBuilderStore.getState().setCardType('multipass');
    render(<Step3CardFields />);
    const leftSelect = screen.getByLabelText(
      'step3.fieldsSection.leftField',
    ) as HTMLSelectElement;
    const rightSelect = screen.getByLabelText(
      'step3.fieldsSection.rightField',
    ) as HTMLSelectElement;
    expect(leftSelect.options).toHaveLength(10);
    expect(rightSelect.options).toHaveLength(10);
    for (const key of STAMP_KEYS) {
      expect(leftSelect.querySelector(`option[value="${key}"]`)).toBeTruthy();
      expect(rightSelect.querySelector(`option[value="${key}"]`)).toBeTruthy();
    }
  });

  it('switching cardType from stamp_card to cashback_card hides the stamp-only options but PRESERVES a previously-picked stamp-only leftField value (no silent data loss)', () => {
    // 1. User picks stamp_card, then picks availableRewards on the left.
    useCardBuilderStore.getState().setCardType('stamp_card');
    useCardBuilderStore.getState().setLeftField('availableRewards');
    render(<Step3CardFields />);

    const leftSelect = screen.getByLabelText(
      'step3.fieldsSection.leftField',
    ) as HTMLSelectElement;
    expect(leftSelect.value).toBe('availableRewards');
    expect(leftSelect.options).toHaveLength(10);

    // 2. User changes cardType to cashback_card — store value is preserved,
    //    but the dropdown option disappears (since 'availableRewards' is no
    //    longer in `availableFields`). The browser renders the closed select
    //    text as empty for an unmatched value, so we re-check the store
    //    rather than the DOM.
    //
    // Wrap the store mutation in `act()` so React commits the re-render
    // before the next DOM query. Without this, Zustand notifies subscribers
    // asynchronously and the assertions below see the pre-mutation DOM.
    act(() => {
      useCardBuilderStore.getState().setCardType('cashback_card');
    });

    expect(useCardBuilderStore.getState().leftField).toBe('availableRewards');
    // The component must re-render with 7 options (cashback_card branch).
    // We re-query because the existing `leftSelect` reference may still
    // point to the pre-render DOM (DOM nodes are usually reused, but the
    // safer pattern is to re-query after `act`).
    const leftSelect2 = screen.getByLabelText(
      'step3.fieldsSection.leftField',
    ) as HTMLSelectElement;
    expect(leftSelect2.options).toHaveLength(7);
    expect(
      leftSelect2.querySelector<HTMLOptionElement>('option[value="availableRewards"]'),
    ).toBeNull();
  });

  it('filterCARD_FIELDS_BY_CARD_TYPE helper: returns 6 common fields for null, non-stamp, or unmatched cardType; returns all 9 for stamp_card/multipass', () => {
    // Pure-function assertion — bypasses React entirely. Keeps the filter
    // contract pinned independently of any rendering quirks.
    expect(filterCARD_FIELDS_BY_CARD_TYPE(null)).toHaveLength(6);
    expect(filterCARD_FIELDS_BY_CARD_TYPE('cashback_card')).toHaveLength(6);
    expect(filterCARD_FIELDS_BY_CARD_TYPE('gift_card')).toHaveLength(6);
    expect(filterCARD_FIELDS_BY_CARD_TYPE('stamp_card')).toHaveLength(9);
    expect(filterCARD_FIELDS_BY_CARD_TYPE('multipass')).toHaveLength(9);

    // Sanity: the helper returns the same key set as CARD_FIELDS when given
    // a stamp cardType — no entries are dropped by mistake.
    const allKeys = filterCARD_FIELDS_BY_CARD_TYPE('stamp_card').map((f) => f.key).sort();
    expect(allKeys).toEqual([...CARD_FIELDS].map((f) => f.key).sort());
  });
});

describe('Step3CardFields — stamp_card "會員等級" → "獎勵" option label override (2026-09-10)', () => {
  /**
   * 2026-09-10 stamp card member-level → reward refactor:
   *   When cardType === 'stamp_card', the option whose `value` is
   *   `'memberLevel'` should render with the i18n key
   *   `step3.fieldsSection.fields.memberLevelStamp` (which resolves to
   *   "獎勵" / "Reward") instead of the default
   *   `step3.fieldsSection.fields.memberLevel` ("會員等級" / "Member Level").
   *   The dropdown still emits `'memberLevel'` as the option value (the
   *   CardFieldKey contract is preserved — backend / shared schema
   *   unchanged per Rule 019 § 4.1).
   *
   *   For `multipass` (which shares the same STAMP_CARD_TYPES filter for
   *   the stamp-only field group) the label is INTENTIONALLY NOT
   *   overridden — `multipass` keeps "會員等級" because the user's UX
   *   intent was scoped to `stamp_card` only (user-confirmed scope:
   *   `stamp_only`).
   *
   *   Tests rely on `vi.mock('react-i18next')` returning the key path
   *   verbatim, so we assert against the i18n key path rather than the
   *   translated text. The `verify:i18n` smoke test (separate run) guards
   *   against missing translations.
   */

  // Card types we expect to NOT trigger the memberLevel → memberLevelStamp
  // override. Mirrors the set used by the conditional-visibility describe
  // block above (kept local to avoid coupling two describe blocks).
  const NON_STAMP_CARD_TYPES = [
    'cashback_card',
    'reward_card',
    'membership_card',
    'discount_card',
    'coupon_card',
    'gift_card',
  ] as const;

  it('memberLevel option label uses memberLevelStamp i18n key when cardType="stamp_card"', () => {
    useCardBuilderStore.getState().setCardType('stamp_card');
    render(<Step3CardFields />);
    const leftSelect = screen.getByLabelText(
      'step3.fieldsSection.leftField',
    ) as HTMLSelectElement;
    const memberLevelOption = leftSelect.querySelector(
      'option[value="memberLevel"]',
    ) as HTMLOptionElement;
    expect(memberLevelOption).toBeTruthy();
    // vi.mock returns the key path verbatim; assert against the key.
    expect(memberLevelOption.textContent).toBe(
      'step3.fieldsSection.fields.memberLevelStamp',
    );
    // The underlying option value is still 'memberLevel' — only the label
    // changes. The store contract is preserved.
    expect(memberLevelOption.value).toBe('memberLevel');
  });

  it('memberLevel option label keeps the original memberLevel key when cardType="multipass" (scope = stamp_card only)', () => {
    useCardBuilderStore.getState().setCardType('multipass');
    render(<Step3CardFields />);
    const leftSelect = screen.getByLabelText(
      'step3.fieldsSection.leftField',
    ) as HTMLSelectElement;
    const memberLevelOption = leftSelect.querySelector(
      'option[value="memberLevel"]',
    ) as HTMLOptionElement;
    expect(memberLevelOption).toBeTruthy();
    expect(memberLevelOption.textContent).toBe(
      'step3.fieldsSection.fields.memberLevel',
    );
  });

  it.each(NON_STAMP_CARD_TYPES)(
    'memberLevel option label keeps the original memberLevel key for non-stamp cardType="%s"',
    (cardType) => {
      useCardBuilderStore.getState().setCardType(cardType);
      render(<Step3CardFields />);
      const leftSelect = screen.getByLabelText(
        'step3.fieldsSection.leftField',
      ) as HTMLSelectElement;
      const memberLevelOption = leftSelect.querySelector(
        'option[value="memberLevel"]',
      ) as HTMLOptionElement;
      expect(memberLevelOption).toBeTruthy();
      expect(memberLevelOption.textContent).toBe(
        'step3.fieldsSection.fields.memberLevel',
      );
    },
  );

  it('only memberLevel option is relabeled on stamp_card; other common fields keep their original keys', () => {
    useCardBuilderStore.getState().setCardType('stamp_card');
    render(<Step3CardFields />);
    const leftSelect = screen.getByLabelText(
      'step3.fieldsSection.leftField',
    ) as HTMLSelectElement;

    // Sanity sweep: every OTHER common field's option text uses its
    // canonical labelKey (no accidental cascade).
    const cases: ReadonlyArray<{ key: string; labelKey: string }> = [
      { key: 'phone', labelKey: 'step3.fieldsSection.fields.phone' },
      { key: 'email', labelKey: 'step3.fieldsSection.fields.email' },
      { key: 'birthday', labelKey: 'step3.fieldsSection.fields.birthday' },
      { key: 'visitCount', labelKey: 'step3.fieldsSection.fields.visitCount' },
      { key: 'memberName', labelKey: 'step3.fieldsSection.fields.memberName' },
    ];
    for (const { key, labelKey } of cases) {
      const opt = leftSelect.querySelector(
        `option[value="${key}"]`,
      ) as HTMLOptionElement;
      expect(opt).toBeTruthy();
      expect(opt.textContent).toBe(labelKey);
    }
  });

  it('switching cardType from stamp_card back to a non-stamp cardType restores the original memberLevel label (reactive)', () => {
    // 1. Start as stamp_card → memberLevel option renders with memberLevelStamp.
    useCardBuilderStore.getState().setCardType('stamp_card');
    render(<Step3CardFields />);
    const leftSelect = screen.getByLabelText(
      'step3.fieldsSection.leftField',
    ) as HTMLSelectElement;
    const memberLevelOption = leftSelect.querySelector(
      'option[value="memberLevel"]',
    ) as HTMLOptionElement;
    expect(memberLevelOption.textContent).toBe(
      'step3.fieldsSection.fields.memberLevelStamp',
    );

    // 2. Switch to cashback_card → label reverts to the original memberLevel key.
    act(() => {
      useCardBuilderStore.getState().setCardType('cashback_card');
    });
    // Re-query after the act() commit.
    const leftSelectAfter = screen.getByLabelText(
      'step3.fieldsSection.leftField',
    ) as HTMLSelectElement;
    const memberLevelOptionAfter = leftSelectAfter.querySelector(
      'option[value="memberLevel"]',
    ) as HTMLOptionElement;
    expect(memberLevelOptionAfter.textContent).toBe(
      'step3.fieldsSection.fields.memberLevel',
    );
  });
});
