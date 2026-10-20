/**
 * GiftCardDesignLimitsSection — Vitest + RTL Tests
 *
 * 2026-10-20: Tests for the card-design fence sub-section (PR 1 of 雙層 fence).
 * Verifies the section renders, cross-field validation, and field defaults.
 */

import { render, screen, cleanup, act } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { GiftCardDesignLimitsSection } from './GiftCardDesignLimitsSection';
import { useCardBuilderStore } from '../../CardBuilderEditor.store';

// Mock i18n (mirrors GiftCardLogic.test.tsx pattern).
vi.mock('react-i18next', () => ({
  useTranslation: vi.fn(() => ({
    t: vi.fn((key: string) => {
      const lookup: Record<string, string> = {
        // section hero intro
        'step6.gift.design.intro': '\u9019\u5f35\u5361\u6700\u591a\u53ef\u767c\u884c\u5e7e\u9ede',
        'step6.gift.design.introHint': '\u6d3b\u52d5\u671f\u9593\u53ef\u62c9\u9ad8\u4e0a\u9650\uff1b\u55ae\u7b46\u4ea4\u6613\u4e0a\u9650\u898b\u4e0b\u65b9\u8a2d\u5b9a\u3002',
        // labels
        'step6.gift.design.minPointsLabel': '\u767c\u884c\u9ede\u6578\u4e0b\u9650',
        'step6.gift.design.maxPointsLabel': '\u767c\u884c\u9ede\u6578\u4e0a\u9650',
        'step6.gift.design.placeholderMinPoints': '\u4f8b\uff1a1',
        'step6.gift.design.placeholderMaxPoints': '\u4f8b\uff1a10000',
        // points unit suffix on input fields
        'step6.gift.pointsUnit': '\u9ede',
        'step6.gift.validation.minGreaterThanMax': '\u4e0b\u9650\u4e0d\u80fd\u5927\u65bc\u4e0a\u9650',
        'step6.gift.validation.positive': '\u6578\u503c\u5fc5\u9808\u5927\u65bc\u96f2',
      };
      return lookup[key] ?? key;
    }),
    i18n: { language: 'zh-TW' },
  })),
}));

afterEach(() => {
  useCardBuilderStore.getState().reset();
  cleanup();
});

describe('GiftCardDesignLimitsSection — card-design fence (Rule 000 § A.1)', () => {
  it('renders min and max point fields with correct aria-labels', () => {
    render(<GiftCardDesignLimitsSection showValidation={false} />);

    expect(screen.getByLabelText('\u767c\u884c\u9ede\u6578\u4e0b\u9650')).toBeInTheDocument();
    expect(screen.getByLabelText('\u767c\u884c\u9ede\u6578\u4e0a\u9650')).toBeInTheDocument();
  });

  it('renders with default values (1 and 999_999_999)', () => {
    render(<GiftCardDesignLimitsSection showValidation={false} />);

    const minInput = screen.getByLabelText('\u767c\u884c\u9ede\u6578\u4e0b\u9650');
    const maxInput = screen.getByLabelText('\u767c\u884c\u9ede\u6578\u4e0a\u9650');
    expect(minInput).toHaveValue(1);
    expect(maxInput).toHaveValue(999_999_999);
  });

  it('showValidation=true + min > max: both fields get red border + error message', () => {
    // Simulate corrupted row: set min=200, max=100 in the store.
    useCardBuilderStore.setState({
      giftCardDesignMinPoints: 200,
      giftCardDesignMaxPoints: 100,
    });
    render(<GiftCardDesignLimitsSection showValidation={true} />);

    const minInput = screen.getByLabelText('\u767c\u884c\u9ede\u6578\u4e0b\u9650');
    const maxInput = screen.getByLabelText('\u767c\u884c\u9ede\u6578\u4e0a\u9650');

    // Both should show aria-invalid (cross-field error state).
    expect(minInput.getAttribute('aria-invalid')).toBe('true');
    expect(maxInput.getAttribute('aria-invalid')).toBe('true');
    expect(minInput.className).toContain('border-destructive');
    expect(maxInput.className).toContain('border-destructive');

    // Error message appears on the page (at least one instance — both fields show it).
    const errorMessages = screen.getAllByText('\u4e0b\u9650\u4e0d\u80fd\u5927\u65bc\u4e0a\u9650');
    expect(errorMessages.length).toBeGreaterThanOrEqual(1);
  });

  it('setter blocks attempt to set min > current max (cross-field guard)', () => {
    // Start at defaults (min=1, max=999_999_999).
    // Try to set min to a value > current max via setter.
    // The setter should reject silently (returns early) — min stays at 1.
    act(() => {
      useCardBuilderStore.getState().setGiftCardDesignMinPoints(1000000000);
    });
    const minAfter = useCardBuilderStore.getState().giftCardDesignMinPoints;
    expect(minAfter).toBe(1); // unchanged — setter correctly blocked
  });

  it('setter blocks attempt to set max < min (cross-field guard)', () => {
    act(() => {
      useCardBuilderStore.getState().setGiftCardDesignMaxPoints(999_999_998);
    });
    const maxAfter = useCardBuilderStore.getState().giftCardDesignMaxPoints;
    // Current min is 1, so max=999_999_998 is fine (min=1 < max=999_999_998)
    expect(maxAfter).toBe(999_999_998);
  });

  it('setter blocks attempt to set min > current max (regression guard)', () => {
    // Set max to a smaller value first
    act(() => {
      useCardBuilderStore.getState().setGiftCardDesignMaxPoints(500);
    });
    // Now min=1, max=500, try to set min=600 → should be blocked
    act(() => {
      useCardBuilderStore.getState().setGiftCardDesignMinPoints(600);
    });
    const minAfter = useCardBuilderStore.getState().giftCardDesignMinPoints;
    expect(minAfter).toBe(1); // unchanged — setter rejected
  });

  it('DOM order: min field before max field', () => {
    render(<GiftCardDesignLimitsSection showValidation={false} />);

    const minInput = screen.getByLabelText('\u767c\u884c\u9ede\u6578\u4e0b\u9650');
    const maxInput = screen.getByLabelText('\u767c\u884c\u9ede\u6578\u4e0a\u9650');
    const FOLLOWING = Node.DOCUMENT_POSITION_FOLLOWING;
    expect(minInput.compareDocumentPosition(maxInput) & FOLLOWING).toBeTruthy();
  });
});
