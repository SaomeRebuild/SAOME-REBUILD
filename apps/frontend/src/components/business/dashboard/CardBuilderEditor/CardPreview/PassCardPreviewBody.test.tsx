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
  it.each(CARD_FIELD_KEYS)('renders leftField="%s" → fieldPreview.%s.label and .value', (key) => {
    const { unmount } = render(<PassCardPreviewBody leftField={key} />);
    expect(screen.getByText(`fieldPreview.${key}.label`)).toBeInTheDocument();
    expect(screen.getByText(`fieldPreview.${key}.value`)).toBeInTheDocument();
    unmount();
  });

  it.each(CARD_FIELD_KEYS)('renders rightField="%s" → fieldPreview.%s.label and .value', (key) => {
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

// Pull in useTranslation so the tests above can `vi.mocked` it.
import { useTranslation } from 'react-i18next';
