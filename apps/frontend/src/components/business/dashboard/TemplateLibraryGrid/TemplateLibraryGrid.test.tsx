import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { TemplateLibraryGrid } from './TemplateLibraryGrid';
import type { TemplateSettings } from './TemplateLibraryGrid.types';
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

const mockTemplates = [
  {
    id: 't1',
    name: 'Template One',
    settings: {
      cardType: 'stamp_card',
      logoText: 'Template One',
      issuerName: 'Issuer 1',
      barcodeType: 'qr_code',
    } as Partial<TemplateSettings> as TemplateSettings,
  },
  {
    id: 't2',
    name: 'Template Two',
    settings: {
      cardType: 'membership_card',
      logoText: 'Template Two',
      issuerName: 'Issuer 2',
      barcodeType: 'qr_code',
    } as Partial<TemplateSettings> as TemplateSettings,
  },
];

describe('TemplateLibraryGrid', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows empty state when no templates', () => {
    render(<TemplateLibraryGrid templates={[]} />);
    // Real i18n translates 'templateLibrary.empty' → '尚無模板，從頭建置開始吧。'
    expect(screen.getByText('尚無模板，從頭建置開始吧。')).toBeInTheDocument();
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
    // Real i18n translates 'templateCard.{edit,send,delete}' → '重新編輯' / '下載桌牌' / '刪除模板'.
    // Verify via the three action buttons per card (6 buttons total for 2 templates).
    const editBtns = screen.getAllByRole('button', { name: '重新編輯' });
    const sendBtns = screen.getAllByRole('button', { name: '下載桌牌' });
    const deleteBtns = screen.getAllByRole('button', { name: '刪除模板' });
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
    const editBtns = screen.getAllByRole('button', { name: '重新編輯' });
    const sendBtns = screen.getAllByRole('button', { name: '下載桌牌' });
    const deleteBtns = screen.getAllByRole('button', { name: '刪除模板' });
    expect(editBtns).toHaveLength(2);
    expect(sendBtns).toHaveLength(2);
    expect(deleteBtns).toHaveLength(2);
  });

  it('passes each template.settings to its TemplateCard (2026-10-04 PR — settings prop)', () => {
    render(
      <TemplateLibraryGrid
        templates={mockTemplates}
        onEdit={mockOnEdit}
        onSend={mockOnSend}
        onDelete={mockOnDelete}
      />
    );
    // 2026-10-06 fix — assert via data-card-type attribute (regression
    // of 2026-10-05 header-right-slot refactor: the card-type pill is
    // only rendered for null/undefined cardType; for stamp_card /
    // membership_card the header renders a balance preview block
    // instead. The `data-card-type` attribute on the preview root is
    // the stable test surface that survives the refactor.
    const previews = screen.getAllByTestId('template-card-preview');
    expect(previews[0]).toHaveAttribute('data-card-type', 'stamp_card');
    expect(previews[1]).toHaveAttribute('data-card-type', 'membership_card');
  });

  /**
   * 2026-10-04 PR — Delete propagation.
   * When a template id is in `deletingIds`, the matching card shows
   * a deleting state (disabled delete button + zh-TW 刪除中... label).
   * Other cards in the same grid remain interactive.
   */
  it('passes deletingIds to TemplateCard (only the matching card shows deleting state)', () => {
    const deletingIds = new Set(['t1']);
    render(
      <TemplateLibraryGrid
        templates={mockTemplates}
        onEdit={mockOnEdit}
        onSend={mockOnSend}
        onDelete={mockOnDelete}
        deletingIds={deletingIds}
      />
    );
    // t1 is deleting → its delete button label = 刪除中...
    const t1DeleteBtn = screen.getByTestId('template-card-delete-t1');
    expect(t1DeleteBtn).toBeDisabled();
    expect(t1DeleteBtn).toHaveTextContent('刪除中...');
    // t2 is NOT deleting → its delete button label = 刪除模板 (default)
    const t2DeleteBtn = screen.getByTestId('template-card-delete-t2');
    expect(t2DeleteBtn).not.toBeDisabled();
    expect(t2DeleteBtn).toHaveTextContent('刪除模板');
  });
});