/**
 * PassCardPreviewBody — Vitest + RTL Tests
 *
 * Covers the PassCreator Label/Value wiring:
 *   1. Placeholder behavior when leftField/rightField are null
 *   2. Demo label/value rendering when fields are selected
 *   3. All 9 fields × 2 slots = 18 cases (parametrized via CARD_FIELDS)
 *   4. textColor scope (label + value spans)
 *   5. compact mode (truncate on value spans)
 *   6. PassCreator typography hierarchy (label class < value class)
 *   7. PassCreator load-bearing invariant (computed font-size of label < value)
 *   8. Stamp preview interpolation (totalStamps.value uses {{rows}})
 */

import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { PassCardPreviewBody } from './PassCardPreviewBody';
import { CARD_FIELD_KEYS } from '@saome/shared/constants/card-fields';

// Mock: vi.fn(key => key) makes t() return the key as text. This lets the
// i18n key path itself be asserted (e.g. 'fieldPreview.phone.label') in the
// parametrized "all 9 fields × 2 slots" block. For the stamp interpolation
// tests we additionally assert on the `t()` call arguments to verify that
// `totalStamps.value` is called WITH `{ rows }` opts (the actual
// interpolation is done by react-i18next at runtime, not by this mock).
vi.mock('react-i18next', () => {
  return { useTranslation: vi.fn(() => ({ t: vi.fn((key: string) => key) })) };
});

describe('PassCardPreviewBody — placeholder behavior', () => {
  it('renders fieldLabelLeft / fieldLabelRight when both fields are null', () => {
    render(<PassCardPreviewBody />);
    // Mock returns key as-is; expect placeholder keys.
    expect(screen.getAllByText('fieldLabelLeft').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('fieldLabelRight').length).toBeGreaterThanOrEqual(1);
  });

  it('renders placeholder for left only when rightField is null', () => {
    render(<PassCardPreviewBody leftField="phone" />);
    // Left = fieldPreview.phone.label, right = fieldLabelRight placeholder
    expect(screen.getByText('fieldPreview.phone.label')).toBeInTheDocument();
    expect(screen.getAllByText('fieldLabelRight').length).toBeGreaterThanOrEqual(1);
  });

  it('renders placeholder for right only when leftField is null', () => {
    render(<PassCardPreviewBody rightField="email" />);
    expect(screen.getAllByText('fieldLabelLeft').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('fieldPreview.email.value')).toBeInTheDocument();
  });
});

describe('PassCardPreviewBody — demo label/value rendering', () => {
  it('renders phone label/value on left and email label/value on right', () => {
    render(<PassCardPreviewBody leftField="phone" rightField="email" />);
    expect(screen.getByText('fieldPreview.phone.label')).toBeInTheDocument();
    expect(screen.getByText('fieldPreview.phone.value')).toBeInTheDocument();
    expect(screen.getByText('fieldPreview.email.label')).toBeInTheDocument();
    expect(screen.getByText('fieldPreview.email.value')).toBeInTheDocument();
  });

  it('renders memberLevel value (Gold) when leftField is memberLevel', () => {
    render(<PassCardPreviewBody leftField="memberLevel" />);
    expect(screen.getByText('fieldPreview.memberLevel.value')).toBeInTheDocument();
  });
});

describe('PassCardPreviewBody — all 6 fields × 2 slots', () => {
  // Parametrize: for each CardFieldKey in both slots, the i18n key path
  // must resolve without drift. Catches missing fieldPreview.{key} entries.
  //
  // 2026-09-13 ZAR pollution fix: the two cashback amount fields
  // (`pointsToNextTierCashback`, `accumulatedSpendCashback`) are excluded
  // from this parametrized test because their values live in the
  // currency-driven `CASHBACK_PREVIEW_AMOUNTS` constant (NOT in i18n).
  // They have their own dedicated tests in the "cashback-only display
  // fields" describe block below. Filtering them out here keeps the
  // "all 6 fields × 2 slots" contract tight: i18n-sourced fields only.
  //
  // 2026-09-18 discount card extension: the two discount amount fields
  // (`pointsToNextTierDiscount`, `accumulatedSpendDiscount`) are also
  // currency-driven (sourced from `DISCOUNT_PREVIEW_AMOUNTS`), so they
  // join the cashback exclusions. The `discountTierBracket` field is
  // store-derived (`discountTiers[0].discountPercent + '%'`), NOT
  // i18n-sourced, so it's also excluded. They have their own dedicated
  // tests in the "discount-only amount fields" and "discountTierBracket
  // store-derived value" describe blocks below.
  //
  // 2026-09-20 multipass extension: the three multipass fields are
  // gated by `cardType === 'multipass'` — without that cardType, the
  // resolveSlot branches fall through to the default i18n default
  // branch, but the body's defensive guard (`label.startsWith('fieldPreview.')`
  // → empty string) catches the mock t() returning the i18n key
  // verbatim. The three multipass fields are excluded from this
  // parametrized sweep for the same reason as the cashback/discount
  // amount fields: their i18n keys exist, but they need a cardType
  // match to reach the resolveSlot branches. They have their own
  // dedicated tests in the "multipass + memberLevel → first-tier-name
  // override" describe block above. The fields are:
  //   - multipassCompleted
  //   - multipassPointsToNextTier
  //   - multipassRewardContent
  // Note: the dedicated `multipassMemberLevel` CardFieldKey was removed
  // (2026-09-20 review) — multipass now reuses the common `memberLevel`
  // key, which IS included in this sweep as a normal `memberLevel` test
  // case.
  const I18N_SOURCED_FIELD_KEYS = CARD_FIELD_KEYS.filter(
    (key) =>
      key !== 'pointsToNextTierCashback' &&
      key !== 'accumulatedSpendCashback' &&
      key !== 'pointsToNextTierDiscount' &&
      key !== 'accumulatedSpendDiscount' &&
      key !== 'discountTierBracket' &&
      key !== 'multipassCompleted' &&
      key !== 'multipassPointsToNextTier' &&
      key !== 'multipassRewardContent',
  );

  it.each(I18N_SOURCED_FIELD_KEYS)('renders leftField="%s" → fieldPreview.%s.label and .value', (key) => {
    const { unmount } = render(<PassCardPreviewBody leftField={key} />);
    expect(screen.getByText(`fieldPreview.${key}.label`)).toBeInTheDocument();
    expect(screen.getByText(`fieldPreview.${key}.value`)).toBeInTheDocument();
    unmount();
  });

  it.each(I18N_SOURCED_FIELD_KEYS)('renders rightField="%s" → fieldPreview.%s.label and .value', (key) => {
    const { unmount } = render(<PassCardPreviewBody rightField={key} />);
    expect(screen.getByText(`fieldPreview.${key}.label`)).toBeInTheDocument();
    expect(screen.getByText(`fieldPreview.${key}.value`)).toBeInTheDocument();
    unmount();
  });
});

describe('PassCardPreviewBody — textColor scope', () => {
  it('applies textColor to label + value spans (regression coverage scope #3 + #4)', () => {
    const { container } = render(
      <PassCardPreviewBody leftField="phone" rightField="email" textColor="#ff0000" />
    );
    // Find label + value spans — these are the 2 spans per row carrying i18n text.
    // The dividers are <div>, not <span>, so querySelectorAll('span') catches
    // only the 4 text spans (2 labels + 2 values).
    const coloredSpans = Array.from(container.querySelectorAll('span')).filter(
      (el) => el.style.color === 'rgb(255, 0, 0)',
    );
    expect(coloredSpans.length).toBe(4); // left label + left value + right label + right value
  });

  it('does not apply textColor when textColor prop is omitted', () => {
    const { container } = render(<PassCardPreviewBody leftField="phone" />);
    const coloredSpans = Array.from(container.querySelectorAll('span')).filter(
      (el) => el.style.color !== '',
    );
    expect(coloredSpans.length).toBe(0);
  });
});

describe('PassCardPreviewBody — compact mode', () => {
  it('applies truncate class to value spans in compact mode', () => {
    const { container } = render(
      <PassCardPreviewBody leftField="phone" rightField="email" compact />
    );
    const valueSpans = Array.from(container.querySelectorAll('span')).filter(
      (el) => el.textContent === 'fieldPreview.phone.value'
        || el.textContent === 'fieldPreview.email.value',
    );
    expect(valueSpans.length).toBe(2);
    valueSpans.forEach((span) => {
      expect(span.className).toContain('truncate');
    });
  });

  it('does NOT apply truncate in non-compact mode', () => {
    const { container } = render(
      <PassCardPreviewBody leftField="phone" rightField="email" />
    );
    const valueSpans = Array.from(container.querySelectorAll('span')).filter(
      (el) => el.textContent === 'fieldPreview.phone.value'
        || el.textContent === 'fieldPreview.email.value',
    );
    valueSpans.forEach((span) => {
      expect(span.className).not.toContain('truncate');
    });
  });
});

describe('PassCardPreviewBody — PassCreator typography hierarchy', () => {
  it('non-compact: label class is text-[10px] and value class is text-sm font-medium', () => {
    const { container } = render(
      <PassCardPreviewBody leftField="phone" rightField="email" />
    );
    const labelSpan = Array.from(container.querySelectorAll('span')).find(
      (el) => el.textContent === 'fieldPreview.phone.label',
    ) as HTMLElement;
    const valueSpan = Array.from(container.querySelectorAll('span')).find(
      (el) => el.textContent === 'fieldPreview.phone.value',
    ) as HTMLElement;
    expect(labelSpan).toBeInTheDocument();
    expect(valueSpan).toBeInTheDocument();
    expect(labelSpan.className).toContain('text-[10px]');
    expect(valueSpan.className).toContain('text-sm');
    expect(valueSpan.className).toContain('font-medium');
  });

  it('compact: label class is text-[8px] and value class is text-[11px] font-medium', () => {
    const { container } = render(
      <PassCardPreviewBody leftField="phone" rightField="email" compact />
    );
    const labelSpan = Array.from(container.querySelectorAll('span')).find(
      (el) => el.textContent === 'fieldPreview.phone.label',
    ) as HTMLElement;
    const valueSpan = Array.from(container.querySelectorAll('span')).find(
      (el) => el.textContent === 'fieldPreview.phone.value',
    ) as HTMLElement;
    expect(labelSpan.className).toContain('text-[8px]');
    expect(valueSpan.className).toContain('text-[11px]');
    expect(valueSpan.className).toContain('font-medium');
  });
});

describe('PassCardPreviewBody — label < value font-size invariant', () => {
  /**
   * Load-bearing test for the PassCreator requirement: regardless of which
   * i18n values render, the label span must be visibly smaller than the value
   * span.
   *
   * jsdom does NOT resolve Tailwind classes (vitest.config.ts has `css: false`),
   * so `getComputedStyle(el).fontSize` returns ''. We therefore resolve the
   * Tailwind class → px mapping ourselves using Tailwind v4 defaults:
   *   text-sm   = 14px
   *   text-[10px] = 10px
   *   text-[11px] = 11px
   *   text-[8px]  = 8px
   *
   * This matches the exact values rendered by the JIT-compiled CSS in
   * production, so the invariant holds under both jsdom and the real
   * browser. If anyone changes the className in PassCardPreviewBody, this
   * test fails immediately.
   */
  const TAILWIND_TEXT_TO_PX: Record<string, number> = {
    'text-sm': 14,
    'text-xs': 12,
    'text-[10px]': 10,
    'text-[11px]': 11,
    'text-[9px]': 9,
    'text-[8px]': 8,
  };

  /** Resolve a span's font-size in px from its className (Tailwind v4 mapping). */
  function getFontSizePxFromClass(el: HTMLElement): number {
    for (const [cls, px] of Object.entries(TAILWIND_TEXT_TO_PX)) {
      if (el.className.includes(cls)) return px;
    }
    return 0;
  }

  it('non-compact: label font-size < value font-size (PassCreator hierarchy)', () => {
    const { container } = render(
      <PassCardPreviewBody leftField="phone" rightField="email" />
    );
    const labelSpan = Array.from(container.querySelectorAll('span')).find(
      (el) => el.textContent === 'fieldPreview.phone.label',
    ) as HTMLElement;
    const valueSpan = Array.from(container.querySelectorAll('span')).find(
      (el) => el.textContent === 'fieldPreview.phone.value',
    ) as HTMLElement;
    const labelPx = getFontSizePxFromClass(labelSpan);
    const valuePx = getFontSizePxFromClass(valueSpan);
    expect(labelPx).toBeGreaterThan(0); // sanity: known mapping found
    expect(valuePx).toBeGreaterThan(labelPx);
  });

  it('compact: label font-size < value font-size (PassCreator hierarchy)', () => {
    const { container } = render(
      <PassCardPreviewBody leftField="phone" rightField="email" compact />
    );
    const labelSpan = Array.from(container.querySelectorAll('span')).find(
      (el) => el.textContent === 'fieldPreview.phone.label',
    ) as HTMLElement;
    const valueSpan = Array.from(container.querySelectorAll('span')).find(
      (el) => el.textContent === 'fieldPreview.phone.value',
    ) as HTMLElement;
    const labelPx = getFontSizePxFromClass(labelSpan);
    const valuePx = getFontSizePxFromClass(valueSpan);
    expect(labelPx).toBeGreaterThan(0);
    expect(valuePx).toBeGreaterThan(labelPx);
  });
});

