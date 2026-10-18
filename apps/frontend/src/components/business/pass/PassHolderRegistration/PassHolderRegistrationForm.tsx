/**
 * PassHolderRegistrationForm — RHF-driven form for capturing the 4
 * Pass-Holder fields (name, phone, birthday, email).
 *
 * Why each design choice:
 *   - `<Field>` from @/components/ui/form already provides label + error
 *     contract + a11y wiring (aria-describedby / aria-invalid). We use it
 *     everywhere to keep visual + a11y behaviour aligned with auth forms.
 *   - Phone country code is a 2-option <select> (per plan 2026-09-28:
 *     +886 + +27). Native select keeps mobile keyboards out of the way.
 *   - Birthday uses native `<input type="date">` for OS-native pickers.
 *   - Email blur rule (trigger only after blur) prevents the user from
 *     seeing "invalid email" while still typing.
 *
 * Pure presentation — all business logic lives in `usePassHolderForm`
 * (.hooks.ts). Submit calls the consumer-provided `onValidSubmit`.
 */

import { useEffect } from 'react';
import { Field, SubmitButton } from '@/components/ui';
import { useTranslation } from 'react-i18next';
import type {
  UsePassHolderFormResult,
} from './PassHolderRegistration.hooks';

export interface PassHolderRegistrationFormProps {
  form: UsePassHolderFormResult;
  isSubmitting?: boolean;
  /**
   * 2026-10-16 — When true, the form's own SubmitButton is suppressed.
   * Used by the paid-membership flow where a single CTA (the payment
   * button below the field set) drives both the simulated payment AND
   * the form submission, removing the two-step "Get Pass → Pay with X"
   * interaction that confused users.
   *
   * Rule 023 § component-bound i18n discipline is preserved: the
   * alternative CTA still surfaces the localized "支付 NT$ 100 並領取
   * Pass" label through its own component-bound translation context,
   * not through this form.
   */
  hideSubmit?: boolean;
}

const COUNTRY_CODES = [
  { value: '+886', label: '+886' },
  { value: '+27', label: '+27' },
] as const;

/**
 * 2026-10-18 — Autofill defense (Rule 018 § 1).
 *
 * Chrome (and other browsers / 1Password / LastPass) injects values
 * into `<input type="email">` / `<input type="tel">` based on form
 * history — sometimes AFTER React's first commit but BEFORE the user
 * types. Without defense, the user's actual input gets overwritten:
 * production saw the phone field pre-filled with `0943222444` and the
 * email field pre-filled with `josh1989gmail.com` (Chrome's
 * guess-from-history).
 *
 * Defense: defer the clear to multiple frames + a 100ms timeout so we
 * catch the autofill race regardless of when Chrome commits. Guard
 * each input with `!form.getValues(name)` so user-typed values are
 * preserved during the sweep window.
 *
 * Mirrors `RegisterForm.tsx` § "Clear browser-autofilled values on
 * Step 2 mount" (the canonical Rule 018 § 1 reference implementation).
 */
function useAutofillSweep(form: UsePassHolderFormResult) {
  useEffect(() => {
    const clearAutofill = () => {
      // The 4 form field names — must match the zod schema in
      // PassHolderRegistration.hooks.ts. `phoneCountryCode` is the
      // <select>; we skip it because Chrome never autofills selects.
      for (const name of ['name', 'phoneNumber', 'birthday', 'email'] as const) {
        const dom = document.querySelector<HTMLInputElement>(
          `input[name="${name}"]`,
        );
        if (dom && dom.value !== '' && !form.getValues(name)) {
          dom.value = '';
          form.setValue(name, '', { shouldDirty: false });
        }
      }
    };
    // Chrome autofill is async; defer to multiple frames + a 100ms
    // fallback (mirrors RegisterForm.tsx lines 145-149).
    const raf1 = requestAnimationFrame(clearAutofill);
    const raf2 = requestAnimationFrame(() =>
      requestAnimationFrame(clearAutofill),
    );
    const timeoutId = window.setTimeout(clearAutofill, 100);
    return () => {
      cancelAnimationFrame(raf1);
      cancelAnimationFrame(raf2);
      window.clearTimeout(timeoutId);
    };
  }, [form]);
}

