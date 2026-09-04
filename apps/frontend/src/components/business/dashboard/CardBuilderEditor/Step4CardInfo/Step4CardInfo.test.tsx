/**
 * Step4CardInfo — Vitest + RTL tests
 *
 * Covers the main composition:
 *   1. Renders the three section titles (Description / Back fields / Links)
 *   2. DescriptionField textarea + counter
 *   3. BackFieldsField with default 1 row
 *   4. LinksField with default 0 rows
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { Step4CardInfo } from './Step4CardInfo';
import { useCardBuilderStore } from '../CardBuilderEditor.store';

vi.mock('react-i18next', () => ({
  useTranslation: vi.fn(() => ({ t: vi.fn((key: string) => key) })),
}));

beforeEach(() => {
  cleanup();
  useCardBuilderStore.getState().reset();
});

describe('Step4CardInfo — section composition', () => {
  it('renders all three section titles', () => {
    render(<Step4CardInfo showValidation={false} />);
    expect(screen.getByText('step4.description.title')).toBeInTheDocument();
    expect(screen.getByText('step4.backFields.title')).toBeInTheDocument();
    expect(screen.getByText('step4.links.title')).toBeInTheDocument();
  });

  it('renders all three section hints', () => {
    render(<Step4CardInfo showValidation={false} />);
    expect(screen.getByText('step4.description.hint')).toBeInTheDocument();
    expect(screen.getByText('step4.backFields.hint')).toBeInTheDocument();
    expect(screen.getByText('step4.links.hint')).toBeInTheDocument();
  });
});

describe('Step4CardInfo — DescriptionField', () => {
  it('renders a textarea for the description', () => {
    render(<Step4CardInfo showValidation={false} />);
    const textarea = screen.getByRole('textbox', { name: '' });
    expect(textarea.tagName).toBe('TEXTAREA');
  });

  it('shows the counter with current character count', () => {
    useCardBuilderStore.getState().setDescription('Hello');
    render(<Step4CardInfo showValidation={false} />);
    // vi.mock returns t(key, vars) as the key; assert presence
    expect(screen.getByText('step4.description.counter')).toBeInTheDocument();
  });

  it('shows the destructive border + required error when showValidation && empty', () => {
    render(<Step4CardInfo showValidation={true} />);
    expect(screen.getByText('step4.description.required')).toBeInTheDocument();
  });

  it('does NOT show the required error when showValidation is false (even if empty)', () => {
    render(<Step4CardInfo showValidation={false} />);
    expect(screen.queryByText('step4.description.required')).not.toBeInTheDocument();
  });
});

describe('Step4CardInfo — BackFieldsField', () => {
  it('renders exactly one default backField row on first mount', () => {
    render(<Step4CardInfo showValidation={false} />);
    // Per row (post 2026-09-05 plan 修二): 1 label input + 1 value textarea.
    // The description textarea is a separate element.
    const labelInputs = document.querySelectorAll('input[type="text"]');
    const valueTextareas = document.querySelectorAll('textarea');
    expect(labelInputs.length).toBeGreaterThanOrEqual(1);
    expect(valueTextareas.length).toBeGreaterThanOrEqual(1);
  });

  it('shows the required error when showValidation && backField value empty', () => {
    render(<Step4CardInfo showValidation={true} />);
    // backFields[0].value === '' → should display the required error
    expect(screen.getByText('step4.backFields.required')).toBeInTheDocument();
  });

  it('does NOT show the required error when the backField has a non-empty value', () => {
    useCardBuilderStore.setState({
      backFields: [{ label: '', value: 'something' }],
    });
    render(<Step4CardInfo showValidation={true} />);
    expect(screen.queryByText('step4.backFields.required')).not.toBeInTheDocument();
  });
});

describe('Step4CardInfo — LinksField', () => {
  it('renders an empty-state placeholder when links.length === 0', () => {
    render(<Step4CardInfo showValidation={false} />);
    // When empty, the empty-state placeholder uses the maxReachedKey text
    // (the LabelValueListField uses it as the placeholder when no rows are present).
    expect(screen.getByText('step4.links.maxReached')).toBeInTheDocument();
  });

  it('does NOT show any URL error when links array is empty (links are optional)', () => {
    render(<Step4CardInfo showValidation={true} />);
    expect(screen.queryByText('step4.links.invalidUrl')).not.toBeInTheDocument();
  });

  it('shows the invalidUrl error when a link value is non-empty but unparseable', () => {
    useCardBuilderStore.setState({
      links: [{ label: 'Bad', value: 'not-a-url' }],
    });
    render(<Step4CardInfo showValidation={true} />);
    expect(screen.getByText('step4.links.invalidUrl')).toBeInTheDocument();
  });

  it('does NOT show the invalidUrl error when a link value parses (https)', () => {
    useCardBuilderStore.setState({
      links: [{ label: 'Web', value: 'https://x.com' }],
    });
    render(<Step4CardInfo showValidation={true} />);
    expect(screen.queryByText('step4.links.invalidUrl')).not.toBeInTheDocument();
  });

  it('does NOT show the invalidUrl error for tel: or mailto: schemes', () => {
    useCardBuilderStore.setState({
      links: [
        { label: 'Phone', value: 'tel:+1234567890' },
        { label: 'Email', value: 'mailto:a@b.com' },
      ],
    });
    render(<Step4CardInfo showValidation={true} />);
    expect(screen.queryByText('step4.links.invalidUrl')).not.toBeInTheDocument();
  });

  // 2026-09-05 plan 修一: isValidUrl() gained phone/email fallback for Links.
  // Make sure the new accept-as-is policy does NOT regress on these formats.
  it('does NOT show the invalidUrl error for raw TW phone (0912-345-678)', () => {
    useCardBuilderStore.setState({
      links: [{ label: 'Phone', value: '0912-345-678' }],
    });
    render(<Step4CardInfo showValidation={true} />);
    expect(screen.queryByText('step4.links.invalidUrl')).not.toBeInTheDocument();
  });

  it('does NOT show the invalidUrl error for raw ZA phone (082 123 4567)', () => {
    useCardBuilderStore.setState({
      links: [{ label: 'Phone', value: '082 123 4567' }],
    });
    render(<Step4CardInfo showValidation={true} />);
    expect(screen.queryByText('step4.links.invalidUrl')).not.toBeInTheDocument();
  });

  it('does NOT show the invalidUrl error for raw email (name@example.com)', () => {
    useCardBuilderStore.setState({
      links: [{ label: 'Email', value: 'name@example.com' }],
    });
    render(<Step4CardInfo showValidation={true} />);
    expect(screen.queryByText('step4.links.invalidUrl')).not.toBeInTheDocument();
  });
});

describe('Step4CardInfo — back fields multi-line (2026-09-05 plan 修二)', () => {
  it('back field value renders as <textarea> (not <input>)', () => {
    render(<Step4CardInfo showValidation={false} />);
    const textarea = screen.getByPlaceholderText(
      'step4.backFields.valuePlaceholder',
    );
    expect(textarea.tagName).toBe('TEXTAREA');
  });

  it('link value still renders as <input> (not textarea)', () => {
    useCardBuilderStore.setState({
      links: [{ label: 'Web', value: 'https://x.com' }],
    });
    render(<Step4CardInfo showValidation={false} />);
    const input = screen.getByPlaceholderText(
      'step4.links.valuePlaceholder',
    );
    expect(input.tagName).toBe('INPUT');
  });

  it('multi-line back-field value is preserved across store update', () => {
    const multiline = '台北市信義區\n忠孝東路 4 段 1 號\n02-1234-5678';
    useCardBuilderStore.getState().setBackFieldsValue(0, multiline);
    const stored = useCardBuilderStore.getState().backFields[0].value;
    expect(stored).toBe(multiline);
    // newline count preserved
    expect((stored.match(/\n/g) ?? []).length).toBe(2);
  });

  it('back field validation stays non-empty (does NOT apply isValidUrl() check)', () => {
    // A back field with a value that is valid as "non-empty text" but NOT
    // a URL / phone / email must still pass BackFieldsField's validator.
    // Per plan 修一: BackFieldsField deliberately does not use isValidUrl.
    useCardBuilderStore.setState({
      backFields: [{ label: 'Note', value: 'just a note' }],
    });
    render(<Step4CardInfo showValidation={true} />);
    expect(
      screen.queryByText('step4.backFields.required'),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByText('step4.links.invalidUrl'),
    ).not.toBeInTheDocument();
  });
});