describe('PassCardPreviewBody — column layout (left/right side-by-side, L&V vertical)', () => {
  /**
   * Load-bearing layout invariant (per user feedback 2026-09-04):
   *   左欄位 與 右欄位 必須並排 (flex-row)，而兩個欄位的 Label & Value 必須垂直排列 (flex-col)。
   *   之前的實作誤將每個 row 設成 [label, value] 並排、兩個 row 上下堆疊，
   *   不符合 PassCreator secondary field 的視覺慣例（label 在 value 上方）。
   *
   *   此 describe block 用 3 條斷言把這個 layout 鎖住，避免下次改回去。
   */

  it('outer field container is flex-row (左右欄位並排)', () => {
    const { container } = render(
      <PassCardPreviewBody leftField="phone" rightField="email" />,
    );
    // 第一層：分隔線 / 內容 / 分隔線
    // 第二層：內容區 = flex-row 容器（這層裝左右兩個 column）
    const flexRowContainers = Array.from(container.querySelectorAll('div')).filter(
      (el) => el.className.includes('flex-row'),
    );
    expect(flexRowContainers.length).toBeGreaterThanOrEqual(1);
  });

  it('each column is flex-col with label above value (vertical L&V)', () => {
    const { container } = render(
      <PassCardPreviewBody leftField="phone" rightField="email" />,
    );
    // 找所有 flex-col container，這些應該是左右兩個 column
    const flexColContainers = Array.from(container.querySelectorAll('div')).filter(
      (el) => el.className.includes('flex-col'),
    );
    // 至少要有 2 個 flex-col（左欄 + 右欄；最外層是 flex-col 沒被 flex-row 替換，但
    // flex-row 的出現就代表有 2 個 flex-col 的 column）
    expect(flexColContainers.length).toBeGreaterThanOrEqual(2);

    // 在每個 flex-col container 內，label 必須排在 value 前面 (DOM order)
    flexColContainers.forEach((col) => {
      const spans = Array.from(col.querySelectorAll(':scope > span'));
      if (spans.length < 2) return; // 非內容 column 跳過
      const firstSpanText = spans[0].textContent ?? '';
      const secondSpanText = spans[1].textContent ?? '';
      // label 的特徵：key 結尾是 .label；value 結尾是 .value
      const firstIsLabel = firstSpanText.endsWith('.label') || firstSpanText === 'fieldLabelLeft';
      const secondIsValue = secondSpanText.endsWith('.value') || secondSpanText === 'fieldLabelRight';
      expect(firstIsLabel).toBe(true);
      expect(secondIsValue).toBe(true);
    });
  });

  it('left column contains phone.label + phone.value; right column contains email.label + email.value', () => {
    render(
      <PassCardPreviewBody leftField="phone" rightField="email" />,
    );
    // 找出兩欄：透過 textContent 鎖定 column（column 內含 phone.label / phone.value / email.label / email.value）
    const phoneLabel = screen.getByText('fieldPreview.phone.label');
    const phoneValue = screen.getByText('fieldPreview.phone.value');
    const emailLabel = screen.getByText('fieldPreview.email.label');
    const emailValue = screen.getByText('fieldPreview.email.value');

    // phone 的 label 和 value 必須在同一個 flex-col parent（= 左欄）
    const phoneColumn = phoneLabel.parentElement;
    expect(phoneColumn).toBe(phoneValue.parentElement);
    expect(phoneColumn?.className).toContain('flex-col');

    // email 的 label 和 value 必須在同一個 flex-col parent（= 右欄）
    const emailColumn = emailLabel.parentElement;
    expect(emailColumn).toBe(emailValue.parentElement);
    expect(emailColumn?.className).toContain('flex-col');

    // 兩個 column 必須並列在同一個 flex-row parent
    expect(phoneColumn?.parentElement).toBe(emailColumn?.parentElement);
    expect(phoneColumn?.parentElement?.className).toContain('flex-row');
  });
});

describe('PassCardPreviewBody — stamp preview interpolation (2026-09-08)', () => {
  /**
   * totalStamps is the ONLY field whose preview value depends on another
   * section's data (Step 3 StampGrid → stampGridRows). The body component
   * receives `stampGridRows` as a prop and passes it to `t()` as
   * `t('fieldPreview.totalStamps.value', { rows })`. The denominator is
   * the TOTAL stamp count = rows × STAMPS_PER_ROW (5), not the raw row
   * count — see `StampGridPreview.types.ts::STAMPS_PER_ROW` for the
   * geometry contract.
   *
   * We assert on the call arguments (rather than rendered output, since
   * the mock returns the key verbatim) to pin the interpolation contract:
   *   - The key is `fieldPreview.totalStamps.value`.
   *   - The opts object contains `rows: <rows × STAMPS_PER_ROW>` (or
   *     `1 × 5 = 5` if stampGridRows is undefined).
   *   - Other stamp fields (availableRewards / stampsRemaining) call t()
   *     WITHOUT opts (static value, no interpolation).
   */

  /** Build a t() spy that accepts variadic args and returns the key. */
  function buildTSpy() {
    // Variadic so we can capture both single-arg and two-arg calls.
    return vi.fn((...args: unknown[]) => args[0] as string);
  }

  /** Re-mock `useTranslation` for one render with our spy as `t`. */
  function mockUseTranslationOnce(spy: ReturnType<typeof buildTSpy>) {
    // The component reads `const { t } = useTranslation('passCard')`, so we
    // only need to provide the `t` field. Cast through `unknown` to bypass
    // `react-i18next`'s strict tuple return type `[t, i18n, ready]`.
    vi.mocked(useTranslation).mockReturnValueOnce({ t: spy } as unknown as ReturnType<typeof useTranslation>);
  }

  it('leftField="totalStamps" with stampGridRows=2 calls t() with { rows: 10 } (2 rows × 5 stamps/row)', () => {
    const tSpy = buildTSpy();
    mockUseTranslationOnce(tSpy);
    render(<PassCardPreviewBody leftField="totalStamps" stampGridRows={2} />);

    // Find the value call (the one with opts as the 2nd positional arg).
    const valueCalls = tSpy.mock.calls.filter((call) => call[1] !== undefined);
    expect(valueCalls).toHaveLength(1);
    expect(valueCalls[0]?.[0]).toBe('fieldPreview.totalStamps.value');
    expect(valueCalls[0]?.[1]).toEqual({ rows: 10 });
  });

  it('rightField="totalStamps" with stampGridRows=4 calls t() with { rows: 20 } (4 rows × 5 stamps/row)', () => {
    const tSpy = buildTSpy();
    mockUseTranslationOnce(tSpy);
    render(<PassCardPreviewBody rightField="totalStamps" stampGridRows={4} />);

    const valueCalls = tSpy.mock.calls.filter((call) => call[1] !== undefined);
    expect(valueCalls).toHaveLength(1);
    expect(valueCalls[0]?.[1]).toEqual({ rows: 20 });
  });

  it('leftField="totalStamps" with stampGridRows=3 calls t() with { rows: 15 } (3 rows × 5 stamps/row)', () => {
    const tSpy = buildTSpy();
    mockUseTranslationOnce(tSpy);
    render(<PassCardPreviewBody leftField="totalStamps" stampGridRows={3} />);

    const valueCalls = tSpy.mock.calls.filter((call) => call[1] !== undefined);
    expect(valueCalls).toHaveLength(1);
    expect(valueCalls[0]?.[1]).toEqual({ rows: 15 });
  });

  it('leftField="totalStamps" with stampGridRows=1 calls t() with { rows: 5 } (1 row × 5 stamps/row)', () => {
    const tSpy = buildTSpy();
    mockUseTranslationOnce(tSpy);
    render(<PassCardPreviewBody leftField="totalStamps" stampGridRows={1} />);

    const valueCalls = tSpy.mock.calls.filter((call) => call[1] !== undefined);
    expect(valueCalls).toHaveLength(1);
    expect(valueCalls[0]?.[1]).toEqual({ rows: 5 });
  });

  it('leftField="totalStamps" without stampGridRows falls back to rows=5 (1 row × 5 stamps/row, never NaN/undefined)', () => {
    const tSpy = buildTSpy();
    mockUseTranslationOnce(tSpy);
    render(<PassCardPreviewBody leftField="totalStamps" />);

    const valueCalls = tSpy.mock.calls.filter((call) => call[1] !== undefined);
    expect(valueCalls).toHaveLength(1);
    expect(valueCalls[0]?.[1]).toEqual({ rows: 5 });
  });

  it('leftField="availableRewards" calls t() WITHOUT opts (static value)', () => {
    const tSpy = buildTSpy();
    mockUseTranslationOnce(tSpy);
    render(<PassCardPreviewBody leftField="availableRewards" stampGridRows={3} />);

    // No call should include opts — this field has no interpolation.
    const valueCalls = tSpy.mock.calls.filter((call) => call[1] !== undefined);
    expect(valueCalls).toHaveLength(0);
    // But the fieldPreview.availableRewards.value key IS called.
    expect(tSpy).toHaveBeenCalledWith('fieldPreview.availableRewards.value');
  });

  it('leftField="stampsRemaining" calls t() WITHOUT opts (static value)', () => {
    const tSpy = buildTSpy();
    mockUseTranslationOnce(tSpy);
    render(<PassCardPreviewBody leftField="stampsRemaining" stampGridRows={3} />);

    const valueCalls = tSpy.mock.calls.filter((call) => call[1] !== undefined);
    expect(valueCalls).toHaveLength(0);
    expect(tSpy).toHaveBeenCalledWith('fieldPreview.stampsRemaining.value');
  });
});

