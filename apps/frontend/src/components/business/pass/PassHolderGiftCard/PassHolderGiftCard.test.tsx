/**
 * PassHolderGiftCard tests — the gift-card purchase section.
 *
 * The behavior this file pins is the customer-facing contract of the
 * 2026-10-23 gift-card purchase flow:
 *   - the merchant's rate + fences are stated before any input
 *   - the customer types POINTS; the amount is derived and read-only
 *   - an amount that the rate cannot price is reported inline, not
 *     silently rounded
 *   - the payment CTA is gated on a valid points value
 *   - the provider follows the currency (TWD → 綠界, ZAR → Payfast)
 */

import { describe, it, expect, vi } from 'vitest';
import { useState } from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { I18nextProvider } from 'react-i18next';
import { i18n as testI18n } from '@/test/i18n';
import { PassHolderGiftCard } from './PassHolderGiftCard';
import type { PublicGiftCardConfig } from '@saome/shared/types/passHolder';

/** 100 元 = 10 點. 500 點 → 5000 元. */
const CONFIG: PublicGiftCardConfig = {
  unitAmount: 100,
  unitPoints: 10,
  checkoutMinPoints: 100,
  checkoutMaxPoints: 10_000,
  checkoutMinAmount: 100,
  checkoutMaxAmount: 10_000,
};

const pointsInput = () => screen.getByTestId('pass-holder-gift-card-points-input');
const amountOutput = () => screen.getByTestId('pass-holder-gift-card-amount');
const rateValue = () => screen.getByTestId('pass-holder-gift-card-rate-value');
const amountRangeValue = () =>
  screen.getByTestId('pass-holder-gift-card-amount-range-value');
const cta = () => screen.getByTestId('pass-holder-payment-button');

const renderComponent = (props: Partial<React.ComponentProps<typeof PassHolderGiftCard>> = {}) => {
  const onPurchasedPointsChange = props.onPurchasedPointsChange ?? vi.fn();
  const onSimulatePayment = props.onSimulatePayment ?? vi.fn();
  const utils = render(
    <I18nextProvider i18n={testI18n}>
      <PassHolderGiftCard
        config={CONFIG}
        currency="TWD"
        purchasedPoints={null}
        onPurchasedPointsChange={onPurchasedPointsChange}
        paymentState="idle"
        onSimulatePayment={onSimulatePayment}
        {...props}
      />
    </I18nextProvider>,
  );
  return { ...utils, onPurchasedPointsChange, onSimulatePayment };
};

/**
 * Stateful harness — mirrors how the component is actually used
 * (`usePassHolderPayment` holds the value in React state).
 *
 * Needed for typing tests: the points input is CONTROLLED, so without
 * a stateful parent the value snaps back to `''` after the first
 * keystroke and only ever propagates `null`.
 */
function ControlledHarness(props: Partial<React.ComponentProps<typeof PassHolderGiftCard>> = {}) {
  const [points, setPoints] = useState<number | null>(null);
  const onSimulatePayment = vi.fn();
  // `{...props}` is spread FIRST so the controlled `purchasedPoints`
  // and the stateful `onPurchasedPointsChange` below always win —
  // otherwise a caller-supplied handler would replace the state setter
  // and the controlled input would snap back to '' on every keystroke.
  const { onPurchasedPointsChange: callerChange, ...rest } = props;
  return (
    <I18nextProvider i18n={testI18n}>
      <PassHolderGiftCard
        config={CONFIG}
        currency="TWD"
        paymentState="idle"
        onSimulatePayment={onSimulatePayment}
        {...rest}
        purchasedPoints={points}
        onPurchasedPointsChange={(next) => {
          setPoints(next);
          callerChange?.(next);
        }}
      />
    </I18nextProvider>
  );
}

describe('PassHolderGiftCard — section rendering', () => {
  it('renders the explanation, tips, purchase, and payment CTA', () => {
    renderComponent();
    expect(screen.getByTestId('pass-holder-gift-card')).toBeInTheDocument();
    expect(screen.getByTestId('pass-holder-gift-card-explanation')).toBeInTheDocument();
    expect(screen.getByTestId('pass-holder-gift-card-tips')).toBeInTheDocument();
    expect(screen.getByTestId('pass-holder-gift-card-purchase')).toBeInTheDocument();
    expect(cta()).toBeInTheDocument();
  });

  it("states the merchant's exchange rate so the price is predictable", () => {
    renderComponent();
    // "每 100 可獲得 10 點" — rendered from the config, not hardcoded.
    expect(screen.getByTestId('pass-holder-gift-card-rate-value')).toHaveTextContent(
      /100/,
    );
    expect(screen.getByTestId('pass-holder-gift-card-rate-value')).toHaveTextContent(/10/);
  });

  it('states the per-checkout points range from the config', () => {
    renderComponent();
    expect(screen.getByTestId('pass-holder-gift-card-range-value')).toHaveTextContent(
      /100/,
    );
    expect(screen.getByTestId('pass-holder-gift-card-range-value')).toHaveTextContent(
      /10,000/,
    );
  });

  it('carries the gifting hint ("buy for someone else")', () => {
    renderComponent();
    expect(screen.getByTestId('pass-holder-gift-card-tips')).toBeInTheDocument();
  });
});

