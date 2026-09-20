/**
 * MultipassAccrualModeField — Vitest + RTL Tests (Rule 003 TDD)
 *
 * Verifies the 3-option radio group (mirrors StampAccrualModeField.test.tsx):
 *   per_stamp  (基於蓋章 / Manual Stamp)
 *   per_visit  (基於拜訪 / Per Visit)
 *   per_spend  (基於消費 / Per Spend)
 *
 * Same Radio Card Pattern A (2026-09-07):
 *   - Native `<input type="radio">` is hidden behind `absolute opacity-0 size-5`.
 *   - `.radio-card-primary` + `.radio-card-fill` classes on label / indicator.
 *   - Selected state flips via `.radio-card-primary:has(:checked) .radio-card-fill`
 *     rule in apps/frontend/src/index.css.
 *
 * Plan ref: step6_multipass_pr-5_accrual_mode 2026-09-20 § Layer 8.1.
 */

import { render, screen, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { MultipassAccrualModeField } from './MultipassAccrualModeField';
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

describe('MultipassAccrualModeField (Step 6 section) — Radio Card Pattern A', () => {
  it('renders all three options as native radios (name=step6-multipass-accrual-mode)', () => {
    render(<MultipassAccrualModeField showValidation={false} />);

    // 3 radios share the multipass-flavored name (NOT the stamp card's
    // 'step6-accrual-mode' — radio group isolation).
    const radios = screen.getAllByRole('radio') as HTMLInputElement[];
    expect(radios).toHaveLength(3);
    for (const r of radios) {
      expect(r.name).toBe('step6-multipass-accrual-mode');
    }

    const values = radios.map((r) => r.value);
    expect(values).toContain('per_stamp');
    expect(values).toContain('per_visit');
    expect(values).toContain('per_spend');
  });

  it('hides each native radio via absolute + opacity-0 + size-5 (Pattern A overlay)', () => {
    render(<MultipassAccrualModeField showValidation={false} />);

    const radios = screen.getAllByRole('radio', { hidden: true }) as HTMLInputElement[];
    for (const r of radios) {
      expect(r.className).toContain('absolute');
      expect(r.className).toContain('opacity-0');
      const classes = r.className;
      const isSize5 = classes.includes('size-5') || (classes.includes('h-5') && classes.includes('w-5'));
      expect(isSize5).toBe(true);
    }
  });

  it('renders helper text for each mode', () => {
    render(<MultipassAccrualModeField showValidation={false} />);

    expect(screen.getAllByText('step6.multipass.modes.per_stamp.helper')).toHaveLength(1);
    expect(screen.getAllByText('step6.multipass.modes.per_visit.helper')).toHaveLength(1);
    expect(screen.getAllByText('step6.multipass.modes.per_spend.helper')).toHaveLength(1);
  });

  it('renders title and description', () => {
    render(<MultipassAccrualModeField showValidation={false} />);

    expect(screen.getByText('step6.multipass.accrualModeTitle')).toBeInTheDocument();
    expect(screen.getByText('step6.multipass.accrualModeDescription')).toBeInTheDocument();
  });

  it('clicking per_visit updates store.multipassAccrualMode to "per_visit"', async () => {
    const user = userEvent.setup();
    render(<MultipassAccrualModeField showValidation={false} />);

    const radios = screen.getAllByRole('radio', { hidden: true }) as HTMLInputElement[];
    const perVisitRadio = radios.find((r) => r.value === 'per_visit')!;
    await user.click(perVisitRadio);

    expect(useCardBuilderStore.getState().multipassAccrualMode).toBe('per_visit');
  });

  it('clicking per_stamp updates store.multipassAccrualMode to "per_stamp"', async () => {
    const user = userEvent.setup();
    render(<MultipassAccrualModeField showValidation={false} />);

    const radios = screen.getAllByRole('radio', { hidden: true }) as HTMLInputElement[];
    const perStampRadio = radios.find((r) => r.value === 'per_stamp')!;
    await user.click(perStampRadio);

    expect(useCardBuilderStore.getState().multipassAccrualMode).toBe('per_stamp');
  });

  it('clicking per_spend updates store.multipassAccrualMode to "per_spend"', async () => {
    const user = userEvent.setup();
    render(<MultipassAccrualModeField showValidation={false} />);

    const radios = screen.getAllByRole('radio', { hidden: true }) as HTMLInputElement[];
    const perSpendRadio = radios.find((r) => r.value === 'per_spend')!;
    await user.click(perSpendRadio);

    expect(useCardBuilderStore.getState().multipassAccrualMode).toBe('per_spend');
  });

  it('all radios are unchecked initially', () => {
    render(<MultipassAccrualModeField showValidation={false} />);

    const radios = screen.getAllByRole('radio', { hidden: true }) as HTMLInputElement[];
    expect(radios).toHaveLength(3);
    for (const r of radios) {
      expect(r.checked).toBe(false);
    }
  });

  it('reflects pre-existing store value as the checked radio', () => {
    useCardBuilderStore.setState({ multipassAccrualMode: 'per_visit' });
    render(<MultipassAccrualModeField showValidation={false} />);

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
    useCardBuilderStore.setState({ multipassAccrualMode: 'per_visit' });
    render(<MultipassAccrualModeField showValidation={false} />);

    const radios = screen.getAllByRole('radio', { hidden: true }) as HTMLInputElement[];
    const perSpendRadio = radios.find((r) => r.value === 'per_spend')!;
    await user.click(perSpendRadio);

    const allRadios = screen.getAllByRole('radio', { hidden: true }) as HTMLInputElement[];
    expect(allRadios.find((r) => r.value === 'per_spend')?.checked).toBe(true);
    expect(allRadios.find((r) => r.value === 'per_visit')?.checked).toBe(false);
  });

  it('label container carries the radio-card-primary class (Pattern A — :has(:checked) drives selection visuals)', () => {
    render(<MultipassAccrualModeField showValidation={false} />);

    const labels = document.querySelectorAll('label[for^="step6-multipass-accrual-"]');
    expect(labels).toHaveLength(3);
    for (const lbl of labels) {
      const cls = (lbl as HTMLElement).className;
      expect(cls).toContain('radio-card-primary');
      expect(cls).toContain('rounded-lg');
      expect(cls).toContain('border');
      expect(cls).toContain('border-border');
      expect(cls).toContain('transition-all');
    }
  });

  it('label container does NOT use inline `style` for selection visuals (single source of truth lives in index.css)', () => {
    render(<MultipassAccrualModeField showValidation={false} />);

    const labels = document.querySelectorAll('label[for^="step6-multipass-accrual-"]');
    for (const lbl of labels) {
      const inline = (lbl as HTMLElement).getAttribute('style') || '';
      expect(inline).not.toMatch(/borderColor/);
      expect(inline).not.toMatch(/backgroundColor/);
      expect(inline).not.toMatch(/boxShadow/);
    }
  });

  it('visual indicator span carries radio-card-fill class (Pattern A fills with SAOME 橘色 on selection)', () => {
    render(<MultipassAccrualModeField showValidation={false} />);

    const labels = document.querySelectorAll('label[for^="step6-multipass-accrual-"]');
    expect(labels).toHaveLength(3);
    for (const lbl of labels) {
      const indicator = lbl.querySelector('span[aria-hidden="true"]') as HTMLElement | null;
      expect(indicator).not.toBeNull();
      const cls = indicator!.className;
      expect(cls).toContain('radio-card-fill');
      expect(cls).toContain('border-muted-foreground/40');
      expect(cls).toContain('bg-transparent');
      // 絕對禁止畫內點（Pattern A 沒有 8×8 inner dot）
      expect(cls).not.toContain('bg-on-primary');
      const inline = (indicator as HTMLElement).getAttribute('style') || '';
      expect(inline).not.toMatch(/borderColor/);
      expect(inline).not.toMatch(/backgroundColor/);
    }
  });

  it('does NOT render inner 8×8 dot indicator on selection (Pattern A — primary fill replaces inner dot)', () => {
    useCardBuilderStore.setState({ multipassAccrualMode: 'per_visit' });
    render(<MultipassAccrualModeField showValidation={false} />);

    const innerDots = document.querySelectorAll('span.h-2.w-2.rounded-full.bg-on-primary');
    expect(innerDots).toHaveLength(0);
  });

  it('icon carries radio-card-icon class (CSS :has(:checked) flips to text-primary on selection)', () => {
    useCardBuilderStore.setState({ multipassAccrualMode: 'per_stamp' });
    render(<MultipassAccrualModeField showValidation={false} />);

    const stampsLabel = document.querySelector(
      'label[for="step6-multipass-accrual-per_stamp"]',
    ) as HTMLElement | null;
    expect(stampsLabel).not.toBeNull();
    const icon = stampsLabel!.querySelector('svg');
    expect(icon).not.toBeNull();
    const iconCls = (icon as SVGElement).getAttribute('class') || '';
    expect(iconCls).toContain('radio-card-icon');
    const inline = (icon as SVGElement).getAttribute('style') || '';
    expect(inline).not.toMatch(/color:/);
  });
});
