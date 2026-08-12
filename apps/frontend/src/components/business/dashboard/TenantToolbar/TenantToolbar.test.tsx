import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { TenantToolbar } from './TenantToolbar';
import { TenantToolbarItem } from './TenantToolbarItem';
import { BarChart3 } from 'lucide-react';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => {
      const translations: Record<string, string> = {
        'tenantToolbar.charts': 'Charts',
        'tenantToolbar.cardEditor': 'Card Editor',
        'tenantToolbar.members': 'Members',
        'tenantToolbar.email': 'Email',
        'tenantToolbar.billing': 'Billing',
        'tenantToolbar.settings': 'Settings',
        'tenantToolbar.expandTooltip': 'Expand toolbar',
        'tenantToolbar.collapseTooltip': 'Collapse toolbar',
      };
      return translations[key] ?? key;
    },
  }),
}));

describe('TenantToolbar', () => {
  it('renders 7 buttons when expanded (6 tools + collapse)', () => {
    render(<TenantToolbar />);
    // When expanded: 6 tool buttons + 1 collapse button = 7
    expect(screen.getAllByRole('button')).toHaveLength(7);
  });

  it('renders tool icons and labels', () => {
    render(<TenantToolbar />);
    // Filter out expand and collapse buttons to get tool buttons
    const toolButtons = screen.getAllByRole('button').filter((btn) =>
      btn.getAttribute('aria-label') !== 'Expand toolbar' && btn.getAttribute('aria-label') !== 'Collapse toolbar'
    );
    expect(toolButtons[0]).toHaveAttribute('aria-label', 'Charts');
  });

  it('toggles active state on click', () => {
    render(<TenantToolbar />);
    const toolButtons = screen.getAllByRole('button').filter((btn) =>
      btn.getAttribute('aria-label') !== 'Expand toolbar' && btn.getAttribute('aria-label') !== 'Collapse toolbar'
    );
    const firstButton = toolButtons[0];
    expect(firstButton).not.toHaveAttribute('aria-current', 'page');
    fireEvent.click(firstButton);
    expect(firstButton).toHaveAttribute('aria-current', 'page');
  });

  it('has collapse toggle button when expanded', () => {
    render(<TenantToolbar />);
    expect(screen.getByRole('button', { name: 'Collapse toolbar' })).toBeInTheDocument();
  });
});

describe('TenantToolbarItem', () => {
  it('renders with correct props', () => {
    const mockOnClick = vi.fn();
    render(
      <TenantToolbarItem
        id="test-tool"
        i18nKey="tenantToolbar.charts"
        icon={BarChart3}
        isActive={false}
        onClick={mockOnClick}
      />
    );
    expect(screen.getByRole('button', { name: 'Charts' })).toBeInTheDocument();
  });

  it('calls onClick when clicked', () => {
    const mockOnClick = vi.fn();
    render(
      <TenantToolbarItem
        id="test-tool"
        i18nKey="tenantToolbar.charts"
        icon={BarChart3}
        onClick={mockOnClick}
      />
    );
    fireEvent.click(screen.getByRole('button'));
    expect(mockOnClick).toHaveBeenCalledOnce();
  });
});
