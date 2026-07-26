import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { GDPRPage } from './GDPRPage';
import { i18n } from '@/test/i18n';

const renderGDPRPage = () =>
  render(
    <MemoryRouter initialEntries={['/gdpr']}>
      <GDPRPage />
    </MemoryRouter>,
  );

beforeEach(() => {
  document.body.style.overflow = '';
});

afterEach(() => {
  cleanup();
  i18n.changeLanguage('zh-TW');
});

describe('GDPRPage i18n', () => {
  describe('zh-TW (default)', () => {
    beforeEach(() => {
      i18n.changeLanguage('zh-TW');
    });

    it('renders DPA title and subtitle in Traditional Chinese', () => {
      renderGDPRPage();
      expect(screen.getByRole('heading', { level: 1, name: '資料處理協議 (DPA)' })).toBeInTheDocument();
      expect(screen.getByText('本協議是《主服務協議》（MSA）的附件。')).toBeInTheDocument();
    });

    it('renders all four section headings in zh-TW', () => {
      renderGDPRPage();
      expect(screen.getByRole('heading', { level: 2, name: /A\..*當事方/ })).toBeInTheDocument();
      expect(screen.getByRole('heading', { level: 2, name: /B\..*處理的範圍/ })).toBeInTheDocument();
      expect(screen.getByRole('heading', { level: 2, name: /C\..*處理者的義務/ })).toBeInTheDocument();
      expect(screen.getByRole('heading', { level: 2, name: /D\..*服務終止/ })).toBeInTheDocument();
    });

    it('renders parties table with controller and processor labels', () => {
      renderGDPRPage();
      expect(screen.getByText('資料控制者 (Controller)')).toBeInTheDocument();
      expect(screen.getByText('資料處理者 (Processor)')).toBeInTheDocument();
    });

    it('renders scope table with Chinese headers', () => {
      renderGDPRPage();
      expect(screen.getByText('項目')).toBeInTheDocument();
      expect(screen.getByText('描述')).toBeInTheDocument();
    });

    it('renders C-group obligations titles in Chinese', () => {
      renderGDPRPage();
      expect(screen.getByText('僅依指示處理')).toBeInTheDocument();
      expect(screen.getByText('保密承諾')).toBeInTheDocument();
      expect(screen.getByText('資訊安全措施 (TOMS)')).toBeInTheDocument();
      expect(screen.getByText('分包處理者')).toBeInTheDocument();
      expect(screen.getByText('協助義務')).toBeInTheDocument();
    });
  });

  describe('en', () => {
    beforeEach(() => {
      i18n.changeLanguage('en');
    });

    it('renders DPA title and subtitle in English', () => {
      renderGDPRPage();
      expect(screen.getByRole('heading', { level: 1, name: 'Data Processing Agreement (DPA)' })).toBeInTheDocument();
      expect(screen.getByText('This agreement is an annex to the Master Service Agreement (MSA).')).toBeInTheDocument();
    });

    it('renders all four section headings in English', () => {
      renderGDPRPage();
      expect(screen.getByRole('heading', { level: 2, name: /A\..*Parties/ })).toBeInTheDocument();
      expect(screen.getByRole('heading', { level: 2, name: /B\..*Scope and Details/ })).toBeInTheDocument();
      expect(screen.getByRole('heading', { level: 2, name: /C\..*Processor's Obligations/ })).toBeInTheDocument();
      expect(screen.getByRole('heading', { level: 2, name: /D\..*Service Termination/ })).toBeInTheDocument();
    });

    it('renders parties table with English controller and processor labels', () => {
      renderGDPRPage();
      expect(screen.getByText('Data Controller (Controller)')).toBeInTheDocument();
      expect(screen.getByText('Data Processor (Processor)')).toBeInTheDocument();
    });

    it('renders scope table with English headers', () => {
      renderGDPRPage();
      expect(screen.getByText('Item')).toBeInTheDocument();
      expect(screen.getByText('Description')).toBeInTheDocument();
    });

    it('renders C-group obligations titles in English', () => {
      renderGDPRPage();
      expect(screen.getByText('Process Only Per Instructions')).toBeInTheDocument();
      expect(screen.getByText('Confidentiality')).toBeInTheDocument();
      expect(screen.getByText('Information Security Measures (TOMS)')).toBeInTheDocument();
      expect(screen.getByText('Sub-processors')).toBeInTheDocument();
      expect(screen.getByText('Duty to Assist')).toBeInTheDocument();
    });

    it('does not contain any Chinese characters in DOM (BDD scenario 10)', () => {
      const { container } = renderGDPRPage();
      const text = container.textContent ?? '';
      const chineseChars = text.match(/[\u4e00-\u9fff]/g);
      expect(chineseChars).toBeNull();
    });
  });
});
