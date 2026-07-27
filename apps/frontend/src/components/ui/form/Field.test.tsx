import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Field } from './Field';

describe('Field', () => {
  it('renders label when provided', () => {
    render(
      <Field label="Email">
        <input />
      </Field>,
    );
    expect(screen.getByText('Email')).toBeInTheDocument();
  });

  it('shows required asterisk when required=true', () => {
    render(
      <Field label="Email" required>
        <input />
      </Field>,
    );
    expect(screen.getByText('*')).toBeInTheDocument();
  });

  it('renders description when provided', () => {
    render(
      <Field label="Email" description="We will never share">
        <input />
      </Field>,
    );
    expect(screen.getByText('We will never share')).toBeInTheDocument();
  });

  it('renders error when provided', () => {
    render(
      <Field label="Email" error="Invalid email">
        <input />
      </Field>,
    );
    expect(screen.getByRole('alert')).toHaveTextContent('Invalid email');
  });

  it('injects id on child input', () => {
    render(
      <Field label="Email">
        <input data-testid="email" />
      </Field>,
    );
    const input = screen.getByTestId('email');
    expect(input).toHaveAttribute('id');
    expect(input.id).toMatch(/^field-/);
  });
});
