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
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { Step3CardFields } from './index';
import { useCardBuilderStore } from '../CardBuilderEditor.store';

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
  it('each <select> has 7 options: 1 disabled placeholder + 6 fields (phone, email, memberLevel, birthday, visitCount, memberName)', () => {
    render(<Step3CardFields />);
    const leftSelect = screen.getByLabelText(
      'step3.fieldsSection.leftField',
    ) as HTMLSelectElement;
    const rightSelect = screen.getByLabelText(
      'step3.fieldsSection.rightField',
    ) as HTMLSelectElement;

    expect(leftSelect.options).toHaveLength(7);
    expect(rightSelect.options).toHaveLength(7);

    const fieldKeys = ['phone', 'email', 'memberLevel', 'birthday', 'visitCount', 'memberName'];
    for (const key of fieldKeys) {
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
