/**
 * PassHolderRegistration — gift-card branch integration tests.
 *
 * These live in a SEPARATE file from the main
 * `PassHolderRegistration.test.tsx` on purpose: the main file pins the
 * long-established membership + non-paid behavior and must keep passing
 * UNCHANGED after the `usePassHolderPayment` extraction. This file adds
 * the 2026-10-23 gift-card branch without touching it.
 *
 * What this pins:
 *   - a `gift_card` template with a usable rate renders the purchase
 *     section (and NOT the membership tier picker — they are mutually
 *     exclusive)
 *   - a `gift_card` template with NO configured rate renders NO
 *     purchase section at all
 *   - the points travel in the register payload
 *   - the payload carries points but never a price
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { I18nextProvider } from 'react-i18next';
import { MemoryRouter } from 'react-router-dom';
import { i18n as testI18n } from '@/test/i18n';
import { PassHolderRegistration } from './PassHolderRegistration';
import type { PublicGiftCardConfig, PublicPassTemplate } from '@saome/shared/types/passHolder';

const passHolderServiceMock = vi.hoisted(() => ({
  register: vi.fn().mockResolvedValue({ ok: true, passHolderId: 'mock-gift' }),
}));

vi.mock('@/services/passHolderService', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/services/passHolderService')>();
  return {
    passHolderService: passHolderServiceMock,
    PassHolderError: actual.PassHolderError,
    PassHolderNotFoundError: actual.PassHolderNotFoundError,
  };
});

const GIFT_CARD: PublicGiftCardConfig = {
  unitAmount: 100,
  unitPoints: 10,
  checkoutMinPoints: 100,
  checkoutMaxPoints: 10_000,
  checkoutMinAmount: 100,
  checkoutMaxAmount: 10_000,
};

const giftTemplate: PublicPassTemplate = {
  id: 'demo-gift',
  name: 'Gift Card Studio',
  cardType: 'gift_card',
  logoText: 'Gift Studio',
  issuerName: 'Gift Card Studio',
  language: 'en',
  currency: 'TWD',
  giftCard: GIFT_CARD,
};

/** Same template with the rate stripped — backend omits `giftCard`. */
const unconfiguredGiftTemplate: PublicPassTemplate = {
  ...giftTemplate,
  giftCard: undefined,
};

const renderComponent = (template: PublicPassTemplate) =>
  render(
    <I18nextProvider i18n={testI18n}>
      <MemoryRouter>
        <PassHolderRegistration template={template} onSubmit={vi.fn()} />
      </MemoryRouter>
    </I18nextProvider>,
  );

const fillValidForm = async (user: ReturnType<typeof userEvent.setup>) => {
  await user.type(screen.getByTestId('pass-holder-name'), '王小明');
  await user.tab();
  await user.type(screen.getByTestId('pass-holder-phone'), '0912345678');
  await user.tab();
  await user.type(screen.getByTestId('pass-holder-birthday'), '1990-01-01');
  await user.tab();
  await user.type(screen.getByTestId('pass-holder-email'), 'test@example.com');
  await user.tab();
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.useRealTimers();
});

describe('PassHolderRegistration — gift-card branch', () => {
  it('renders the purchase section for a configured gift card', () => {
    renderComponent(giftTemplate);
    expect(screen.getByTestId('pass-holder-gift-card')).toBeInTheDocument();
  });

  it('does NOT render the membership tier picker (branches are exclusive)', () => {
    renderComponent(giftTemplate);
    expect(screen.queryByTestId('pass-holder-membership-tiers')).not.toBeInTheDocument();
  });

  it('renders NO purchase section when the tenant never configured a rate', () => {
    // The backend omits `giftCard` for a partial / corrupt row, and the
    // page must then show nothing — not an input that rejects
    // everything.
    renderComponent(unconfiguredGiftTemplate);
    expect(screen.queryByTestId('pass-holder-gift-card')).not.toBeInTheDocument();
    expect(screen.queryByTestId('pass-holder-membership-tiers')).not.toBeInTheDocument();
  });

  it('keeps the delivery form intact alongside the purchase section', () => {
    renderComponent(giftTemplate);
    expect(screen.getByTestId('pass-holder-name')).toBeInTheDocument();
    expect(screen.getByTestId('pass-holder-email')).toBeInTheDocument();
  });

  it('suppresses the form submit button — the payment CTA is the only one', () => {
    // Single-CTA rule (2026-10-16): a payment-gated card must not offer
    // two competing submit paths.
    renderComponent(giftTemplate);
    expect(screen.queryByTestId('pass-holder-submit')).not.toBeInTheDocument();
  });

  it('sends the purchased points — and no price — in the register payload', async () => {
    // Real timers (matching the established paid-flow pattern): fake
    // timers leaked across `user-event` interactions in earlier rounds
    // and broke the following tests' DOM render. 1.5s of real waiting is
    // absorbed by the 6s `waitFor` tolerance.
    const user = userEvent.setup();
    renderComponent(giftTemplate);

    await fillValidForm(user);
    await user.type(screen.getByTestId('pass-holder-gift-card-points-input'), '500');

    const cta = screen.getByTestId('pass-holder-payment-button');
    expect(cta).toBeEnabled();
    await user.click(cta);

    await waitFor(
      () => {
        expect(passHolderServiceMock.register).toHaveBeenCalledTimes(1);
      },
      { timeout: 6000 },
    );

    const [templateId, payload] = passHolderServiceMock.register.mock.calls[0];
    expect(templateId).toBe('demo-gift');
    expect(payload).toMatchObject({
      purchasedPoints: 500,
      // The provider follows the template currency, not a client choice.
      paymentProvider: 'ecpay',
      paymentStatus: 'completed',
    });
    // Defense-in-depth: the client must NEVER propose a price. The
    // backend re-derives the amount from the template's own rate.
    expect(payload).not.toHaveProperty('paidAmount');
    expect(payload).not.toHaveProperty('amount');
    expect(payload).not.toHaveProperty('giftCardSnapshot');
  });

  it('registers nothing when the points are out of the allowed range', async () => {
    const user = userEvent.setup();
    renderComponent(giftTemplate);

    await fillValidForm(user);
    await user.type(screen.getByTestId('pass-holder-gift-card-points-input'), '50');

    // Below checkoutMinPoints → the CTA is gated, so a click cannot even
    // start the payment simulation, let alone register.
    expect(screen.getByTestId('pass-holder-payment-button')).toBeDisabled();
    await user.click(screen.getByTestId('pass-holder-payment-button'));
    expect(passHolderServiceMock.register).not.toHaveBeenCalled();
  });

  it('registers nothing when the points cannot be priced by the rate', async () => {
    const user = userEvent.setup();
    renderComponent(giftTemplate);

    await fillValidForm(user);
    // 505 is not a whole multiple of unitPoints (10).
    await user.type(screen.getByTestId('pass-holder-gift-card-points-input'), '505');

    expect(screen.getByTestId('pass-holder-payment-button')).toBeDisabled();
    await user.click(screen.getByTestId('pass-holder-payment-button'));
    expect(passHolderServiceMock.register).not.toHaveBeenCalled();
  });

  it('routes a ZAR gift card through Payfast', () => {
    renderComponent({ ...giftTemplate, currency: 'ZAR' });
    expect(screen.getByTestId('pass-holder-payment-button')).toHaveAttribute(
      'data-provider',
      'payfast',
    );
  });
});