describe('PassCardPreviewBody — stamp_card member-level → reward override (2026-09-10)', () => {
  /**
   * 2026-09-10 stamp card member-level → reward refactor.
   *
   * When `cardType === 'stamp_card'` AND the picked field is
   * `'memberLevel'`, the slot must render as a 2-line pair
   *   label = `fieldPreview.memberLevel.stampLabel`
   *   value = `rewardName` (whatever the user typed in step6-reward-name).
   *
   * All other cardTypes (incl. `multipass`) MUST keep the original
   * memberLevel label/value behavior. The override is INTENTIONALLY scoped
   * to `stamp_card` only (user-confirmed scope: `stamp_only`).
   *
   * Empty `rewardName` renders as an empty string — no fallback to the
   * demo "金級" / "Gold" placeholder.
   */

  function buildTSpy() {
    // Variadic spy — captured calls include both the key (positional 0)
    // and the opts object (positional 1, when present).
    return vi.fn((...args: unknown[]) => args[0] as string);
  }

  function mockUseTranslationOnce(spy: ReturnType<typeof buildTSpy>) {
    vi.mocked(useTranslation).mockReturnValueOnce({ t: spy } as unknown as ReturnType<typeof useTranslation>);
  }

  it('stamp_card + leftField="memberLevel" + rewardName="10元折價" → label uses stampLabel key, value equals rewardName', () => {
    const tSpy = buildTSpy();
    mockUseTranslationOnce(tSpy);
    render(
      <PassCardPreviewBody
        leftField="memberLevel"
        cardType="stamp_card"
        rewardName="10元折價"
      />,
    );

    // Label must use the stamp-specific key.
    expect(tSpy).toHaveBeenCalledWith('fieldPreview.memberLevel.stampLabel');
    // The original memberLevel.label key MUST NOT be called for the label
    // (the override is exclusive — only stampLabel, not both).
    const labelCalls = tSpy.mock.calls.filter(
      (call) => call[0] === 'fieldPreview.memberLevel.label',
    );
    expect(labelCalls).toHaveLength(0);

    // Value: rewardName is passed through verbatim (NOT routed through t()).
    // The mocked t() returns the key for any string-arg call, so we look
    // for the literal rewardName in the rendered DOM instead of asserting
    // against t() calls.
    expect(screen.getByText('10元折價')).toBeInTheDocument();
  });

  it('stamp_card + leftField="memberLevel" + rewardName="" → value renders as empty string (no demo fallback)', () => {
    const tSpy = buildTSpy();
    mockUseTranslationOnce(tSpy);
    render(
      <PassCardPreviewBody
        leftField="memberLevel"
        cardType="stamp_card"
        rewardName=""
      />,
    );

    // Label still uses stampLabel.
    expect(tSpy).toHaveBeenCalledWith('fieldPreview.memberLevel.stampLabel');

    // Value: an empty string. We assert by NOT finding the demo fallback
    // "金級" / "Gold" text (which lives under fieldPreview.memberLevel.value).
    // The DOM should contain an empty <span> for the value side. We check
    // by collecting all value spans and verifying one is empty.
    const allSpans = Array.from(document.querySelectorAll('span'));
    const emptyValueSpans = allSpans.filter((span) => span.textContent === '');
    expect(emptyValueSpans.length).toBeGreaterThanOrEqual(1);
    // And we must NOT find the demo "金級" / "Gold" value text.
    const demoValueCalls = tSpy.mock.calls.filter(
      (call) => call[0] === 'fieldPreview.memberLevel.value',
    );
    expect(demoValueCalls).toHaveLength(0);
  });

  it('non-stamp / non-cashback / non-membership / non-discount cardType + leftField="memberLevel" → original memberLevel.label / .value keys (no override)', () => {
    // 2026-09-13: membership_card override branch was RESTORED. Now ALL
    // non-{stamp,reward,cashback} card types — including membership_card —
    // keep the original memberLevel label/value pair, except the 4
    // override families: stamp_card (stampLabel), reward_card (stampLabel),
    // cashback_card (stampLabel), membership_card (default label +
    // first tier name), discount_card (discountLabel + first tier name).
    //
    // 2026-09-18: discount_card joined the override families (per the
    // Step 3 dropdown extension). To test the default branch (no
    // override), use `coupon_card` which is never overridden.
    const tSpy = buildTSpy();
    mockUseTranslationOnce(tSpy);
    render(
      <PassCardPreviewBody
        leftField="memberLevel"
        cardType="coupon_card"
        rewardName="10元折價"
      />,
    );

    // coupon_card is not in any override list → original label/value keys.
    expect(tSpy).toHaveBeenCalledWith('fieldPreview.memberLevel.label');
    expect(tSpy).toHaveBeenCalledWith('fieldPreview.memberLevel.value');
    // stampLabel MUST NOT be called for non-{stamp,reward,cashback} types.
    const stampLabelCalls = tSpy.mock.calls.filter(
      (call) => call[0] === 'fieldPreview.memberLevel.stampLabel',
    );
    expect(stampLabelCalls).toHaveLength(0);
    // discountLabel MUST NOT be called for non-discount types.
    const discountLabelCalls = tSpy.mock.calls.filter(
      (call) => call[0] === 'fieldPreview.memberLevel.discountLabel',
    );
    expect(discountLabelCalls).toHaveLength(0);
    // And rewardName is NOT surfaced in the DOM (the override is off).
    expect(screen.queryByText('10元折價')).toBeNull();
  });

  it('multipass + leftField="memberLevel" + rewardName="10元折價" → multipass override fires (NOT stamp_card override; stampLabel MUST NOT be called; rewardName is IGNORED)', () => {
    // 2026-09-20 review: the OLD assertion ("scope = stamp_card ONLY") is
    // no longer correct — multipass now has its own override on the common
    // `memberLevel` key (mirrors `membership_card` pattern). The multipass
    // override uses the DEFAULT `fieldPreview.memberLevel.label` (not
    // stampLabel), and reads its value from `firstMultipassTierName` —
    // NOT from `rewardName` (which is stamp_card's source). `rewardName`
    // is therefore IGNORED for multipass cards.
    const tSpy = buildTSpy();
    mockUseTranslationOnce(tSpy);
    render(
      <PassCardPreviewBody
        leftField="memberLevel"
        cardType="multipass"
        rewardName="10元折價"
      />,
    );

    // The multipass override branch fires — label uses the default
    // `fieldPreview.memberLevel.label` key (NOT stampLabel, NOT
    // discountLabel — those are for stamp/reward/cashback and
    // discount cards respectively).
    expect(tSpy).toHaveBeenCalledWith('fieldPreview.memberLevel.label');
    // stampLabel MUST NOT be called — multipass is a tier-identity card,
    // not a reward card.
    const stampLabelCalls = tSpy.mock.calls.filter(
      (call) => call[0] === 'fieldPreview.memberLevel.stampLabel',
    );
    expect(stampLabelCalls).toHaveLength(0);
    // discountLabel MUST NOT be called either.
    expect(tSpy).not.toHaveBeenCalledWith('fieldPreview.memberLevel.discountLabel');
    // The stampCard data source `rewardName` is IGNORED — multipass reads
    // from `firstMultipassTierName` instead.
    expect(screen.queryByText('10元折價')).toBeNull();
  });
});

describe('PassCardPreviewBody — reward_card member-level → reward override (2026-09-10 ext)', () => {
  /**
   * 2026-09-10 reward card member-level → reward refactor extension.
   *
   * Mirrors the stamp_card override above: when `cardType === 'reward_card'`
   * AND the picked field is `'memberLevel'`, the slot must render as a
   * 2-line pair:
   *   label = `fieldPreview.memberLevel.stampLabel` (same as stamp_card —
   *         "獎勵" / "Reward")
   *   value = `firstRewardTierName` (the user's Step 6 `rewardTiers[0].name`
   *         input — first row only, per user-confirmed scope).
   *
   * Differs from the stamp_card override only in the data source:
   *   - stamp_card reads top-level `rewardName` (single string).
   *   - reward_card reads `firstRewardTierName` (first element of the
   *     multi-tier array — handled by the parent component, the body only
   *     receives the resolved string).
   *
   * All other cardTypes (incl. `multipass`) MUST keep the original
   * memberLevel label/value behavior. The override is INTENTIONALLY scoped
   * to `reward_card` only (user-confirmed scope: `stamp_card + reward_card`
   * share the label, but multipass is not a reward system).
   *
   * Empty / undefined `firstRewardTierName` renders as an empty string —
   * no fallback to the demo "金級" / "Gold" placeholder.
   */

  function buildTSpy() {
    // Variadic spy — captured calls include both the key (positional 0)
    // and the opts object (positional 1, when present).
    return vi.fn((...args: unknown[]) => args[0] as string);
  }

  function mockUseTranslationOnce(spy: ReturnType<typeof buildTSpy>) {
    vi.mocked(useTranslation).mockReturnValueOnce({ t: spy } as unknown as ReturnType<typeof useTranslation>);
  }

  it('reward_card + leftField="memberLevel" + firstRewardTierName="oijo" → label uses stampLabel key, value equals firstRewardTierName', () => {
    const tSpy = buildTSpy();
    mockUseTranslationOnce(tSpy);
    render(
      <PassCardPreviewBody
        leftField="memberLevel"
        cardType="reward_card"
        firstRewardTierName="oijo"
      />,
    );

    // Label must use the stamp-specific key (shared with stamp_card).
    expect(tSpy).toHaveBeenCalledWith('fieldPreview.memberLevel.stampLabel');
    // The original memberLevel.label key MUST NOT be called for the label
    // (the override is exclusive — only stampLabel, not both).
    const labelCalls = tSpy.mock.calls.filter(
      (call) => call[0] === 'fieldPreview.memberLevel.label',
    );
    expect(labelCalls).toHaveLength(0);

    // Value: firstRewardTierName is passed through verbatim (NOT routed through t()).
    expect(screen.getByText('oijo')).toBeInTheDocument();
  });

  it('reward_card + rightField="memberLevel" + firstRewardTierName="1000點折抵10%" → right slot renders the override', () => {
    const tSpy = buildTSpy();
    mockUseTranslationOnce(tSpy);
    render(
      <PassCardPreviewBody
        rightField="memberLevel"
        cardType="reward_card"
        firstRewardTierName="1000點折抵10%"
      />,
    );

    expect(tSpy).toHaveBeenCalledWith('fieldPreview.memberLevel.stampLabel');
    expect(screen.getByText('1000點折抵10%')).toBeInTheDocument();
  });

  it('reward_card + leftField="memberLevel" + firstRewardTierName="" → value renders as empty string (no demo fallback)', () => {
    const tSpy = buildTSpy();
    mockUseTranslationOnce(tSpy);
    render(
      <PassCardPreviewBody
        leftField="memberLevel"
        cardType="reward_card"
        firstRewardTierName=""
      />,
    );

    // Label still uses stampLabel.
    expect(tSpy).toHaveBeenCalledWith('fieldPreview.memberLevel.stampLabel');

    // Value: an empty string. We assert by NOT finding the demo fallback
    // "金級" / "Gold" text. The DOM should contain an empty <span> for
    // the value side.
    const allSpans = Array.from(document.querySelectorAll('span'));
    const emptyValueSpans = allSpans.filter((span) => span.textContent === '');
    expect(emptyValueSpans.length).toBeGreaterThanOrEqual(1);
    // And we must NOT find the demo "金級" / "Gold" value text.
    const demoValueCalls = tSpy.mock.calls.filter(
      (call) => call[0] === 'fieldPreview.memberLevel.value',
    );
    expect(demoValueCalls).toHaveLength(0);
  });

  it('reward_card + leftField="memberLevel" without firstRewardTierName → empty string fallback (no demo fallback)', () => {
    const tSpy = buildTSpy();
    mockUseTranslationOnce(tSpy);
    render(
      <PassCardPreviewBody
        leftField="memberLevel"
        cardType="reward_card"
      />,
    );

    // Label still uses stampLabel.
    expect(tSpy).toHaveBeenCalledWith('fieldPreview.memberLevel.stampLabel');

    // firstRewardTierName was not provided — falls back to '' (matches the
    // empty-input UX). The demo "金級" / "Gold" MUST NOT be surfaced.
    const demoValueCalls = tSpy.mock.calls.filter(
      (call) => call[0] === 'fieldPreview.memberLevel.value',
    );
    expect(demoValueCalls).toHaveLength(0);
  });

  it('non-{membership,discount} cardType (coupon_card) + leftField="memberLevel" + firstMembershipTierName="VIP" → default branch', () => {
    // 2026-09-13: the membership_card override is INTENTIONALLY scoped
    // to `membership_card` only. Non-membership card types keep the
    // default fieldPreview.memberLevel label/value pair even if
    // firstMembershipTierName is provided.
    //
    // 2026-09-18: discount_card got its own override too. To test the
    // default branch (no override), use `coupon_card` which is never
    // overridden.
    const tSpy = buildTSpy();
    mockUseTranslationOnce(tSpy);
    render(
      <PassCardPreviewBody
        leftField="memberLevel"
        cardType="coupon_card"
        firstMembershipTierName="VIP"
      />,
    );

    // Original label key MUST be called (default branch).
    expect(tSpy).toHaveBeenCalledWith('fieldPreview.memberLevel.label');
    // Original value key MUST be called (default branch — no override).
    expect(tSpy).toHaveBeenCalledWith('fieldPreview.memberLevel.value');
    // And firstMembershipTierName is NOT surfaced in the DOM (membership
    // override only fires for membership_card).
    expect(screen.queryByText('VIP')).toBeNull();
  });

  it('membership_card + leftField="memberLevel" + firstMembershipTierName="VIP Gold" → uses default memberLevel.label + first tier name (override restored 2026-09-13)', () => {
    // 2026-09-13 (current task): the membership_card override was
    // RESTORED. Membership cards now override the left/right memberLevel
    // slot with the FIRST tier's name (Step 6 `membershipTiers[0].name`).
    //   - label = `fieldPreview.memberLevel.label` (default "會員等級" /
    //     "Member Level") — NOT stampLabel (different from
    //     stamp/reward/cashback)
    //   - value = `firstMembershipTierName` (the FIRST tier name)
    const tSpy = buildTSpy();
    mockUseTranslationOnce(tSpy);
    render(
      <PassCardPreviewBody
        leftField="memberLevel"
        cardType="membership_card"
        firstMembershipTierName="VIP Gold"
      />,
    );

    // Default label MUST be called (NOT stampLabel — membership override
    // uses default label, not the stampLabel used by stamp/reward/cashback).
    expect(tSpy).toHaveBeenCalledWith('fieldPreview.memberLevel.label');
    // Demo value MUST NOT be called (override renders firstMembershipTierName,
    // not the demo "金級" / "Gold" string).
    const demoValueCalls = tSpy.mock.calls.filter(
      (call) => call[0] === 'fieldPreview.memberLevel.value',
    );
    expect(demoValueCalls).toHaveLength(0);
    // stampLabel MUST NOT be called (membership override uses default label).
    const stampLabelCalls = tSpy.mock.calls.filter(
      (call) => call[0] === 'fieldPreview.memberLevel.stampLabel',
    );
    expect(stampLabelCalls).toHaveLength(0);
    // The override value MUST be rendered in the DOM.
    expect(screen.getByText('VIP Gold')).toBeInTheDocument();
  });

  it('membership_card + leftField="memberLevel" + firstMembershipTierName="" → empty string fallback (no demo fallback)', () => {
    // Per user-confirmed UX, an empty firstMembershipTierName renders as
    // an empty string rather than to the demo "金級" / "Gold" string.
    const tSpy = buildTSpy();
    mockUseTranslationOnce(tSpy);
    render(
      <PassCardPreviewBody
        leftField="memberLevel"
        cardType="membership_card"
        firstMembershipTierName=""
      />,
    );

    // Label uses default memberLevel.label (NOT stampLabel).
    expect(tSpy).toHaveBeenCalledWith('fieldPreview.memberLevel.label');

    // firstMembershipTierName was empty → falls back to '' (no demo
    // "金級" / "Gold" surfaced).
    const demoValueCalls = tSpy.mock.calls.filter(
      (call) => call[0] === 'fieldPreview.memberLevel.value',
    );
    expect(demoValueCalls).toHaveLength(0);
  });

  it('membership_card + leftField="memberLevel" without firstMembershipTierName → empty string fallback', () => {
    // When firstMembershipTierName is omitted entirely (e.g. caller didn't
    // pass it), the override branch falls through to '' (no demo fallback).
    const tSpy = buildTSpy();
    mockUseTranslationOnce(tSpy);
    render(
      <PassCardPreviewBody
        leftField="memberLevel"
        cardType="membership_card"
      />,
    );

    // Label uses default memberLevel.label.
    expect(tSpy).toHaveBeenCalledWith('fieldPreview.memberLevel.label');
    // Demo value MUST NOT be called.
    const demoValueCalls = tSpy.mock.calls.filter(
      (call) => call[0] === 'fieldPreview.memberLevel.value',
    );
    expect(demoValueCalls).toHaveLength(0);
  });

  it('multipass + leftField="memberLevel" + firstRewardTierName="oijo" → multipass override fires (NOT reward_card override; stampLabel MUST NOT be called; firstRewardTierName is IGNORED)', () => {
    // 2026-09-20 review: the OLD assertion ("scope = reward_card ONLY")
    // is no longer correct — multipass has its own override on the
    // common `memberLevel` key (mirrors `membership_card` pattern).
    // The multipass override reads its value from `firstMultipassTierName`
    // — NOT from `firstRewardTierName` (which is reward_card's source).
    // `firstRewardTierName` is therefore IGNORED for multipass cards.
    const tSpy = buildTSpy();
    mockUseTranslationOnce(tSpy);
    render(
      <PassCardPreviewBody
        leftField="memberLevel"
        cardType="multipass"
        firstRewardTierName="oijo"
      />,
    );

    expect(tSpy).toHaveBeenCalledWith('fieldPreview.memberLevel.label');
    // stampLabel MUST NOT be called — multipass is a tier-identity card.
    const stampLabelCalls = tSpy.mock.calls.filter(
      (call) => call[0] === 'fieldPreview.memberLevel.stampLabel',
    );
    expect(stampLabelCalls).toHaveLength(0);
    // The reward_card data source `firstRewardTierName` is IGNORED —
    // multipass reads from `firstMultipassTierName` instead.
    expect(screen.queryByText('oijo')).toBeNull();
  });

  it('reward_card + leftField="phone" + firstRewardTierName="oijo" → phone field is NOT overridden (override is memberLevel-specific)', () => {
    // The override only applies to memberLevel — other common fields keep
    // their canonical fieldPreview.{key}.label + .value rendering.
    const tSpy = buildTSpy();
    mockUseTranslationOnce(tSpy);
    render(
      <PassCardPreviewBody
        leftField="phone"
        cardType="reward_card"
        firstRewardTierName="oijo"
      />,
    );

    expect(tSpy).toHaveBeenCalledWith('fieldPreview.phone.label');
    expect(tSpy).toHaveBeenCalledWith('fieldPreview.phone.value');
    // stampLabel MUST NOT be called for non-memberLevel fields.
    const stampLabelCalls = tSpy.mock.calls.filter(
      (call) => call[0] === 'fieldPreview.memberLevel.stampLabel',
    );
    expect(stampLabelCalls).toHaveLength(0);
    // firstRewardTierName is NOT surfaced for phone.
    expect(screen.queryByText('oijo')).toBeNull();
  });

  it('stamp_card + firstRewardTierName is IGNORED (only reward_card reads it)', () => {
    // The stamp_card override uses `rewardName` (top-level string), not
    // `firstRewardTierName`. Verify firstRewardTierName is NOT surfaced
    // for stamp_card — this pins the contract that each card type has a
    // distinct value source.
    const tSpy = buildTSpy();
    mockUseTranslationOnce(tSpy);
    render(
      <PassCardPreviewBody
        leftField="memberLevel"
        cardType="stamp_card"
        rewardName="10元折價"
        firstRewardTierName="WRONG_VALUE_SHOULD_NOT_SHOW"
      />,
    );

    // Stamp_card reads rewardName, not firstRewardTierName.
    expect(screen.getByText('10元折價')).toBeInTheDocument();
    expect(screen.queryByText('WRONG_VALUE_SHOULD_NOT_SHOW')).toBeNull();
  });
});

