/**
 * StampAccrualModeField — Vitest + RTL Tests (Rule 003 TDD)
 *
 * Verifies the 3-option radio group:
 *   per_stamp  (手動蓋章)
 *   per_visit  (來訪自動)
 *   per_spend  (消費自動)
 *
 * Visual contract (Radio Card Pattern A — see apps/frontend/src/index.css §
 * Radio Card Pattern A; 2026-09-07):
 *   - Native `<input type="radio">` is hidden behind `absolute opacity-0 size-5`.
 *   - The visible indicator span carries class `radio-card-fill`; the parent
 *     label carries class `radio-card-primary`. The CSS rule
 *     `.radio-card-primary:has(:checked) .radio-card-fill` flips fill to
 *     SAOME `--color-primary` (#F97316). **No inner 8×8 dot** (Pattern A).
 *   - The card container ALSO uses `:has(:checked)` for border + bg tint +
 *     shadow — same source of state truth, no React conditional needed.
 *
 * Why `.radio-card-primary` instead of Tailwind's `has-[:checked]:bg-primary`
 * (2026-09-07): see apps/frontend/src/index.css § Radio Card Pattern A.
 *
 * Plan ref: step6_集點卡模組化實作 plan 2026-09-07 § Phase 6.1 StampAccrualModeField test.
 */

