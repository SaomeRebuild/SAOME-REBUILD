/**
 * PassNotification.test.tsx — unit tests for the PassNotification component.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { PassNotification } from './PassNotification';
import type { PassInfo } from '@saome/shared/types/auth';
import * as usePassNotificationModule from './usePassNotification';

// Mock i18next
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, opts?: Record<string, unknown>) => {
      const map: Record<string, string> = {
        'trial.title': '{{daysLeft}} days left on your trial',
        'trial.titleUrgent': 'Only {{daysLeft}} days left — act now!',
        'trial.subtitle': 'Verify your account and bind a credit card to avoid service interruption after the trial ends',
        'trial.cta': 'Verify & Bind Credit Card',
        'trialExpired.title': 'Trial period has ended',
        'trialExpired.subtitle': 'Your trial has ended. Please bind a credit card to continue using the service',
        'trialExpired.cta': 'Subscribe Now',
        'renewalReminder.title': '{{daysLeft}} days remaining this month',
        'renewalReminder.subtitle': 'Please complete payment to ensure uninterrupted service',
        'renewalReminder.cta': 'Go to Payment',
        'trial.ariaLabel': '{{daysLeft}} days remaining on trial',
      };
      const str = map[key] ?? key;
      return opts ? str.replace('{{daysLeft}}', String(opts.daysLeft ?? '')) : str;
    },
  }),
}));

const mockUsePassNotification = vi.spyOn(usePassNotificationModule, 'usePassNotification');

function fakePass(overrides: Partial<PassInfo> = {}): PassInfo {
  return {
    endDate: '2026-09-01T00:00:00.000Z',
    daysRemaining: 10,
    status: 'active',
    plan: 'green',
    phase: 'trial',
    paidAt: null,
    billingCycleEnd: null,
    ...overrides,
  };
}

describe('PassNotification', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders nothing when type is null', () => {
    mockUsePassNotification.mockReturnValue({ type: null, daysLeft: 0 });
    const handleCta = vi.fn();
    render(<PassNotification pass={null} onCta={handleCta} />);
    expect(document.body.textContent).toBe('');
  });

  it('renders trial notification with correct text', () => {
    mockUsePassNotification.mockReturnValue({ type: 'trial', daysLeft: 10 });
    const handleCta = vi.fn();
    render(<PassNotification pass={fakePass()} onCta={handleCta} />);
    expect(screen.getByText('10 days left on your trial')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Verify & Bind Credit Card' })).toBeInTheDocument();
  });

  it('renders trial expired notification', () => {
    mockUsePassNotification.mockReturnValue({ type: 'trialExpired', daysLeft: 0 });
    const handleCta = vi.fn();
    render(<PassNotification pass={fakePass({ daysRemaining: 0, phase: 'expired' })} onCta={handleCta} />);
    expect(screen.getByText('Trial period has ended')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Subscribe Now' })).toBeInTheDocument();
  });

  it('renders renewal reminder notification', () => {
    mockUsePassNotification.mockReturnValue({ type: 'renewalReminder', daysLeft: 5 });
    const handleCta = vi.fn();
    render(
      <PassNotification
        pass={fakePass({ paidAt: '2026-07-01T00:00:00.000Z', phase: 'paid', daysRemaining: 5 })}
        onCta={handleCta}
      />,
    );
    expect(screen.getByText('5 days remaining this month')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Go to Payment' })).toBeInTheDocument();
  });

  it('calls onCta when CTA button is clicked', async () => {
    mockUsePassNotification.mockReturnValue({ type: 'trial', daysLeft: 10 });
    const handleCta = vi.fn();
    const user = userEvent.setup();
    render(<PassNotification pass={fakePass()} onCta={handleCta} />);
    await user.click(screen.getByRole('button', { name: 'Verify & Bind Credit Card' }));
    expect(handleCta).toHaveBeenCalledOnce();
  });
});
