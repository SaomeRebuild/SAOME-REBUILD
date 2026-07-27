import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ErrorBanner } from './ErrorBanner';

describe('ErrorBanner', () => {
  it('returns null when no message and no children', () => {
    const { container } = render(<ErrorBanner />);
    expect(container.firstChild).toBeNull();
  });

  it('renders the message string', () => {
    render(<ErrorBanner message="Invalid credentials" />);
    expect(screen.getByRole('alert')).toHaveTextContent('Invalid credentials');
  });
});
