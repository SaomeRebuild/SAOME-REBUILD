/**
 * DiscountExpiryFields — Vitest + RTL Tests (Rule 003 TDD)
 *
 * Verifies mutual exclusion behavior (mirrors PassValidDaysField ↔
 * ExpiryDateField pattern from Step 2):
 *   - Setting custom days via DiscountCustomExpiryDaysField clears
 *     discountSpecificExpiryDate (the field handler clears the other).
 *   - Setting a specific date via DiscountSpecificExpiryDateField clears
 *     discountCustomExpiryDays.
 *   - Both fields can be cleared independently (back to no expiry).
 *
 * Store setters are pure (do NOT enforce exclusion); the mutual exclusion
 * logic lives in DiscountExpiryFields component handlers.
 *
 * 2026-09-18 user clarification: card expiry is REQUIRED (at least one of
 * days/date must be set). The component surfaces a section-level
 * `expiryBothNullError` message when both are null and showValidation=true.
 * Field-level errors now ONLY flag invalid VALUES (out-of-range / past
 * date), not null — null is handled by the section-level both-null error.
 */

import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { DiscountExpiryFields } from './DiscountExpiryFields';
import { useCardBuilderStore } from '../../CardBuilderEditor.store';

vi.mock('react-i18next', () => ({
  useTranslation: vi.fn(() => ({
    t: vi.fn((key: string) => key),
  })),
}));

afterEach(() => {
  useCardBuilderStore.getState().reset();
  cleanup();
});

