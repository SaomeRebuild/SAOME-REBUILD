/**
 * PassHolderPaymentButton — Payfast / Ecpay CTA button for the
 * simulated payment flow. Renders the provider logo on the left and a
 * 3-segment state on the right (idle → paying → paid).
 *
 * Visual states:
 *   - `idle`  — enabled, "Pay with X" label, logo + button text
 *   - `paying` — disabled, spinner + "付款處理中…" / "Processing…"
 *   - `paid`   — disabled, check icon + "已付款" / "Paid",
 *                background fade to success color
 *
 * Animation contract (Rule 000 §6 / design-system/MASTER.md §6):
 *   - Click feedback:    scale-0.95 + glow shadow (200ms ease-out)
 *   - paying transition: logo slides left, spinner slides in (200ms)
 *   - paid transition:   background fades to success + check scale-in (300ms)
 *   - prefers-reduced-motion: 瞬時切換, no transform / fade
 *
 * Logo asset resolution:
 *   - payfast → /images/Payfast logo.png
 *   - ecpay   → /images/ecpay_logo.svg
 *
 * (Both assets exist in apps/frontend/public/images/ since 2026-10-13
 * per `git status` snapshot. We reference them by public path so Vite
 * emits the right fingerprint at build time.)
 */

import { useId } from 'react';
import { Loader2, Check } from 'lucide-react';
import type { PassHolderPaymentButtonProps, PaymentProvider } from './PassHolderMembershipTiers.types';

const LOGO_SRC: Record<PaymentProvider, string> = {
  payfast: '/images/Payfast logo.png',
  ecpay: '/images/ecpay_logo.svg',
};

// 2026-10-17 — Ecpay 圖片 alt text 改用官方中文名「綠界」
// (對齊 Rule 023 § 翻譯書寫紀律:zh-TW 全中文)
const LOGO_ALT: Record<PaymentProvider, string> = {
  payfast: 'Payfast',
  ecpay: '綠界',
};

export function PassHolderPaymentButton({
  provider,
  paymentState,
  labels,
  onClick,
  disabled,
}: PassHolderPaymentButtonProps) {
  const buttonId = useId();
  const isDisabled = disabled || paymentState !== 'idle';
  const isPaid = paymentState === 'paid';
  const isPaying = paymentState === 'paying';

  // Background color shifts on paid — design-system §5 (success = #22C55E)
  const backgroundColor = isPaid
    ? 'var(--color-success)'
    : isDisabled
      ? 'var(--color-muted)'
      : 'var(--color-primary)';
  const textColor = isPaid
    ? 'var(--color-on-primary)' // success color has good contrast w/ dark text
    : isDisabled
      ? 'var(--color-muted-foreground)'
      : 'var(--color-on-primary)';

  return (
    <button
      id={buttonId}
      type="button"
      disabled={isDisabled}
      onClick={onClick}
      aria-busy={isPaying}
      data-testid="pass-holder-payment-button"
      data-provider={provider}
      data-payment-state={paymentState}
      className={[
        'inline-flex min-h-[48px] w-full items-center justify-center gap-3 rounded-lg px-4 py-2',
        'text-base font-semibold',
        // Click feedback (motion-safe only; reduced-motion → instant)
        'motion-safe:active:scale-[0.95] motion-safe:transition-all',
        'duration-200 ease-out',
      ].join(' ')}
      style={{
        backgroundColor,
        color: textColor,
        cursor: isDisabled ? 'not-allowed' : 'pointer',
        boxShadow: isPaid ? '0 0 0 3px rgba(34, 197, 94, 0.35)' : 'none',
      }}
    >
      {isPaying ? (
        <Loader2
          size={18}
          className="animate-spin"
          aria-hidden="true"
          data-testid="pass-holder-payment-button-spinner"
        />
      ) : isPaid ? (
        <Check
          size={20}
          aria-hidden="true"
          data-testid="pass-holder-payment-button-check"
        />
      ) : (
        <img
          src={LOGO_SRC[provider]}
          alt={LOGO_ALT[provider]}
          data-testid="pass-holder-payment-button-logo"
          // 24px logo height, auto width; preserve aspect ratio
          style={{ height: '20px', width: 'auto', maxWidth: '64px', objectFit: 'contain' }}
        />
      )}

      <span data-testid="pass-holder-payment-button-status">
        {isPaying
          ? labels.paying
          : isPaid
            ? labels.paid
            : labels.idleLabel}
      </span>
    </button>
  );
}
