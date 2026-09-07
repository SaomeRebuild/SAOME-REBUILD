/**
 * PassCardPreviewHeader — Vitest + RTL tests
 *
 * Covers the Balance preview feature (added 2026-09-08) plus regression of
 * the default rounded-full pill for non-target card types:
 *
 *   1. Default pill behavior for non-target card types
 *      (membership_card / discount_card / coupon_card / multipass / gift_card)
 *   2. Balance preview for stamp_card / reward_card / cashback_card (× 3)
 *   3. Currency switch: store.currency='TWD' → valueTwd, 'ZAR' → valueZar
 *   4. textColor scope (label + value spans inside the balance block)
 *   5. compact mode typography (label 8px / value 11px font-bold)
 *   6. non-compact typography (label 10px / value text-sm font-bold)
 *   7. DOM order: label is above value, both inside same parent <div>
 *   8. Reactive store update: setCurrency re-renders the value
 *
 * Conventions follow PassCardPreviewBody.test.tsx:
 *   - vi.mock('react-i18next') returns `t: key => key`
 *   - Store state seeded via `useCardBuilderStore.setState(...)`
 *   - `useCardBuilderStore.getState().reset()` in beforeEach for isolation
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, act, cleanup } from '@testing-library/react';
import {
  PassCardPreviewHeader,
  BALANCE_PREVIEW_CARD_TYPES,
  shouldShowBalancePreview,
} from './PassCardPreviewHeader';
import { useCardBuilderStore } from '../CardBuilderEditor.store';
import { BALANCE_PREVIEW_AMOUNTS } from '@saome/shared/constants/balancePreview';

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

// ─── Default pill behavior (non-target card types) ────────────────────────
// All 5 non-target card types keep the original rounded-full pill.
// This pins the existing visual contract for the 5 card types that don't
// get the balance preview (membership / discount / coupon / multipass / gift).
describe('PassCardPreviewHeader — default pill for non-target card types', () => {
  it.each(['membership_card', 'discount_card', 'coupon_card', 'multipass', 'gift_card'] as const)(
    'cardType="%s" renders rounded-full pill with raw cardType text',
    (cardType) => {
      const { container } = render(<PassCardPreviewHeader cardType={cardType} />);
      const pill = container.querySelector('span.rounded-full');
      expect(pill).toBeInTheDocument();
      expect(pill?.textContent).toBe(cardType);
    },
  );

  it('cardType=null renders the i18n fallback (defaultCardType key)', () => {
    const { container } = render(<PassCardPreviewHeader cardType={null} />);
    const pill = container.querySelector('span.rounded-full');
    expect(pill).toBeInTheDocument();
    expect(pill?.textContent).toBe('defaultCardType');
  });

  it('cardType=undefined renders the i18n fallback (defaultCardType key)', () => {
    const { container } = render(<PassCardPreviewHeader />);
    const pill = container.querySelector('span.rounded-full');
    expect(pill).toBeInTheDocument();
    expect(pill?.textContent).toBe('defaultCardType');
  });
});

// ─── Balance preview for the 3 target card types ───────────────────────────
// Each of {stamp_card, reward_card, cashback_card} must replace the pill
// with a 2-line block. Same shape across all 3 — only the cardType differs.
describe('PassCardPreviewHeader — balance preview for target card types (TWD default)', () => {
  it.each(['stamp_card', 'reward_card', 'cashback_card'] as const)(
    'cardType="%s" + currency=TWD renders balancePreview.label + the TWD amount string',
    (cardType) => {
      useCardBuilderStore.setState({ currency: 'TWD' });
      const { container } = render(<PassCardPreviewHeader cardType={cardType} />);
      // No pill for target card types
      expect(container.querySelector('span.rounded-full')).toBeNull();
      // Label is an i18n key (mock returns key as text)
      expect(screen.getByText('balancePreview.label')).toBeInTheDocument();
      // Value is the resolved string from BALANCE_PREVIEW_AMOUNTS (NOT an i18n key)
      expect(screen.getByText(BALANCE_PREVIEW_AMOUNTS.TWD)).toBeInTheDocument();
      // The ZAR variant must NOT appear
      expect(screen.queryByText(BALANCE_PREVIEW_AMOUNTS.ZAR)).toBeNull();
    },
  );
});

// ─── Currency switch (reactive store update) ───────────────────────────────
// store.currency === 'ZAR' switches the value to BALANCE_PREVIEW_AMOUNTS.ZAR.
describe('PassCardPreviewHeader — currency switch', () => {
  it('cardType="stamp_card" + currency=ZAR renders the ZAR amount string (not TWD)', () => {
    useCardBuilderStore.setState({ currency: 'ZAR' });
    render(<PassCardPreviewHeader cardType="stamp_card" />);
    expect(screen.getByText(BALANCE_PREVIEW_AMOUNTS.ZAR)).toBeInTheDocument();
    expect(screen.queryByText(BALANCE_PREVIEW_AMOUNTS.TWD)).toBeNull();
  });

  it('reactive: cardType="reward_card" + initial TWD → setState ZAR → re-render shows ZAR amount', () => {
    useCardBuilderStore.setState({ currency: 'TWD' });
    render(<PassCardPreviewHeader cardType="reward_card" />);
    expect(screen.getByText(BALANCE_PREVIEW_AMOUNTS.TWD)).toBeInTheDocument();

    // Switch currency while the component is mounted; the hook subscription
    // should trigger a re-render with the ZAR value.
    act(() => {
      useCardBuilderStore.setState({ currency: 'ZAR' });
    });

    expect(screen.getByText(BALANCE_PREVIEW_AMOUNTS.ZAR)).toBeInTheDocument();
    expect(screen.queryByText(BALANCE_PREVIEW_AMOUNTS.TWD)).toBeNull();
  });
});

// ─── textColor scope ───────────────────────────────────────────────────────
// textColor must apply to both spans inside the balance block (label + value),
// matching the existing pill contract (the pill also picks up textColor).
describe('PassCardPreviewHeader — textColor scope on balance preview', () => {
  it('textColor="#ff0000" applies to both label and value spans inside the balance block', () => {
    useCardBuilderStore.setState({ currency: 'TWD' });
    render(
      <PassCardPreviewHeader cardType="stamp_card" textColor="#ff0000" />,
    );

    // Locate the balance block by its label text, then walk up to the parent <div>
    const labelSpan = screen.getByText('balancePreview.label');
    const balanceBlock = labelSpan.parentElement as HTMLElement;
    expect(balanceBlock).toBeInTheDocument();
    expect(balanceBlock.className).toContain('flex-col');

    // The block contains exactly 2 spans (label + value). Both must have
    // inline style.color = textColor. We assert on both individually so
    // a regression that drops one of them surfaces immediately.
    const spansInBlock = balanceBlock.querySelectorAll('span');
    expect(spansInBlock.length).toBe(2);
    const labelEl = spansInBlock[0]!;
    const valueEl = spansInBlock[1]!;
    expect(labelEl.style.color).toBe('rgb(255, 0, 0)');
    expect(valueEl.style.color).toBe('rgb(255, 0, 0)');
  });

  it('no textColor prop → no inline color on balance spans (no regression)', () => {
    const { container } = render(<PassCardPreviewHeader cardType="stamp_card" />);
    const spans = container.querySelectorAll('span');
    const colored = Array.from(spans).filter((el) => el.style.color !== '');
    // No span should have inline color when textColor is omitted.
    // (The label/value are inside the balance block; nothing else in the
    // header carries inline color.)
    expect(colored.length).toBe(0);
  });
});

// ─── Typography ────────────────────────────────────────────────────────────
// Label is smaller than value. font-bold on the value (vs. font-medium on pill)
// is intentional — the value is the prominent number.
describe('PassCardPreviewHeader — typography', () => {
  it('non-compact: label class contains text-[10px] font-medium', () => {
    render(<PassCardPreviewHeader cardType="stamp_card" />);
    const labelSpan = screen.getByText('balancePreview.label');
    expect(labelSpan.className).toContain('text-[10px]');
    expect(labelSpan.className).toContain('font-medium');
  });

  it('non-compact: value class contains text-sm font-bold', () => {
    render(<PassCardPreviewHeader cardType="stamp_card" />);
    const valueSpan = screen.getByText(BALANCE_PREVIEW_AMOUNTS.TWD);
    expect(valueSpan.className).toContain('text-sm');
    expect(valueSpan.className).toContain('font-bold');
  });

  it('compact: label class contains text-[8px] font-medium', () => {
    render(<PassCardPreviewHeader cardType="stamp_card" compact />);
    const labelSpan = screen.getByText('balancePreview.label');
    expect(labelSpan.className).toContain('text-[8px]');
    expect(labelSpan.className).toContain('font-medium');
  });

  it('compact: value class contains text-[11px] font-bold', () => {
    render(<PassCardPreviewHeader cardType="stamp_card" compact />);
    const valueSpan = screen.getByText(BALANCE_PREVIEW_AMOUNTS.TWD);
    expect(valueSpan.className).toContain('text-[11px]');
    expect(valueSpan.className).toContain('font-bold');
  });

  it('label font-size < value font-size (PassCreator hierarchy)', () => {
    const TAILWIND_TEXT_TO_PX: Record<string, number> = {
      'text-sm': 14,
      'text-[10px]': 10,
      'text-[11px]': 11,
      'text-[8px]': 8,
    };
    render(<PassCardPreviewHeader cardType="stamp_card" />);
    const labelSpan = screen.getByText('balancePreview.label');
    const valueSpan = screen.getByText(BALANCE_PREVIEW_AMOUNTS.TWD);
    const labelPx = Object.entries(TAILWIND_TEXT_TO_PX).find(([cls]) =>
      labelSpan.className.includes(cls),
    )?.[1];
    const valuePx = Object.entries(TAILWIND_TEXT_TO_PX).find(([cls]) =>
      valueSpan.className.includes(cls),
    )?.[1];
    expect(labelPx).toBeGreaterThan(0);
    expect(valuePx).toBeGreaterThan(labelPx!);
  });
});

// ─── Layout / DOM order ────────────────────────────────────────────────────
// The balance block is `flex flex-col items-start` — label above value, both
// left-aligned (items-start). Both spans share the same parent <div>.
describe('PassCardPreviewHeader — balance block layout', () => {
  it('balance block is flex-col with items-start (left-aligned vertical)', () => {
    render(<PassCardPreviewHeader cardType="stamp_card" />);
    const labelSpan = screen.getByText('balancePreview.label');
    const block = labelSpan.parentElement as HTMLElement;
    expect(block.className).toContain('flex-col');
    expect(block.className).toContain('items-start');
  });

  it('label span comes before value span in DOM order (vertical stacking)', () => {
    render(<PassCardPreviewHeader cardType="stamp_card" />);
    const labelSpan = screen.getByText('balancePreview.label');
    const valueSpan = screen.getByText(BALANCE_PREVIEW_AMOUNTS.TWD);
    // Both spans share the same parent (the balance block)
    expect(labelSpan.parentElement).toBe(valueSpan.parentElement);
    // In document order, label appears before value
    expect(
      labelSpan.compareDocumentPosition(valueSpan) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });
});

// ─── Pure helper exports ───────────────────────────────────────────────────
// The exported BALANCE_PREVIEW_CARD_TYPES and shouldShowBalancePreview are
// the contract for "which card types get the balance preview". Pin them.
describe('BALANCE_PREVIEW_CARD_TYPES / shouldShowBalancePreview — contract', () => {
  it('BALANCE_PREVIEW_CARD_TYPES has exactly {stamp_card, reward_card, cashback_card}', () => {
    expect(BALANCE_PREVIEW_CARD_TYPES.size).toBe(3);
    expect(BALANCE_PREVIEW_CARD_TYPES.has('stamp_card')).toBe(true);
    expect(BALANCE_PREVIEW_CARD_TYPES.has('reward_card')).toBe(true);
    expect(BALANCE_PREVIEW_CARD_TYPES.has('cashback_card')).toBe(true);
  });

  it('BALANCE_PREVIEW_CARD_TYPES excludes the other 5 card types', () => {
    expect(BALANCE_PREVIEW_CARD_TYPES.has('membership_card')).toBe(false);
    expect(BALANCE_PREVIEW_CARD_TYPES.has('discount_card')).toBe(false);
    expect(BALANCE_PREVIEW_CARD_TYPES.has('coupon_card')).toBe(false);
    expect(BALANCE_PREVIEW_CARD_TYPES.has('multipass')).toBe(false);
    expect(BALANCE_PREVIEW_CARD_TYPES.has('gift_card')).toBe(false);
  });

  it('shouldShowBalancePreview returns true for target card types', () => {
    expect(shouldShowBalancePreview('stamp_card')).toBe(true);
    expect(shouldShowBalancePreview('reward_card')).toBe(true);
    expect(shouldShowBalancePreview('cashback_card')).toBe(true);
  });

  it('shouldShowBalancePreview returns false for non-target / null / undefined', () => {
    expect(shouldShowBalancePreview('membership_card')).toBe(false);
    expect(shouldShowBalancePreview(null)).toBe(false);
    expect(shouldShowBalancePreview(undefined)).toBe(false);
  });
});
