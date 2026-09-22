import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { I18nextProvider } from 'react-i18next';
import i18n from '@/test/i18n';
import { AuthProvider } from '@/hooks/useAuth';
import { PlanSelector } from './PlanSelector';
import type { PricingTier } from '@/components/pricing';

function renderPlanSelector(selectedPlan: PricingTier | null = null, onSelect = vi.fn()) {
  return render(
    <I18nextProvider i18n={i18n}>
      <MemoryRouter>
        <AuthProvider>
          <PlanSelector selectedPlan={selectedPlan} onSelect={onSelect} />
        </AuthProvider>
      </MemoryRouter>
    </I18nextProvider>,
  );
}

describe('PlanSelector', () => {
  const mockOnSelect = vi.fn();

  beforeEach(() => {
    mockOnSelect.mockClear();
  });

  it('renders all three plan options', () => {
    renderPlanSelector(null, mockOnSelect);

    expect(screen.getByText('Green')).toBeInTheDocument();
    expect(screen.getByText('Gold')).toBeInTheDocument();
    expect(screen.getByText('Platinum')).toBeInTheDocument();
  });

  it('renders plan prices', () => {
    renderPlanSelector(null, mockOnSelect);

    expect(screen.getByText('$900')).toBeInTheDocument();
    expect(screen.getByText('$1500')).toBeInTheDocument();
    expect(screen.getByText('$2500')).toBeInTheDocument();
  });

  it('calls onSelect when a plan is clicked', () => {
    renderPlanSelector(null, mockOnSelect);

    const goldButton = screen.getByRole('button', { name: /gold/i });
    fireEvent.click(goldButton);

    expect(mockOnSelect).toHaveBeenCalledWith('gold');
  });

  it('sets aria-pressed to true for selected plan', () => {
    renderPlanSelector('gold', mockOnSelect);

    const goldButton = screen.getByRole('button', { name: /gold/i });
    expect(goldButton).toHaveAttribute('aria-pressed', 'true');

    const greenButton = screen.getByRole('button', { name: /green/i });
    expect(greenButton).toHaveAttribute('aria-pressed', 'false');
  });

  it('highlights selected plan with primary border', () => {
    renderPlanSelector('platinum', mockOnSelect);

    const platinumButton = screen.getByRole('button', { name: /platinum/i });
    expect(platinumButton).toHaveClass('border-primary');
    expect(platinumButton).toHaveClass('ring-2');
  });
});