describe('PassCardPreviewBody — cashback_card member-level → reward override (2026-09-12)', () => {
  /**
   * 2026-09-12 cashback card member-level → reward refactor.
   *
   * When `cardType === 'cashback_card'` AND the picked field is
   * `'memberLevel'`, the slot must render as a 2-line pair:
   *   label = `fieldPreview.memberLevel.stampLabel` ("獎勵" / "Reward")
   *   value = `firstCashbackTierName` (the user's Step 6
   *           `cashbackTiers[0].name` input — first row only).
   *
   * Mirrors the stamp_card / reward_card override pattern but uses
   * `firstCashbackTierName` as the value source.
   * Empty / undefined `firstCashbackTierName` renders as an empty string.
   *
   * Key contract: the override is scoped EXCLUSIVELY to `cashback_card`.
   * Non-cashback card types with `firstCashbackTierName` provided must NOT
   * surface that value (each card type has its own value source).
   */

  function buildTSpy() {
    return vi.fn((...args: unknown[]) => args[0] as string);
  }

  function mockUseTranslationOnce(spy: ReturnType<typeof buildTSpy>) {
    vi.mocked(useTranslation).mockReturnValueOnce({ t: spy } as unknown as ReturnType<typeof useTranslation>);
  }

  it('cashback_card + leftField="memberLevel" + firstCashbackTierName="VIP Gold" → label uses stampLabel, value equals firstCashbackTierName', () => {
    const tSpy = buildTSpy();
    mockUseTranslationOnce(tSpy);
    render(
      <PassCardPreviewBody
        leftField="memberLevel"
        cardType="cashback_card"
        firstCashbackTierName="VIP Gold"
      />,
    );

    // Label uses stampLabel key (shared with stamp_card / reward_card).
    expect(tSpy).toHaveBeenCalledWith('fieldPreview.memberLevel.stampLabel');
    // Original memberLevel.label key MUST NOT be called.
    expect(tSpy).not.toHaveBeenCalledWith('fieldPreview.memberLevel.label');
    // Value: firstCashbackTierName passed through verbatim.
    expect(screen.getByText('VIP Gold')).toBeInTheDocument();
  });

  it('cashback_card + rightField="memberLevel" + firstCashbackTierName="R100 Cashback" → right slot renders override', () => {
    const tSpy = buildTSpy();
    mockUseTranslationOnce(tSpy);
    render(
      <PassCardPreviewBody
        rightField="memberLevel"
        cardType="cashback_card"
        firstCashbackTierName="R100 Cashback"
      />,
    );

    expect(tSpy).toHaveBeenCalledWith('fieldPreview.memberLevel.stampLabel');
    expect(screen.getByText('R100 Cashback')).toBeInTheDocument();
  });

  it('cashback_card + leftField="memberLevel" + firstCashbackTierName="" → value renders as empty string (no demo fallback)', () => {
    const tSpy = buildTSpy();
    mockUseTranslationOnce(tSpy);
    render(
      <PassCardPreviewBody
        leftField="memberLevel"
        cardType="cashback_card"
        firstCashbackTierName=""
      />,
    );

    expect(tSpy).toHaveBeenCalledWith('fieldPreview.memberLevel.stampLabel');
    // Empty string: DOM has an empty <span> for the value side.
    const allSpans = Array.from(document.querySelectorAll('span'));
    const emptyValueSpans = allSpans.filter((span) => span.textContent === '');
    expect(emptyValueSpans.length).toBeGreaterThanOrEqual(1);
    // Demo "金級" / "Gold" value key MUST NOT be called.
    expect(tSpy).not.toHaveBeenCalledWith('fieldPreview.memberLevel.value');
  });

  it('cashback_card + leftField="memberLevel" without firstCashbackTierName → empty string fallback', () => {
    const tSpy = buildTSpy();
    mockUseTranslationOnce(tSpy);
    render(
      <PassCardPreviewBody
        leftField="memberLevel"
        cardType="cashback_card"
      />,
    );

    expect(tSpy).toHaveBeenCalledWith('fieldPreview.memberLevel.stampLabel');
    expect(tSpy).not.toHaveBeenCalledWith('fieldPreview.memberLevel.value');
  });

  it('non-cashback cardType + firstCashbackTierName="WRONG" → original memberLevel.label / .value, firstCashbackTierName NOT surfaced', () => {
    // stamp_card / reward_card / multipass must NOT use the cashback value source.
    const tSpy = buildTSpy();
    mockUseTranslationOnce(tSpy);
    render(
      <PassCardPreviewBody
        leftField="memberLevel"
        cardType="stamp_card"
        firstCashbackTierName="WRONG_VALUE_SHOULD_NOT_SHOW"
      />,
    );

    // stamp_card uses rewardName (not firstCashbackTierName).
    expect(tSpy).toHaveBeenCalledWith('fieldPreview.memberLevel.stampLabel');
    expect(screen.queryByText('WRONG_VALUE_SHOULD_NOT_SHOW')).toBeNull();
  });

  it('cashback_card + firstRewardTierName is IGNORED (only reward_card reads it)', () => {
    // Each card type has its own value source. cashback_card reads
    // firstCashbackTierName, NOT firstRewardTierName.
    const tSpy = buildTSpy();
    mockUseTranslationOnce(tSpy);
    render(
      <PassCardPreviewBody
        leftField="memberLevel"
        cardType="cashback_card"
        firstRewardTierName="WRONG_REWARD_VALUE"
        firstCashbackTierName="CORRECT_CASHBACK_VALUE"
      />,
    );

    expect(screen.getByText('CORRECT_CASHBACK_VALUE')).toBeInTheDocument();
    expect(screen.queryByText('WRONG_REWARD_VALUE')).toBeNull();
  });
});

describe('PassCardPreviewBody — cashback-only display fields (2026-09-12, refined 2026-09-13)', () => {
  /**
   * Cashback card adds two new display fields accessible in Step 3:
   *   - pointsToNextTierCashback  — 到下個層級還差 / Amount to Next Tier
   *   - accumulatedSpendCashback  — 已累積消費 / Accumulated Spending
   *
   * Note (2026-09-12 copy fix): cashback is spend-based, NOT point-based,
   * so the English label drops "Points" → "Amount to Next Tier". The
   * reward_card equivalent (`pointsToNextTier`) still uses "Points to
   * Next Tier" because reward tiers ARE point-based.
   *
   * 2026-09-13 ZAR pollution fix — currency-driven values:
   *   The cashback amount values are NOT stored in i18n (label-only there).
   *   They are sourced from `CASHBACK_PREVIEW_AMOUNTS[currency]` — same
   *   currency-driven map pattern as `BALANCE_PREVIEW_AMOUNTS` for the
   *   balance preview block.
   *
   *   TWD → "562元" / "3301元" (Han suffix, en-locale-unsafe)
   *   ZAR → "R562" / "R3301" (no Han, locale en-ZA convention)
   *
   *   The body component NEVER routes cashback values through t() —
   *   they're rendered as raw strings from the constant.
   */

  it('pointsToNextTierCashback renders its label via i18n + value via CASHBACK_PREVIEW_AMOUNTS (TWD)', () => {
    // The mocked t() returns the i18n key as text, so the label DOM
    // shows `fieldPreview.pointsToNextTierCashback.label`. The value,
    // however, comes from the currency-driven constant — NOT t() —
    // so the value DOM shows the literal string "562元" (TWD) or
    // "R562" (ZAR). The mock t() cannot intercept the constant lookup.
    const { unmount } = render(
      <PassCardPreviewBody leftField="pointsToNextTierCashback" />,
    );
    expect(screen.getByText('fieldPreview.pointsToNextTierCashback.label')).toBeInTheDocument();
    expect(screen.getByText('562元')).toBeInTheDocument();
    unmount();
  });

  it('accumulatedSpendCashback renders its label via i18n + value via CASHBACK_PREVIEW_AMOUNTS (TWD)', () => {
    const { unmount } = render(
      <PassCardPreviewBody rightField="accumulatedSpendCashback" />,
    );
    expect(screen.getByText('fieldPreview.accumulatedSpendCashback.label')).toBeInTheDocument();
    expect(screen.getByText('3301元')).toBeInTheDocument();
    unmount();
  });

  it('ZAR currency: cashback values read from CASHBACK_PREVIEW_AMOUNTS.ZAR', () => {
    useCardBuilderStore.setState({ currency: 'ZAR' });

    const { unmount } = render(
      <PassCardPreviewBody
        leftField="pointsToNextTierCashback"
        rightField="accumulatedSpendCashback"
      />,
    );
    expect(screen.getByText('R562')).toBeInTheDocument();
    expect(screen.getByText('R3301')).toBeInTheDocument();
    unmount();
  });

  it('TWD currency: cashback values read from CASHBACK_PREVIEW_AMOUNTS.TWD (Han suffix)', () => {
    // Sanity check: TWD keeps the original "562元" format. This is the
    // regression for the regex-based formatter that previously contaminated
    // cashback values into "R562".
    // Note: a previous test may have flipped the store to ZAR via
    // setState, so we explicitly reset to TWD here to keep the test
    // self-contained.
    useCardBuilderStore.setState({ currency: 'TWD' });

    const { unmount } = render(
      <PassCardPreviewBody
        leftField="pointsToNextTierCashback"
        rightField="accumulatedSpendCashback"
      />,
    );
    expect(screen.getByText('562元')).toBeInTheDocument();
    expect(screen.getByText('3301元')).toBeInTheDocument();
    // The mock t() returns i18n keys verbatim, so we should NOT see the
    // bare value key `fieldPreview.pointsToNextTierCashback.value` rendered
    // (since the body now bypasses t() for cashback amount values).
    expect(
      screen.queryByText('fieldPreview.pointsToNextTierCashback.value'),
    ).toBeNull();
    expect(
      screen.queryByText('fieldPreview.accumulatedSpendCashback.value'),
    ).toBeNull();
    unmount();
  });
});

