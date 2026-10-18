/**
 * PassHolderRegistration.hooks — view-model hooks for the L2 form.
 *
 * Hook split rationale:
 *   - usePassHolderForm owns the RHF + zod state and submit handler.
 *   - Returning a structured object keeps the JSX layer (the L2 main
 *     component) thin and the form logic testable in isolation.
 *
 * Validation rules (per plan 2026-09-28):
 *   - name: 2..100 chars, required
 *   - phone: digits only, 6..15 chars (after country code is concatenated)
 *   - birthday: ISO YYYY-MM-DD; age >= 13
 *   - email: RFC email; checked only after blur to avoid pestering the user
 *     mid-typing (UX rule — same as email-validation rule for Register)
 */

import { useCallback } from 'react';
import { useForm } from 'react-hook-form';
import type { FormEventHandler } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';

const MIN_AGE = 13;
const PHONE_REGEX = /^[0-9]{6,15}$/;
const ISO_DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;

const passHolderFormSchema = z.object({
  name: z
    .string()
    .min(1, 'validation.nameRequired')
    .min(2, 'validation.nameTooShort')
    .max(100),
  phoneCountryCode: z.enum(['+886', '+27']),
  phoneNumber: z
    .string()
    .min(1, 'validation.phoneInvalid')
    .regex(PHONE_REGEX, 'validation.phoneInvalid'),
  birthday: z
    .string()
    .min(1, 'validation.birthdayInvalid')
    .regex(ISO_DATE_REGEX, 'validation.birthdayInvalid')
    .refine((value) => {
      const date = new Date(value);
      if (Number.isNaN(date.getTime())) return false;
      const now = new Date();
      const minBirth = new Date(
        now.getFullYear() - MIN_AGE,
        now.getMonth(),
        now.getDate(),
      );
      return date <= minBirth;
    }, 'validation.ageTooYoung'),
  email: z
    .string()
    .min(1, 'validation.emailInvalid')
    .email('validation.emailInvalid'),
});

export type PassHolderFormValues = z.infer<typeof passHolderFormSchema>;

export interface UsePassHolderFormOptions {
  onValidSubmit: (values: PassHolderFormValues) => void | Promise<void>;
}

export interface UsePassHolderFormResult {
  register: ReturnType<typeof useForm<PassHolderFormValues>>['register'];
  /** React.FormEventHandler wired to the form's `onSubmit`. */
  handleSubmit: FormEventHandler<HTMLFormElement>;
  formState: ReturnType<typeof useForm<PassHolderFormValues>>['formState'];
  watch: ReturnType<typeof useForm<PassHolderFormValues>>['watch'];
  errors: ReturnType<typeof useForm<PassHolderFormValues>>['formState']['errors'];
  setValue: ReturnType<typeof useForm<PassHolderFormValues>>['setValue'];
  trigger: ReturnType<typeof useForm<PassHolderFormValues>>['trigger'];
  /** Validate email only after the field loses focus (UX rule). */
  handleEmailBlur: () => void;
  /**
   * 2026-10-16 — Read current form values (synchronous). Used by
   * `PassHolderRegistration.onCtaClick` after the simulated-payment
   * `setTimeout` to grab the latest user inputs before assembling the
   * register payload (bypasses the stale closure risk of the
   * `handleSubmit(event)` event-driven path).
   */
  getValues: ReturnType<typeof useForm<PassHolderFormValues>>['getValues'];
  /**
   * 2026-10-16 — Programmatic submit. Use when an external CTA (e.g. the
   * paid-membership PaymentButton) drives the form outside the
   * `<form onSubmit>` event. Runs the same RHF validation + onValidSubmit
   * pipeline as `handleSubmit`, but without requiring a form-submit event.
   *
   * `trigger()` is called inside, so any errors surface on the inputs
   * exactly as if the user clicked the form's own SubmitButton. Pair
   * with a `trigger()` call first if you want to short-circuit (e.g.
   * "do not even start the simulated payment when fields are invalid").
   */
  submitForm: () => Promise<void>;
}

export function usePassHolderForm({
  onValidSubmit,
}: UsePassHolderFormOptions): UsePassHolderFormResult {
  const form = useForm<PassHolderFormValues>({
    resolver: zodResolver(passHolderFormSchema),
    // onSubmit matches the auth/RegisterForm pattern: validation runs when
    // the user clicks submit. The submit button is therefore always enabled,
    // and isValid is computed synchronously inside `handleSubmit` before the
    // callback fires.
    mode: 'onSubmit',
    defaultValues: {
      name: '',
      phoneCountryCode: '+886',
      phoneNumber: '',
      birthday: '',
      email: '',
    },
  });

  const handleEmailBlur = useCallback(() => {
    void form.trigger('email');
  }, [form]);

  // 2026-10-18 — Rule 018 § 2 DOM reconcile helper. Before RHF
  // runs validation/submit, copy any DOM value that RHF missed
  // (e.g. autofill wrote to `input.value` AFTER React committed
  // but BEFORE RHF's _formValues sync picked it up). Without the
  // reconcile, the submit payload would carry the stale RHF value
  // (often empty or the user's pre-autofill typed value).
  const reconcileDomToForm = useCallback(() => {
    for (const name of ['name', 'phoneNumber', 'birthday', 'email'] as const) {
      const dom = document.querySelector<HTMLInputElement>(
        `input[name="${name}"]`,
      );
      if (!dom) continue;
      const domValue = dom.value;
      const formValue = form.getValues(name);
      if (domValue !== formValue) {
        // Mirror the DOM value into RHF state. `shouldDirty: false`
        // so the user doesn't see "form has unsaved changes" just
        // because Chrome autofilled something.
        form.setValue(name, domValue, { shouldDirty: false });
      }
    }
  }, [form]);

  const handleSubmit = useCallback<FormEventHandler<HTMLFormElement>>(
    (event) => {
      event.preventDefault();
      // Rule 018 § 2 — DOM reconcile BEFORE RHF reads _formValues.
      reconcileDomToForm();
      void form.handleSubmit(onValidSubmit)(event);
    },
    [form, onValidSubmit, reconcileDomToForm],
  );

  // 2026-10-16 — programmatic submit for external CTA drivers
  // (e.g. paid-membership PaymentButton). Mirrors handleSubmit minus
  // the event-driven preventDefault; RHF still runs validation and
  // either calls onValidSubmit (valid) or sets errors (invalid).
  // 2026-10-18 — also runs DOM reconcile per Rule 018 § 2 — the
  // paid path's 1.5s setTimeout is exactly the race window Chrome
  // needs to autofill (user idles while the simulated payment runs).
  const submitForm = useCallback(async () => {
    reconcileDomToForm();
    await form.handleSubmit(onValidSubmit)();
  }, [form, onValidSubmit, reconcileDomToForm]);

  return {
    register: form.register,
    handleSubmit,
    submitForm,
    getValues: form.getValues,
    formState: form.formState,
    watch: form.watch,
    errors: form.formState.errors,
    setValue: form.setValue,
    trigger: form.trigger,
    handleEmailBlur,
  };
}