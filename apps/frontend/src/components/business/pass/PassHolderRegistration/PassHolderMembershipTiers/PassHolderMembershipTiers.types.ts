/**
 * PassHolderMembershipTiers.types — local prop interfaces for the
 * `PassHolderMembershipTiers` L2 sub-folder.
 *
 * Three-component split (Rule 000 § A.1):
 *   1. `PassHolderMembershipTiers`     — main assembly (≤ 100 lines)
 *   2. `PassHolderMembershipTierRow`   — Radio Card sub-component
 *   3. `PassHolderPaymentButton`       — Payfast / Ecpay button sub
 *
 * State machine (3 segments, drives the payment button visual):
 *   - `idle`  → button enabled, "Pay with X" label
 *   - `paying` → button disabled + spinner, 1500ms transition
 *   - `paid`   → button disabled + check icon + success color
 *
 * Provider resolution lives here (not in the button sub) so the
 * upstream `PassHolderRegistration` component can decide once
 * (template.currency === 'ZAR' → 'payfast', else → 'ecpay') and the
 * rest of the sub-components stay purely presentational.
 */

import type {
  PublicMembershipTier,
  PublicPassTemplate,
} from '@saome/shared/types/passHolder';
import type { Currency } from '@saome/shared/schemas/card';

export type PaymentState = 'idle' | 'paying' | 'paid';

export type PaymentProvider = 'payfast' | 'ecpay';

/**
 * Resolve the simulated payment provider from a template's currency.
 * TWD → Ecpay (Taiwan), ZAR → Payfast (South Africa). All other
 * currencies are out of scope today (mock stage only).
 */
export function resolvePaymentProvider(currency: Currency | undefined): PaymentProvider {
  return currency === 'ZAR' ? 'payfast' : 'ecpay';
}

/**
 * Currency symbol resolution — TWD = NT$, ZAR = R.
 *
 * 2026-10-16: lifted from `PassHolderMembershipTierRow` so the
 * `PassHolderMembershipTiers` parent can format the same amount
 * string for the CTA button label (avoid DRY violation across row
 * + parent).
 */
export function currencySymbol(currency: Currency): 'NT$' | 'R' {
  return currency === 'ZAR' ? 'R' : 'NT$';
}

// ============================================================================
// PassHolderMembershipTiers (main) props
// ============================================================================

export interface PassHolderMembershipTiersProps {
  /** Public-safe template (must have `membershipTiers` populated). */
  template: PublicPassTemplate;
  /**
   * Currently selected tier index, or null when no tier is selected.
   * Controlled by the parent so the submit gate can read the same value.
   */
  selectedTierIndex: number | null;
  /** Called with the new index when a tier Radio Card is clicked. */
  onSelectTier: (index: number) => void;
  /** 3-segment state machine for the payment button visual. */
  paymentState: PaymentState;
  /**
   * Called when the user clicks the payment button. Parent decides
   * how to transition state (typically: set 'paying', 1.5s later set
   * 'paid'). Today this is mocked; future work will swap in a real
   * Payfast / Ecpay SDK call.
   */
  onSimulatePayment: () => void;
  /** When true, the section renders in a disabled (greyed-out) state. */
  disabled?: boolean;
}

// ============================================================================
// PassHolderMembershipTierRow (sub) props
// ============================================================================

export interface PassHolderMembershipTierRowProps {
  tier: PublicMembershipTier;
  index: number;
  /** Currency the cost is denominated in; used for the prefix symbol. */
  currency: Currency;
  /** Localized labels resolved by the parent (avoids duplicate t() calls). */
  labels: {
    costFree: string;
    perMonth: string;
    perYear: string;
    rewardsLabel: string;
  };
  selected: boolean;
  onSelect: (index: number) => void;
  /** Disable interaction (e.g. when parent is in a transient state). */
  disabled?: boolean;
}

// ============================================================================
// PassHolderPaymentButton (sub) props
// ============================================================================

export interface PassHolderPaymentButtonProps {
  provider: PaymentProvider;
  paymentState: PaymentState;
  /**
   * 2026-10-16: idle label is now a single pre-resolved string. The
   * `PassHolderMembershipTiers` parent computes it from the selected
   * tier (e.g. "Pay NT$ 100 & Get Pass" / "Get Free Pass"), keeping
   * the button purely presentational (Rule 023 § component-bound i18n
   * discipline). When no tier is selected, the parent falls back to
   * the provider-specific "Pay with X" string.
   */
  labels: {
    idleLabel: string;
    paying: string;
    paid: string;
  };
  onClick: () => void;
  disabled?: boolean;
}
