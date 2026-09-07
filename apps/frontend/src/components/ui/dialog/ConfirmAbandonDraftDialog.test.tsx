/**
 * ConfirmAbandonDraftDialog — Vitest + RTL Tests (Rule 003 TDD)
 *
 * Visual contract (Radio Card Pattern A — see apps/frontend/src/index.css
 * § Radio Card Pattern A; 2026-09-07):
 *   - Native `<input type="radio">` is hidden behind `absolute opacity-0 size-5`.
 *   - The Resume option uses class `.radio-card-primary` → fills with SAOME
 *     `--color-primary` (#F97316) on selection.
 *   - The Discard option uses class `.radio-card-destructive` → fills with
 *     `--color-destructive` (#EF4444) on selection.
 *   - Indicator span carries class `radio-card-fill` so the CSS
 *     `.radio-card-primary:has(:checked) .radio-card-fill` /
 *     `.radio-card-destructive:has(:checked) .radio-card-fill` rules flip fill.
 *
 * Why CSS class instead of inline style (2026-09-07 regression):
 *   The previous version used React inline `style={{ borderColor: 'var(--color-destructive)' }}`
 *   driven by `selectedAction === 'discard'`. The discard option's red fill
 *   stopped rendering on a refactor that also removed the `:has(:checked)`
 *   Tailwind variants. We pin the *single source of truth* (CSS class name
 *   + `:has(:checked)` rule in index.css) here so future regressions trip
 *   the test before shipping.
 *
 * Why not Tailwind's `has-[:checked]:bg-destructive`:
 *   Tailwind v4 only emits color utilities (`bg-destructive`, `border-destructive`)
 *   when `--color-destructive` is declared inside `@theme {}`. Our
 *   `--color-destructive` lives in `:root, [data-theme='dark']` +
 *   `[data-theme='light']` blocks (so dark/light can override per-mode),
 *   so the Tailwind utility is NOT emitted. CSS class + hand-written
 *   `:has(:checked)` rule in index.css is the correct path.
 */

