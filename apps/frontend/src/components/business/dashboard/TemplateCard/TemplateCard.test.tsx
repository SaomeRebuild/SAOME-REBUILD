import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { TemplateCard } from './TemplateCard';
import type { TemplateSettings } from './TemplateCard.types';
import '@/test/i18n'; // Initializes real react-i18next + i18n resources

vi.mock('@/services/authStore', () => ({
  getAccessToken: () => null,
}));

vi.mock('@/assets/icons/stamps/manifest', () => ({
  getStampIcon: vi.fn(() => ({
    stampedUrl: '',
    unstampedUrl: '',
  })),
}));

const mockOnEdit = vi.fn();
const mockOnSend = vi.fn();
const mockOnDelete = vi.fn();

const defaultSettings: Partial<TemplateSettings> = {
  cardType: 'stamp_card',
  logoText: 'My Template',
  issuerName: 'Test Issuer',
  barcodeType: 'qr_code',
  stampGridRows: 1,
  stampIconId: '',
};

const defaultProps = {
  id: 'template-1',
  name: 'My Template',
  settings: defaultSettings as TemplateSettings,
  onEdit: mockOnEdit,
  onSend: mockOnSend,
  onDelete: mockOnDelete,
};

describe('TemplateCard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders card name (via TemplateCardPreview strip fallback)', () => {
    render(<TemplateCard {...defaultProps} />);
    // For stamp_card with empty stampIconId, the preview falls back to the
    // CreditCard + name hero. The name comes from settings.logoText
    // (overriding the legacy `name` prop).
    //
    // 2026-10-05 — The card name now also appears in the header (mirrors
    // CardBuilder's PassCardPreviewHeader which renders `name` next to the
    // issuer logo). The test previously expected a single match; the new
    // behavior renders the name in TWO places (header + strip fallback),
    // so we use `getAllByText` to accept both occurrences.
    expect(screen.getAllByText('My Template').length).toBeGreaterThan(0);
  });

  it('always shows all three action buttons without hover', () => {
    render(<TemplateCard {...defaultProps} />);
    // Real i18n translates templateCard.{edit,send,delete} → 重新編輯 / 發送卡片 / 刪除卡片.
    expect(screen.getAllByRole('button', { name: '重新編輯' })).toHaveLength(1);
    expect(screen.getAllByRole('button', { name: '發送卡片' })).toHaveLength(1);
    expect(screen.getAllByRole('button', { name: '刪除卡片' })).toHaveLength(1);
  });

  it('calls onEdit with id when Edit button is clicked', async () => {
    render(<TemplateCard {...defaultProps} />);
    await userEvent.click(screen.getByRole('button', { name: '重新編輯' }));
    expect(mockOnEdit).toHaveBeenCalledWith('template-1');
  });

  it('calls onSend with id when Send button is clicked', async () => {
    render(<TemplateCard {...defaultProps} />);
    await userEvent.click(screen.getByRole('button', { name: '發送卡片' }));
    expect(mockOnSend).toHaveBeenCalledWith('template-1');
  });

  it('calls onDelete with id when Delete button is clicked', async () => {
    render(<TemplateCard {...defaultProps} />);
    await userEvent.click(screen.getByRole('button', { name: '刪除卡片' }));
    expect(mockOnDelete).toHaveBeenCalledWith('template-1');
  });

  /**
   * 2026-10-04 PR — Deleting state.
   * When isDeleting=true, the card's delete button is disabled and
   * shows a "deleting" label. Edit + Send are also disabled so the
   * user cannot navigate away mid-delete.
   */
  it('renders deleting state when isDeleting=true', () => {
    render(<TemplateCard {...defaultProps} isDeleting />);
    // Real i18n translates templateCard.deleting → 刪除中... in zh-TW.
    const deleteBtn = screen.getByTestId('template-card-delete-template-1');
    expect(deleteBtn).toBeDisabled();
    expect(deleteBtn).toHaveTextContent('刪除中...');
    // Edit + Send should also be disabled during the delete
    expect(screen.getByRole('button', { name: '重新編輯' })).toBeDisabled();
    expect(screen.getByRole('button', { name: '發送卡片' })).toBeDisabled();
  });

  it('does not render deleting state when isDeleting=false (default)', () => {
    render(<TemplateCard {...defaultProps} />);
    const deleteBtn = screen.getByTestId('template-card-delete-template-1');
    expect(deleteBtn).not.toBeDisabled();
    expect(deleteBtn).toHaveTextContent('刪除卡片');
  });
});