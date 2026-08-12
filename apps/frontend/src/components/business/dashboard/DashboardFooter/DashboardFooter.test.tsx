import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { BrowserRouter } from 'react-router-dom';
import { DashboardFooter } from './DashboardFooter';

const renderWithRouter = (ui: React.ReactElement) =>
  render(<BrowserRouter>{ui}</BrowserRouter>);

describe('DashboardFooter', () => {
  it('renders copyright text', () => {
    renderWithRouter(<DashboardFooter />);
    expect(screen.getByTestId('dashboard-footer-copyright')).toBeInTheDocument();
  });

  it('renders privacy policy link', () => {
    renderWithRouter(<DashboardFooter />);
    expect(screen.getByRole('link', { name: /隱私權政策/i })).toHaveAttribute('href', '/privacy');
  });
});
