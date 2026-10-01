/**
 * PassHolderRegistration.types — local prop interfaces for the L2 folder.
 */

import type {
  CardType,
} from '@saome/shared/schemas/card';
import type {
  PublicPassTemplate,
} from '@saome/shared/types/passHolder';

export interface PassHolderRegistrationProps {
  /** Public-safe template metadata. */
  template: PublicPassTemplate;
  /** Called after a successful mock registration. */
  onSubmit: () => void;
  /** When true, the submit button shows a spinner + submitting text. */
  isSubmitting?: boolean;
}

/** Slot extension surface — currently a passthrough. */
export interface PassHolderRegistrationFieldSetProps {
  cardType: CardType;
  children?: React.ReactNode;
}