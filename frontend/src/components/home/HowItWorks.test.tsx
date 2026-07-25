import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { HowItWorks } from './HowItWorks';

describe('HowItWorks', () => {
  it('renders section title', () => {
    render(<HowItWorks />);
    expect(screen.getByRole('heading', { level: 2, name: '3 步驟啟動您的忠誠計劃' })).toBeInTheDocument();
  });

  it('renders 3 steps', () => {
    const { container } = render(<HowItWorks />);
    const cards = container.querySelectorAll('.grid > div');
    expect(cards.length).toBe(3);
  });

  describe('each step', () => {
    it('renders step 1: Register and create store', () => {
      render(<HowItWorks />);
      expect(screen.getByRole('heading', { level: 3, name: '註冊並建立店家資料' })).toBeInTheDocument();
      expect(screen.getByText(/填寫基本資訊/)).toBeInTheDocument();
    });

    it('renders step 2: Customize rewards', () => {
      render(<HowItWorks />);
      expect(screen.getByRole('heading', { level: 3, name: '自訂會員獎勵規則' })).toBeInTheDocument();
      expect(screen.getByText(/定義點數計算方式/)).toBeInTheDocument();
    });

    it('renders step 3: Members start collecting points', () => {
      render(<HowItWorks />);
      expect(screen.getByRole('heading', { level: 3, name: '會員立即開始集點' })).toBeInTheDocument();
      expect(screen.getByText(/會員透過 QR Code/)).toBeInTheDocument();
    });
  });

  it('renders step icons', () => {
    const { container } = render(<HowItWorks />);
    const icons = container.querySelectorAll('.bg-white.shadow-md');
    expect(icons.length).toBe(3);
  });

  it('renders connecting line between steps (hidden on mobile, visible on desktop)', () => {
    const { container } = render(<HowItWorks />);
    const connectors = container.querySelectorAll('.hidden.lg\\:block');
    expect(connectors.length).toBeGreaterThan(0);
  });
});
