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

import { Field, SubmitButton } from '@/components/ui';
import { useTranslation } from 'react-i18next';
import type {
  UsePassHolderFormResult,
} from './PassHolderRegistration.hooks';

export interface PassHolderRegistrationFormProps {
  form: UsePassHolderFormResult;
  isSubmitting?: boolean;
}

const COUNTRY_CODES = [
  { value: '+886', label: '+886' },
  { value: '+27', label: '+27' },
] as const;

export function PassHolderRegistrationForm({
  form,
  isSubmitting,
}: PassHolderRegistrationFormProps) {
  const { t } = useTranslation('passHolder');
  const {
    register,
    handleSubmit,
    errors,
    handleEmailBlur,
  } = form;

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
            autoComplete="tel-national"
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
        />
      </Field>

      <SubmitButton
        type="submit"
        loading={isSubmitting}
        loadingText={t('submitting')}
        fullWidth
        data-testid="pass-holder-submit"
      >
        {t('submit')}
      </SubmitButton>
    </form>
  );
}