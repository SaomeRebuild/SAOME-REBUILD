import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ThemeToggle } from './ThemeToggle';
import * as useThemeModule from '@/hooks/useTheme';

// Stable mock — shared across test cases
const mockUseTheme = vi.spyOn(useThemeModule, 'useTheme');

const renderComponent = (preference: 'light' | 'dark' = 'dark') => {
  mockUseTheme.mockReturnValue({
    preference,
    resolved: preference,
    setPreference: vi.fn(),
  });
  return render(<ThemeToggle />);
};

describe('ThemeToggle', () => {
  beforeEach(() => {
    mockUseTheme.mockClear();
  });

  it('renders two buttons for light / dark', () => {
    renderComponent();
    expect(screen.getByRole('button', { name: /Light/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Dark/i })).toBeInTheDocument();
  });

  it('sets aria-pressed=true on the active button', () => {
    renderComponent('dark');
    expect(screen.getByRole('button', { name: /Dark/i })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: /Light/i })).toHaveAttribute('aria-pressed', 'false');
  });

  it('calls setPreference when a button is clicked', () => {
    let capturedPref: string | null = null;
    mockUseTheme.mockReturnValue({
      preference: 'dark',
      resolved: 'dark',
      setPreference: (pref: 'light' | 'dark') => { capturedPref = pref; },
    });
    render(<ThemeToggle />);

    fireEvent.click(screen.getByRole('button', { name: /Light/i }));
    expect(capturedPref).toBe('light');
  });

  it('has role="group" with aria-label', () => {
    renderComponent();
    const group = screen.getByRole('group');
    expect(group).toHaveAttribute('aria-label', expect.stringContaining('theme'));
  });
});
