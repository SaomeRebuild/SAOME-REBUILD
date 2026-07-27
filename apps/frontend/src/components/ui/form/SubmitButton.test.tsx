import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { SubmitButton } from './SubmitButton';

describe('SubmitButton', () => {
  it('renders children as label', () => {
    render(<SubmitButton>Submit</SubmitButton>);
    expect(screen.getByRole('button', { name: 'Submit' })).toBeInTheDocument();
  });

  it('is disabled when disabled=true', () => {
    render(<SubmitButton disabled>Submit</SubmitButton>);
    expect(screen.getByRole('button')).toBeDisabled();
  });

  it('is disabled when loading=true', () => {
    render(<SubmitButton loading>Submit</SubmitButton>);
    expect(screen.getByRole('button')).toBeDisabled();
  });

  it('shows loadingText instead of children when loading', () => {
    render(<SubmitButton loading loadingText="Signing in…">Submit</SubmitButton>);
    expect(screen.getByText('Signing in…')).toBeInTheDocument();
    expect(screen.queryByText('Submit')).not.toBeInTheDocument();
  });

  it('fires onClick when clicked', () => {
    const onClick = vi.fn();
    render(<SubmitButton onClick={onClick}>Submit</SubmitButton>);
    fireEvent.click(screen.getByRole('button'));
    expect(onClick).toHaveBeenCalledOnce();
  });
});