import { render, screen, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { StampAccrualModeField } from './StampAccrualModeField';
import { useCardBuilderStore } from '../../CardBuilderEditor.store';

// Mock react-i18next: t(key) returns the key as text.
vi.mock('react-i18next', () => ({
  useTranslation: vi.fn(() => ({
    t: vi.fn((key: string, _params?: Record<string, unknown>) => key),
  })),
}));

afterEach(() => {
  useCardBuilderStore.getState().reset();
  cleanup();
});

describe('StampAccrualModeField (Step 6 section 1) — Radio Card Pattern A', () => {
  it('renders all three options as native radios (name=step6-accrual-mode)', () => {
    render(<StampAccrualModeField showValidation={false} />);

    // 3 radios share a name; verify by name selector.
    const radios = screen.getAllByRole('radio') as HTMLInputElement[];
    expect(radios).toHaveLength(3);
    for (const r of radios) {
      expect(r.name).toBe('step6-accrual-mode');
    }

    const values = radios.map((r) => r.value);
    expect(values).toContain('per_stamp');
    expect(values).toContain('per_visit');
    expect(values).toContain('per_spend');
  });

  it('hides each native radio via absolute + opacity-0 + size-5 (Pattern A overlay)', () => {
    render(<StampAccrualModeField showValidation={false} />);

    const radios = screen.getAllByRole('radio', { hidden: true }) as HTMLInputElement[];
    for (const r of radios) {
      expect(r.className).toContain('absolute');
      expect(r.className).toContain('opacity-0');
      // `size-5` is the modern Tailwind shorthand for h-5 w-5; it expands at
      // build time but is also accepted by the runtime style. Some Tailwind
      // versions normalize to `h-5 w-5`; accept either spelling.
      const classes = r.className;
      const isSize5 = classes.includes('size-5') || (classes.includes('h-5') && classes.includes('w-5'));
      expect(isSize5).toBe(true);
    }
  });

  it('renders helper text for each mode', () => {
    render(<StampAccrualModeField showValidation={false} />);

    expect(screen.getAllByText('step6.stamp.modes.per_stamp.helper')).toHaveLength(1);
    expect(screen.getAllByText('step6.stamp.modes.per_visit.helper')).toHaveLength(1);
    expect(screen.getAllByText('step6.stamp.modes.per_spend.helper')).toHaveLength(1);
  });

  it('renders title and description', () => {
    render(<StampAccrualModeField showValidation={false} />);

    expect(screen.getByText('step6.stamp.accrualModeTitle')).toBeInTheDocument();
    expect(screen.getByText('step6.stamp.accrualModeDescription')).toBeInTheDocument();
  });

  it('clicking per_visit updates store.stampAccrualMode to "per_visit"', async () => {
    const user = userEvent.setup();
    render(<StampAccrualModeField showValidation={false} />);

    const radios = screen.getAllByRole('radio', { hidden: true }) as HTMLInputElement[];
    const perVisitRadio = radios.find((r) => r.value === 'per_visit')!;
    await user.click(perVisitRadio);

    expect(useCardBuilderStore.getState().stampAccrualMode).toBe('per_visit');
  });

  it('clicking per_stamp updates store.stampAccrualMode to "per_stamp"', async () => {
    const user = userEvent.setup();
    render(<StampAccrualModeField showValidation={false} />);

    const radios = screen.getAllByRole('radio', { hidden: true }) as HTMLInputElement[];
    const perStampRadio = radios.find((r) => r.value === 'per_stamp')!;
    await user.click(perStampRadio);

    expect(useCardBuilderStore.getState().stampAccrualMode).toBe('per_stamp');
  });

  it('clicking per_spend updates store.stampAccrualMode to "per_spend"', async () => {
    const user = userEvent.setup();
    render(<StampAccrualModeField showValidation={false} />);

    const radios = screen.getAllByRole('radio', { hidden: true }) as HTMLInputElement[];
    const perSpendRadio = radios.find((r) => r.value === 'per_spend')!;
    await user.click(perSpendRadio);

    expect(useCardBuilderStore.getState().stampAccrualMode).toBe('per_spend');
  });

  it('all radios are unchecked initially', () => {
    render(<StampAccrualModeField showValidation={false} />);

    const radios = screen.getAllByRole('radio', { hidden: true }) as HTMLInputElement[];
    expect(radios).toHaveLength(3);
    for (const r of radios) {
      expect(r.checked).toBe(false);
    }
  });

  it('reflects pre-existing store value as the checked radio', () => {
    useCardBuilderStore.setState({ stampAccrualMode: 'per_visit' });
    render(<StampAccrualModeField showValidation={false} />);

    const radios = screen.getAllByRole('radio', { hidden: true }) as HTMLInputElement[];
    const perVisit = radios.find((r) => r.value === 'per_visit');
    expect(perVisit?.checked).toBe(true);
    for (const r of radios) {
      if (r.value !== 'per_visit') {
        expect(r.checked).toBe(false);
      }
    }
  });

  it('switching from per_visit to per_spend updates the checked radio', async () => {
    const user = userEvent.setup();
    useCardBuilderStore.setState({ stampAccrualMode: 'per_visit' });
    render(<StampAccrualModeField showValidation={false} />);

    const radios = screen.getAllByRole('radio', { hidden: true }) as HTMLInputElement[];
    const perSpendRadio = radios.find((r) => r.value === 'per_spend')!;
    await user.click(perSpendRadio);

    const allRadios = screen.getAllByRole('radio', { hidden: true }) as HTMLInputElement[];
    expect(allRadios.find((r) => r.value === 'per_spend')?.checked).toBe(true);
    expect(allRadios.find((r) => r.value === 'per_visit')?.checked).toBe(false);
  });

  // ===== Pattern A 視覺斷言 — CSS class 必須在 label & indicator 上對 :has(:checked) 生效 =====
  //
  // Why className assertions over inline-style assertions (2026-09-07):
  //   We deliberately moved selected-state styling out of React inline style
  //   and into `.radio-card-primary :has(:checked) .radio-card-fill` /
  //   `.radio-card-icon` rules in apps/frontend/src/index.css. The Tailwind
  //   utility `has-[:checked]:bg-primary` would compile to nothing because
  //   our `--color-primary` lives outside `@theme {}`. These assertions
  //   therefore pin the *single source of truth* (the CSS class name +
  //   the `:has(:checked)` selector in index.css), not the rendered style.

  it('label container carries the radio-card-primary class (Pattern A — :has(:checked) drives selection visuals)', () => {
    render(<StampAccrualModeField showValidation={false} />);

    // Pattern A: 3 個 label 都要帶 `radio-card-primary` class（讓 CSS :has(:checked) 規則生效）
    const labels = document.querySelectorAll('label[for^="step6-accrual-"]');
    expect(labels).toHaveLength(3);
    for (const lbl of labels) {
      const cls = (lbl as HTMLElement).className;
      expect(cls).toContain('radio-card-primary');
      // 也保留 shape / transition utility（不該被取代）
      expect(cls).toContain('rounded-lg');
      expect(cls).toContain('border');
      expect(cls).toContain('border-border');
      expect(cls).toContain('transition-all');
    }
  });

  it('label container does NOT use inline `style` for selection visuals (single source of truth lives in index.css)', () => {
    render(<StampAccrualModeField showValidation={false} />);

    const labels = document.querySelectorAll('label[for^="step6-accrual-"]');
    for (const lbl of labels) {
      // React inline style 只能在「已經 selected」時塞 borderColor / backgroundColor / boxShadow。
      // 我們改成 CSS class，label 不應再有 selected 相關 inline style。
      const inline = (lbl as HTMLElement).getAttribute('style') || '';
      expect(inline).not.toMatch(/borderColor/);
      expect(inline).not.toMatch(/backgroundColor/);
      expect(inline).not.toMatch(/boxShadow/);
    }
  });

  it('visual indicator span carries radio-card-fill class (Pattern A fills with SAOME 橘色 on selection)', () => {
    render(<StampAccrualModeField showValidation={false} />);

    const labels = document.querySelectorAll('label[for^="step6-accrual-"]');
    expect(labels).toHaveLength(3);
    for (const lbl of labels) {
      const indicator = lbl.querySelector('span[aria-hidden="true"]') as HTMLElement | null;
      expect(indicator).not.toBeNull();
      const cls = indicator!.className;
      // 必須帶 `radio-card-fill` class，讓 CSS selector
      // `.radio-card-primary:has(:checked) .radio-card-fill` 觸發填色。
      expect(cls).toContain('radio-card-fill');
      // 未選：邊框 + 透明背景（layout utility 仍在）
      expect(cls).toContain('border-muted-foreground/40');
      expect(cls).toContain('bg-transparent');
      // 絕對**禁止**畫內點（Pattern A 沒有 8×8 inner dot）
      expect(cls).not.toContain('bg-on-primary');
      // 絕對**禁止** inline style 寫 selected visuals（會繞過 CSS :has(:checked) source of truth）
      const inline = (indicator as HTMLElement).getAttribute('style') || '';
      expect(inline).not.toMatch(/borderColor/);
      expect(inline).not.toMatch(/backgroundColor/);
    }
  });

  it('regression — indicator span does NOT use bare has-[:checked] Tailwind variant (would not emit because --color-primary is outside @theme {})', () => {
    // 2026-09-07 事故：上一版用 `has-[:checked]:bg-primary` 在 span / label 上，
    // 但 Tailwind v4 不 emit `bg-primary`（因 `--color-primary` 在 `:root` 而非 `@theme`），
    // → CSS 永遠不觸發 → 選中時圈圈維持透明。
    // 改成 `.radio-card-primary:has(:checked) .radio-card-fill` 手寫 CSS rule 修。
    // 這條 assertion 防止未來又有人把 `.radio-card-fill` 換回 bare `has-[:checked]:bg-primary`。
    render(<StampAccrualModeField showValidation={false} />);

    const labels = document.querySelectorAll('label[for^="step6-accrual-"]');
    for (const lbl of labels) {
      const indicator = lbl.querySelector('span[aria-hidden="true"]') as HTMLElement | null;
      expect(indicator).not.toBeNull();
      const cls = indicator!.className;
      const tokens = cls.split(/\s+/).filter((t) => t.includes('has-[:checked]') || t.includes('has(:checked)'));
      expect(tokens).toEqual([]);
    }
  });

  it('does NOT render inner 8×8 dot indicator on selection (Pattern A — primary fill replaces inner dot)', () => {
    useCardBuilderStore.setState({ stampAccrualMode: 'per_visit' });
    render(<StampAccrualModeField showValidation={false} />);

    // 確認 h-2 w-2 的 inner dot 完全不存在
    const innerDots = document.querySelectorAll('span.h-2.w-2.rounded-full.bg-on-primary');
    expect(innerDots).toHaveLength(0);
  });

  it('icon carries radio-card-icon class (CSS :has(:checked) flips to text-primary on selection)', () => {
    useCardBuilderStore.setState({ stampAccrualMode: 'per_stamp' });
    render(<StampAccrualModeField showValidation={false} />);

    // Lucide StampIcon 第一個 instance 應該帶 `radio-card-icon` class；
    // CSS rule `.radio-card-primary:has(:checked) .radio-card-icon` 把它從
    // text-muted-foreground 翻成 var(--color-primary)。
    const stampsLabel = document.querySelector('label[for="step6-accrual-per_stamp"]') as HTMLElement | null;
    expect(stampsLabel).not.toBeNull();
    const icon = stampsLabel!.querySelector('svg');
    expect(icon).not.toBeNull();
    const iconCls = (icon as SVGElement).getAttribute('class') || '';
    expect(iconCls).toContain('radio-card-icon');
    // 不應該有 inline color style — selected color 由 CSS :has(:checked) 給
    const inline = (icon as SVGElement).getAttribute('style') || '';
    expect(inline).not.toMatch(/color:/);
  });
});