/**
 * The exchange rate is a money figure. Passing `config.unitAmount`
 * (a bare number) straight into the copy rendered 「每 1 可獲得 1 點」,
 * which reads as "every 1 of what?". These pin the currency symbol.
 */
describe('PassHolderGiftCard — exchange rate currency symbol', () => {
  it('labels the rate unit with NT$ for a TWD template', () => {
    renderComponent({ currency: 'TWD' });
    expect(rateValue()).toHaveTextContent('NT$100');
    expect(rateValue()).toHaveTextContent('10');
  });

  it('labels the rate unit with R for a ZAR template', () => {
    renderComponent({ currency: 'ZAR' });
    expect(rateValue()).toHaveTextContent('R100');
    expect(rateValue()).toHaveTextContent('10');
  });
});

/**
 * The merchant configures BOTH fences in CardBuilder Step 6
 * (checkoutMin/MaxPoints AND checkoutMin/MaxAmount). Showing only the
 * points range left the customer unable to predict what 100 points
 * costs, so both dimensions are stated.
 */
describe('PassHolderGiftCard — per-checkout amount fences', () => {
  it('states the amount range from the template settings (TWD)', () => {
    renderComponent({ currency: 'TWD' });
    expect(amountRangeValue()).toHaveTextContent('NT$100');
    expect(amountRangeValue()).toHaveTextContent('NT$10,000');
  });

  it('states the amount range from the template settings (ZAR)', () => {
    renderComponent({ currency: 'ZAR' });
    expect(amountRangeValue()).toHaveTextContent('R100');
    expect(amountRangeValue()).toHaveTextContent('R10,000');
  });

  it('tracks the template rather than hardcoding a default range', () => {
    renderComponent({
      config: { ...CONFIG, checkoutMinAmount: 250, checkoutMaxAmount: 2_500 },
    });
    expect(amountRangeValue()).toHaveTextContent('NT$250');
    expect(amountRangeValue()).toHaveTextContent('NT$2,500');
  });
});

/**
 * `validateGiftCardPurchase` returns an i18n KEY in `message`, never
 * prose. `PassHolderGiftCardPurchase` is a pure view with no `t()`,
 * so it used to render that key verbatim and the customer saw
 * `passHolder.validation.pointsBelowMin` on the page. The parent now
 * resolves it. These pin the translated result AND the absence of the
 * key.
 */
describe('PassHolderGiftCard — validation messages are translated, not raw keys', () => {
  const RAW_KEY_PATTERN = /passHolder\.validation\./;

  it('renders the translated reason when points are below the minimum', () => {
    renderComponent({ purchasedPoints: 50 });
    expect(amountOutput()).not.toHaveTextContent(RAW_KEY_PATTERN);
    expect(amountOutput()).toHaveTextContent('點數低於最低購買量');
  });

  it('renders the translated reason when points exceed the maximum', () => {
    renderComponent({ purchasedPoints: 20_000 });
    expect(amountOutput()).not.toHaveTextContent(RAW_KEY_PATTERN);
    expect(amountOutput()).toHaveTextContent('點數高於單次購買上限');
  });

  it('renders the translated reason for an unpriceable points value', () => {
    renderComponent({ purchasedPoints: 505 });
    expect(amountOutput()).not.toHaveTextContent(RAW_KEY_PATTERN);
    expect(amountOutput()).toHaveTextContent('點數必須是兌換單位的倍數');
  });

  it('never leaks a raw key anywhere in the section', () => {
    renderComponent({ purchasedPoints: 50 });
    expect(screen.getByTestId('pass-holder-gift-card')).not.toHaveTextContent(
      RAW_KEY_PATTERN,
    );
  });

  it('marks the rejected input for assistive tech', () => {
    renderComponent({ purchasedPoints: 50 });
    expect(pointsInput()).toHaveAttribute('aria-invalid', 'true');
  });
});

describe('PassHolderGiftCard — payment provider', () => {
  it('offers 綠界 (ecpay) for a TWD template', () => {
    renderComponent({ currency: 'TWD' });
    expect(cta()).toHaveAttribute('data-provider', 'ecpay');
  });

  it('offers Payfast for a ZAR template', () => {
    renderComponent({ currency: 'ZAR' });
    expect(cta()).toHaveAttribute('data-provider', 'payfast');
  });

  it('renders the ZAR amount with the R symbol', () => {
    renderComponent({ currency: 'ZAR', purchasedPoints: 500 });
    expect(amountOutput()).toHaveTextContent('R5,000');
  });

  it('renders the TWD amount with the NT$ prefix', () => {
    renderComponent({ currency: 'TWD', purchasedPoints: 500 });
    expect(amountOutput()).toHaveTextContent('NT$5,000');
  });
});