describe('PassCardPreviewBody — ZAR pollution regression (2026-09-13)', () => {
  /**
   * 2026-09-13 ZAR pollution fix: when the user selects ZAR as the card
   * currency, NON-AMOUNT preview fields must NOT receive any ZAR prefix
   * transformation. The previous regex-based formatter
   * (`/\d+/` → prepend "R") contaminated every i18n-sourced value on
   * every card type, e.g.:
   *
   *   phone        `+8869XXXXXXXX`     → `R8869XXXXXXXX` ❌
   *   phone (en)   `+279XXXXXXXXX`    → `R279XXXXXXXXX` ❌
   *   birthday     `05/11/1999`        → `R05111999` ❌
   *   visitCount   `5 次`              → `R5` ❌
   *   totalStamps  `3/{{rows}}`        → `R3` ❌
   *   stampsRemain `6個`               → `R6` ❌
   *   pointsToNext `123點`             → `R123` ❌
   *   currentPoints `23點`             → `R23` ❌
   *
   * This describe block pins the fix: only the two cashback amount fields
   * (`pointsToNextTierCashback` + `accumulatedSpendCashback`) are
   * currency-driven. Everything else renders verbatim from i18n.
   *
   * Note: the mock t() returns i18n keys as strings (e.g.
   * `fieldPreview.phone.value`). With the regex formatter gone, the body
   * now passes the raw i18n key through to the DOM, so the rendered value
   * span text is exactly the i18n key string. We assert:
   *   - value DOM contains the literal i18n key (NOT a ZAR-prefixed variant)
   *   - value DOM does NOT contain "R" followed by digits
   */

  it('ZAR + phone field: value renders as raw i18n key, NOT "R8869XXXXXXXX" (regression 2026-09-13)', () => {
    useCardBuilderStore.setState({ currency: 'ZAR' });

    const { unmount } = render(<PassCardPreviewBody leftField="phone" />);
    // Mock t() returns key verbatim. Old behavior: "R8869XXXXXXXX" (regex
    // extracted digits + prepended R). New behavior: the raw i18n key.
    expect(screen.getByText('fieldPreview.phone.value')).toBeInTheDocument();
    expect(screen.queryByText(/^R\d/)).toBeNull();
    unmount();
  });

  it('ZAR + birthday field: value renders as raw i18n key, NOT "R0511..." (regression)', () => {
    useCardBuilderStore.setState({ currency: 'ZAR' });

    const { unmount } = render(<PassCardPreviewBody leftField="birthday" />);
    expect(screen.getByText('fieldPreview.birthday.value')).toBeInTheDocument();
    expect(screen.queryByText(/^R\d/)).toBeNull();
    unmount();
  });

  it('ZAR + visitCount field: value renders as raw i18n key, NOT "R5" (regression)', () => {
    useCardBuilderStore.setState({ currency: 'ZAR' });

    const { unmount } = render(<PassCardPreviewBody leftField="visitCount" />);
    expect(screen.getByText('fieldPreview.visitCount.value')).toBeInTheDocument();
    expect(screen.queryByText(/^R\d/)).toBeNull();
    unmount();
  });

  it('ZAR + totalStamps field: i18n interpolation still works (not "R3") (regression)', () => {
    useCardBuilderStore.setState({ currency: 'ZAR' });

    const tSpy = vi.fn((...args: unknown[]) => args[0] as string);
    vi.mocked(useTranslation).mockReturnValueOnce({ t: tSpy } as unknown as ReturnType<typeof useTranslation>);
    render(<PassCardPreviewBody leftField="totalStamps" stampGridRows={2} />);

    // The body must call t() with the interpolation opts `{ rows: 10 }`
    // (2 rows × 5 stamps/row = 10). Previously the regex formatter
    // short-circuited this — but with it gone, the i18n call is preserved.
    const valueCalls = tSpy.mock.calls.filter((call) => call[1] !== undefined);
    expect(valueCalls).toHaveLength(1);
    expect(valueCalls[0]?.[0]).toBe('fieldPreview.totalStamps.value');
    expect(valueCalls[0]?.[1]).toEqual({ rows: 10 });
  });

  it('ZAR + pointsToNextTier field (reward card): value renders as raw i18n key, NOT "R123" (regression)', () => {
    useCardBuilderStore.setState({ currency: 'ZAR' });

    const { unmount } = render(<PassCardPreviewBody leftField="pointsToNextTier" />);
    expect(screen.getByText('fieldPreview.pointsToNextTier.value')).toBeInTheDocument();
    expect(screen.queryByText(/^R\d/)).toBeNull();
    unmount();
  });

  it('ZAR + stampsRemaining field: value renders as raw i18n key, NOT "R6" (regression)', () => {
    useCardBuilderStore.setState({ currency: 'ZAR' });

    const { unmount } = render(<PassCardPreviewBody leftField="stampsRemaining" />);
    expect(screen.getByText('fieldPreview.stampsRemaining.value')).toBeInTheDocument();
    expect(screen.queryByText(/^R\d/)).toBeNull();
    unmount();
  });

  it('TWD + phone field: value renders as raw i18n key (no transformation, sanity baseline)', () => {
    // Sanity baseline: even under TWD (no formatter ever applied),
    // the value is the raw i18n key. This pins that the TWD path is
    // unchanged.
    const { unmount } = render(<PassCardPreviewBody leftField="phone" />);
    expect(screen.getByText('fieldPreview.phone.value')).toBeInTheDocument();
    expect(screen.queryByText(/^R\d/)).toBeNull();
    unmount();
  });
});

// Pull in useTranslation so the tests above can `vi.mocked` it.
import { useTranslation } from 'react-i18next';
import { useCardBuilderStore } from '../CardBuilderEditor.store';
// PassCardPreviewBody reads `s.currency` from the store to drive ZAR formatting.
// Tests that need ZAR call `vi.mocked(useCardBuilderStore).setState({ currency: 'ZAR' })`
// before rendering; TWD is the default (isZAR === false).
//
// Implementation note: the factory body must NOT reference the mocked
// `useCardBuilderStore` itself — that creates a self-reference where the
// mock function (which has no `.getState()`) shadows the real Zustand
// store. Instead, capture the real store via `vi.importActual` and delegate
// `selector(state)` plus expose `setState` / `getState` so the test calls
// (`useCardBuilderStore.setState({...})`) keep working.
vi.mock('../CardBuilderEditor.store', async () => {
  const actual = await vi.importActual<typeof import('../CardBuilderEditor.store')>('../CardBuilderEditor.store');
  // The mock must satisfy two contracts:
  //   1. Zustand hook signature: `useCardBuilderStore(selector)` → selection result
  //   2. Zustand mutator API: `useCardBuilderStore.setState(partial)` / `getState()`
  //      (tests use these to flip currency between renders)
  // We type the result as a callable Mock augmented with the mutator fields,
  // so both Vitest's `Mock` typing and TypeScript's structural checks are satisfied.
  type StoreMock = typeof actual.useCardBuilderStore & {
    (selector: (state: unknown) => unknown): unknown;
  };
  const mocked = vi.fn((selector: (state: unknown) => unknown) => {
    if (typeof selector !== 'function') return undefined;
    return selector(actual.useCardBuilderStore.getState());
  }) as unknown as StoreMock;
  // Expose real store mutators so test code can call
  // `useCardBuilderStore.setState({...})` between renders.
  (mocked as { setState: typeof actual.useCardBuilderStore.setState }).setState =
    actual.useCardBuilderStore.setState;
  (mocked as { getState: typeof actual.useCardBuilderStore.getState }).getState =
    actual.useCardBuilderStore.getState;
  return { useCardBuilderStore: mocked };
});

// ── 2026-09-18 discount card: memberLevel override + currency-driven amount fields ──

