/**
 * PassHolderPaymentButton tests — 3-segment state machine + provider
 * logo selection. Covers Payfast / Ecpay logo switch by provider, the
 * idle / paying / paid transitions, and the disabled state.
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { I18nextProvider } from 'react-i18next';
import { i18n as testI18n } from '@/test/i18n';
import { PassHolderPaymentButton } from './PassHolderPaymentButton';

const baseLabels = {
  idleLabel: '以綠界付款',
  paying: '付款處理中…',
  paid: '已付款',
};

const renderButton = (props: Partial<React.ComponentProps<typeof PassHolderPaymentButton>> = {}) =>
  render(
    <I18nextProvider i18n={testI18n}>
      <PassHolderPaymentButton
        provider="ecpay"
        paymentState="idle"
        labels={baseLabels}
        onClick={vi.fn()}
        {...props}
      />
    </I18nextProvider>,
  );

describe('PassHolderPaymentButton', () => {
  it('renders the Payfast logo when provider="payfast"', () => {
    renderButton({ provider: 'payfast' });
    const logo = screen.getByTestId('pass-holder-payment-button-logo');
    expect(logo).toBeInTheDocument();
    expect(logo.getAttribute('src')).toContain('Payfast');
  });

  it('renders the Ecpay logo when provider="ecpay"', () => {
    renderButton({ provider: 'ecpay' });
    const logo = screen.getByTestId('pass-holder-payment-button-logo');
    expect(logo).toBeInTheDocument();
    expect(logo.getAttribute('src')).toContain('ecpay_logo');
  });

  it('idle state: enabled, shows "以綠界付款" label', () => {
    renderButton({ provider: 'ecpay', paymentState: 'idle' });
    const button = screen.getByTestId('pass-holder-payment-button');
    expect(button).not.toBeDisabled();
    expect(button).toHaveAttribute('data-payment-state', 'idle');
    expect(screen.getByTestId('pass-holder-payment-button-status')).toHaveTextContent('以綠界付款');
  });

  it('clicking the button in idle state calls onClick', async () => {
    const onClick = vi.fn();
    const user = userEvent.setup();
    renderButton({ onClick });
    await user.click(screen.getByTestId('pass-holder-payment-button'));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('paying state: disabled, shows spinner + "付款處理中…" label', () => {
    renderButton({ paymentState: 'paying' });
    const button = screen.getByTestId('pass-holder-payment-button');
    expect(button).toBeDisabled();
    expect(button).toHaveAttribute('data-payment-state', 'paying');
    expect(button).toHaveAttribute('aria-busy', 'true');
    expect(screen.getByTestId('pass-holder-payment-button-spinner')).toBeInTheDocument();
    expect(screen.getByTestId('pass-holder-payment-button-status')).toHaveTextContent('付款處理中…');
  });

  it('paid state: disabled, shows check icon + "已付款" label', () => {
    renderButton({ paymentState: 'paid' });
    const button = screen.getByTestId('pass-holder-payment-button');
    expect(button).toBeDisabled();
    expect(button).toHaveAttribute('data-payment-state', 'paid');
    expect(button).toHaveAttribute('aria-busy', 'false');
    expect(screen.getByTestId('pass-holder-payment-button-check')).toBeInTheDocument();
    expect(screen.getByTestId('pass-holder-payment-button-status')).toHaveTextContent('已付款');
  });

  it('paid state has no logo (replaced by check icon)', () => {
    renderButton({ paymentState: 'paid' });
    expect(screen.queryByTestId('pass-holder-payment-button-logo')).not.toBeInTheDocument();
    expect(screen.queryByTestId('pass-holder-payment-button-spinner')).not.toBeInTheDocument();
    expect(screen.getByTestId('pass-holder-payment-button-check')).toBeInTheDocument();
  });

  it('paying state has no logo (replaced by spinner)', () => {
    renderButton({ paymentState: 'paying' });
    expect(screen.queryByTestId('pass-holder-payment-button-logo')).not.toBeInTheDocument();
    expect(screen.getByTestId('pass-holder-payment-button-spinner')).toBeInTheDocument();
  });

  it('explicit disabled prop blocks click even in idle state', async () => {
    const onClick = vi.fn();
    const user = userEvent.setup();
    renderButton({ disabled: true, onClick });
    const button = screen.getByTestId('pass-holder-payment-button');
    expect(button).toBeDisabled();
    await user.click(button);
    expect(onClick).not.toHaveBeenCalled();
  });

  it('transitions idle → paying → paid (parent controls state)', () => {
    const { rerender } = renderButton({ paymentState: 'idle' });
    expect(screen.getByTestId('pass-holder-payment-button-status')).toHaveTextContent('以綠界付款');

    rerender(
      <I18nextProvider i18n={testI18n}>
        <PassHolderPaymentButton
          provider="ecpay"
          paymentState="paying"
          labels={baseLabels}
          onClick={vi.fn()}
        />
      </I18nextProvider>,
    );
    expect(screen.getByTestId('pass-holder-payment-button-status')).toHaveTextContent('付款處理中…');

    rerender(
      <I18nextProvider i18n={testI18n}>
        <PassHolderPaymentButton
          provider="ecpay"
          paymentState="paid"
          labels={baseLabels}
          onClick={vi.fn()}
        />
      </I18nextProvider>,
    );
    expect(screen.getByTestId('pass-holder-payment-button-status')).toHaveTextContent('已付款');
  });
});
