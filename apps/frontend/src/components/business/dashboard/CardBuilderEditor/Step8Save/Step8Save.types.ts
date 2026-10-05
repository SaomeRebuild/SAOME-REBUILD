/**
 * Step8Save — Types
 *
 * @module CardBuilderEditor/Step8Save/Step8Save.types
 */

import type { CardType, BarcodeType } from '@saome/shared/schemas/card';

/**
 * Summary data shown in the Step 8 "Save & Publish" panel.
 *
 * Each field maps to a single setting on the store / template — the
 * panel is read-only and just surfaces what the user has already
 * configured in Steps 1-7 so they can confirm before publishing.
 */
export interface Step8SaveSummary {
  /** Card Name (templates.name SQL column). May be empty if Step 2 incomplete. */
  cardName: string;
  /** Card type (templates.card_type SQL column). null = user never picked a type. */
  cardType: CardType | null;
  /** Issuer name (settings.issuerName). */
  issuerName: string;
  /** Barcode format (settings.barcodeType). */
  barcodeType: BarcodeType;
  /** Whether the issuer uploaded a logo (settings.issuerLogo is non-empty). */
  hasLogo: boolean;
  /** Whether any location rows exist (settings.locations.length > 0). */
  hasLocations: boolean;
  /** Membership card `isPaid` flag (settings.isPaid). */
  isPaid: boolean;
}

/**
 * State of the Save & Publish action. Drives the disabled state + loading
 * spinner + error toast of the primary action button.
 *
 *   - 'idle'    → user can click Publish.
 *   - 'saving'  → API call in flight; button disabled + spinner shown.
 *   - 'saved'   → successful publish; component will navigate to Library.
 *   - 'error'   → publish failed; error toast shown + button re-enabled.
 */
export type Step8SaveStatus = 'idle' | 'saving' | 'saved' | 'error';

/**
 * Sub-component prop shapes.
 *
 * The split mirrors the Step 6 / Step 7 sub-component layout:
 *   - `Step8SaveSummary` is a pure render component (no logic).
 *   - `Step8SaveActions` owns the publish action wiring.
 *   - The parent `Step8Save` (index.tsx) wires them together.
 */
export interface Step8SaveSummaryProps {
  summary: Step8SaveSummary;
}

export interface Step8SaveActionsProps {
  /** Card ID from the store (null = no template to publish). */
  cardId: string | null;
  /** Current status. Controls button disabled / spinner / error UI. */
  status: Step8SaveStatus;
  /** Validation summary used to disable Publish when required fields are missing. */
  validation: Step8SaveValidation;
  /** Click handler that calls cardService.update({ status: 'published' }). */
  onPublish: () => Promise<void>;
  /** Click handler that navigates back to the Library without publishing. */
  onBack: () => void;
}

/**
 * Validation state derived from the store. Mirrors the workspace's
 * `isStep1Valid()` gate (cardType required) + a "Card Name non-empty"
 * gate (the SQL column must not be empty when publishing).
 *
 * Both fields are REQUIRED for the user to advance to a published card —
 * we surface them in a single object so the button can disable with one
 * boolean check (`validation.canPublish`).
 */
export interface Step8SaveValidation {
  /** cardType is not null. */
  hasCardType: boolean;
  /** Card Name (templates.name) is non-empty (after trim). */
  hasCardName: boolean;
  /** Both must be true for the publish action to be allowed. */
  canPublish: boolean;
}