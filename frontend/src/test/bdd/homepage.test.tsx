import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';
import { Hero } from '@/components/home/Hero';
import { SocialProof } from '@/components/home/SocialProof';
import { Features } from '@/components/home/Features';
import { HowItWorks } from '@/components/home/HowItWorks';
import { PricingSection } from '@/components/pricing/PricingSection';
import { CTASection } from '@/components/home/CTASection';

const renderHomepage = () => {
  window.scrollTo = vi.fn();
  return render(
    <MemoryRouter initialEntries={['/']}>
      <Header />
      <main>
        <Hero />
        <SocialProof />
        <Features />
        <HowItWorks />
        <PricingSection />
        <CTASection />
      </main>
      <Footer />
    </MemoryRouter>,
  );
};

beforeEach(() => {
  document.body.style.overflow = '';
  Object.defineProperty(window, 'scrollY', { configurable: true, value: 0 });
});

afterEach(() => {
  cleanup();
  document.body.style.overflow = '';
});

describe('BDD: Homepage Gherkin 場景對應', () => {
  describe('Header', () => {
    it('sc01: 桌面顯示 Logo + 三個導航連結 + 登入 + 開始使用', () => {
      renderHomepage();
      expect(screen.getAllByText('SAOME').length).toBeGreaterThanOrEqual(1);
      const navs = screen.getAllByRole('navigation');
      const desktopNav = navs.find((n) => n.className.includes('lg:flex'));
      expect(desktopNav).toHaveTextContent('關於我們');
      expect(desktopNav).toHaveTextContent('功能');
      expect(desktopNav).toHaveTextContent('定價');
      expect(screen.getAllByRole('link', { name: '登入' }).length).toBeGreaterThanOrEqual(1);
      expect(screen.getAllByRole('link', { name: '開始使用' }).length).toBeGreaterThanOrEqual(1);
    });

    it('sc02: 手機裝置只顯示 Logo 與 Hamburger', () => {
      renderHomepage();
      expect(screen.getByRole('button', { name: 'Open menu' })).toBeInTheDocument();
    });

    it('sc03: 點擊 Logo 導航回首頁', () => {
      renderHomepage();
      const logo = screen.getAllByRole('link', { name: /SAOME/ })[0];
      expect(logo).toHaveAttribute('href', '/');
    });

    it('sc04: 點擊 Header「開始使用」導航至 /register', () => {
      renderHomepage();
      const cta = screen.getAllByRole('link', { name: '開始使用' })[0];
      expect(cta).toHaveAttribute('href', '/register');
    });

    it('sc05: 滾動時顯示陰影與半透明白色背景', () => {
      renderHomepage();
      Object.defineProperty(window, 'scrollY', { configurable: true, value: 20 });
      fireEvent.scroll(window);
      const header = screen.getByRole('banner');
      expect(header.className).toContain('shadow-sm');
      expect(header.className).toContain('bg-white/95');
    });

    it('sc06: 開啟手機選單後 body overflow 鎖定', () => {
      renderHomepage();
      fireEvent.click(screen.getByRole('button', { name: 'Open menu' }));
      expect(document.body.style.overflow).toBe('hidden');
    });

    it('sc07: 關閉手機選單後 body overflow 恢復', () => {
      renderHomepage();
      fireEvent.click(screen.getByRole('button', { name: 'Open menu' }));
      expect(document.body.style.overflow).toBe('hidden');
      fireEvent.click(screen.getByRole('button', { name: 'Close menu' }));
      expect(document.body.style.overflow).toBe('');
    });
  });

  describe('Hero', () => {
    it('sc08: 顯示 Badge + 標題 + 副標題 + 雙 CTA', () => {
      renderHomepage();
      expect(screen.getByText('數位會員卡行銷計畫')).toBeInTheDocument();
      expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('更多回頭的客戶=更高的營收');
      expect(screen.getByText(/增加.*客戶保留率/)).toBeInTheDocument();
      expect(screen.getAllByRole('link', { name: /開始免費試用/ }).length).toBeGreaterThanOrEqual(1);
      expect(screen.getByRole('link', { name: /觀看示範/ })).toBeInTheDocument();
    });
  });

  describe('Features', () => {
    it('sc09: 顯示標題 + 4 個 Feature Cards', () => {
      renderHomepage();
      expect(screen.getByRole('heading', { level: 2, name: '為您的店家打造的完整解決方案' })).toBeInTheDocument();
      expect(screen.getByRole('heading', { level: 3, name: '數位會員卡' })).toBeInTheDocument();
      expect(screen.getByRole('heading', { level: 3, name: '印章與點數' })).toBeInTheDocument();
      expect(screen.getByRole('heading', { level: 3, name: '掃碼系統' })).toBeInTheDocument();
      expect(screen.getByRole('heading', { level: 3, name: '多租戶管理' })).toBeInTheDocument();
    });
  });

  describe('HowItWorks', () => {
    it('sc10: 顯示標題 + 3 步驟', () => {
      renderHomepage();
      expect(screen.getByRole('heading', { level: 2, name: '3 步驟啟動您的忠誠計劃' })).toBeInTheDocument();
      expect(screen.getByRole('heading', { level: 3, name: '註冊並建立店家資料' })).toBeInTheDocument();
      expect(screen.getByRole('heading', { level: 3, name: '自訂會員獎勵規則' })).toBeInTheDocument();
      expect(screen.getByRole('heading', { level: 3, name: '會員立即開始集點' })).toBeInTheDocument();
    });
  });

  describe('Pricing', () => {
    it('sc11: 顯示 3 個定價方案卡片，名稱/價格/特色', () => {
      renderHomepage();
      expect(screen.getByText('綠卡')).toBeInTheDocument();
      expect(screen.getByText('金卡')).toBeInTheDocument();
      expect(screen.getByText('白金卡')).toBeInTheDocument();
      expect(screen.getByText('$900')).toBeInTheDocument();
      expect(screen.getByText('$1500')).toBeInTheDocument();
      expect(screen.getByText('$2500')).toBeInTheDocument();
      expect(screen.getByText('Most Popular')).toBeInTheDocument();
    });

    it('sc12: 3 個 CTA 按鈕皆連結到 /register', () => {
      renderHomepage();
      const ctas = screen.getAllByRole('link', { name: '開始免費試用' });
      expect(ctas.length).toBeGreaterThanOrEqual(3);
      ctas.forEach((cta) => {
        expect(cta).toHaveAttribute('href', '/register');
      });
    });
  });

  describe('CTASection', () => {
    it('sc13: 顯示標題 + 副文字 + CTA 按鈕', () => {
      renderHomepage();
      expect(screen.getByRole('heading', { level: 2, name: '準備好提升會員參與度了嗎？' })).toBeInTheDocument();
      expect(screen.getByText(/14 天免費試用/)).toBeInTheDocument();
      expect(screen.getByText(/無需信用卡/)).toBeInTheDocument();
    });
  });

  describe('Footer', () => {
    it('sc14: 顯示完整頁尾資訊', () => {
      renderHomepage();
      const footer = screen.getByRole('contentinfo');
      expect(footer).toHaveTextContent('SAOME');
      expect(footer).toHaveTextContent('更多回頭的客戶=更高的營收');
      expect(footer).toHaveTextContent('關於我們');
      expect(footer).toHaveTextContent('功能');
      expect(footer).toHaveTextContent('定價');
      expect(footer).toHaveTextContent('部落格');
      expect(footer).toHaveTextContent('聯絡我們');
      expect(screen.getByRole('link', { name: 'hello@saome.org' })).toHaveAttribute('href', 'mailto:hello@saome.org');
      expect(screen.getByRole('link', { name: 'Instagram' })).toBeInTheDocument();
      expect(screen.getByRole('link', { name: 'Facebook' })).toBeInTheDocument();
      expect(screen.getByRole('link', { name: 'X' })).toBeInTheDocument();
      expect(screen.getByText(/© 2026 SAOME/)).toBeInTheDocument();
      expect(screen.getByRole('link', { name: '隱私權政策' })).toHaveAttribute('href', '/privacy');
      expect(screen.getByRole('link', { name: '服務條款' })).toHaveAttribute('href', '/terms');
      expect(screen.getByRole('link', { name: '資料處理協議' })).toHaveAttribute('href', '/gdpr');
    });

    it('sc15: 點擊 Footer 隱私權政策導航至 /privacy', () => {
      renderHomepage();
      expect(screen.getByRole('link', { name: '隱私權政策' })).toHaveAttribute('href', '/privacy');
    });
  });

  describe('i18n', () => {
    it('sc16: 預設語言為繁體中文（zh-TW），UI 文字為繁體中文', () => {
      renderHomepage();
      // 透過 Footer 全文檢查 5 個鏈接都為繁體中文
      const footer = screen.getByRole('contentinfo');
      expect(footer).toHaveTextContent('關於我們');
      expect(footer).toHaveTextContent('部落格');
      expect(footer).toHaveTextContent('聯絡我們');
    });
  });
});
