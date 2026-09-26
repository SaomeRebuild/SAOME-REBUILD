/**
 * Step2CardSettings — Conditional hide for passValidDays/expiryDate (2026-09-27)
 *
 * Verifies the `!isMembership && !isDiscount && !isMultipass && !isGift`
 * guard correctly hides Step 2's two time fields for gift_card (the
 * latest addition — joining membership_card / discount_card / multipass
 * as card types with no time concept).
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, cleanup } from '@testing-library/react';
import { Step2CardSettings } from './index';
import { useCardBuilderStore } from '../CardBuilderEditor.store';

vi.mock('react-i18next', () => ({
  useTranslation: vi.fn(() => ({
    t: vi.fn((key: string) => key),
    i18n: { language: 'zh-TW' },
  })),
}));

beforeEach(() => {
  useCardBuilderStore.getState().reset();
});

afterEach(() => {
  cleanup();
});

describe('Step2CardSettings — hide passValidDays/expiryDate for gift_card (2026-09-27)', () => {
  it('gift_card hides both PassValidDaysField and ExpiryDateField', () => {
    useCardBuilderStore.setState({ cardType: 'gift_card' });
    render(<Step2CardSettings />);

    // The fields use <input type="number" min="1"> for PassValidDaysField
    // and <input type="date"> for ExpiryDateField. Check that neither
    // input is rendered for gift_card.
    const numberInputs = document.querySelectorAll('input[type="number"]');
    const dateInputs = document.querySelectorAll('input[type="date"]');
    expect(numberInputs.length).toBe(0);
    expect(dateInputs.length).toBe(0);
  });

  it('stamp_card (control case) shows both PassValidDaysField and ExpiryDateField', () => {
    useCardBuilderStore.setState({ cardType: 'stamp_card' });
    render(<Step2CardSettings />);

    const numberInputs = document.querySelectorAll('input[type="number"]');
    const dateInputs = document.querySelectorAll('input[type="date"]');
    // stamp_card should show at least one number (PassValidDays) + one date (ExpiryDate)
    expect(numberInputs.length).toBeGreaterThanOrEqual(1);
    expect(dateInputs.length).toBeGreaterThanOrEqual(1);
  });
});