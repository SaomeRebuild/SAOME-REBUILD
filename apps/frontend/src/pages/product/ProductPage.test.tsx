import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { ProductPage } from './ProductPage';

const renderProductPage = () => {
  return render(
    <MemoryRouter initialEntries={['/product']}>
      <ProductPage />
    </MemoryRouter>,
  );
};

beforeEach(() => {
  document.body.style.overflow = '';
});

afterEach(() => {
  cleanup();
});

describe('BDD: ProductPage Gherkin 場景對應', () => {
  describe('Hero section', () => {
    it('renders hero section with title and subtitle', () => {
      renderProductPage();
      expect(screen.getByText('產品介紹')).toBeInTheDocument();
      expect(screen.getByText('簡單註冊！毫不費力地為客戶創造卡片')).toBeInTheDocument();
    });
  });

  describe('SectionHeader', () => {
    it('renders section headers', () => {
      renderProductPage();
      expect(screen.getByText('簡單註冊！')).toBeInTheDocument();
      expect(screen.getByText('可以完全客製化的卡片')).toBeInTheDocument();
      expect(screen.getByText('高效互動')).toBeInTheDocument();
    });
  });

  describe('FeatureCard', () => {
    it('renders feature cards with icon, title, description', () => {
      renderProductPage();
      expect(screen.getByText('網頁表單')).toBeInTheDocument();
      expect(screen.getByText('重複檢查')).toBeInTheDocument();
    });
  });

  describe('All sections', () => {
    it('renders all sections', () => {
      renderProductPage();
      expect(screen.getByText('簡單註冊！')).toBeInTheDocument();
      expect(screen.getByText('可以完全客製化的卡片')).toBeInTheDocument();
      expect(screen.getByText('高效互動')).toBeInTheDocument();
    });
  });

  describe('CTA buttons', () => {
    it('cta buttons link to /register', () => {
      renderProductPage();
      const registerLinks = screen.getAllByRole('link', { name: /開始免費試用/i });
      expect(registerLinks.length).toBeGreaterThan(0);
      registerLinks.forEach((link) => {
        expect(link).toHaveAttribute('href', '/register');
      });
    });

    it('cta buttons link to /pricing/compare', () => {
      renderProductPage();
      const pricingLink = screen.getByRole('link', { name: /詳細定價/i });
      expect(pricingLink).toHaveAttribute('href', '/pricing/compare');
    });
  });

  describe('i18n', () => {
    it('default language is Traditional Chinese', () => {
      renderProductPage();
      expect(screen.getByText('產品介紹')).toBeInTheDocument();
    });
  });
});