import { render, screen, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import type { TemplateDto } from '@saome/shared/schemas/card';
import { ConfirmAbandonDraftDialog } from './ConfirmAbandonDraftDialog';

const DRAFT = {
  id: 'draft-1',
  name: 'My Draft',
  description: 'desc',
  cardType: 'stamp_card',
  status: 'draft',
  settings: {},
  createdAt: '2026-09-01T00:00:00.000Z',
  updatedAt: '2026-09-07T00:00:00.000Z',
  abandonedAt: null,
} as unknown as TemplateDto;

vi.mock('react-i18next', () => ({
  useTranslation: vi.fn(() => ({
    t: vi.fn((key: string) => key),
  })),
}));

// jsdom doesn't implement <dialog> showModal / close
beforeAll(() => {
  HTMLDialogElement.prototype.showModal = vi.fn();
  HTMLDialogElement.prototype.close = vi.fn();
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe('ConfirmAbandonDraftDialog — Radio Card Pattern A', () => {
  it('renders Resume + Discard radios sharing name=draft-action', () => {
    render(
      <ConfirmAbandonDraftDialog
        draft={DRAFT}
        onResume={vi.fn()}
        onDiscard={vi.fn()}
        onCancel={vi.fn()}
      />,
    );

    const radios = screen.getAllByRole('radio', { hidden: true }) as HTMLInputElement[];
    expect(radios).toHaveLength(2);
    for (const r of radios) {
        expect(r.name).toBe('draft-action');
    }
    const values = radios.map((r) => r.value);
    expect(values).toContain('resume');
    expect(values).toContain('discard');
  });

  it('Resume radio is selected by default', () => {
    render(
      <ConfirmAbandonDraftDialog
        draft={DRAFT}
        onResume={vi.fn()}
        onDiscard={vi.fn()}
        onCancel={vi.fn()}
      />,
    );

    const radios = screen.getAllByRole('radio', { hidden: true }) as HTMLInputElement[];
    const resume = radios.find((r) => r.value === 'resume');
    expect(resume?.checked).toBe(true);
  });

  it('clicking Discard updates the checked radio (and selectedAction)', async () => {
    const user = userEvent.setup();
    render(
      <ConfirmAbandonDraftDialog
        draft={DRAFT}
        onResume={vi.fn()}
        onDiscard={vi.fn()}
        onCancel={vi.fn()}
      />,
    );

    const radios = screen.getAllByRole('radio', { hidden: true }) as HTMLInputElement[];
    const discard = radios.find((r) => r.value === 'discard')!;
    await user.click(discard);

    const all = screen.getAllByRole('radio', { hidden: true }) as HTMLInputElement[];
    expect(all.find((r) => r.value === 'discard')?.checked).toBe(true);
    expect(all.find((r) => r.value === 'resume')?.checked).toBe(false);
  });

  it('Resume label carries radio-card-primary class (CSS :has(:checked) drives primary fill)', () => {
    render(
      <ConfirmAbandonDraftDialog
        draft={DRAFT}
        onResume={vi.fn()}
        onDiscard={vi.fn()}
        onCancel={vi.fn()}
      />,
    );

    const resumeLabel = document.querySelector('label.radio-card-primary') as HTMLElement | null;
    expect(resumeLabel).not.toBeNull();
  });

  it('Discard label carries radio-card-destructive class (CSS :has(:checked) drives destructive fill) — regression for 2026-09-07 red-fill loss', () => {
    render(
      <ConfirmAbandonDraftDialog
        draft={DRAFT}
        onResume={vi.fn()}
        onDiscard={vi.fn()}
        onCancel={vi.fn()}
      />,
    );

    const discardLabel = document.querySelector('label.radio-card-destructive') as HTMLElement | null;
    expect(discardLabel).not.toBeNull();
  });

  it('label containers do NOT use inline style for selection visuals (single source of truth lives in index.css)', () => {
    render(
      <ConfirmAbandonDraftDialog
        draft={DRAFT}
        onResume={vi.fn()}
        onDiscard={vi.fn()}
        onCancel={vi.fn()}
      />,
    );

    for (const sel of ['.radio-card-primary', '.radio-card-destructive']) {
      const lbl = document.querySelector(`label${sel}`) as HTMLElement | null;
      expect(lbl).not.toBeNull();
      const inline = lbl!.getAttribute('style') || '';
      expect(inline).not.toMatch(/borderColor/);
      expect(inline).not.toMatch(/backgroundColor/);
      expect(inline).not.toMatch(/boxShadow/);
    }
  });

  it('indicator spans carry radio-card-fill class (CSS selector flips fill on :has(:checked))', () => {
    render(
      <ConfirmAbandonDraftDialog
        draft={DRAFT}
        onResume={vi.fn()}
        onDiscard={vi.fn()}
        onCancel={vi.fn()}
      />,
    );

    const fillSpans = document.querySelectorAll('div.radio-card-fill');
    expect(fillSpans.length).toBe(2);

    for (const span of Array.from(fillSpans)) {
      const inline = (span as HTMLElement).getAttribute('style') || '';
      expect(inline).not.toMatch(/borderColor/);
      expect(inline).not.toMatch(/backgroundColor/);
    }
  });

  it('regression — no inline `style={{ borderColor: var(--color-destructive) }}` on Discard (2026-09-07 red-fill loss root cause)', () => {
    render(
      <ConfirmAbandonDraftDialog
        draft={DRAFT}
        onResume={vi.fn()}
        onDiscard={vi.fn()}
        onCancel={vi.fn()}
      />,
    );

    // Walk every element; the previous version had inline style with
    // borderColor/backgroundColor on the discard label & indicator div.
    // After the refactor those visuals are driven by `.radio-card-destructive:has(:checked)`.
    const all = document.querySelectorAll('*');
    for (const el of Array.from(all)) {
      const inline = (el as HTMLElement).getAttribute?.('style') || '';
      expect(inline).not.toMatch(/var\(--color-destructive\)/);
      expect(inline).not.toMatch(/var\(--color-primary\)/);
    }
  });

  it('regression — Discard indicator span does NOT carry bare has-[:checked] Tailwind variant (would not emit because --color-destructive is outside @theme {})', () => {
    render(
      <ConfirmAbandonDraftDialog
        draft={DRAFT}
        onResume={vi.fn()}
        onDiscard={vi.fn()}
        onCancel={vi.fn()}
      />,
    );

    const fillSpans = document.querySelectorAll('div.radio-card-fill');
    for (const span of Array.from(fillSpans)) {
      const cls = (span as HTMLElement).className;
      const tokens = cls
        .split(/\s+/)
        .filter((t) => t.includes('has-[:checked]') || t.includes('has(:checked)'));
      expect(tokens).toEqual([]);
    }
  });

  it('Confirm button calls onResume when Resume is selected (default)', async () => {
    const onResume = vi.fn();
    const onDiscard = vi.fn();
    const user = userEvent.setup();
    render(
      <ConfirmAbandonDraftDialog
        draft={DRAFT}
        onResume={onResume}
        onDiscard={onDiscard}
        onCancel={vi.fn()}
      />,
    );

    const buttons = document.querySelectorAll('button');
    const confirmButton = Array.from(buttons).find(
      (b) => b.textContent === 'confirm' || b.textContent?.includes('confirm'),
    );
    expect(confirmButton).toBeDefined();
    await user.click(confirmButton as HTMLButtonElement);

    expect(onResume).toHaveBeenCalledWith(DRAFT);
    expect(onDiscard).not.toHaveBeenCalled();
  });

  it('Confirm button calls onDiscard when Discard is selected', async () => {
    const onResume = vi.fn();
    const onDiscard = vi.fn();
    const user = userEvent.setup();
    render(
      <ConfirmAbandonDraftDialog
        draft={DRAFT}
        onResume={onResume}
        onDiscard={onDiscard}
        onCancel={vi.fn()}
      />,
    );

    const radios = screen.getAllByRole('radio', { hidden: true }) as HTMLInputElement[];
    await user.click(radios.find((r) => r.value === 'discard')!);

    const buttons = document.querySelectorAll('button');
    const confirmButton = Array.from(buttons).find(
      (b) => b.textContent === 'confirm' || b.textContent?.includes('confirm'),
    );
    expect(confirmButton).toBeDefined();
    await user.click(confirmButton as HTMLButtonElement);

    expect(onDiscard).toHaveBeenCalledWith(DRAFT);
    expect(onResume).not.toHaveBeenCalled();
  });

  it('Cancel button calls onCancel', async () => {
    const onCancel = vi.fn();
    const user = userEvent.setup();
    render(
      <ConfirmAbandonDraftDialog
        draft={DRAFT}
        onResume={vi.fn()}
        onDiscard={vi.fn()}
        onCancel={onCancel}
      />,
    );

    // The buttons live inside <dialog>; jsdom may not expose them via
    // getByRole depending on dialog open state. Query directly as fallback.
    const buttons = document.querySelectorAll('button');
    const cancelButton = Array.from(buttons).find(
      (b) => b.textContent === 'cancel' || b.textContent?.includes('cancel'),
    );
    expect(cancelButton).toBeDefined();
    await user.click(cancelButton as HTMLButtonElement);

    expect(onCancel).toHaveBeenCalled();
  });
});