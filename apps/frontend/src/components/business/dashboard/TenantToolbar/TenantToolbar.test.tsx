import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { TenantToolbar } from './TenantToolbar';
import { TenantToolbarItem } from './TenantToolbarItem';
import { BarChart3 } from 'lucide-react';
import { useCardBuilderStore } from '../CardBuilderEditor/CardBuilderEditor.store';

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
        'tenantToolbar.openMenu': 'Open menu',
        'tenantToolbar.closeMenu': 'Close menu',
        'tenantToolbar.menuTitle': 'Menu',
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
  beforeEach(() => {
    // Reset the CardBuilder store step between tests so each test sees a
    // fresh baseline (Round 3 Fix 5 — affects hamburger position).
    useCardBuilderStore.setState({ cardBuilderStep: null });
  });

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

  // ───────────────────────────────────────────────────────────────────────
  // Round 3 Fix 5 — mobile hamburger position is pushed up when on Step 7
  //
  // The Step7 bottom toolbar (`Step7MobileToolbar`) is ~60px tall and sits
  // at `inset-x-0 bottom-0`. The default hamburger position (`bottom-6`
  // = 24px from bottom) gets covered. When the store flag `cardBuilderStep
  // === 7`, the hamburger must lift to `bottom-20` (80px = 60px toolbar
  // + 20px gap) so the user can still tap it. Other steps keep the
  // original position so other tenants of this toolbar are unaffected.
  // ───────────────────────────────────────────────────────────────────────
  describe('Round 3 Fix 5 — mobile hamburger position', () => {
    it('cardBuilderStep === null → hamburger uses bottom-6 (default)', () => {
      useCardBuilderStore.setState({ cardBuilderStep: null });
      renderWithRouter();
      const hamburger = screen.getByRole('button', { name: 'Open menu' });
      expect(hamburger.className).toMatch(/bottom-6/);
      expect(hamburger.className).not.toMatch(/bottom-20/);
      // Sanity-check the data attribute used by tests for step-aware logic.
      expect(hamburger.getAttribute('data-card-builder-step')).toBe('none');
    });

    it('cardBuilderStep === 7 → hamburger lifts to bottom-20', () => {
      useCardBuilderStore.setState({ cardBuilderStep: 7 });
      renderWithRouter();
      const hamburger = screen.getByRole('button', { name: 'Open menu' });
      expect(hamburger.className).toMatch(/bottom-20/);
      expect(hamburger.className).not.toMatch(/\bbottom-6\b/);
      expect(hamburger.getAttribute('data-card-builder-step')).toBe('7');
    });

    it('cardBuilderStep === 5 (other step) → hamburger stays at bottom-6', () => {
      useCardBuilderStore.setState({ cardBuilderStep: 5 });
      renderWithRouter();
      const hamburger = screen.getByRole('button', { name: 'Open menu' });
      expect(hamburger.className).toMatch(/bottom-6/);
      expect(hamburger.className).not.toMatch(/bottom-20/);
      expect(hamburger.getAttribute('data-card-builder-step')).toBe('5');
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
