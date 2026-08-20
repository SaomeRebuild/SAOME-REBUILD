import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { TemplateLibraryGrid } from './TemplateLibraryGrid';

vi.mock('react-i18next', () => {
  return { useTranslation: vi.fn(() => ({ t: vi.fn((key: string) => key) })) };
});

const mockOnEdit = vi.fn();
const mockOnSend = vi.fn();
const mockOnDelete = vi.fn();

const mockTemplates = [
  { id: 't1', name: 'Template One' },
  { id: 't2', name: 'Template Two' },
];

describe('TemplateLibraryGrid', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows empty state when no templates', () => {
    render(<TemplateLibraryGrid templates={[]} />);
    expect(screen.getByText('templateLibrary.empty')).toBeInTheDocument();
  });

  it('renders correct number of template cards', () => {
    render(
      <TemplateLibraryGrid
        templates={mockTemplates}
        onEdit={mockOnEdit}
        onSend={mockOnSend}
        onDelete={mockOnDelete}
      />
    );
    // TemplateCard has no <img> — TemplateCardPreview uses Lucide Barcode SVG.
    // Verify via the three action buttons per card (6 buttons total for 2 templates).
    const editBtns = screen.getAllByRole('button', { name: 'templateCard.edit' });
    const sendBtns = screen.getAllByRole('button', { name: 'templateCard.send' });
    const deleteBtns = screen.getAllByRole('button', { name: 'templateCard.delete' });
    expect(editBtns).toHaveLength(2);
    expect(sendBtns).toHaveLength(2);
    expect(deleteBtns).toHaveLength(2);
  });

  it('renders each card with edit, send, and delete buttons', () => {
    render(
      <TemplateLibraryGrid
        templates={mockTemplates}
        onEdit={mockOnEdit}
        onSend={mockOnSend}
        onDelete={mockOnDelete}
      />
    );
    const editBtns = screen.getAllByRole('button', { name: 'templateCard.edit' });
    const sendBtns = screen.getAllByRole('button', { name: 'templateCard.send' });
    const deleteBtns = screen.getAllByRole('button', { name: 'templateCard.delete' });
    expect(editBtns).toHaveLength(2);
    expect(sendBtns).toHaveLength(2);
    expect(deleteBtns).toHaveLength(2);
  });
});
