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
 * 2026-10-24 — the per-cardType header contract (which Sets / type
 * guards / date helpers this component used to own) moved to the
 * shared spec `packages/shared/constants/headerSlots.ts`. The
 * contract-style describes that used to live here are replaced by
 * `packages/shared/constants/headerSlots.test.ts` (partition / key /
 * test-id coverage). What stays here is the RENDER BEHAVIOR: what the
 * DOM actually looks like for each card type.
 *
 * Conventions follow PassCardPreviewBody.test.tsx:
 *   - vi.mock('react-i18next') returns `t: key => key`
 *   - Store state seeded via `useCardBuilderStore.setState(...)`
 *   - `useCardBuilderStore.getState().reset()` in beforeEach for isolation
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, act, cleanup } from '@testing-library/react';
import { useTranslation } from 'react-i18next';
import { PassCardPreviewHeader } from './PassCardPreviewHeader';
import { useCardBuilderStore } from '../CardBuilderEditor.store';
import { BALANCE_PREVIEW_AMOUNTS } from '@saome/shared/constants/balancePreview';
import { GIFT_POINTS_PREVIEW_VALUE } from '@saome/shared/constants/gift-card';
import {
  HEADER_SLOTS,
  HEADER_SLOT_KIND_SPECS,
} from '@saome/shared/constants/headerSlots';

/** Every card type the shared header-slot spec declares — the input domain
 *  of the header right slot. Derived from the spec itself (rather than
 *  re-listing the card types) so this test cannot drift from the spec. */
const ALL_CARD_TYPES = Object.keys(HEADER_SLOTS) as (keyof typeof HEADER_SLOTS)[];

// Mock i18n — vi.fn(key => key) makes t() return the key as text.
// This lets us assert against key paths directly without depending on the
// actual translation strings (those are guarded by verify-i18n-keys.mjs).
// i18n.language is set to 'en' default; tests that need a different locale
// override via `vi.mocked(useTranslation).mockReturnValueOnce(...)`.
vi.mock('react-i18next', () => ({
  useTranslation: vi.fn(() => ({
    t: vi.fn((key: string) => key),
    i18n: { language: 'en' },
  })),
}));

beforeEach(() => {
  cleanup();
  useCardBuilderStore.getState().reset();
});

