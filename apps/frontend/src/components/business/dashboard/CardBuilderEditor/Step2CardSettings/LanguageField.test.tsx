/**
 * LanguageField — Vitest + RTL Tests (Rule 003 TDD)
 *
 * Verifies:
 *   - Title renders as a <label> associated with the <select> via htmlFor
 *   - Hint paragraph renders below the field
 *   - Default value is 'en' (English option is selected)
 *   - Selecting 'zh-TW' updates store.language to 'zh-TW'
 *   - Selecting 'en' reverts store.language to 'en'
 *   - UI pattern matches Step 3 FieldSelect:
 *       * appearance-none + pr-9 so chevron icon has space
 *       * ChevronDown icon rendered in relative wrapper
 *       * inline style.colorScheme === 'light' (forces OS dropdown to light theme)
 *       * inline style.color === '#000000' on each <option> (defense-in-depth)
 *       * rounded-md (not bare rounded) so corners align with other fields
 *
 * 2026-09-18 Step 2: added for Passcreator future integration.
 * 2026-09-18 polish-2: aligned dropdown UI with Step 3 FieldSelect pattern
 * (appearance-none + chevron icon + inline colorScheme: 'light' + black options)
 * to fix invisible unselected dropdown text on dark-themed pages.
 */

import { render, screen, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { LanguageField } from './LanguageField';
import { useCardBuilderStore } from '../CardBuilderEditor.store';

vi.mock('react-i18next', () => ({
  useTranslation: vi.fn(() => ({
    t: vi.fn((key: string) => key),
  })),
}));

afterEach(() => {
  useCardBuilderStore.getState().reset();
  cleanup();
});

describe('LanguageField (Step 2)', () => {
  it('renders title as a <label> associated with the select via htmlFor', () => {
    render(<LanguageField />);
    const titleText = screen.getByText('step2.language.title');
    expect(titleText.tagName).toBe('LABEL');
    expect(titleText.getAttribute('for')).toBe('cardLanguage');

    const select = screen.getByRole('combobox');
    expect(select.getAttribute('id')).toBe('cardLanguage');
  });

  it('renders the hint paragraph below the select', () => {
    render(<LanguageField />);
    const hint = screen.getByText('step2.language.hint');
    expect(hint.tagName).toBe('P');
  });

  it('defaults to English selected', () => {
    render(<LanguageField />);
    const select = screen.getByRole('combobox') as HTMLSelectElement;
    expect(select.value).toBe('en');
  });

  it('selecting zh-TW updates store.language', async () => {
    const user = userEvent.setup();
    render(<LanguageField />);
    const select = screen.getByRole('combobox');

    await user.selectOptions(select, 'zh-TW');

    expect(useCardBuilderStore.getState().language).toBe('zh-TW');
  });

  it('selecting en reverts store.language back to en', async () => {
    const user = userEvent.setup();
    useCardBuilderStore.setState({ language: 'zh-TW' });
    render(<LanguageField />);
    const select = screen.getByRole('combobox');

    await user.selectOptions(select, 'en');

    expect(useCardBuilderStore.getState().language).toBe('en');
  });

  it('reflects pre-existing store value in the select', () => {
    useCardBuilderStore.setState({ language: 'zh-TW' });
    render(<LanguageField />);
    const select = screen.getByRole('combobox') as HTMLSelectElement;
    expect(select.value).toBe('zh-TW');
  });

  // ===== FieldSelect-style UI alignment =====

  it('uses appearance-none so chevron icon can replace native arrow', () => {
    render(<LanguageField />);
    const select = screen.getByRole('combobox');
    expect(select.className).toContain('appearance-none');
  });

  it('uses pr-9 to leave room for the chevron icon', () => {
    render(<LanguageField />);
    const select = screen.getByRole('combobox');
    expect(select.className).toContain('pr-9');
  });

  it('uses rounded-md so corners align with other fields', () => {
    render(<LanguageField />);
    const select = screen.getByRole('combobox');
    expect(select.className).toContain('rounded-md');
    expect(select.className).not.toMatch(/\brounded\b(?!-)/);
  });

  it('renders text-foreground for closed-state text visibility', () => {
    render(<LanguageField />);
    const select = screen.getByRole('combobox');
    expect(select.className).toContain('text-foreground');
  });

  it('renders ChevronDown icon (chevron) inside a relative wrapper', () => {
    const { container } = render(<LanguageField />);
    // ChevronDown renders as <svg class="lucide lucide-chevron-down ...">
    const chevron = container.querySelector('svg.lucide-chevron-down');
    expect(chevron).not.toBeNull();
    // Wrapper has relative so the absolute chevron positions correctly
    const wrapper = chevron?.parentElement;
    expect(wrapper?.className).toContain('relative');
  });

  it('forces colorScheme: light via inline style so OS dropdown renders light', () => {
    render(<LanguageField />);
    const select = screen.getByRole('combobox') as HTMLSelectElement;
    expect(select.style.colorScheme).toBe('light');
  });

  it('renders each <option> with inline color #000000 for defense-in-depth', () => {
    const { container } = render(<LanguageField />);
    const options = container.querySelectorAll('option');
    expect(options.length).toBe(2);
    options.forEach((option) => {
      expect((option as HTMLElement).style.color).toBe('rgb(0, 0, 0)');
    });
  });
});