describe('PassCardPreviewBody — discount_card member-level → first-tier-name override (2026-09-18)', () => {
  /**
   * 2026-09-18 discount card Step 3 / preview extension.
   *
   * When `cardType === 'discount_card'` AND the picked field is
   * `'memberLevel'`, the slot must render as a 2-line pair:
   *   label = `fieldPreview.memberLevel.discountLabel` ("折扣等級" /
   *         "Discount Tier") — distinct i18n key from stampLabel
   *   value = `firstDiscountTierName` (the user's Step 6
   *           `discountTiers[0].name` input — first row only).
   *
   * Mirrors the cashback_card override pattern (2026-09-12) but uses a
   * distinct label key (`discountLabel` instead of `stampLabel`) because
   * the discount semantic is "tier identity", not "reward earned".
   *
   * Empty / undefined `firstDiscountTierName` renders as an empty string.
   *
   * Key contract: the override is scoped EXCLUSIVELY to `discount_card`.
   * Non-discount card types with `firstDiscountTierName` provided must
   * NOT surface that value (each card type has its own value source).
   */

  function buildTSpy() {
    return vi.fn((...args: unknown[]) => args[0] as string);
  }

  function mockUseTranslationOnce(spy: ReturnType<typeof buildTSpy>) {
    vi.mocked(useTranslation).mockReturnValueOnce({ t: spy } as unknown as ReturnType<typeof useTranslation>);
  }

  it('discount_card + leftField="memberLevel" + firstDiscountTierName="金級" → label uses discountLabel, value equals tier name', () => {
    const tSpy = buildTSpy();
    mockUseTranslationOnce(tSpy);
    render(
      <PassCardPreviewBody
        leftField="memberLevel"
        cardType="discount_card"
        firstDiscountTierName="金級"
      />,
    );

    // Label uses discountLabel key (distinct from stampLabel).
    expect(tSpy).toHaveBeenCalledWith('fieldPreview.memberLevel.discountLabel');
    // stampLabel MUST NOT be called (different semantic — discount uses
    // "Discount Tier", not "Reward").
    expect(tSpy).not.toHaveBeenCalledWith('fieldPreview.memberLevel.stampLabel');
    // Original memberLevel.label key MUST NOT be called.
    expect(tSpy).not.toHaveBeenCalledWith('fieldPreview.memberLevel.label');
    // Value: firstDiscountTierName passed through verbatim.
    expect(screen.getByText('金級')).toBeInTheDocument();
  });

  it('discount_card + rightField="memberLevel" + firstDiscountTierName="VIP Discount" → right slot renders override', () => {
    const tSpy = buildTSpy();
    mockUseTranslationOnce(tSpy);
    render(
      <PassCardPreviewBody
        rightField="memberLevel"
        cardType="discount_card"
        firstDiscountTierName="VIP Discount"
      />,
    );

    expect(tSpy).toHaveBeenCalledWith('fieldPreview.memberLevel.discountLabel');
    expect(screen.getByText('VIP Discount')).toBeInTheDocument();
  });

  it('discount_card + leftField="memberLevel" + firstDiscountTierName="" → value renders as empty string (no demo fallback)', () => {
    const tSpy = buildTSpy();
    mockUseTranslationOnce(tSpy);
    render(
      <PassCardPreviewBody
        leftField="memberLevel"
        cardType="discount_card"
        firstDiscountTierName=""
      />,
    );

    expect(tSpy).toHaveBeenCalledWith('fieldPreview.memberLevel.discountLabel');
    // Empty string: DOM has an empty <span> for the value side.
    const allSpans = Array.from(document.querySelectorAll('span'));
    const emptyValueSpans = allSpans.filter((span) => span.textContent === '');
    expect(emptyValueSpans.length).toBeGreaterThanOrEqual(1);
    // Demo "金級" / "Gold" value key MUST NOT be called.
    expect(tSpy).not.toHaveBeenCalledWith('fieldPreview.memberLevel.value');
  });

  it('discount_card + leftField="memberLevel" without firstDiscountTierName → empty string fallback', () => {
    const tSpy = buildTSpy();
    mockUseTranslationOnce(tSpy);
    render(
      <PassCardPreviewBody
        leftField="memberLevel"
        cardType="discount_card"
      />,
    );

    expect(tSpy).toHaveBeenCalledWith('fieldPreview.memberLevel.discountLabel');
    expect(tSpy).not.toHaveBeenCalledWith('fieldPreview.memberLevel.value');
  });

  it('non-discount cardType + firstDiscountTierName="WRONG" → original memberLevel.label / .value, firstDiscountTierName NOT surfaced', () => {
    // stamp_card / reward_card / cashback_card / multipass / membership_card
    // must NOT use the discount value source. Each card type has its own.
    const tSpy = buildTSpy();
    mockUseTranslationOnce(tSpy);
    render(
      <PassCardPreviewBody
        leftField="memberLevel"
        cardType="stamp_card"
        firstDiscountTierName="WRONG_VALUE_SHOULD_NOT_SHOW"
      />,
    );

    // stamp_card uses rewardName (not firstDiscountTierName).
    expect(tSpy).toHaveBeenCalledWith('fieldPreview.memberLevel.stampLabel');
    expect(screen.queryByText('WRONG_VALUE_SHOULD_NOT_SHOW')).toBeNull();
  });

  it('discount_card + firstRewardTierName is IGNORED (each card type has distinct value source)', () => {
    // discount_card reads firstDiscountTierName, NOT firstRewardTierName.
    const tSpy = buildTSpy();
    mockUseTranslationOnce(tSpy);
    render(
      <PassCardPreviewBody
        leftField="memberLevel"
        cardType="discount_card"
        firstRewardTierName="WRONG_REWARD_VALUE"
        firstDiscountTierName="CORRECT_DISCOUNT_VALUE"
      />,
    );

    expect(screen.getByText('CORRECT_DISCOUNT_VALUE')).toBeInTheDocument();
    expect(screen.queryByText('WRONG_REWARD_VALUE')).toBeNull();
  });

  it('discount_card + leftField="phone" + firstDiscountTierName="金級" → phone field is NOT overridden (override is memberLevel-specific)', () => {
    // The override only applies to memberLevel — other common fields keep
    // their canonical fieldPreview.{key}.label + .value rendering.
    const tSpy = buildTSpy();
    mockUseTranslationOnce(tSpy);
    render(
      <PassCardPreviewBody
        leftField="phone"
        cardType="discount_card"
        firstDiscountTierName="金級"
      />,
    );

    expect(tSpy).toHaveBeenCalledWith('fieldPreview.phone.label');
    expect(tSpy).toHaveBeenCalledWith('fieldPreview.phone.value');
    // discountLabel MUST NOT be called for non-memberLevel fields.
    expect(tSpy).not.toHaveBeenCalledWith('fieldPreview.memberLevel.discountLabel');
    // firstDiscountTierName is NOT surfaced for phone.
    expect(screen.queryByText('金級')).toBeNull();
  });
});

describe('PassCardPreviewBody — multipass + memberLevel → first-tier-name override (2026-09-20)', () => {
  /**
   * 2026-09-20 multipass card 會員等級 slot — mirrors the `membership_card`
   * override pattern, REUSING the existing common `memberLevel` key.
   *
   * When `cardType === 'multipass'` AND the picked field is
   * `'memberLevel'` (the common key — `memberLevel` is in CARD_FIELD_KEYS
   * with `hideOnCardTypes: ['coupon_card']` only, so multipass sees it in
   * the dropdown), the slot must render as a 2-line pair:
   *   label = `fieldPreview.memberLevel.label` ("會員等級" /
   *         "Member Level") — default memberLevel label, NOT stampLabel
   *         (mirrors membership_card semantic: tier identity, not reward).
   *   value = `firstMultipassTierName` (the user's Step 6
   *           `multipassTiers[0].name` input — first row only).
   *
   * Empty / undefined `firstMultipassTierName` renders as an empty string.
   *
   * Key contract: the override is scoped EXCLUSIVELY to
   *   (cardType === 'multipass' && field === 'memberLevel').
   * Non-multipass card types with `firstMultipassTierName` provided must
   * NOT surface that value.
   *
   * Note: the original 2026-09-20 implementation used a dedicated
   * `multipassMemberLevel` CardFieldKey + a `fieldPreview.multipassMemberLevel`
   * translation. After 2026-09-20 review, the dedicated key was removed
   * (see `PassCardPreviewBody` resolveSlot branch-order docblock); the
   * common `memberLevel` slot is now the single source of truth for both
   * the default behaviour and all card-type-specific overrides
   * (stamp/reward/cashback/membership/multipass/discount).
   */

  function buildTSpy() {
    return vi.fn((...args: unknown[]) => args[0] as string);
  }

  function mockUseTranslationOnce(spy: ReturnType<typeof buildTSpy>) {
    vi.mocked(useTranslation).mockReturnValueOnce({ t: spy } as unknown as ReturnType<typeof useTranslation>);
  }

  it('multipass + leftField="memberLevel" + firstMultipassTierName="金卡" → label uses default memberLevel.label, value equals tier name', () => {
    const tSpy = buildTSpy();
    mockUseTranslationOnce(tSpy);
    render(
      <PassCardPreviewBody
        leftField="memberLevel"
        cardType="multipass"
        firstMultipassTierName="金卡"
      />,
    );

    // Label uses the default memberLevel.label key (NOT stampLabel —
    // multipass is a tier-identity card, not a reward card).
    expect(tSpy).toHaveBeenCalledWith('fieldPreview.memberLevel.label');
    // stampLabel MUST NOT be called (multipass uses default memberLevel label,
    // not "Reward" / "獎勵" semantic).
    expect(tSpy).not.toHaveBeenCalledWith('fieldPreview.memberLevel.stampLabel');
    // The default memberLevel.value is NOT called for the value slot
    // (the override sources the value from firstMultipassTierName, not i18n).
    expect(tSpy).not.toHaveBeenCalledWith('fieldPreview.memberLevel.value');
    // Value: firstMultipassTierName passed through verbatim.
    expect(screen.getByText('金卡')).toBeInTheDocument();
  });

  it('multipass + rightField="memberLevel" + firstMultipassTierName="VIP Discount" → right slot renders override', () => {
    const tSpy = buildTSpy();
    mockUseTranslationOnce(tSpy);
    render(
      <PassCardPreviewBody
        rightField="memberLevel"
        cardType="multipass"
        firstMultipassTierName="VIP Discount"
      />,
    );

    expect(tSpy).toHaveBeenCalledWith('fieldPreview.memberLevel.label');
    expect(screen.getByText('VIP Discount')).toBeInTheDocument();
  });

  it('multipass + leftField="memberLevel" + firstMultipassTierName="" → value renders as empty string (no demo fallback)', () => {
    const tSpy = buildTSpy();
    mockUseTranslationOnce(tSpy);
    render(
      <PassCardPreviewBody
        leftField="memberLevel"
        cardType="multipass"
        firstMultipassTierName=""
      />,
    );

    expect(tSpy).toHaveBeenCalledWith('fieldPreview.memberLevel.label');
    // Empty string: DOM does not contain "金級" / "Gold" demo placeholder.
    expect(screen.queryByText('金級')).toBeNull();
    expect(screen.queryByText('Gold')).toBeNull();
  });

  it('multipass + leftField="memberLevel" + firstMultipassTierName=undefined → empty string', () => {
    // Edge case: firstMultipassTierName is undefined (e.g. multipassTiers is empty).
    const tSpy = buildTSpy();
    mockUseTranslationOnce(tSpy);
    render(
      <PassCardPreviewBody
        leftField="memberLevel"
        cardType="multipass"
      />,
    );

    expect(tSpy).toHaveBeenCalledWith('fieldPreview.memberLevel.label');
    // No tier name surfaced.
    expect(screen.queryByText('金級')).toBeNull();
  });

  it('multipass + leftField="phone" + firstMultipassTierName="金卡" → phone field is NOT overridden (override is memberLevel-specific on multipass)', () => {
    // The override only applies to (cardType='multipass' && field='memberLevel')
    // — other fields keep their canonical fieldPreview.{key}.label + .value
    // rendering. The firstMultipassTierName prop is NOT surfaced for phone.
    const tSpy = buildTSpy();
    mockUseTranslationOnce(tSpy);
    render(
      <PassCardPreviewBody
        leftField="phone"
        cardType="multipass"
        firstMultipassTierName="金卡"
      />,
    );

    // memberLevel.label MUST NOT be called when the picked field is phone.
    expect(tSpy).not.toHaveBeenCalledWith('fieldPreview.memberLevel.label');
    // firstMultipassTierName is NOT surfaced for phone.
    expect(screen.queryByText('金卡')).toBeNull();
  });

  it('membership_card + leftField="memberLevel" + firstMembershipTierName="金卡" → uses membership_card override, NOT multipass override', () => {
    // Membership card uses firstMembershipTierName (its own data source) via
    // the membership_card override branch (mirror pattern), NOT firstMultipassTierName.
    // This test ensures the multipass override does NOT leak into
    // membership_card context.
    //
    // Implementation note: the body calls `fieldPreview.memberLevel.label`
    // for BOTH overrides (membership + multipass share the same label key —
    // that's the whole point of reusing the common key). The discriminator
    // is the value source: membership_card → firstMembershipTierName,
    // multipass → firstMultipassTierName. To verify the membership branch
    // ran (and NOT the multipass branch), we assert the multipass value is
    // NOT surfaced in the DOM.
    const tSpy = buildTSpy();
    mockUseTranslationOnce(tSpy);
    render(
      <PassCardPreviewBody
        leftField="memberLevel"
        cardType="membership_card"
        firstMultipassTierName="should-not-show"
        firstMembershipTierName="金卡"
      />,
    );

    expect(tSpy).toHaveBeenCalledWith('fieldPreview.memberLevel.label');
    // The multipass tier name MUST NOT be rendered in the DOM — the
    // multipass override branch only fires for `cardType === 'multipass'`,
    // so `firstMultipassTierName` is ignored here. The membership branch
    // surfaces `firstMembershipTierName="金卡"`.
    expect(screen.queryByText('should-not-show')).toBeNull();
  });

  it('multipass + leftField="memberLevel" + firstMultipassTierName provided → label rendered with default memberLevel copy', () => {
    // Sanity check: the multipass override reuses the default memberLevel
    // label string ("會員等級" / "Member Level") — NOT "獎勵" / "Reward"
    // (which is stampLabel for stamp/reward/cashback cards).
    // This pins the label semantic for future regression: switching to
    // stampLabel here would be a copy-paste bug.
    const tSpy = buildTSpy();
    mockUseTranslationOnce(tSpy);
    render(
      <PassCardPreviewBody
        leftField="memberLevel"
        cardType="multipass"
        firstMultipassTierName="金卡"
      />,
    );

    // The default memberLevel.label key is called for the label.
    expect(tSpy).toHaveBeenCalledWith('fieldPreview.memberLevel.label');
    // The stamp/reward/cashback label MUST NOT be called — multipass is a
    // tier-identity card, not a reward card.
    expect(tSpy).not.toHaveBeenCalledWith('fieldPreview.memberLevel.stampLabel');
    // The discount-card label MUST NOT be called — multipass is not discount_card.
    expect(tSpy).not.toHaveBeenCalledWith('fieldPreview.memberLevel.discountLabel');
  });
});