// ─── Default pill behavior (non-target card types) ────────────────────────
// Non-target card types keep the original rounded-full pill. As of
// 2026-09-27, EVERY cardType has a dedicated 2-line preview block:
//   - stamp_card / reward_card / cashback_card / multipass → balance
//   - membership_card → member expiry
//   - discount_card → discount expiry
//   - coupon_card → coupon expiry
//   - gift_card → gift points preview (hardcoded value)
// That leaves ONLY `cardType={null|undefined}` to render the i18n
// fallback pill (defaultCardType key).
//   - 2026-09-27: gift_card moved OUT of this set (now renders the
//     gift-points preview block, label "點數" + hardcoded "2363點").
//   - 2026-09-20: multipass moved OUT of this set (balance preview).
//   - 2026-09-19: coupon_card moved OUT of this set (coupon-expiry).
//   - 2026-09-13: membership_card moved OUT of this set (member-expiry).
//   - 2026-09-08: stamp/reward/cashback were excluded when the balance
//     preview was added.
describe('PassCardPreviewHeader — default pill for non-target card types', () => {
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

// ─── Balance preview card-type partition (render-level) ───────────────────
// 2026-10-24 — the "which card types get the balance preview" contract
// now lives in the shared spec
// (`packages/shared/constants/headerSlots.ts::HEADER_SLOTS`) and is
// covered by `packages/shared/constants/headerSlots.test.ts`.
// What's asserted HERE is the render consequence: which card types
// produce a balance block vs. some other block.
describe('PassCardPreviewHeader — balance preview applies to exactly the balance card types', () => {
  it.each(['stamp_card', 'reward_card', 'cashback_card', 'multipass'] as const)(
    'cardType="%s" renders the balance block (not the pill)',
    (cardType) => {
      const { container } = render(<PassCardPreviewHeader cardType={cardType} />);
      expect(container.querySelector('span.rounded-full')).toBeNull();
      expect(screen.getByText('balancePreview.label')).toBeInTheDocument();
    },
  );

  it.each(['membership_card', 'discount_card', 'coupon_card', 'gift_card'] as const)(
    'cardType="%s" does NOT render the balance block',
    (cardType) => {
      render(<PassCardPreviewHeader cardType={cardType} />);
      expect(screen.queryByText('balancePreview.label')).toBeNull();
    },
  );
});

// ─── Member expiry preview (2026-09-13) ───────────────────────────────────
// membership_card renders a 2-line vertical block on the right side of the
// header: label = "會員到期日" / "Member Expiry", value = formatted expiryDate
// or "∞" (infinity when hasExpiry=false). The pill is NOT rendered.
describe('PassCardPreviewHeader — member expiry preview for membership_card', () => {
  it('membership_card + hasExpiry=false renders "∞" as value (no expiry = infinity)', () => {
    useCardBuilderStore.setState({ hasExpiry: false });
    const { container } = render(<PassCardPreviewHeader cardType="membership_card" />);
    // No pill for membership_card
    expect(container.querySelector('span.rounded-full')).toBeNull();
    // Label is an i18n key (mock returns key as text)
    expect(screen.getByText('memberExpiry.label')).toBeInTheDocument();
    // Value is "∞"
    expect(screen.getByText('∞')).toBeInTheDocument();
  });

  it('membership_card + hasExpiry=true + expiryDate="2027-10-23" renders formatted date', () => {
    // The shared mock uses English, so formatExpiryDateForHeader renders
    // the en (MM.DD.YYYY) format. To test zh-TW (YYYY.MM.DD), the mock
    // needs to be configured per-test (see "zh-TW date format" test below).
    useCardBuilderStore.setState({
      hasExpiry: true,
      expiryDate: '2027-10-23',
    });
    render(<PassCardPreviewHeader cardType="membership_card" />);
    expect(screen.getByText('memberExpiry.label')).toBeInTheDocument();
    // en format: MM.DD.YYYY
    expect(screen.getByText('10.23.2027')).toBeInTheDocument();
  });

  it('membership_card + hasExpiry=true + expiryDate="2027-10-23" + zh-TW locale renders YYYY.MM.DD', () => {
    // Override the i18n mock to return zh-TW for this render — verifies the
    // locale-driven date formatting path inside the component.
    vi.mocked(useTranslation).mockReturnValueOnce({
      t: vi.fn((key: string) => key),
      i18n: { language: 'zh-TW' },
    } as unknown as ReturnType<typeof useTranslation>);
    useCardBuilderStore.setState({
      hasExpiry: true,
      expiryDate: '2027-10-23',
    });
    render(<PassCardPreviewHeader cardType="membership_card" />);
    // zh-TW format: YYYY.MM.DD
    expect(screen.getByText('2027.10.23')).toBeInTheDocument();
  });

  it('membership_card + hasExpiry=true + expiryDate="" renders formatted DEFAULT_EXPIRY_DATE (en: 10.23.2027)', () => {
    // 2026-09-13 fix: the membership card intentionally hides step2's
    // PassValidDaysField + ExpiryDateField, so the preview has no source
    // for expiryDate. Fall back to the hardcoded DEFAULT_EXPIRY_DATE
    // ('2027-10-23') instead of the "—" placeholder.
    useCardBuilderStore.setState({
      hasExpiry: true,
      expiryDate: '',
    });
    render(<PassCardPreviewHeader cardType="membership_card" />);
    expect(screen.getByText('memberExpiry.label')).toBeInTheDocument();
    expect(screen.getByText('10.23.2027')).toBeInTheDocument();
    expect(screen.queryByText('—')).toBeNull();
  });

  it('membership_card + hasExpiry=true + expiryDate="" + zh-TW locale renders formatted DEFAULT_EXPIRY_DATE (2027.10.23)', () => {
    // Same fallback path as the en case above, but with the locale-aware
    // formatter producing the zh-TW YYYY.MM.DD output.
    vi.mocked(useTranslation).mockReturnValueOnce({
      t: vi.fn((key: string) => key),
      i18n: { language: 'zh-TW' },
    } as unknown as ReturnType<typeof useTranslation>);
    useCardBuilderStore.setState({
      hasExpiry: true,
      expiryDate: '',
    });
    render(<PassCardPreviewHeader cardType="membership_card" />);
    expect(screen.getByText('memberExpiry.label')).toBeInTheDocument();
    expect(screen.getByText('2027.10.23')).toBeInTheDocument();
    expect(screen.queryByText('—')).toBeNull();
  });

  it('membership_card + hasExpiry=true + expiryDate=malformed input renders input verbatim (defensive)', () => {
    // The DB layer enforces YYYY-MM-DD format, but the preview must not
    // crash on weird input. Defensive fallback: return the original string.
    useCardBuilderStore.setState({
      hasExpiry: true,
      expiryDate: 'not-a-date',
    });
    render(<PassCardPreviewHeader cardType="membership_card" />);
    expect(screen.getByText('not-a-date')).toBeInTheDocument();
  });

  it('membership_card — testid "member-expiry-preview" is rendered for test selectors', () => {
    useCardBuilderStore.setState({ hasExpiry: false });
    const { container } = render(<PassCardPreviewHeader cardType="membership_card" />);
    expect(
      container.querySelector('[data-testid="member-expiry-preview"]'),
    ).toBeInTheDocument();
  });
});

// ─── MEMBER_EXPIRY_PREVIEW card-type partition (render-level) ─────────────
// 2026-10-24 — the contract moved to the shared spec
// (`packages/shared/constants/headerSlots.ts`). What's asserted here is
// the render consequence.
describe('PassCardPreviewHeader — member expiry preview applies to membership_card only', () => {
  it('membership_card renders the member expiry block', () => {
    useCardBuilderStore.setState({ hasExpiry: false });
    render(<PassCardPreviewHeader cardType="membership_card" />);
    expect(screen.getByText('memberExpiry.label')).toBeInTheDocument();
  });

  it.each(['stamp_card', 'reward_card', 'cashback_card', 'discount_card', 'coupon_card', 'multipass', 'gift_card'] as const)(
    'cardType="%s" does NOT render the member expiry block',
    (cardType) => {
      render(<PassCardPreviewHeader cardType={cardType} />);
      expect(screen.queryByText('memberExpiry.label')).toBeNull();
    },
  );
});

// ─── Discount expiry preview (2026-09-18) ───────────────────────────────
// discount_card renders a 2-line vertical block on the right side of the
// header: label = "有效期限" / "Expiry Date", value = either formatted
// discountSpecificExpiryDate or (today + discountCustomExpiryDays),
// locale-aware (zh-TW: YYYY.MM.DD, en: MM.DD.YYYY). Falls back to "—"
// when both fields are null (theoretical — Step 6 requires one).
describe('PassCardPreviewHeader — discount expiry preview for discount_card', () => {
  /**
   * 2026-09-18 discount card extension.
   *
   * Mirrors the member expiry preview block above, but for the
   * `discount_card` card type. The data source is the store's
   * `discountCustomExpiryDays` (int days from today) or
   * `discountSpecificExpiryDate` (ISO YYYY-MM-DD string). Both are
   * mutually exclusive (setDiscountCustomExpiryDays clears the date
   * and vice versa — see CardBuilderEditor.store.ts).
   *
   * The date math is evaluated against `new Date()` which is timezone-
   * dependent in jsdom. Tests assert on the formatted OUTPUT string
   * (not the raw Date object) to pin the locale-driven formatter.
   */
  it('discount_card + discountCustomExpiryDays = 30 → value is today+30 days (en format)', () => {
    useCardBuilderStore.setState({
      discountCustomExpiryDays: 30,
      discountSpecificExpiryDate: null,
    });
    render(<PassCardPreviewHeader cardType="discount_card" />);
    expect(screen.getByText('discountExpiry.label')).toBeInTheDocument();

    // Compute expected value: today + 30 days in en format (MM.DD.YYYY).
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const future = new Date(today);
    future.setDate(future.getDate() + 30);
    const mm = String(future.getMonth() + 1).padStart(2, '0');
    const dd = String(future.getDate()).padStart(2, '0');
    const yyyy = future.getFullYear();
    const expected = `${mm}.${dd}.${yyyy}`;
    expect(screen.getByText(expected)).toBeInTheDocument();
  });

  it('discount_card + discountSpecificExpiryDate = "2026-10-30" → value is formatted en', () => {
    useCardBuilderStore.setState({
      discountCustomExpiryDays: null,
      discountSpecificExpiryDate: '2026-10-30',
    });
    render(<PassCardPreviewHeader cardType="discount_card" />);
    expect(screen.getByText('discountExpiry.label')).toBeInTheDocument();
    expect(screen.getByText('10.30.2026')).toBeInTheDocument();
  });

  it('discount_card + discountSpecificExpiryDate = "2026-10-30" + zh-TW locale → value is formatted zh-TW (YYYY.MM.DD)', () => {
    vi.mocked(useTranslation).mockReturnValueOnce({
      t: vi.fn((key: string) => key),
      i18n: { language: 'zh-TW' },
    } as unknown as ReturnType<typeof useTranslation>);
    useCardBuilderStore.setState({
      discountCustomExpiryDays: null,
      discountSpecificExpiryDate: '2026-10-30',
    });
    render(<PassCardPreviewHeader cardType="discount_card" />);
    expect(screen.getByText('discountExpiry.label')).toBeInTheDocument();
    expect(screen.getByText('2026.10.30')).toBeInTheDocument();
  });

  it('discount_card + discountCustomExpiryDays = 7 + zh-TW locale → value is today+7 days in zh-TW format', () => {
    vi.mocked(useTranslation).mockReturnValueOnce({
      t: vi.fn((key: string) => key),
      i18n: { language: 'zh-TW' },
    } as unknown as ReturnType<typeof useTranslation>);
    useCardBuilderStore.setState({
      discountCustomExpiryDays: 7,
      discountSpecificExpiryDate: null,
    });
    render(<PassCardPreviewHeader cardType="discount_card" />);

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const future = new Date(today);
    future.setDate(future.getDate() + 7);
    const mm = String(future.getMonth() + 1).padStart(2, '0');
    const dd = String(future.getDate()).padStart(2, '0');
    const yyyy = future.getFullYear();
    const expected = `${yyyy}.${mm}.${dd}`;
    expect(screen.getByText(expected)).toBeInTheDocument();
  });

  it('discount_card + both discountCustomExpiryDays and discountSpecificExpiryDate = null → "∞" placeholder', () => {
    // Theoretical fallback: Step 6 requires one or the other (the
    // "bothNullError" validation enforces this). If both happen to be
    // null at preview time, the component renders the shared "never
    // expires" sentinel "∞" defensively (2026-10-26).
    useCardBuilderStore.setState({
      discountCustomExpiryDays: null,
      discountSpecificExpiryDate: null,
    });
    render(<PassCardPreviewHeader cardType="discount_card" />);
    expect(screen.getByText('discountExpiry.label')).toBeInTheDocument();
    expect(screen.getByText('∞')).toBeInTheDocument();
  });

  it('discount_card — testid "discount-expiry-preview" is rendered for test selectors', () => {
    useCardBuilderStore.setState({
      discountCustomExpiryDays: 30,
      discountSpecificExpiryDate: null,
    });
    const { container } = render(<PassCardPreviewHeader cardType="discount_card" />);
    expect(
      container.querySelector('[data-testid="discount-expiry-preview"]'),
    ).toBeInTheDocument();
  });

  it('discount_card — pill is NOT rendered (replaces the default pill with expiry block)', () => {
    useCardBuilderStore.setState({
      discountCustomExpiryDays: 30,
      discountSpecificExpiryDate: null,
    });
    const { container } = render(<PassCardPreviewHeader cardType="discount_card" />);
    expect(container.querySelector('span.rounded-full')).toBeNull();
  });
});

describe('PassCardPreviewHeader - discount expiry preview applies to discount_card only', () => {
  /**
   * 2026-10-24 - the contract moved to the shared spec
   * (`packages/shared/constants/headerSlots.ts`). What is asserted here
   * is the render consequence.
   */
  it('discount_card renders the discount expiry block', () => {
    useCardBuilderStore.setState({
      discountCustomExpiryDays: 30,
      discountSpecificExpiryDate: null,
    });
    render(<PassCardPreviewHeader cardType="discount_card" />);
    expect(screen.getByText('discountExpiry.label')).toBeInTheDocument();
  });

  it.each(['stamp_card', 'reward_card', 'cashback_card', 'membership_card', 'coupon_card', 'multipass', 'gift_card'] as const)(
    'cardType="%s" does NOT render the discount expiry block',
    (cardType) => {
      useCardBuilderStore.setState({
        discountCustomExpiryDays: 30,
        discountSpecificExpiryDate: '2026-10-30',
      });
      render(<PassCardPreviewHeader cardType={cardType} />);
      expect(screen.queryByText('discountExpiry.label')).toBeNull();
    },
  );
});
describe('PassCardPreviewHeader — non-target card types render the default pill (regression)', () => {
  /**
   * 2026-09-18 — discount_card is the only card type that gets the
   * discount expiry preview. All other card types (incl. stamp/reward/
   * cashback which get the balance preview, membership which gets the
   * member expiry preview) must NOT render the discount expiry block.
   * This is a regression guard against the discount block leaking into
   * other card types.
   */
  it('stamp_card does NOT render the discount expiry block', () => {
    useCardBuilderStore.setState({
      discountCustomExpiryDays: 30,
      discountSpecificExpiryDate: '2026-10-30',
    });
    const { container } = render(<PassCardPreviewHeader cardType="stamp_card" />);
    expect(
      container.querySelector('[data-testid="discount-expiry-preview"]'),
    ).toBeNull();
    // The discountExpiry.label key MUST NOT appear in the DOM.
    expect(screen.queryByText('discountExpiry.label')).toBeNull();
    // The balance preview renders for stamp_card instead.
    expect(screen.getByText('balancePreview.label')).toBeInTheDocument();
  });

  it('membership_card does NOT render the discount expiry block', () => {
    useCardBuilderStore.setState({
      discountCustomExpiryDays: 30,
      discountSpecificExpiryDate: '2026-10-30',
    });
    const { container } = render(<PassCardPreviewHeader cardType="membership_card" />);
    expect(
      container.querySelector('[data-testid="discount-expiry-preview"]'),
    ).toBeNull();
    // The member expiry preview renders for membership_card.
    expect(screen.getByText('memberExpiry.label')).toBeInTheDocument();
  });

  it('reward_card does NOT render the discount expiry block', () => {
    useCardBuilderStore.setState({
      discountCustomExpiryDays: 30,
      discountSpecificExpiryDate: '2026-10-30',
    });
    const { container } = render(<PassCardPreviewHeader cardType="reward_card" />);
    expect(
      container.querySelector('[data-testid="discount-expiry-preview"]'),
    ).toBeNull();
  });

  it('cashback_card does NOT render the discount expiry block', () => {
    useCardBuilderStore.setState({
      discountCustomExpiryDays: 30,
      discountSpecificExpiryDate: '2026-10-30',
    });
    const { container } = render(<PassCardPreviewHeader cardType="cashback_card" />);
    expect(
      container.querySelector('[data-testid="discount-expiry-preview"]'),
    ).toBeNull();
  });
});

// ─── Coupon expiry preview (2026-09-19) ──────────────────────────────────
// Scoped to coupon_card ONLY. Data sources:
//   - passValidDays (int days from today) → today + N days formatted per locale
//   - expiryDate (ISO YYYY-MM-DD) → directly formatted per locale
//   - both null/empty → "∞" (infinity, no implied expiry for coupons)
//
// Differs from discount expiry in the data source contract:
//   - discount reads discountCustomExpiryDays / discountSpecificExpiryDate
//     (Step 6-specific, mutually exclusive via setter logic).
//   - coupon reads passValidDays / expiryDate (Step 2-shared, both may be
//     set independently — fallback to "∞" only when both are empty).
//
// Differs from member expiry in the control flow:
//   - member uses hasExpiry toggle + expiryDate (true → show, false → "∞").
//   - coupon uses passValidDays + expiryDate (independently; "∞" when both
//     empty).
describe('PassCardPreviewHeader — coupon expiry preview for coupon_card', () => {
  it('coupon_card + passValidDays = 7 → value is today+7 days (en format)', () => {
    useCardBuilderStore.setState({ passValidDays: 7, expiryDate: '' });
    render(<PassCardPreviewHeader cardType="coupon_card" />);
    expect(screen.getByText('couponExpiry.label')).toBeInTheDocument();

    // Compute expected value: today + 7 days in en format (MM.DD.YYYY).
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const future = new Date(today);
    future.setDate(future.getDate() + 7);
    const mm = String(future.getMonth() + 1).padStart(2, '0');
    const dd = String(future.getDate()).padStart(2, '0');
    const yyyy = future.getFullYear();
    const expected = `${mm}.${dd}.${yyyy}`;
    expect(screen.getByText(expected)).toBeInTheDocument();
  });

  it('coupon_card + expiryDate = "2026-10-30" → value is formatted en (MM.DD.YYYY)', () => {
    useCardBuilderStore.setState({ passValidDays: null, expiryDate: '2026-10-30' });
    render(<PassCardPreviewHeader cardType="coupon_card" />);
    expect(screen.getByText('couponExpiry.label')).toBeInTheDocument();
    expect(screen.getByText('10.30.2026')).toBeInTheDocument();
  });

  it('coupon_card + expiryDate = "2026-10-30" + zh-TW locale → value is formatted zh-TW (YYYY.MM.DD)', () => {
    vi.mocked(useTranslation).mockReturnValueOnce({
      t: vi.fn((key: string) => key),
      i18n: { language: 'zh-TW' },
    } as unknown as ReturnType<typeof useTranslation>);
    useCardBuilderStore.setState({ passValidDays: null, expiryDate: '2026-10-30' });
    render(<PassCardPreviewHeader cardType="coupon_card" />);
    expect(screen.getByText('couponExpiry.label')).toBeInTheDocument();
    expect(screen.getByText('2026.10.30')).toBeInTheDocument();
  });

  it('coupon_card + passValidDays = 7 + zh-TW locale → value is today+7 days in zh-TW format', () => {
    vi.mocked(useTranslation).mockReturnValueOnce({
      t: vi.fn((key: string) => key),
      i18n: { language: 'zh-TW' },
    } as unknown as ReturnType<typeof useTranslation>);
    useCardBuilderStore.setState({ passValidDays: 7, expiryDate: '' });
    render(<PassCardPreviewHeader cardType="coupon_card" />);

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const future = new Date(today);
    future.setDate(future.getDate() + 7);
    const mm = String(future.getMonth() + 1).padStart(2, '0');
    const dd = String(future.getDate()).padStart(2, '0');
    const yyyy = future.getFullYear();
    const expected = `${yyyy}.${mm}.${dd}`;
    expect(screen.getByText(expected)).toBeInTheDocument();
  });

  it('coupon_card + both passValidDays null AND expiryDate empty → "∞" infinity (default behaviour)', () => {
    // Coupon default: no implied expiry. Falls back to "∞" when both
    // fields are empty. Mirrors membership_card hasExpiry=false UX.
    useCardBuilderStore.setState({ passValidDays: null, expiryDate: '' });
    render(<PassCardPreviewHeader cardType="coupon_card" />);
    expect(screen.getByText('couponExpiry.label')).toBeInTheDocument();
    expect(screen.getByText('∞')).toBeInTheDocument();
  });

  it('coupon_card — testid "coupon-expiry-preview" is rendered for test selectors', () => {
    useCardBuilderStore.setState({ passValidDays: 7, expiryDate: '' });
    const { container } = render(<PassCardPreviewHeader cardType="coupon_card" />);
    expect(
      container.querySelector('[data-testid="coupon-expiry-preview"]'),
    ).toBeInTheDocument();
  });

  it('coupon_card — pill is NOT rendered (replaces the default pill with expiry block)', () => {
    useCardBuilderStore.setState({ passValidDays: 7, expiryDate: '' });
    const { container } = render(<PassCardPreviewHeader cardType="coupon_card" />);
    expect(container.querySelector('span.rounded-full')).toBeNull();
  });
});

describe('PassCardPreviewHeader - coupon expiry preview applies to coupon_card only', () => {
  /**
   * 2026-10-24 - the contract moved to the shared spec
   * (`packages/shared/constants/headerSlots.ts`). What is asserted here
   * is the render consequence.
   */
  it('coupon_card renders the coupon expiry block', () => {
    useCardBuilderStore.setState({ passValidDays: 7, expiryDate: '' });
    render(<PassCardPreviewHeader cardType="coupon_card" />);
    expect(screen.getByText('couponExpiry.label')).toBeInTheDocument();
  });

  it.each(['stamp_card', 'reward_card', 'cashback_card', 'membership_card', 'discount_card', 'multipass', 'gift_card'] as const)(
    'cardType="%s" does NOT render the coupon expiry block',
    (cardType) => {
      useCardBuilderStore.setState({ passValidDays: 7, expiryDate: '2026-10-30' });
      render(<PassCardPreviewHeader cardType={cardType} />);
      expect(screen.queryByText('couponExpiry.label')).toBeNull();
    },
  );
});
describe('PassCardPreviewHeader — coupon expiry preview is coupon_card-only (regression)', () => {
  /**
   * 2026-09-19 — coupon_card is the ONLY card type that gets the coupon
   * expiry preview. All other card types (incl. stamp/reward/cashback
   * which get the balance preview, membership which gets the member
   * expiry preview, discount which gets the discount expiry preview) must
   * NOT render the coupon expiry block even when passValidDays/expiryDate
   * are set. This is a regression guard against the coupon block leaking
   * into other card types.
   */
  it('stamp_card does NOT render the coupon expiry block', () => {
    useCardBuilderStore.setState({ passValidDays: 7, expiryDate: '2026-10-30' });
    const { container } = render(<PassCardPreviewHeader cardType="stamp_card" />);
    expect(
      container.querySelector('[data-testid="coupon-expiry-preview"]'),
    ).toBeNull();
    expect(screen.queryByText('couponExpiry.label')).toBeNull();
    // The balance preview renders for stamp_card instead.
    expect(screen.getByText('balancePreview.label')).toBeInTheDocument();
  });

  it('membership_card does NOT render the coupon expiry block', () => {
    useCardBuilderStore.setState({ passValidDays: 7, expiryDate: '2026-10-30' });
    const { container } = render(<PassCardPreviewHeader cardType="membership_card" />);
    expect(
      container.querySelector('[data-testid="coupon-expiry-preview"]'),
    ).toBeNull();
    // The member expiry preview renders for membership_card.
    expect(screen.getByText('memberExpiry.label')).toBeInTheDocument();
  });

  it('discount_card does NOT render the coupon expiry block (its own variant)', () => {
    useCardBuilderStore.setState({
      passValidDays: 7,
      expiryDate: '2026-10-30',
      // discount-specific fields also set, to make sure we render the discount
      // block (not coupon) when cardType=discount_card
      discountCustomExpiryDays: null,
      discountSpecificExpiryDate: '2026-12-31',
    });
    const { container } = render(<PassCardPreviewHeader cardType="discount_card" />);
    expect(
      container.querySelector('[data-testid="coupon-expiry-preview"]'),
    ).toBeNull();
    // The discount expiry preview renders for discount_card instead.
    expect(screen.getByText('discountExpiry.label')).toBeInTheDocument();
  });
});

// ─── Gift points preview for gift_card (2026-09-27) ───────────────────────
// 2026-09-27: gift_card now renders a 2-line "點數 / 2363點" block instead
// of the rounded-full pill. The value is hardcoded (GIFT_POINTS_PREVIEW_VALUE
// from shared/constants/gift-card.ts), the label is locale-driven
// ("點數" / "Points" — i18n key "giftPointsPreview.label").
//
// Scenarios covered:
//   1. Renders the 2-line block (no pill, label + value visible)
//   2. Value is GIFT_POINTS_PREVIEW_VALUE ("2363點"), not store-derived
//   3. Currency invariant: switching store.currency does NOT change value
//   4. gift_card is the only card type that renders the gift-points block
describe('PassCardPreviewHeader — gift points preview for gift_card (2026-09-27)', () => {
  it('gift_card renders the 2-line gift-points block (no pill)', () => {
    const { container } = render(<PassCardPreviewHeader cardType="gift_card" />);
    // No pill for gift_card
    expect(container.querySelector('span.rounded-full')).toBeNull();
    // Label is an i18n key (mock returns key as text)
    expect(screen.getByText('giftPointsPreview.label')).toBeInTheDocument();
    // Value is the hardcoded GIFT_POINTS_PREVIEW_VALUE
    expect(screen.getByText(GIFT_POINTS_PREVIEW_VALUE)).toBeInTheDocument();
  });

  it('gift_card value is the hardcoded constant, NOT store-derived (currency switch test)', () => {
    // Start with TWD, verify the same hardcoded value renders
    useCardBuilderStore.setState({ currency: 'TWD' });
    const { unmount } = render(<PassCardPreviewHeader cardType="gift_card" />);
    expect(screen.getByText(GIFT_POINTS_PREVIEW_VALUE)).toBeInTheDocument();
    expect(screen.queryByText(BALANCE_PREVIEW_AMOUNTS.TWD)).toBeNull();
    expect(screen.queryByText(BALANCE_PREVIEW_AMOUNTS.ZAR)).toBeNull();
    unmount();

    // Switch to ZAR and re-render — value must still be the hardcoded
    // GIFT_POINTS_PREVIEW_VALUE (NOT the ZAR currency-driven balance).
    useCardBuilderStore.setState({ currency: 'ZAR' });
    render(<PassCardPreviewHeader cardType="gift_card" />);
    expect(screen.getByText(GIFT_POINTS_PREVIEW_VALUE)).toBeInTheDocument();
    expect(screen.queryByText(BALANCE_PREVIEW_AMOUNTS.TWD)).toBeNull();
    expect(screen.queryByText(BALANCE_PREVIEW_AMOUNTS.ZAR)).toBeNull();
  });

  it('gift_card is the ONLY card type that renders the gift-points block', () => {
    // 2026-10-24 - the type-guard contract moved to the shared spec
    // (packages/shared/constants/headerSlots.ts); this asserts the
    // render consequence instead.
    render(<PassCardPreviewHeader cardType="gift_card" />);
    expect(screen.getByText('giftPointsPreview.label')).toBeInTheDocument();

    for (const cardType of ['stamp_card', 'membership_card', 'coupon_card'] as const) {
      cleanup();
      render(<PassCardPreviewHeader cardType={cardType} />);
      expect(screen.queryByText('giftPointsPreview.label')).toBeNull();
    }
  });
});

// ─── Header right slot test id — DOM must match the shared spec ───────────
// 2026-10-25 — the shared spec
// (`packages/shared/constants/headerSlots.ts::HEADER_SLOT_KIND_SPECS`)
// declares a `data-testid` per header kind, and the component renders it
// via `resolveHeaderRightSlot(...).testId`.
//
// The spec's own docblock spells out why this DOM-level check matters:
// "a mismatch would make the selector-based regression tests silently pass
// against the wrong element". The balance block in particular was MISSING
// its test id before the shared-spec refactor (the other four blocks had
// one), so both `balance-preview` and `gift-points-preview` are asserted
// here for the first time.
describe('PassCardPreviewHeader — the rendered test id matches the shared spec', () => {
  it.each([
    ['stamp_card', 'balance-preview'],
    ['reward_card', 'balance-preview'],
    ['cashback_card', 'balance-preview'],
    ['multipass', 'balance-preview'],
    ['membership_card', 'member-expiry-preview'],
    ['discount_card', 'discount-expiry-preview'],
    ['coupon_card', 'coupon-expiry-preview'],
    ['gift_card', 'gift-points-preview'],
  ] as const)('cardType="%s" renders under data-testid="%s"', (cardType, expectedTestId) => {
    const { container } = render(<PassCardPreviewHeader cardType={cardType} />);
    expect(
      container.querySelector(`[data-testid="${expectedTestId}"]`),
      `cardType="${cardType}" must render the "${expectedTestId}" block`,
    ).toBeInTheDocument();
  });

  it('every card type renders under the test id the shared spec declares', () => {
    // Derive the expectation from the SPEC itself, so a drift between the
    // spec table and the component's DOM is what fails — not a hardcoded
    // copy of the same table.
    for (const cardType of ALL_CARD_TYPES) {
      const kind = HEADER_SLOTS[cardType];
      const expectedTestId = HEADER_SLOT_KIND_SPECS[kind].testId;
      cleanup();
      const { container } = render(<PassCardPreviewHeader cardType={cardType} />);
      expect(
        container.querySelector(`[data-testid="${expectedTestId}"]`),
        `cardType="${cardType}" must render the spec's "${expectedTestId}"`,
      ).toBeInTheDocument();
    }
  });

  it('the default pill branch renders NO preview test id', () => {
    const { container } = render(<PassCardPreviewHeader cardType={null} />);
    expect(container.querySelector('span.rounded-full')).toBeInTheDocument();
    // No preview block → no preview test id.
    expect(container.querySelector('[data-testid$="-preview"]')).toBeNull();
  });
});

// ─── Unknown card type string — the retired guards' "false" branch ───────
// The retired `shouldShowXxxPreview()` guards were typed
// `(cardType: string | null | undefined)` and returned FALSE for every
// string outside their Sets, so the component fell through to the default
// pill. The component prop is still `cardType?: string | null`, so an
// arbitrary string is still reachable — it must render the pill, not throw.
describe('PassCardPreviewHeader — an unknown card type string renders the pill', () => {
  it.each(['not_a_card_type', 'toString', 'constructor', '__proto__'])(
    'cardType="%s" renders the default pill (no throw)',
    (cardType) => {
      const { container } = render(<PassCardPreviewHeader cardType={cardType} />);
      expect(container.querySelector('span.rounded-full')).toBeInTheDocument();
      // No preview block → no preview label.
      expect(screen.queryByText('balancePreview.label')).toBeNull();
      expect(screen.queryByText('memberExpiry.label')).toBeNull();
      expect(container.querySelector('[data-testid$="-preview"]')).toBeNull();
    },
  );
});
