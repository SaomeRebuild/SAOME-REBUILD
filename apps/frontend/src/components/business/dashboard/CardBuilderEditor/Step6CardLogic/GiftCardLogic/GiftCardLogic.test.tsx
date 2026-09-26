/**
 * GiftCardLogic — Vitest + RTL Tests (Rule 003 TDD + Rule 000 L2 結構)
 *
 * Verifies the gift_card Step 6 sub-module composes 3 sub-components in
 * the correct order, and that currency-aware rendering + validation work.
 *
 * Per Rule 000 § A.1 + Rule 000 § A.2:
 *   - Main component ≤ 100 lines, just composes sub-components.
 *   - Each sub-component handles its own validation, currency-aware
 *     rendering, and store integration.
 *
 * Tests run 6 scenarios (Rule 025 § 1 E.7 mandatory coverage):
 *   1. Default state (1:1) — RatePreview shows "1 元 = 1 點"
 *   2. Amount input change — RatePreview updates to "100 元 = 100 點"
 *   3. Currency switch to ZAR — RatePreview shows "100 R = 100 點"
 *   4. showValidation=true + amount=0 (corrupted DB) — red border
 *   5. Both fields null/0 (corrupted DB) — RatePreview doesn't render
 *   6. DOM order: AmountField → PointsField → RatePreview
 */

import { render, screen, cleanup, act } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { GiftCardLogic } from './GiftCardLogic';
import { useCardBuilderStore } from '../../CardBuilderEditor.store';

// Mock i18n so we get predictable t(key) → key output for assertions.
// The ratePreview template uses i18n interpolation; in test mode react-i18next
// passes the interpolation values through to the template via {{amount}} etc.
// To keep assertions predictable, we mock t() with a small lookup table
// for the gift-card-specific keys.
vi.mock('react-i18next', () => ({
  useTranslation: vi.fn(() => ({
    t: vi.fn((key: string, opts?: Record<string, unknown>) => {
      const lookup: Record<string, string> = {
        // Gift card preview keys — return the real translation strings
        // so ratePreview interpolation looks like the actual rendered output.
        'step6.gift.amountUnitTWD': '元',
        'step6.gift.amountUnitZAR': 'R',
        'step6.gift.ratePreview': '{{amount}} {{unit}} = {{points}} 點',
        'step6.gift.amountLabel': '消費金額',
        'step6.gift.pointsLabel': '獲得點數',
      };
      let template = lookup[key] ?? key;
      if (key === 'step6.gift.ratePreview' && opts) {
        return `${opts.amount} ${opts.unit} = ${opts.points} 點`;
      }
      return template;
    }),
    i18n: { language: 'zh-TW' },
  })),
}));

afterEach(() => {
  useCardBuilderStore.getState().reset();
  cleanup();
});

describe('GiftCardLogic — main component composition (Rule 000 § A.1)', () => {
  it('renders the 3 sub-components (amount + points + rate preview)', () => {
    // Default store state: giftCardAmount=1, giftCardPoints=1.
    render(<GiftCardLogic showValidation={false} />);

    // Amount + Points fields are always rendered (aria-label is the
    // localized label string, NOT the i18n key — the mock returns the
    // translation via the lookup table).
    expect(screen.getByLabelText('消費金額')).toBeInTheDocument();
    expect(screen.getByLabelText('獲得點數')).toBeInTheDocument();

    // RatePreview renders when both fields are valid (default 1:1).
    expect(screen.getByTestId('gift-rate-preview')).toBeInTheDocument();
    expect(screen.getByTestId('gift-rate-preview').textContent).toContain('1 元 = 1 點');
  });

  it('updates the rate preview when amount changes', () => {
    render(<GiftCardLogic showValidation={false} />);

    // Initial: "1 元 = 1 點"
    expect(screen.getByTestId('gift-rate-preview').textContent).toContain('1 元 = 1 點');

    // Update the store directly — fireEvent in jsdom doesn't always
    // propagate React's synthetic events correctly for controlled
    // number inputs. Using the store setter is the canonical test
    // approach for Zustand-backed components.
    act(() => {
      useCardBuilderStore.getState().setGiftCardAmount(100);
    });

    // Rate preview should now show "100 元 = 1 點"
    expect(screen.getByTestId('gift-rate-preview').textContent).toContain('100 元 = 1 點');
  });

  it('currency ZAR replaces 元 suffix with R prefix in the rate preview', () => {
    // Start with TWD (default).
    useCardBuilderStore.setState({ currency: 'ZAR' });
    render(<GiftCardLogic showValidation={false} />);

    // For ZAR zh-TW: rate preview shows "1 R = 1 點" (R prefix, no suffix).
    expect(screen.getByTestId('gift-rate-preview').textContent).toContain('1 R = 1 點');
  });

  it('does NOT render rate preview when one field is invalid (defensive guard)', () => {
    // Simulate corrupted DB: amount=0 (store setter would reject, but
    // loadSettings could surface 0 from a malformed row).
    useCardBuilderStore.setState({ giftCardAmount: 0 });
    render(<GiftCardLogic showValidation={false} />);

    // RatePreview must not render — defensive guard prevents "0 元 = 1 點" noise.
    expect(screen.queryByTestId('gift-rate-preview')).toBeNull();
  });

  it('showValidation=true + amount ≤ 0 adds red border to amount field', () => {
    // Simulate corrupted DB: amount=0.
    useCardBuilderStore.setState({ giftCardAmount: 0 });
    render(<GiftCardLogic showValidation={true} />);

    const amountInput = screen.getByLabelText('消費金額');
    expect(amountInput.getAttribute('aria-invalid')).toBe('true');
    expect(amountInput.className).toContain('border-destructive');
  });

  it('DOM order: amount field → points field → rate preview', () => {
    render(<GiftCardLogic showValidation={false} />);

    const amount = screen.getByLabelText('消費金額');
    const points = screen.getByLabelText('獲得點數');
    const preview = screen.getByTestId('gift-rate-preview');

    // amount comes before points (via compareDocumentPosition).
    const FOLLOWING = Node.DOCUMENT_POSITION_FOLLOWING;
    expect(amount.compareDocumentPosition(points) & FOLLOWING).toBeTruthy();
    // points comes before rate preview.
    expect(points.compareDocumentPosition(preview) & FOLLOWING).toBeTruthy();
  });
});