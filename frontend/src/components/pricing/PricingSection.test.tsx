import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { PricingSection } from './PricingSection';

const renderPricing = () =>
  render(
    <MemoryRouter>
      <PricingSection />
    </MemoryRouter>,
  );

describe('PricingSection', () => {
  it('renders section with id="pricing" for anchor navigation', () => {
    const { container } = renderPricing();
    const section = container.querySelector('#pricing');
    expect(section).toBeInTheDocument();
    expect(section?.tagName).toBe('SECTION');
  });

  it('renders section title and subtitle', () => {
    renderPricing();
    expect(screen.getByRole('heading', { level: 2, name: '簡單透明，定價合理' })).toBeInTheDocument();
    expect(screen.getByText('選擇適合您業務規模的方案')).toBeInTheDocument();
  });

  describe('pricing plans', () => {
    it('renders Green tier', () => {
      renderPricing();
      expect(screen.getByText('綠卡')).toBeInTheDocument();
      expect(screen.getByText('$900')).toBeInTheDocument();
      expect(screen.getByText('適合小型店家起步')).toBeInTheDocument();
    });

    it('renders Gold tier with "Most Popular" badge', () => {
      renderPricing();
      expect(screen.getByText('金卡')).toBeInTheDocument();
      expect(screen.getByText('$1500')).toBeInTheDocument();
      expect(screen.getByText('適合成長中的店家')).toBeInTheDocument();
      expect(screen.getByText('Most Popular')).toBeInTheDocument();
    });

    it('renders Platinum tier', () => {
      renderPricing();
      expect(screen.getByText('白金卡')).toBeInTheDocument();
      expect(screen.getByText('$2500')).toBeInTheDocument();
      expect(screen.getByText('適合大型連鎖店家')).toBeInTheDocument();
    });

    it('renders "/月" period label', () => {
      renderPricing();
      const periods = screen.getAllByText('/月');
      expect(periods.length).toBe(3);
    });
  });

  describe('CTA buttons', () => {
    it('renders 3 CTA buttons linking to register', () => {
      renderPricing();
      const ctas = screen.getAllByRole('link', { name: '開始免費試用' });
      expect(ctas.length).toBe(3);
      ctas.forEach((cta) => {
        expect(cta).toHaveAttribute('href', '/register');
      });
    });
  });
});
