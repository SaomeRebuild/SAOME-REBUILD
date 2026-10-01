/**
 * PassHolderRegistration — main L2 assembly component for the public
 * "Get Pass" page. Owns the form/Success state machine and delegates
 * form plumbing to `usePassHolderForm`.
 *
 * Composition (≤ 100 lines per Rule 000 §A.2):
 *   1. PassHolderRegistrationHeader (title + subtitle)
 *   2. PassHolderRegistrationFieldSet (extension slot — passthrough today)
 *   3. PassHolderRegistrationForm (4-field RHF form) OR
 *      PassHolderRegistrationSuccess (post-submit Coming Soon view)
 *
 * Pure logic is in `.hooks.ts` (usePassHolderForm) and `.types.ts`
 * (PassHolderRegistrationProps). This file only assembles.
 */

import { useState } from 'react';
import {
  PassHolderRegistrationHeader,
} from './PassHolderRegistrationHeader';
import {
  PassHolderRegistrationForm,
} from './PassHolderRegistrationForm';
import {
  PassHolderRegistrationFieldSet,
} from './PassHolderRegistrationFieldSet';
import {
  PassHolderRegistrationSuccess,
} from './PassHolderRegistrationSuccess';
import { usePassHolderForm } from './PassHolderRegistration.hooks';
import { passHolderService } from '@/services/passHolderService';
import type { PassHolderRegistrationProps } from './PassHolderRegistration.types';

export function PassHolderRegistration({
  template,
  onSubmit,
  isSubmitting,
}: PassHolderRegistrationProps) {
  const [submitted, setSubmitted] = useState(false);
  const [pending, setPending] = useState(false);

  const form = usePassHolderForm({
    onValidSubmit: async (values) => {
      setPending(true);
      try {
        await passHolderService.register(template.id, values);
        setSubmitted(true);
        onSubmit();
      } finally {
        setPending(false);
      }
    },
  });

  return (
    <article
      className="mx-auto flex w-full max-w-screen-sm flex-col gap-4"
      data-testid="pass-holder-registration"
    >
      <PassHolderRegistrationHeader template={template} />
      {submitted ? (
        <PassHolderRegistrationSuccess template={template} />
      ) : (
        <PassHolderRegistrationFieldSet cardType={template.cardType}>
          <PassHolderRegistrationForm
            form={form}
            isSubmitting={isSubmitting ?? pending}
          />
        </PassHolderRegistrationFieldSet>
      )}
    </article>
  );
}