describe('DiscountExpiryFields — mutual exclusion (field-handler level)', () => {
  it('renders both fields initially (no expiry is the default state)', () => {
    render(<DiscountExpiryFields showValidation={false} />);

    expect(
      screen.getByLabelText('step6.discount.customExpiryDaysTitle'),
    ).toBeInTheDocument();
    expect(
      screen.getByLabelText('step6.discount.specificExpiryDateTitle'),
    ).toBeInTheDocument();
  });

  it('setting custom days CLEARS the specific date (mutual exclusion)', () => {
    // Seed: only date is set (just the one we expect to be cleared).
    useCardBuilderStore.setState({
      discountCustomExpiryDays: null,
      discountSpecificExpiryDate: '2027-12-31',
    });
    render(<DiscountExpiryFields showValidation={false} />);

    // User types into the days field. The component's onChange wrapper
    // calls setDays(60) and then (since 60 !== null) setDate(null).
    const daysInput = screen.getByLabelText(
      'step6.discount.customExpiryDaysTitle',
    ) as HTMLInputElement;
    fireEvent.change(daysInput, { target: { value: '60' } });

    const s = useCardBuilderStore.getState();
    expect(s.discountCustomExpiryDays).toBe(60);
    // Mutual exclusion: setting days cleared the date.
    expect(s.discountSpecificExpiryDate).toBe(null);
  });

  it('setting the specific date CLEARS the custom days (mutual exclusion)', () => {
    // Reverse direction. Seed: only days is set, then mutate the date.
    useCardBuilderStore.setState({
      discountCustomExpiryDays: 30,
      discountSpecificExpiryDate: null,
    });
    render(<DiscountExpiryFields showValidation={false} />);

    const dateInput = screen.getByLabelText(
      'step6.discount.specificExpiryDateTitle',
    ) as HTMLInputElement;
    fireEvent.change(dateInput, { target: { value: '2028-06-15' } });

    const s = useCardBuilderStore.getState();
    expect(s.discountSpecificExpiryDate).toBe('2028-06-15');
    // Mutual exclusion: setting date cleared the days.
    expect(s.discountCustomExpiryDays).toBe(null);
  });

  it('clearing days via empty input value transitions to null (no expiry, no exclusion)', () => {
    // When user clears the days field, both fields become null = no expiry.
    // No mutual exclusion fires (null → null path doesn't clear anything).
    useCardBuilderStore.setState({
      discountCustomExpiryDays: 30,
      discountSpecificExpiryDate: null, // not set
    });
    render(<DiscountExpiryFields showValidation={false} />);

    const daysInput = screen.getByLabelText(
      'step6.discount.customExpiryDaysTitle',
    ) as HTMLInputElement;
    expect(daysInput.value).toBe('30');

    fireEvent.change(daysInput, { target: { value: '' } });

    expect(useCardBuilderStore.getState().discountCustomExpiryDays).toBe(null);
    expect(useCardBuilderStore.getState().discountSpecificExpiryDate).toBe(null);
  });

  it('clearing date via empty input value transitions to null', () => {
    useCardBuilderStore.setState({
      discountCustomExpiryDays: null, // not set
      discountSpecificExpiryDate: '2027-12-31',
    });
    render(<DiscountExpiryFields showValidation={false} />);

    const dateInput = screen.getByLabelText(
      'step6.discount.specificExpiryDateTitle',
    ) as HTMLInputElement;
    expect(dateInput.value).toBe('2027-12-31');

    fireEvent.change(dateInput, { target: { value: '' } });

    expect(useCardBuilderStore.getState().discountSpecificExpiryDate).toBe(null);
    expect(useCardBuilderStore.getState().discountCustomExpiryDays).toBe(null);
  });

  // ─────────────────────────────────────────────────────────────────────
  // 2026-09-18 user clarification: card expiry is REQUIRED.
  // Section-level `expiryBothNullError` shows when both are null AND
  // showValidation=true. Field-level errors ONLY fire for non-null invalid
  // values (out-of-range / past date), not for null itself.
  // ─────────────────────────────────────────────────────────────────────

  it('shows section-level expiryBothNullError when both fields are null and showValidation=true (REQUIRED gate)', () => {
    useCardBuilderStore.setState({
      discountCustomExpiryDays: null,
      discountSpecificExpiryDate: null,
    });
    render(<DiscountExpiryFields showValidation={true} />);

    // The new section-level both-null message must be visible — this is
    // the primary "you must fill one" indicator after the user tries to
    // advance past Step 6.
    expect(
      screen.getByTestId('discount-expiry-both-null-error'),
    ).toBeInTheDocument();
    expect(
      screen.getByText('step6.discount.expiryBothNullError'),
    ).toBeInTheDocument();
  });

  it('does NOT show field-level errors when both fields are null (null is not invalid — section handles it)', () => {
    // Per 2026-09-18 clarification: field-level error indicates "this value
    // is wrong, please fix it". A null value is handled by the section-level
    // message, not by per-field red borders. The user shouldn't see two
    // "fix this field" prompts AND a "both are empty" prompt for the same
    // condition — that's confusing.
    useCardBuilderStore.setState({
      discountCustomExpiryDays: null,
      discountSpecificExpiryDate: null,
    });
    render(<DiscountExpiryFields showValidation={true} />);

    expect(
      screen.queryByText('step6.discount.customExpiryDaysRangeError'),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByText('step6.discount.specificExpiryDatePastError'),
    ).not.toBeInTheDocument();
  });

  it('does NOT show expiryBothNullError when days is set (one is enough)', () => {
    useCardBuilderStore.setState({
      discountCustomExpiryDays: 30,
      discountSpecificExpiryDate: null,
    });
    render(<DiscountExpiryFields showValidation={true} />);

    expect(
      screen.queryByTestId('discount-expiry-both-null-error'),
    ).not.toBeInTheDocument();
  });

  it('does NOT show expiryBothNullError when date is set (one is enough)', () => {
    useCardBuilderStore.setState({
      discountCustomExpiryDays: null,
      discountSpecificExpiryDate: '2027-12-31',
    });
    render(<DiscountExpiryFields showValidation={true} />);

    expect(
      screen.queryByTestId('discount-expiry-both-null-error'),
    ).not.toBeInTheDocument();
  });

  it('shows field-level range error when days is OUT OF RANGE (genuinely invalid)', () => {
    // Store clamps via setter, but the component still surfaces a field
    // error if a non-null value lands outside [1, 3650] (defensive, e.g.
    // corrupted DB row).
    useCardBuilderStore.setState({
      discountCustomExpiryDays: 9999,
      discountSpecificExpiryDate: null,
    });
    render(<DiscountExpiryFields showValidation={true} />);

    expect(
      screen.getByText('step6.discount.customExpiryDaysRangeError'),
    ).toBeInTheDocument();
  });

  it('does NOT show field-level errors when showValidation=false', () => {
    useCardBuilderStore.setState({
      discountCustomExpiryDays: null,
      discountSpecificExpiryDate: null,
    });
    render(<DiscountExpiryFields showValidation={false} />);

    expect(
      screen.queryByText('step6.discount.customExpiryDaysRangeError'),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByText('step6.discount.specificExpiryDatePastError'),
    ).not.toBeInTheDocument();
    // Section-level both-null error also hidden (showValidation gate).
    expect(
      screen.queryByTestId('discount-expiry-both-null-error'),
    ).not.toBeInTheDocument();
  });

  it('renders discount-specific-expiry-date hint when date is set AND not in both-null state (post-clear UX feedback)', () => {
    useCardBuilderStore.setState({
      discountCustomExpiryDays: null,
      discountSpecificExpiryDate: '2027-12-31',
    });
    render(<DiscountExpiryFields showValidation={false} />);

    // When the date is set (and not the both-null state), a hint reminds
    // the user that the days field was cleared by the mutual-exclusion
    // handler. (The clear happened when the date was originally entered.)
    expect(
      screen.getByText('step6.discount.specificExpiryDateHint'),
    ).toBeInTheDocument();
  });

  it('does NOT show the hint when both fields are null', () => {
    render(<DiscountExpiryFields showValidation={false} />);
    expect(
      screen.queryByText('step6.discount.specificExpiryDateHint'),
    ).not.toBeInTheDocument();
  });

  it('suppresses the hint when the both-null error is active (avoid competing messages)', () => {
    // When showValidation=true and both fields are null, the section-level
    // expiryBothNullError is the primary UX signal. Showing the date hint
    // at the same time would compete for attention.
    useCardBuilderStore.setState({
      discountCustomExpiryDays: null,
      discountSpecificExpiryDate: null,
    });
    render(<DiscountExpiryFields showValidation={true} />);

    expect(
      screen.getByTestId('discount-expiry-both-null-error'),
    ).toBeInTheDocument();
    expect(
      screen.queryByText('step6.discount.specificExpiryDateHint'),
    ).not.toBeInTheDocument();
  });
});
