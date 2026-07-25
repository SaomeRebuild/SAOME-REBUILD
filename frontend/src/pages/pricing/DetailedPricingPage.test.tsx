import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { DetailedPricingPage } from './DetailedPricingPage';

const renderDetailedPricingPage = () => {
  return render(
    <MemoryRouter initialEntries={['/pricing/compare']}>
      <DetailedPricingPage />
    </MemoryRouter>,
  );
};

beforeEach(() => {
  document.body.style.overflow = '';
});

afterEach(() => {
  cleanup();
});

describe('BDD: DetailedPricingPage Gherkin 場景對應', () => {
  describe('Page rendering', () => {
    it('renders page title and subtitle', () => {
      renderDetailedPricingPage();
      expect(screen.getByText('詳細定價')).toBeInTheDocument();
      expect(screen.getByText('比較所有方案的功能')).toBeInTheDocument();
    });
  });

  describe('Pricing toggle', () => {
    it('displays monthly prices by default', () => {
      renderDetailedPricingPage();
      expect(screen.getByText('$900')).toBeInTheDocument();
      expect(screen.getByText('$1500')).toBeInTheDocument();
      expect(screen.getByText('$2500')).toBeInTheDocument();
    });

    it('switches to yearly prices when yearly button clicked', () => {
      renderDetailedPricingPage();
      fireEvent.click(screen.getByText('年繳'));
      expect(screen.getByText('$850')).toBeInTheDocument();
      expect(screen.getByText('$1400')).toBeInTheDocument();
      expect(screen.getByText('$2050')).toBeInTheDocument();
    });

    it('switches back to monthly prices when monthly button clicked', () => {
      renderDetailedPricingPage();
      fireEvent.click(screen.getByText('年繳'));
      fireEvent.click(screen.getByText('月繳'));
      expect(screen.getByText('$900')).toBeInTheDocument();
      expect(screen.getByText('$1500')).toBeInTheDocument();
      expect(screen.getByText('$2500')).toBeInTheDocument();
    });
  });

  describe('Popular badge', () => {
    it('displays Popular badge on Gold plan', () => {
      renderDetailedPricingPage();
      expect(screen.getByText('最受歡迎')).toBeInTheDocument();
    });
  });

  describe('Comparison table', () => {
    it('displays all feature categories', () => {
      renderDetailedPricingPage();
      expect(screen.getByText('卡片功能')).toBeInTheDocument();
      expect(screen.getByText('CRM 與會員管理')).toBeInTheDocument();
      expect(screen.getByText('行銷工具')).toBeInTheDocument();
      expect(screen.getByText('分享功能')).toBeInTheDocument();
      expect(screen.getByText('線下模式')).toBeInTheDocument();
      expect(screen.getByText('支援服務')).toBeInTheDocument();
    });
  });

  describe('CTA buttons', () => {
    it('cta buttons link to /register', () => {
      renderDetailedPricingPage();
      const ctaButtons = screen.getAllByRole('link', { name: '開始免費試用' });
      expect(ctaButtons.length).toBeGreaterThanOrEqual(3);
      ctaButtons.forEach((button) => {
        expect(button).toHaveAttribute('href', '/register');
      });
    });
  });

  describe('i18n', () => {
    it('default language is Traditional Chinese', () => {
      renderDetailedPricingPage();
      expect(screen.getByText('詳細定價')).toBeInTheDocument();
    });
  });
});