describe('PassCardPreviewBody — discount-only amount fields (2026-09-18)', () => {
  /**
   * Discount card adds two new amount display fields accessible in Step 3:
   *   - pointsToNextTierDiscount  — 到下一級還差 / Amount to Next Tier
   *   - accumulatedSpendDiscount  — 累積消費 / Accumulated Spending
   *
   * The values are NOT stored in i18n (label-only there). They are
   * sourced from `DISCOUNT_PREVIEW_AMOUNTS[currency]` — same
   * currency-driven map pattern as `CASHBACK_PREVIEW_AMOUNTS`.
   *
   *   TWD → "234元" / "556元" (Han suffix, en-locale-unsafe)
   *   ZAR → "R234" / "R556" (no Han, locale en-ZA convention)
   *
   * The body component NEVER routes discount amount values through t() —
   * they're rendered as raw strings from the constant.
   */

  it('pointsToNextTierDiscount renders its label via i18n + value via DISCOUNT_PREVIEW_AMOUNTS (TWD)', () => {
    // Reset currency to TWD explicitly — previous tests in this file may
    // have flipped the store to ZAR (currency leaks across tests).
    useCardBuilderStore.setState({ currency: 'TWD' });
    const { unmount } = render(
      <PassCardPreviewBody leftField="pointsToNextTierDiscount" />,
    );
    expect(screen.getByText('fieldPreview.pointsToNextTierDiscount.label')).toBeInTheDocument();
    expect(screen.getByText('234元')).toBeInTheDocument();
    unmount();
  });

  it('accumulatedSpendDiscount renders its label via i18n + value via DISCOUNT_PREVIEW_AMOUNTS (TWD)', () => {
    useCardBuilderStore.setState({ currency: 'TWD' });
    const { unmount } = render(
      <PassCardPreviewBody rightField="accumulatedSpendDiscount" />,
    );
    expect(screen.getByText('fieldPreview.accumulatedSpendDiscount.label')).toBeInTheDocument();
    expect(screen.getByText('556元')).toBeInTheDocument();
    unmount();
  });

  it('ZAR currency: discount values read from DISCOUNT_PREVIEW_AMOUNTS.ZAR', () => {
    useCardBuilderStore.setState({ currency: 'ZAR' });

    const { unmount } = render(
      <PassCardPreviewBody
        leftField="pointsToNextTierDiscount"
        rightField="accumulatedSpendDiscount"
      />,
    );
    expect(screen.getByText('R234')).toBeInTheDocument();
    expect(screen.getByText('R556')).toBeInTheDocument();
    unmount();
  });

  it('TWD currency: discount values read from DISCOUNT_PREVIEW_AMOUNTS.TWD (Han suffix)', () => {
    // Reset currency to TWD in case a previous test flipped it to ZAR.
    useCardBuilderStore.setState({ currency: 'TWD' });

    const { unmount } = render(
      <PassCardPreviewBody
        leftField="pointsToNextTierDiscount"
        rightField="accumulatedSpendDiscount"
      />,
    );
    expect(screen.getByText('234元')).toBeInTheDocument();
    expect(screen.getByText('556元')).toBeInTheDocument();
    // Mock t() returns i18n keys verbatim — discount amount values
    // bypass t() entirely (currency-driven map).
    expect(
      screen.queryByText('fieldPreview.pointsToNextTierDiscount.value'),
    ).toBeNull();
    expect(
      screen.queryByText('fieldPreview.accumulatedSpendDiscount.value'),
    ).toBeNull();
    unmount();
  });
});

describe('PassCardPreviewBody — discountTierBracket store-derived value (2026-09-18)', () => {
  /**
   * The `discountTierBracket` field is a pure store-derived field:
   *   label = `fieldPreview.discountTierBracket.label` ("折扣級距" /
   *         "Discount Tier Bracket") — from i18n
   *   value = `discountTiers[0].discountPercent` formatted as `"X%"`
   *         — from the store, NOT from i18n, NOT from a currency map
   *
   * This field does NOT depend on currency. It does NOT depend on
   * cardType (the dropdown filter already restricts this option to
   * discount_card). It's a static "first tier's % discount" preview
   * that reflects the user's live edit of the discount tier list.
   */

  function buildTSpy() {
    return vi.fn((...args: unknown[]) => args[0] as string);
  }

  function mockUseTranslationOnce(spy: ReturnType<typeof buildTSpy>) {
    vi.mocked(useTranslation).mockReturnValueOnce({ t: spy } as unknown as ReturnType<typeof useTranslation>);
  }

  it('discountTierBracket renders label via i18n + value via discountTiers[0].discountPercent (default 1%)', () => {
    // Store seeds a default tier with `discountPercent = 1`, so the
    // preview defaults to "1%" before the user has edited any tier.
    const tSpy = buildTSpy();
    mockUseTranslationOnce(tSpy);
    render(<PassCardPreviewBody leftField="discountTierBracket" />);

    expect(screen.getByText('fieldPreview.discountTierBracket.label')).toBeInTheDocument();
    expect(screen.getByText('1%')).toBeInTheDocument();
  });

  it('discountTierBracket reflects updated discountTiers[0].discountPercent from the store (reactive)', () => {
    // Simulate the user editing the first tier's discount to 10.
    useCardBuilderStore.setState({
      discountTiers: [
        {
          id: 'tier-test',
          name: 'Gold',
          thresholdSpend: 0,
          discountPercent: 10,
        },
      ],
    });
    render(<PassCardPreviewBody rightField="discountTierBracket" />);
    expect(screen.getByText('fieldPreview.discountTierBracket.label')).toBeInTheDocument();
    expect(screen.getByText('10%')).toBeInTheDocument();
  });

  it('discountTierBracket is NOT currency-driven (ZAR does not change the value format)', () => {
    // Reset to the default tier so the discountPercent is back to 1
    // (the previous "reactive" test set it to 10). Then set ZAR to
    // verify the value format is unaffected by currency.
    useCardBuilderStore.setState({
      currency: 'ZAR',
      discountTiers: [
        {
          id: 'default-discount-tier',
          name: '',
          thresholdSpend: 0,
          discountPercent: 1,
        },
      ],
    });
    render(<PassCardPreviewBody leftField="discountTierBracket" />);
    expect(screen.getByText('1%')).toBeInTheDocument();
    // No R prefix contamination.
    expect(screen.queryByText(/^R\d/)).toBeNull();
  });
});

// ── 2026-09-19 coupon card: store-driven discount value via i18n templates ──

