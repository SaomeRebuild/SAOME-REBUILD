import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { TenantToolbar } from './TenantToolbar';
import { TenantToolbarItem } from './TenantToolbarItem';
import { BarChart3 } from 'lucide-react';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => {
      const translations: Record<string, string> = {
        'tenantToolbar.charts': 'Charts',
        'tenantToolbar.cardBuilder': 'Card Builder',
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

function renderWithRouter(initialPath = '/app/dashboard') {
  return render(
    <MemoryRouter initialEntries={[initialPath]}>
      <TenantToolbar />
    </MemoryRouter>
  );
}

describe('TenantToolbar', () => {
  it('renders collapse button when expanded', () => {
    renderWithRouter();
    expect(screen.getByRole('button', { name: 'Collapse toolbar' })).toBeInTheDocument();
  });

  it('renders all 6 tool links', () => {
    renderWithRouter();
    const links = screen.getAllByRole('link');
    expect(links).toHaveLength(6);
  });

  it('renders tool icons and labels', () => {
    renderWithRouter();
    expect(screen.getByRole('link', { name: /Charts/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Members/i })).toBeInTheDocument();
  });

  it('sets aria-current on active tool based on URL', () => {
    renderWithRouter('/app/dashboard/charts');
    expect(screen.getByRole('link', { name: /Charts/i })).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('link', { name: /Members/i })).not.toHaveAttribute('aria-current');
  });

  it('renders collapse button that toggles to expand', async () => {
    renderWithRouter();
    const collapseBtn = screen.getByRole('button', { name: 'Collapse toolbar' });
    collapseBtn.click();
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Expand toolbar' })).toBeInTheDocument();
    });
  });
});

describe('TenantToolbarItem', () => {
  it('renders as link when href is provided', () => {
    render(
      <MemoryRouter>
        <TenantToolbarItem
          id="test-tool"
          i18nKey="tenantToolbar.charts"
          icon={BarChart3}
          isActive={false}
          href="/app/dashboard/charts"
        />
      </MemoryRouter>
    );
    expect(screen.getByRole('link', { name: 'Charts' })).toBeInTheDocument();
  });

  it('renders as button when href is not provided', () => {
    render(
      <MemoryRouter>
        <TenantToolbarItem
          id="test-tool"
          i18nKey="tenantToolbar.charts"
          icon={BarChart3}
          isActive={false}
          onClick={vi.fn()}
        />
      </MemoryRouter>
    );
    expect(screen.getByRole('button', { name: 'Charts' })).toBeInTheDocument();
  });

  it('applies active styling when isActive is true', () => {
    render(
      <MemoryRouter>
        <TenantToolbarItem
          id="test-tool"
          i18nKey="tenantToolbar.charts"
          icon={BarChart3}
          isActive={true}
          href="/app/dashboard/charts"
        />
      </MemoryRouter>
    );
    expect(screen.getByRole('link', { name: 'Charts' })).toHaveAttribute('aria-current', 'page');
  });

  it('calls onClick when clicked as button', () => {
    const mockOnClick = vi.fn();
    render(
      <MemoryRouter>
        <TenantToolbarItem
          id="test-tool"
          i18nKey="tenantToolbar.charts"
          icon={BarChart3}
          onClick={mockOnClick}
        />
      </MemoryRouter>
    );
    screen.getByRole('button').click();
    expect(mockOnClick).toHaveBeenCalledOnce();
  });
});