export function PassHolderRegistrationForm({
  form,
  isSubmitting,
  hideSubmit = false,
}: PassHolderRegistrationFormProps) {
  const { t } = useTranslation('passHolder');
  const {
    register,
    handleSubmit,
    errors,
    handleEmailBlur,
  } = form;

  // 2026-10-18 — Rule 018 § 1 autofill sweep. Mount-only effect;
  // sweeps 4 fields on every mount (component mounts once per
  // submitted→edit retry cycle, so the sweep runs once per form
  // session).
  useAutofillSweep(form);

  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={handleSubmit}
      data-testid="pass-holder-form"
      noValidate
    >
      <Field
        label={t('fields.name.label')}
        required
        error={errors.name?.message ? t(errors.name.message) : undefined}
      >
        <input
          type="text"
          autoComplete="name"
          placeholder={t('fields.name.placeholder')}
          className="w-full rounded border px-3 py-2 text-base"
          style={{
            borderColor: 'var(--color-border)',
            backgroundColor: 'var(--color-background)',
            color: 'var(--color-foreground)',
            minHeight: '44px',
          }}
          {...register('name')}
          data-testid="pass-holder-name"
          // 2026-10-18 — Rule 018 § 5: 1Password / LastPass ignore
          // hints (defense-in-depth alongside the raf+timeout sweep).
          data-1p-ignore
        />
      </Field>

      <div className="flex flex-col gap-1">
        <label
          htmlFor="phone-country-code"
          className="text-sm font-medium"
          style={{ color: 'var(--color-foreground)' }}
        >
          {t('fields.phone.countryCodeLabel')}
          <span
            aria-hidden="true"
            className="ml-0.5"
            style={{ color: 'var(--color-destructive)' }}
          >
            *
          </span>
        </label>
        <div className="flex gap-2">
          <select
            id="phone-country-code"
            className="rounded border px-3 py-2 text-base"
            style={{
              borderColor: 'var(--color-border)',
              backgroundColor: 'var(--color-background)',
              color: 'var(--color-foreground)',
              minHeight: '44px',
              minWidth: '96px',
            }}
            data-testid="pass-holder-country-code"
            {...register('phoneCountryCode')}
          >
            {COUNTRY_CODES.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
          <input
            type="tel"
            inputMode="numeric"
            pattern="[0-9]*"
            // 2026-10-18 — `tel-national` is a triple-hint that
            // Chrome aggressively autofills from the user's phone
            // history. The form is for a fresh registration; we don't
            // want Chrome's guess. Switch to `off` (the hint, not
            // the override — see Rule 018 § 1 footnote about Chrome
            // treating `off` as "hints").
            autoComplete="off"
            placeholder={t('fields.phone.numberPlaceholder')}
            aria-label={t('fields.phone.numberLabel')}
            className="flex-1 rounded border px-3 py-2 text-base"
            style={{
              borderColor: 'var(--color-border)',
              backgroundColor: 'var(--color-background)',
              color: 'var(--color-foreground)',
              minHeight: '44px',
            }}
            {...register('phoneNumber')}
            data-testid="pass-holder-phone"
            // 2026-10-18 — 1Password + LastPass ignore hints (defense
            // in depth alongside the raf+timeout sweep).
            data-1p-ignore
            data-lpignore="true"
          />
        </div>
        {errors.phoneNumber?.message ? (
          <p
            role="alert"
            className="text-xs"
            style={{ color: 'var(--color-destructive)' }}
            data-testid="field-error"
          >
            {t(errors.phoneNumber.message)}
          </p>
        ) : null}
      </div>

      <Field
        label={t('fields.birthday.label')}
        description={t('fields.birthday.hint')}
        required
        error={errors.birthday?.message ? t(errors.birthday.message) : undefined}
      >
        <input
          type="date"
          autoComplete="bday"
          className="w-full rounded border px-3 py-2 text-base"
          style={{
            borderColor: 'var(--color-border)',
            backgroundColor: 'var(--color-background)',
            color: 'var(--color-foreground)',
            minHeight: '44px',
          }}
          {...register('birthday')}
          data-testid="pass-holder-birthday"
          data-1p-ignore
        />
      </Field>

      <Field
        label={t('fields.email.label')}
        required
        error={errors.email?.message ? t(errors.email.message) : undefined}
      >
        <input
          type="email"
          inputMode="email"
          autoComplete="email"
          placeholder={t('fields.email.placeholder')}
          className="w-full rounded border px-3 py-2 text-base"
          style={{
            borderColor: 'var(--color-border)',
            backgroundColor: 'var(--color-background)',
            color: 'var(--color-foreground)',
            minHeight: '44px',
          }}
          {...register('email', {
            onBlur: handleEmailBlur,
          })}
          data-testid="pass-holder-email"
          data-1p-ignore
          data-lpignore="true"
        />
      </Field>

      {!hideSubmit ? (
        <SubmitButton
          type="submit"
          loading={isSubmitting}
          loadingText={t('submitting')}
          fullWidth
          data-testid="pass-holder-submit"
        >
          {t('submit')}
        </SubmitButton>
      ) : null}
    </form>
  );
}