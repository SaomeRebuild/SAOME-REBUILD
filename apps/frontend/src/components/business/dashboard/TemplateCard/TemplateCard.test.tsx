import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { TemplateCard } from './TemplateCard';

vi.mock('react-i18next', () => {
  return { useTranslation: vi.fn(() => ({ t: vi.fn((key: string) => key) })) };
});

const mockOnEdit = vi.fn();
const mockOnSend = vi.fn();
const mockOnDelete = vi.fn();

const defaultProps = {
  id: 'template-1',
  name: 'My Template',
  onEdit: mockOnEdit,
  onSend: mockOnSend,
  onDelete: mockOnDelete,
};

describe('TemplateCard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders card name', () => {
    render(<TemplateCard {...defaultProps} />);
    expect(screen.getByText('My Template')).toBeInTheDocument();
  });

  it('always shows all three action buttons without hover', () => {
    render(<TemplateCard {...defaultProps} />);
    expect(screen.getAllByRole('button', { name: 'templateCard.edit' })).toHaveLength(1);
    expect(screen.getAllByRole('button', { name: 'templateCard.send' })).toHaveLength(1);
    expect(screen.getAllByRole('button', { name: 'templateCard.delete' })).toHaveLength(1);
  });

  it('calls onEdit with id when Edit button is clicked', async () => {
    render(<TemplateCard {...defaultProps} />);
    await userEvent.click(screen.getByRole('button', { name: 'templateCard.edit' }));
    expect(mockOnEdit).toHaveBeenCalledWith('template-1');
  });

  it('calls onSend with id when Send button is clicked', async () => {
    render(<TemplateCard {...defaultProps} />);
    await userEvent.click(screen.getByRole('button', { name: 'templateCard.send' }));
    expect(mockOnSend).toHaveBeenCalledWith('template-1');
  });

  it('calls onDelete with id when Delete button is clicked', async () => {
    render(<TemplateCard {...defaultProps} />);
    await userEvent.click(screen.getByRole('button', { name: 'templateCard.delete' }));
    expect(mockOnDelete).toHaveBeenCalledWith('template-1');
  });
});
