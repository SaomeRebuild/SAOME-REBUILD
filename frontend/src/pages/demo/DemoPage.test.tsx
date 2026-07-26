import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { DemoPage } from './DemoPage';

const renderDemoPage = () => {
  return render(
    <MemoryRouter initialEntries={['/demo']}>
      <DemoPage />
    </MemoryRouter>,
  );
};

beforeEach(() => {
  document.body.style.overflow = '';
});

afterEach(() => {
  cleanup();
});

describe('BDD: DemoPage Gherkin 場景對應', () => {
  describe('Page rendering', () => {
    it('renders page title', () => {
      renderDemoPage();
      expect(screen.getByText('Coming Soon')).toBeInTheDocument();
    });

    it('renders page subtitle', () => {
      renderDemoPage();
      expect(screen.getByText('演示影片即將發布，敬請期待')).toBeInTheDocument();
    });
  });

  describe('i18n', () => {
    it('default language is Traditional Chinese', () => {
      renderDemoPage();
      expect(screen.getByText('Coming Soon')).toBeInTheDocument();
      expect(screen.getByText('演示影片即將發布，敬請期待')).toBeInTheDocument();
    });
  });
});