describe('PassHolderGiftCard — derived amount', () => {
  it('shows a placeholder when nothing is entered', () => {
    renderComponent({ purchasedPoints: null });
    expect(amountOutput()).not.toHaveTextContent('NT$');
  });

  it('derives the amount from points on every keystroke', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<ControlledHarness onPurchasedPointsChange={onChange} />);
    await user.type(pointsInput(), '500');
    // Each keystroke propagates the parsed prefix (5 → 50 → 500); the
    // parent owns the value so the controlled input doesn't snap back.
    expect(onChange).toHaveBeenNthCalledWith(1, 5);
    expect(onChange).toHaveBeenLastCalledWith(500);
    // And the derived amount is visible without the parent re-rendering.
    expect(amountOutput()).toHaveTextContent('5,000');
  });

  it('displays the derived amount for a valid points value', () => {
    renderComponent({ purchasedPoints: 500 });
    // 500 ÷ 10 × 100 = 5000
    expect(amountOutput()).toHaveTextContent('5,000');
  });

  it('does NOT round a points value the rate cannot price', () => {
    // 505 點 → 50.5 units. Rounding to 5050 would charge an amount the
    // customer never agreed to.
    renderComponent({ purchasedPoints: 505 });
    expect(amountOutput()).not.toHaveTextContent('5,000');
  });
});

describe('PassHolderGiftCard — CTA gating', () => {
  it('disables the CTA when no points are entered', () => {
    renderComponent({ purchasedPoints: null });
    expect(cta()).toBeDisabled();
  });

  it('enables the CTA for a valid points value', () => {
    renderComponent({ purchasedPoints: 500 });
    expect(cta()).toBeEnabled();
  });

  it('disables the CTA for points below the checkout minimum', () => {
    // The parent only stores "parsed positive integer", so an
    // out-of-range value still reaches the component — and must leave
    // the CTA closed.
    renderComponent({ purchasedPoints: 50 });
    expect(cta()).toBeDisabled();
  });

  it('disables the CTA for points above the checkout maximum', () => {
    renderComponent({ purchasedPoints: 20_000 });
    expect(cta()).toBeDisabled();
  });

  it('disables the CTA for a points value the rate cannot price', () => {
    renderComponent({ purchasedPoints: 505 });
    expect(cta()).toBeDisabled();
  });

  it('fires onSimulatePayment when a valid value is present', async () => {
    const user = userEvent.setup();
    const { onSimulatePayment } = renderComponent({ purchasedPoints: 500 });
    await user.click(cta());
    expect(onSimulatePayment).toHaveBeenCalledTimes(1);
  });

  it('does NOT fire onSimulatePayment while the CTA is gated', async () => {
    const user = userEvent.setup();
    const { onSimulatePayment } = renderComponent({ purchasedPoints: 50 });
    await user.click(cta());
    expect(onSimulatePayment).not.toHaveBeenCalled();
  });
});

describe('PassHolderGiftCard — payment state machine', () => {
  it('renders the paying state (spinner + aria-busy)', () => {
    renderComponent({ purchasedPoints: 500, paymentState: 'paying' });
    expect(cta()).toHaveAttribute('data-payment-state', 'paying');
    expect(cta()).toHaveAttribute('aria-busy', 'true');
  });

  it('renders the paid state (check icon)', () => {
    renderComponent({ purchasedPoints: 500, paymentState: 'paid' });
    expect(
      screen.getByTestId('pass-holder-payment-button-check'),
    ).toBeInTheDocument();
  });

  it('locks the CTA once paid (no double charge)', () => {
    renderComponent({ purchasedPoints: 500, paymentState: 'paid' });
    expect(cta()).toBeDisabled();
  });

  it('disables the points input when the parent says disabled', () => {
    renderComponent({ purchasedPoints: 500, disabled: true });
    expect(pointsInput()).toBeDisabled();
  });
});

describe('PassHolderGiftCard — input accessibility (mobile-first)', () => {
  it('labels the points input and associates the hint', () => {
    renderComponent({ purchasedPoints: 500 });
    const input = pointsInput();
    expect(input).toHaveAccessibleName();
    const describedBy = input.getAttribute('aria-describedby');
    expect(describedBy).toBeTruthy();
    // Every id in aria-describedby must resolve to a real element.
    for (const id of (describedBy ?? '').split(' ')) {
      expect(document.getElementById(id)).not.toBeNull();
    }
  });

  it('uses a 16px font so iOS Safari does not zoom on focus', () => {
    // RWD § 表單在 mobile 的處理: input font-size >= 16px.
    renderComponent({ purchasedPoints: 500 });
    expect(pointsInput()).toHaveStyle({ fontSize: '16px' });
  });

  it('marks an out-of-range value with aria-invalid', () => {
    renderComponent({ purchasedPoints: 50 });
    expect(pointsInput()).toHaveAttribute('aria-invalid', 'true');
  });

  it('announces the derived amount politely for screen readers', () => {
    renderComponent({ purchasedPoints: 500 });
    expect(amountOutput()).toHaveAttribute('aria-live', 'polite');
  });
});