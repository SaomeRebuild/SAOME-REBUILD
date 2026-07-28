import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { AuthShell } from './AuthShell';

describe('AuthShell', () => {
  it('renders title and children', () => {
    render(
      <AuthShell title="Sign in">
        <form data-testid="form" />
      </AuthShell>,
    );
    expect(screen.getByRole('heading', { name: 'Sign in' })).toBeInTheDocument();
    expect(screen.getByTestId('form')).toBeInTheDocument();
  });

  it('renders subtitle when provided', () => {
    render(
      <AuthShell title="Sign in" subtitle="Welcome back">
        <div />
      </AuthShell>,
    );
    expect(screen.getByText('Welcome back')).toBeInTheDocument();
  });

  it('renders footer when provided', () => {
    render(
      <AuthShell footer={<a href="/register">Create account</a>}>
        <div />
      </AuthShell>,
    );
    expect(screen.getByText('Create account')).toBeInTheDocument();
  });

  // Per design-system/MASTER.md §1 + §9 (dark orange SaaS palette).
  it('uses dark theme tokens (var(--color-background), var(--color-card)), not light theme utilities', () => {
    const { container } = render(
      <AuthShell title="Sign in">
        <div data-testid="child" />
      </AuthShell>,
    );
    const root = container.firstElementChild as HTMLElement;
    const card = root.querySelector('div > div') as HTMLElement;

    // Outer background = page background token
    expect(root.getAttribute('style') ?? '').toMatch(/--color-background/);
    // Card surface = card token, never plain white
    expect(card.className).not.toMatch(/\bbg-white\b/);
    expect(card.className).not.toMatch(/\bbg-neutral-/);
    expect(card.getAttribute('style') ?? '').toMatch(/--color-card/);
    // Heading uses foreground token, not plain black/gray utility
    const heading = screen.getByRole('heading', { name: 'Sign in' });
    expect(heading.getAttribute('style') ?? '').toMatch(/--color-foreground/);
  });
});
