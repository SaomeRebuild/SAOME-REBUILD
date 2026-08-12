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
        'trial.title': 'Trial Ending Soon',
        'trial.titleUrgent': 'Trial Ending Soon - Act Now!',
        'trial.subtitle': 'Your trial will expire in {{days}} days. Upgrade to continue using all features.',
        'trial.cta': 'Upgrade Now',
        'trialExpired.title': 'Trial Expired',
        'trialExpired.subtitle': 'Upgrade your plan to continue using SAOME services.',
        'trialExpired.cta': 'View Plans',
        'renewalReminder.title': 'Billing Renewal Reminder',
        'renewalReminder.subtitle': 'Your {{plan}} plan will renew in {{days}} days.',
        'renewalReminder.cta': 'Manage Plan',
        'trial.ariaLabel': 'Trial reminder: {{days}} days remaining',
      };
      const str = map[key] ?? key;
      return opts ? str.replace(/\{\{days\}\}/g, String(opts.days ?? '')).replace(/\{\{plan\}\}/g, String(opts.plan ?? '')) : str;
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
    mockUsePassNotification.mockReturnValue({ type: null, daysLeft: 0, plan: '' });
    const handleCta = vi.fn();
    render(<PassNotification pass={null} onCta={handleCta} />);
    expect(document.body.textContent).toBe('');
  });

  it('renders trial notification with correct text', () => {
    mockUsePassNotification.mockReturnValue({ type: 'trial', daysLeft: 10, plan: '' });
    const handleCta = vi.fn();
    render(<PassNotification pass={fakePass()} onCta={handleCta} />);
    expect(screen.getByText('Your trial will expire in 10 days. Upgrade to continue using all features.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Upgrade Now' })).toBeInTheDocument();
  });

  it('renders trial expired notification', () => {
    mockUsePassNotification.mockReturnValue({ type: 'trialExpired', daysLeft: 0, plan: '' });
    const handleCta = vi.fn();
    render(<PassNotification pass={fakePass({ daysRemaining: 0, phase: 'expired' })} onCta={handleCta} />);
    expect(screen.getByText('Trial Expired')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'View Plans' })).toBeInTheDocument();
  });

  it('renders renewal reminder notification', () => {
    mockUsePassNotification.mockReturnValue({ type: 'renewalReminder', daysLeft: 5, plan: 'gold' });
    const handleCta = vi.fn();
    render(
      <PassNotification
        pass={fakePass({ paidAt: '2026-07-01T00:00:00.000Z', phase: 'paid', daysRemaining: 5 })}
        onCta={handleCta}
      />,
    );
    expect(screen.getByText('Your gold plan will renew in 5 days.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Manage Plan' })).toBeInTheDocument();
  });

  it('calls onCta when CTA button is clicked', async () => {
    mockUsePassNotification.mockReturnValue({ type: 'trial', daysLeft: 10, plan: '' });
    const handleCta = vi.fn();
    const user = userEvent.setup();
    render(<PassNotification pass={fakePass()} onCta={handleCta} />);
    await user.click(screen.getByRole('button', { name: 'Upgrade Now' }));
    expect(handleCta).toHaveBeenCalledOnce();
  });
});
