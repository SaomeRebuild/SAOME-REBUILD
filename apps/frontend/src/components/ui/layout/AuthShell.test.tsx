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
});
