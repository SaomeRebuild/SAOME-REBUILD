import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { HomePage } from './HomePage';

const renderHomePage = () =>
  render(
    <MemoryRouter initialEntries={['/']}>
      <HomePage />
    </MemoryRouter>,
  );

describe('HomePage', () => {
  it('renders marketing landing at / instead of redirecting to /login', () => {
    renderHomePage();
    // HomePage must NOT contain a login form
    expect(screen.queryByRole('button', { name: /登入|login|sign in/i })).toBeNull();
    // Should render Hero headline (zh-TW default)
    expect(screen.getByText(/更多回頭的客戶/i)).toBeInTheDocument();
  });

  it('exposes marketing sections (Features, Pricing)', () => {
    renderHomePage();
    expect(screen.getByText(/功能/i)).toBeInTheDocument();
  });
});
