import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { PrivacyPage } from './PrivacyPage';
import { i18n } from '@/test/i18n';

const renderPrivacyPage = () =>
  render(
    <MemoryRouter initialEntries={['/privacy']}>
      <PrivacyPage />
    </MemoryRouter>,
  );

beforeEach(() => {
  document.body.style.overflow = '';
});

afterEach(() => {
  cleanup();
  i18n.changeLanguage('zh-TW');
});

describe('PrivacyPage i18n', () => {
  describe('zh-TW (default)', () => {
    beforeEach(() => {
      i18n.changeLanguage('zh-TW');
    });

    it('renders privacy title in Traditional Chinese', () => {
      renderPrivacyPage();
      expect(screen.getByRole('heading', { level: 1, name: '隱私權政策' })).toBeInTheDocument();
    });

    it('renders all six section headings in zh-TW', () => {
      renderPrivacyPage();
      expect(screen.getByRole('heading', { level: 2, name: /A\./ })).toBeInTheDocument();
      expect(screen.getByRole('heading', { level: 2, name: /B\./ })).toBeInTheDocument();
      expect(screen.getByRole('heading', { level: 2, name: /C\./ })).toBeInTheDocument();
      expect(screen.getByRole('heading', { level: 2, name: /D\./ })).toBeInTheDocument();
      expect(screen.getByRole('heading', { level: 2, name: /E\./ })).toBeInTheDocument();
      expect(screen.getByRole('heading', { level: 2, name: /F\./ })).toBeInTheDocument();
    });

    it('renders controller table with Chinese labels', () => {
      renderPrivacyPage();
      expect(screen.getByText('資料控制者')).toBeInTheDocument();
      expect(screen.getByText('資料保護聯絡人')).toBeInTheDocument();
      expect(screen.getByText('生效日期')).toBeInTheDocument();
    });

    it('renders collection table with Chinese headers and at least one data row', () => {
      renderPrivacyPage();
      expect(screen.getByText('資料類型')).toBeInTheDocument();
      expect(screen.getByText('處理目的')).toBeInTheDocument();
      expect(screen.getByText('法律依據')).toBeInTheDocument();
      expect(screen.getByText('帳戶與聯絡資訊')).toBeInTheDocument();
    });

    it('renders all six Data Subject Rights titles in Chinese', () => {
      renderPrivacyPage();
      expect(screen.getByText('存取權')).toBeInTheDocument();
      expect(screen.getByText('更正權')).toBeInTheDocument();
      expect(screen.getByText('刪除權')).toBeInTheDocument();
      expect(screen.getByText('限制處理權')).toBeInTheDocument();
      expect(screen.getByText('資料可攜權')).toBeInTheDocument();
      expect(screen.getByText('反對權')).toBeInTheDocument();
    });
  });

  describe('en', () => {
    beforeEach(() => {
      i18n.changeLanguage('en');
    });

    it('renders privacy title in English', () => {
      renderPrivacyPage();
      expect(screen.getByRole('heading', { level: 1, name: 'Privacy Policy' })).toBeInTheDocument();
    });

    it('renders controller table with English labels', () => {
      renderPrivacyPage();
      expect(screen.getByText('Data Controller')).toBeInTheDocument();
      expect(screen.getByText('Data Protection Contact')).toBeInTheDocument();
      expect(screen.getByText('Effective Date')).toBeInTheDocument();
    });

    it('renders collection table with English headers and at least one data row', () => {
      renderPrivacyPage();
      expect(screen.getByText('Data Type')).toBeInTheDocument();
      expect(screen.getByText('Purpose')).toBeInTheDocument();
      expect(screen.getByText('Legal Basis')).toBeInTheDocument();
      expect(screen.getByText('Account and contact information')).toBeInTheDocument();
    });

    it('renders all six Data Subject Rights titles in English', () => {
      renderPrivacyPage();
      expect(screen.getByText('Access')).toBeInTheDocument();
      expect(screen.getByText('Rectification')).toBeInTheDocument();
      expect(screen.getByText('Erasure')).toBeInTheDocument();
      expect(screen.getByText('Restriction')).toBeInTheDocument();
      expect(screen.getByText('Data Portability')).toBeInTheDocument();
      expect(screen.getByText('Objection')).toBeInTheDocument();
    });

    it('renders sharing subsection with sub-processors and international transfer text', () => {
      renderPrivacyPage();
      expect(screen.getByText(/Sub-processors.*cloud hosting: Cloudway and DigitalOcean/)).toBeInTheDocument();
      expect(screen.getByText(/International Data Transfers.*DigitalOcean/)).toBeInTheDocument();
    });

    it('does not contain any Chinese characters in DOM (BDD scenario 10)', () => {
      const { container } = renderPrivacyPage();
      const text = container.textContent ?? '';
      const chineseChars = text.match(/[\u4e00-\u9fff]/g);
      expect(chineseChars).toBeNull();
    });
  });
});