describe('PassCardPreviewBody — coupon-only fields (2026-09-19, store-driven discount)', () => {
  /**
   * 2026-09-19 bug fix: previously the `couponDiscount` slot hardcoded
   * "10元折扣" / "R10折扣" regardless of the user's actual input. New
   * behaviour: read store.couponDiscountAmount / couponDiscountPercent
   * and interpolate into i18n templates (amountFormatTWD / amountFormatZAR
   * / percentFormat). The previous currency-driven fallback map
   * (`COUPON_PREVIEW_AMOUNTS`) is REMOVED — values are now store-driven.
   *
   * Also: switching `couponDiscountType` does NOT clear the other field
   * (regression — previously the setter nulled out the unused field,
   * which lost the user's percent value when switching back from
   * amount_off).
   *
   * These tests use a custom spy that resolves i18n keys against the
   * actual loaded passCard.zh-TW resources (via `require()`). The
   * default mock returns the key verbatim — that wouldn't let us
   * assert on the interpolated string output ("50元折扣" / "R50折扣"
   * / "10%折扣"). See buildTSpyWithResources below.
   */
  function buildTSpyWithResources(): ReturnType<typeof vi.fn> {
    // Inline translation map for the coupon-specific i18n keys (2026-09-19
    // bug fix). Reading the passCard.zh-TW resource directly via `require`
    // does NOT work in vitest (the `@/` alias isn't resolved inside
    // `require()` calls). Inlining the relevant keys here avoids the
    // alias resolution issue while still exercising the interpolation
    // contract end-to-end. The actual passCard.zh-TW file remains the
    // source of truth — this inline map is a TEST-ONLY mirror.
    //
    // 2026-09-20: added `couponRemainingCount.countFormat` template
    // ("{{count}}張") so the unit-suffix regression fix can be exercised
    // end-to-end. Also added an optional `couponDiscount.amountFormatTWD_en`
    // entry (default "NT${{amount}} off") so en + TWD + amount_off
    // tests can assert on the NT$ prefix. Tests opt into the en
    // template by overriding the map via `buildTSpyWithResources({ locale: 'en' })`.
    const couponTranslations: Record<string, string> = {
      'fieldPreview.couponDiscount.label': '折扣優惠',
      'fieldPreview.couponDiscount.amountFormatTWD': '{{amount}}元折扣',
      'fieldPreview.couponDiscount.amountFormatZAR': 'R{{amount}}折扣',
      'fieldPreview.couponDiscount.percentFormat': '{{percent}}%折扣',
      'fieldPreview.couponRemainingCount.label': '剩餘張數',
      'fieldPreview.couponRemainingCount.value': '1張',
      'fieldPreview.couponRemainingCount.countFormat': '{{count}}張',
    };
    return vi.fn((...args: unknown[]) => {
      const key = args[0] as string;
      const opts = args[1] as Record<string, unknown> | undefined;
      const template = couponTranslations[key] ?? key;
      if (!opts) return template;
      return template.replace(/\{\{(\w+)\}\}/g, (_match, name) =>
        String(opts[name] ?? ''),
      );
    });
  }

  /**
   * 2026-09-20: en locale spy for coupon preview tests. Mirrors the
   * en passCard namespace values relevant to coupon fields. Use this
   * to assert that:
   *   - en + TWD + amount_off + couponDiscountAmount=50 → "NT$50 off"
   *     (the NT$ prefix was added 2026-09-20 — previously "{{amount}} off"
   *     silently dropped the currency unit on the en side).
   *   - en + couponRemainingCount (firstCouponRemainingCount=5) →
   *     "5 sheets" (countFormat template, regression for the unit-suffix
   *     bug where the body rendered bare digits).
   */
  function buildEnTSpyWithResources(): ReturnType<typeof vi.fn> {
    const couponTranslations: Record<string, string> = {
      'fieldPreview.couponDiscount.label': 'Discount Offer',
      'fieldPreview.couponDiscount.amountFormatTWD': 'NT${{amount}} off',
      'fieldPreview.couponDiscount.amountFormatZAR': 'R{{amount}} off',
      'fieldPreview.couponDiscount.percentFormat': '{{percent}}% off',
      'fieldPreview.couponRemainingCount.label': 'Remaining Count',
      'fieldPreview.couponRemainingCount.value': '1 sheet',
      'fieldPreview.couponRemainingCount.countFormat': '{{count}} sheets',
    };
    return vi.fn((...args: unknown[]) => {
      const key = args[0] as string;
      const opts = args[1] as Record<string, unknown> | undefined;
      const template = couponTranslations[key] ?? key;
      if (!opts) return template;
      return template.replace(/\{\{(\w+)\}\}/g, (_match, name) =>
        String(opts[name] ?? ''),
      );
    });
  }

  function mockUseTranslationOnce(spy: ReturnType<typeof vi.fn>) {
    vi.mocked(useTranslation).mockReturnValueOnce({
      t: spy,
    } as unknown as ReturnType<typeof useTranslation>);
  }

  /**
   * For tests that use `rerender()` (which triggers a fresh
   * useTranslation() call each time) — `mockReturnValueOnce` only
   * applies to the FIRST call. Use `mockImplementation` to make the
   * spy persist across all subsequent calls within this test.
   */
  function mockUseTranslationPersistent(spy: ReturnType<typeof vi.fn>) {
    vi.mocked(useTranslation).mockImplementation(
      () => ({ t: spy } as unknown as ReturnType<typeof useTranslation>),
    );
  }

  it('couponRemainingCount renders label via i18n + value via i18n default ("1張")', () => {
    const tSpy = buildTSpyWithResources();
    mockUseTranslationOnce(tSpy);
    render(
      <PassCardPreviewBody
        cardType="coupon_card"
        leftField="couponRemainingCount"
      />,
    );
    // Label resolves to the i18n template "剩餘張數" via spy.
    expect(
      screen.getByText('剩餘張數'),
    ).toBeInTheDocument();
    // Body falls back to i18n value "1張" when firstCouponRemainingCount is undefined.
    expect(
      screen.getByText('1張'),
    ).toBeInTheDocument();
  });

  it('couponRemainingCount + firstCouponRemainingCount=5 → "5張" via countFormat (regression 2026-09-20 unit-suffix)', () => {
    // 2026-09-20 regression: previously the body forwarded
    // `String(couponIssueCount)` as the value verbatim, which rendered
    // the bare digits "5" without the i18n unit ("張" / "sheets").
    // After the fix, firstCouponRemainingCount is a `number` and the
    // body interpolates it into i18n `couponRemainingCount.countFormat`
    // ("{{count}}張") so the localised unit always appears next to the
    // user's count. Same path also covers the "user picked count=10"
    // case (large counts), not just small ones.
    const tSpy = buildTSpyWithResources();
    mockUseTranslationOnce(tSpy);
    render(
      <PassCardPreviewBody
        cardType="coupon_card"
        leftField="couponRemainingCount"
        firstCouponRemainingCount={5}
      />,
    );
    expect(
      screen.getByText('剩餘張數'),
    ).toBeInTheDocument();
    // Body composes the unit via i18n countFormat — "5張", NOT bare "5".
    expect(screen.getByText('5張')).toBeInTheDocument();
    // The bare digit "5" must NOT appear as a standalone value node
    // (it would only do so if the body bypassed the i18n template).
    const bareDigits = screen.queryByText((_content, node) => {
      if (!node) return false;
      const text = node.textContent ?? '';
      // Match a span whose entire text content is exactly "5" (not "5張").
      return text === '5' && node.children.length === 0;
    });
    expect(bareDigits).toBeNull();
  });

  it('couponDiscount + couponDiscountType="amount_off" + currency=TWD + couponDiscountAmount=null → empty (no placeholder)', () => {
    // 2026-09-19 bug fix: previously the preview showed the hardcoded
    // "10元折扣" placeholder regardless of the user's actual input.
    // New behaviour: when couponDiscountAmount is null, the preview
    // renders an empty string.
    useCardBuilderStore.setState({
      currency: 'TWD',
      couponDiscountType: 'amount_off',
      couponDiscountAmount: null,
      couponDiscountPercent: null,
    });
    render(
      <PassCardPreviewBody cardType="coupon_card" rightField="couponDiscount" />,
    );
    // Label resolves to "折扣優惠" via default mock.
    expect(screen.getByText('fieldPreview.couponDiscount.label')).toBeInTheDocument();
    // The hardcoded "10元折扣" MUST NOT appear (no placeholder text).
    expect(screen.queryByText('10元折扣')).toBeNull();
    // The value span should be empty.
    const valueSpans = screen.getAllByText('');
    expect(valueSpans.length).toBeGreaterThan(0);
  });

  it('couponDiscount + couponDiscountType="amount_off" + currency=TWD + couponDiscountAmount=50 → "50元折扣" (regression 2026-09-19)', () => {
    // 2026-09-19 bug fix: the preview now reads the user's actual
    // couponDiscountAmount and interpolates into the i18n template
    // `amountFormatTWD` → "{{amount}}元折扣" → "50元折扣".
    const tSpy = buildTSpyWithResources();
    mockUseTranslationOnce(tSpy);
    useCardBuilderStore.setState({
      currency: 'TWD',
      couponDiscountType: 'amount_off',
      couponDiscountAmount: 50,
      couponDiscountPercent: null,
    });
    render(
      <PassCardPreviewBody cardType="coupon_card" rightField="couponDiscount" />,
    );
    // Label resolves to "折扣優惠" via spy.
    expect(screen.getByText('折扣優惠')).toBeInTheDocument();
    expect(screen.getByText('50元折扣')).toBeInTheDocument();
  });

  it('couponDiscount + couponDiscountType="amount_off" + currency=ZAR + couponDiscountAmount=50 → "R50折扣" (regression 2026-09-19)', () => {
    // 2026-09-19 bug fix: ZAR path uses `amountFormatZAR` template →
    // "R{{amount}}折扣" → "R50折扣".
    const tSpy = buildTSpyWithResources();
    mockUseTranslationOnce(tSpy);
    useCardBuilderStore.setState({
      currency: 'ZAR',
      couponDiscountType: 'amount_off',
      couponDiscountAmount: 50,
      couponDiscountPercent: null,
    });
    render(
      <PassCardPreviewBody cardType="coupon_card" rightField="couponDiscount" />,
    );
    expect(screen.getByText('折扣優惠')).toBeInTheDocument();
    expect(screen.getByText('R50折扣')).toBeInTheDocument();
  });

  it('couponDiscount + couponDiscountType="amount_off" + currency=TWD + en locale + couponDiscountAmount=50 → "NT$50 off" (regression 2026-09-20 NT$ prefix)', () => {
    // 2026-09-20 NT$ prefix fix: previously the en + TWD template was
    // "{{amount}} off" — missing the currency unit. en + TWD in
    // business contexts is conventionally written with the ISO 4217
    // code NT$ (New Taiwan Dollar). zh-TW uses the Han suffix "元" so
    // the templates diverge by locale. This test pins the en side to
    // the fixed "NT${{amount}} off" template; the previous "50 off"
    // rendering is the regression we're guarding against.
    const tSpy = buildEnTSpyWithResources();
    mockUseTranslationOnce(tSpy);
    useCardBuilderStore.setState({
      currency: 'TWD',
      couponDiscountType: 'amount_off',
      couponDiscountAmount: 50,
      couponDiscountPercent: null,
    });
    render(
      <PassCardPreviewBody cardType="coupon_card" rightField="couponDiscount" />,
    );
    expect(screen.getByText('Discount Offer')).toBeInTheDocument();
    expect(screen.getByText('NT$50 off')).toBeInTheDocument();
    // The unit-less "50 off" MUST NOT appear (regression for missing
    // NT$ prefix on the en + TWD path).
    expect(screen.queryByText('50 off')).toBeNull();
  });

  it('couponDiscount + couponDiscountType="amount_off" + currency=ZAR + en locale + couponDiscountAmount=50 → "R50 off" (en ZAR unchanged)', () => {
    // 2026-09-20: en + ZAR path uses the same "R{{amount}} off"
    // template as before (no regression). Pins that the NT$ change is
    // TWD-specific and didn't accidentally bleed into ZAR.
    const tSpy = buildEnTSpyWithResources();
    mockUseTranslationOnce(tSpy);
    useCardBuilderStore.setState({
      currency: 'ZAR',
      couponDiscountType: 'amount_off',
      couponDiscountAmount: 50,
      couponDiscountPercent: null,
    });
    render(
      <PassCardPreviewBody cardType="coupon_card" rightField="couponDiscount" />,
    );
    expect(screen.getByText('Discount Offer')).toBeInTheDocument();
    expect(screen.getByText('R50 off')).toBeInTheDocument();
  });

  it('couponRemainingCount + firstCouponRemainingCount=5 + en locale → "5 sheets" via countFormat (regression 2026-09-20)', () => {
    // 2026-09-20 regression: the body used to render bare digits on
    // the en side too ("5" instead of "5 sheets"). Same unit-suffix
    // fix as the zh-TW test above; this pins the en-side template.
    const tSpy = buildEnTSpyWithResources();
    mockUseTranslationOnce(tSpy);
    render(
      <PassCardPreviewBody
        cardType="coupon_card"
        leftField="couponRemainingCount"
        firstCouponRemainingCount={5}
      />,
    );
    expect(screen.getByText('Remaining Count')).toBeInTheDocument();
    expect(screen.getByText('5 sheets')).toBeInTheDocument();
    // Bare "5" must NOT appear (it would if the body bypassed i18n).
    const bareDigits = screen.queryByText((_content, node) => {
      if (!node) return false;
      const text = node.textContent ?? '';
      return text === '5' && node.children.length === 0;
    });
    expect(bareDigits).toBeNull();
  });

  it('couponDiscount + couponDiscountType="percent_off" + couponDiscountPercent=10 → "10%折扣" (regression 2026-09-19)', () => {
    const tSpy = buildTSpyWithResources();
    mockUseTranslationOnce(tSpy);
    useCardBuilderStore.setState({
      couponDiscountType: 'percent_off',
      couponDiscountPercent: 10,
      couponDiscountAmount: null,
    });
    render(
      <PassCardPreviewBody cardType="coupon_card" rightField="couponDiscount" />,
    );
    expect(screen.getByText('折扣優惠')).toBeInTheDocument();
    expect(screen.getByText('10%折扣')).toBeInTheDocument();
    // amount_off's "50元折扣" / "R50折扣" MUST NOT appear (mutually exclusive).
    expect(screen.queryByText('50元折扣')).toBeNull();
    expect(screen.queryByText('R50折扣')).toBeNull();
  });

  it('couponDiscount + couponDiscountType="percent_off" + couponDiscountPercent=null → empty (no placeholder)', () => {
    // 2026-09-19 bug fix: percent_off selected but user hasn't typed a
    // value yet → empty string. No more currency-driven "10元折扣" fallback.
    useCardBuilderStore.setState({
      currency: 'TWD',
      couponDiscountType: 'percent_off',
      couponDiscountPercent: null,
      couponDiscountAmount: null,
    });
    render(
      <PassCardPreviewBody cardType="coupon_card" rightField="couponDiscount" />,
    );
    // The hardcoded "10元折扣" MUST NOT appear.
    expect(screen.queryByText('10元折扣')).toBeNull();
  });

  it('switching back to percent_off after amount_off preserves the percent value (regression 2026-09-19)', () => {
    // 2026-09-19 bug fix: previously `setCouponDiscountType` cleared
    // the other field on type-switch. User flow:
    //   1. Pick percent_off, type 15
    //   2. Switch to amount_off → percent cleared (was 15 → null)
    //   3. Switch back to percent_off → percent is null, preview showed
    //      the hardcoded "10元折扣" placeholder instead of "15%折扣".
    // New behaviour: type-switch does NOT clear the other field. After
    // step 1, the percent value survives the type round-trip.
    //
    // Uses `mockUseTranslationPersistent` (not Once) because rerender
    // triggers fresh useTranslation() calls — mockReturnValueOnce only
    // applies to the first call.
    const tSpy = buildTSpyWithResources();
    mockUseTranslationPersistent(tSpy);
    useCardBuilderStore.setState({
      couponDiscountType: 'amount_off',
      couponDiscountAmount: null,
      couponDiscountPercent: null,
    });
    const { rerender } = render(
      <PassCardPreviewBody cardType="coupon_card" rightField="couponDiscount" />,
    );
    // Step 1: switch to percent_off + type 15
    useCardBuilderStore.setState({
      couponDiscountType: 'percent_off',
      couponDiscountPercent: 15,
    });
    rerender(
      <PassCardPreviewBody cardType="coupon_card" rightField="couponDiscount" />,
    );
    expect(screen.getByText('15%折扣')).toBeInTheDocument();
    // Step 2: switch to amount_off → percent is NOT cleared (was the
    // bug — store setter used to null out couponDiscountPercent on
    // type-switch). Now it survives.
    useCardBuilderStore.setState({
      couponDiscountType: 'amount_off',
    });
    rerender(
      <PassCardPreviewBody cardType="coupon_card" rightField="couponDiscount" />,
    );
    // After switching to amount_off, couponDiscountAmount is still null
    // (user didn't type one yet), so the preview is empty for amount_off.
    expect(screen.queryByText('10元折扣')).toBeNull();
    expect(screen.queryByText('15%折扣')).toBeNull();
    // Step 3: switch back to percent_off → percent is STILL 15 (preserved).
    useCardBuilderStore.setState({
      couponDiscountType: 'percent_off',
    });
    rerender(
      <PassCardPreviewBody cardType="coupon_card" rightField="couponDiscount" />,
    );
    expect(screen.getByText('15%折扣')).toBeInTheDocument();
  });

  it('couponDiscount is gated by cardType=coupon_card (other card types fall through to default)', () => {
    // For discount_card, the couponDiscount field is NOT in the dropdown
    // (the filter restricts it to coupon_card), but defensively verify
    // that the coupon branch is gated on cardType — passing a non-coupon
    // cardType should NOT trigger the coupon preview override.
    //
    // Reset mockImplementation from the previous "switching" test (which
    // uses mockImplementation to persist across rerenders). This test
    // only renders once, so the default mock (returns key verbatim)
    // is what we want — verify by NOT using the interpolation spy.
    vi.mocked(useTranslation).mockReset();
    vi.mocked(useTranslation).mockImplementation(
      () => ({ t: vi.fn((key: string) => key) } as unknown as ReturnType<typeof useTranslation>),
    );
    useCardBuilderStore.setState({
      couponDiscountType: 'amount_off',
      couponDiscountPercent: null,
      couponDiscountAmount: null,
    });
    render(
      <PassCardPreviewBody cardType="discount_card" rightField="couponDiscount" />,
    );
    // Falls through to the default branch. The defensive guard at the end
    // of resolveSlot catches the mock t() returning `fieldPreview.couponDiscount.label`
    // verbatim (no real i18n lookup in tests) and converts both label and
    // value to empty string. This is the desired production behaviour:
    // if a new field is added to CARD_FIELD_KEYS without a corresponding
    // i18n entry, the user sees an empty preview rather than a raw key.
    // The guard's behaviour here (empty string) is the test's assertion
    // contract for "the coupon override did NOT fire".
    expect(screen.queryByText('fieldPreview.couponDiscount.label')).toBeNull();
    // The hardcoded "10元折扣" MUST NOT appear (the override requires
    // cardType === 'coupon_card').
    expect(screen.queryByText('10元折扣')).toBeNull();
    // Verify the default branch's defensive guard produced empty
    // strings (label slot in particular — it's the small text-[10px] span).
    const labelSpans = Array.from(document.querySelectorAll('span.text-\\[10px\\]'));
    const rightLabel = labelSpans[1]; // [0]=left, [1]=right (rightField drives right side)
    expect(rightLabel?.textContent).toBe('');
  });
});
