import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Stepper } from './Stepper';

describe('Stepper', () => {
  it('renders step labels', () => {
    render(<Stepper current={0} steps={[{ label: 'Account' }, { label: 'Confirm' }]} />);
    expect(screen.getByText('Account')).toBeInTheDocument();
    expect(screen.getByText('Confirm')).toBeInTheDocument();
  });

  it('marks the current step', () => {
    render(<Stepper current={1} steps={[{ label: 'Account' }, { label: 'Confirm' }, { label: 'Done' }]} />);
    const steps = screen.getAllByRole('listitem');
    expect(steps[1]).toHaveAttribute('aria-current', 'step');
  });

  it('marks completed steps with check icon', () => {
    const { container } = render(
      <Stepper current={1} steps={[{ label: 'Account' }, { label: 'Confirm' }]} />,
    );
    const completedCircles = container.querySelectorAll('[data-status="complete"]');
    expect(completedCircles.length).toBe(1);
  });
});
