/**
 * RegisterForm — multi-step tenant registration.
 *
 * Step 1: tenant info (contactName, phoneCity, address, taxId, companyName, invoiceAddress).
 * Step 2: account info (email, password, confirmPassword).
 * Step 3: plan selection (green/gold/platinum trial).
 *
 * Data persistence: step 1 values are saved to sessionStorage on advance and
 * restored when going back, so the user does not lose their input.
 *
 * On success, AuthProvider stores session; useAuthRedirect handles navigation.
 */

import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useTranslation } from 'react-i18next';
import {
  Field,
  PasswordField,
  SubmitButton,
  ErrorBanner,
  Stepper,
} from '@/components/ui';
import { PlanSelector } from '@/components/business/auth/PlanSelector';
import {
  tenantInfoSchema,
  accountInfoSchema,
  type TenantInfoInput,
  type AccountInfoInput,
  type RegistrationPayload,
} from '@saome/shared/schemas/auth';
import { useAuth } from '@/hooks';
import { SaomeApiError } from '@/services/httpClient';
import { useNavigate } from 'react-router-dom';
import { ROUTES } from '@/config/routes';
import type { PricingTier } from '@/components/pricing';

/**
 * Translate a react-hook-form error message (zod i18n key) to a human-readable i18n String.
 * Falls back to the raw key so we never show an untranslated string.
 */
function translateFieldError(t: ReturnType<typeof useTranslation>['t'], message?: string): string | undefined {
  if (!message) return undefined;
  return t(message, message);
}

interface RegisterFormProps {
  currentStep?: number;
  onStepChange?: (step: number) => void;
}

export function RegisterForm({ currentStep: externalStep, onStepChange }: RegisterFormProps = {}) {
  const { t } = useTranslation('auth');
  const { register: registerUser } = useAuth();
  const navigate = useNavigate();
  const [internalStep, setInternalStep] = useState(0);
  const step = externalStep ?? internalStep;
  const setStep = (s: number) => {
    setInternalStep(s);
    onStepChange?.(s);
  };
  const [selectedPlan, setSelectedPlan] = useState<PricingTier | null>(null);
  const [serverError, setServerError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [serverFieldErrors, setServerFieldErrors] = useState<Record<string, string>>({});

  // i18n step labels — must be inside component to use `t`
  const steps = [
    { label: t('register.steps.storeInfo') },
    { label: t('register.steps.account') },
    { label: t('register.steps.plan') },
  ];

  const tenantForm = useForm<TenantInfoInput>({
    resolver: zodResolver(tenantInfoSchema) as never,
    mode: 'onSubmit',
    defaultValues: {
      name: '',
      contactName: '',
      phoneCity: '',
      mobile: '',
      address: '',
      taxId: '',
      invoiceAddress: '',
    },
  });

  const accountForm = useForm<AccountInfoInput>({
    resolver: zodResolver(accountInfoSchema) as never,
    mode: 'onSubmit',
  });

  async function onStep1Submit(values: TenantInfoInput) {
    setServerError(null);
    setServerFieldErrors({});
    sessionStorage.setItem('saome.reg.tenant', JSON.stringify(values));
    // Do NOT reset tenantForm — we want values intact in case the user goes back.
    accountForm.reset();
    setStep(1);
  }

  function onBackToStep1() {
    setServerError(null);
    setServerFieldErrors({});
    accountForm.reset();
    // Restore step 1 values from sessionStorage into the form so fields are not empty.
    const tenantJson = sessionStorage.getItem('saome.reg.tenant');
    if (tenantJson) {
      try {
        const saved = JSON.parse(tenantJson) as TenantInfoInput;
        tenantForm.reset(saved);
      } catch {
        tenantForm.reset();
      }
    }
    setStep(0);
  }

  function onBackToStep2() {
    setServerError(null);
    setServerFieldErrors({});
    setStep(1);
  }

  // Clear browser-autofilled values on Step 2 mount. Chrome (and other browsers)
  // autofill <input type="email" autoComplete="email"> based on form history,
  // and RHF syncs the autofilled input.value into _formValues. Without this
  // override, the user sees an email value they never typed, isDirty stays
  // false, and submit sends an unexpected email to the backend.
  useEffect(() => {
    if (step !== 1) return;
    const clearAutofill = () => {
      const emailInput = document.querySelector<HTMLInputElement>('input[name="email"]');
      if (emailInput && emailInput.value !== '') {
        emailInput.value = '';
      }
      accountForm.setValue('email', '', { shouldDirty: false });
      accountForm.setValue('password', '', { shouldDirty: false });
      accountForm.setValue('confirmPassword', '', { shouldDirty: false });
    };
    // Browser autofill happens after first paint, so defer to multiple frames.
    const raf1 = requestAnimationFrame(clearAutofill);
    const raf2 = requestAnimationFrame(() => requestAnimationFrame(clearAutofill));
    const timeoutId = window.setTimeout(clearAutofill, 100);
    return () => {
      cancelAnimationFrame(raf1);
      cancelAnimationFrame(raf2);
      window.clearTimeout(timeoutId);
    };
  }, [step, accountForm]);

  // Clear Chrome-autofilled values on Step 1 mount. The mobile field
  // (added 2026-07-31) sits alongside phoneCity; both are <input type="tel">
  // and Chrome's hint-based autofill could populate mobile from the user's
  // saved cell-phone profile entry, syncing into RHF without isDirty.
  // See rule 018 (form autofill + multi-step state).
  //
  // Bail if the user has already touched the mobile field — otherwise the
  // 100ms setTimeout can race with user typing and wipe the value mid-keystroke.
  useEffect(() => {
    if (step !== 0) return;
    const clearStep1Autofill = () => {
      const mobileInput = document.querySelector<HTMLInputElement>('input[name="mobile"]');
      // Only clear if Chrome has populated something AND the user hasn't typed yet.
      // tenantForm.getValues() reflects RHF state; if it's already non-empty
      // the user typed during the sweep window — leave their input alone.
      if (tenantForm.getValues('mobile')) return;
      if (mobileInput && mobileInput.value !== '') {
        mobileInput.value = '';
      }
      tenantForm.setValue('mobile', '', { shouldDirty: false });
    };
    const raf1 = requestAnimationFrame(clearStep1Autofill);
    const raf2 = requestAnimationFrame(() => requestAnimationFrame(clearStep1Autofill));
    const timeoutId = window.setTimeout(clearStep1Autofill, 100);
    return () => {
      cancelAnimationFrame(raf1);
      cancelAnimationFrame(raf2);
      window.clearTimeout(timeoutId);
    };
  }, [step, tenantForm]);

  function onStep2Submit(values: AccountInfoInput) {
    setServerError(null);
    setServerFieldErrors({});
    // Save step 2 values to sessionStorage before advancing
    sessionStorage.setItem('saome.reg.account', JSON.stringify(values));
    setStep(2);
  }

  async function onStep3Submit() {
    if (!selectedPlan) {
      setServerError(t('register.error.planRequired'));
      return;
    }

    setServerError(null);
    setSubmitting(true);

    try {
      const tenantJson = sessionStorage.getItem('saome.reg.tenant');
      const accountJson = sessionStorage.getItem('saome.reg.account');
      if (!tenantJson || !accountJson) throw new Error('Missing form data');
      
      const tenant = JSON.parse(tenantJson) as TenantInfoInput;
      const account = JSON.parse(accountJson) as AccountInfoInput;
      
      const payload: RegistrationPayload = {
        ...tenant,
        ...account,
        invoiceAddress: tenant.invoiceAddress || '',
        plan: selectedPlan,
      } as RegistrationPayload;

      await registerUser(payload);
      sessionStorage.removeItem('saome.reg.tenant');
      sessionStorage.removeItem('saome.reg.account');
      navigate(ROUTES.tenantDashboard, { replace: true });
    } catch (e) {
      if (e instanceof SaomeApiError) {
        if (e.code === 'CONFLICT') {
          setServerError(t('register.error.conflict'));
        } else if (e.code === 'VALIDATION_ERROR') {
          // Parse per-field errors from backend zod issues.
          const issues = e.details?.issues as Array<{ path: string; i18nKey: string }> | undefined;
          if (issues && issues.length > 0) {
            const fieldErrors: Record<string, string> = {};
            for (const issue of issues) {
              if (issue.path && issue.i18nKey) {
                fieldErrors[issue.path] = t(issue.i18nKey, issue.i18nKey);
              }
            }
            if (Object.keys(fieldErrors).length > 0) {
              setServerFieldErrors(fieldErrors);
              setServerError(t('register.error.validation'));
            } else {
              setServerError(t('register.error.validation'));
            }
          } else {
            setServerError(t('register.error.validation'));
          }
        } else {
          setServerError(t('register.error.unknown'));
        }
      } else {
        setServerError(t('register.error.unknown'));
      }
    } finally {
      setSubmitting(false);
    }
  }

  // Step 1 — Tenant Info
  if (step === 0) {
    return (
      <div className="flex flex-col gap-6">
        <Stepper current={step} steps={steps} />
        {serverError ? <ErrorBanner message={serverError} /> : null}
        <form onSubmit={tenantForm.handleSubmit(onStep1Submit)} className="flex flex-col gap-4" noValidate>
          <Field
            label={t('register.contactName')}
            required
            error={translateFieldError(t, tenantForm.formState.errors.contactName?.message)}
          >
            <input {...tenantForm.register('contactName')} autoComplete="name" className={inputCls} style={inputStyle()} {...inputFocusHandlers()} />
          </Field>
          <Field
            label={t('register.phoneCity')}
            required
            error={translateFieldError(t, tenantForm.formState.errors.phoneCity?.message)}
          >
            <input {...tenantForm.register('phoneCity')} autoComplete="tel" className={inputCls} style={inputStyle()} {...inputFocusHandlers()} />
          </Field>
          <Field
            label={t('register.mobile')}
            description={t('register.mobileHint')}
            error={translateFieldError(t, tenantForm.formState.errors.mobile?.message)}
          >
            <input
              type="tel"
              autoComplete="tel"
              {...tenantForm.register('mobile')}
              className={inputCls}
              style={inputStyle()}
              {...inputFocusHandlers()}
            />
          </Field>
          <Field
            label={t('register.address')}
            required
            error={translateFieldError(t, tenantForm.formState.errors.address?.message)}
          >
            <input {...tenantForm.register('address')} autoComplete="street-address" className={inputCls} style={inputStyle()} {...inputFocusHandlers()} />
          </Field>
          <Field
            label={t('register.taxId')}
            required
            description={t('register.taxIdHint')}
            error={translateFieldError(t, tenantForm.formState.errors.taxId?.message)}
          >
            <input {...tenantForm.register('taxId')} autoComplete="off" className={inputCls} style={inputStyle()} {...inputFocusHandlers()} />
          </Field>
          <Field
            label={t('register.name')}
            required
            error={translateFieldError(t, tenantForm.formState.errors.name?.message)}
          >
            <input {...tenantForm.register('name')} autoComplete="organization" className={inputCls} style={inputStyle()} {...inputFocusHandlers()} />
          </Field>
          <Field
            label={t('register.invoiceAddress')}
            required
            error={translateFieldError(t, tenantForm.formState.errors.invoiceAddress?.message)}
          >
            <input {...tenantForm.register('invoiceAddress')} autoComplete="street-address" className={inputCls} style={inputStyle()} {...inputFocusHandlers()} />
          </Field>
          <SubmitButton fullWidth>{t('register.next')}</SubmitButton>
        </form>
      </div>
    );
  }

  // Step 2 — Account Info
  if (step === 1) {
    return (
      <div className="flex flex-col gap-6">
        <Stepper current={step} steps={steps} />
        {serverError ? <ErrorBanner message={serverError} /> : null}
        <form onSubmit={accountForm.handleSubmit(onStep2Submit)} className="flex flex-col gap-4" noValidate>
          <Field
            label={t('register.accountEmail')}
            required
            error={
              serverFieldErrors.email
                ?? (accountForm.formState.errors.email?.message ? t('validation.email') : undefined)
            }
          >
            <input type="email" autoComplete="email" {...accountForm.register('email')} className={inputCls} style={inputStyle()} {...inputFocusHandlers()} />
          </Field>
          <PasswordField
            label={t('register.password')}
            autoComplete="new-password"
            required
            {...accountForm.register('password')}
            error={
              serverFieldErrors.password
                ?? (accountForm.formState.errors.password?.message ? t('validation.passwordTooShort') : undefined)
            }
          />
          <PasswordField
            label={t('register.confirmPassword')}
            autoComplete="new-password"
            required
            {...accountForm.register('confirmPassword')}
            error={
              serverFieldErrors.confirmPassword
                ?? (accountForm.formState.errors.confirmPassword?.message ? t('validation.passwordMismatch') : undefined)
            }
          />
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onBackToStep1}
              className="min-h-[44px] flex-1 rounded border px-4 py-2 text-sm transition-colors hover:opacity-80"
              style={{
                borderColor: 'var(--color-border)',
                backgroundColor: 'transparent',
                color: 'var(--color-foreground)',
              }}
            >
              {t('register.back')}
            </button>
            <SubmitButton fullWidth>{t('register.next')}</SubmitButton>
          </div>
        </form>
      </div>
    );
  }

  // Step 3 — Plan Selection
  return (
    <div className="flex flex-col gap-6">
      <Stepper current={step} steps={steps} />
      {serverError ? <ErrorBanner message={serverError} /> : null}
      <PlanSelector selectedPlan={selectedPlan} onSelect={setSelectedPlan} />
      <div className="flex flex-col gap-3 sm:flex-row">
        <button
          type="button"
          onClick={onBackToStep2}
          className="min-h-[44px] flex-1 rounded border px-4 py-2 text-sm transition-colors hover:opacity-80"
          style={{
            borderColor: 'var(--color-border)',
            backgroundColor: 'transparent',
            color: 'var(--color-foreground)',
          }}
        >
          {t('register.back')}
        </button>
        <button
          type="button"
          onClick={onStep3Submit}
          disabled={!selectedPlan || submitting}
          className="min-h-[44px] flex-1 rounded px-4 py-2 text-sm font-medium transition-colors disabled:opacity-50"
          style={{
            backgroundColor: selectedPlan ? 'var(--color-primary)' : 'var(--color-muted)',
            color: selectedPlan ? 'var(--color-on-primary)' : 'var(--color-muted-foreground)',
          }}
        >
          {submitting ? t('register.submitting') : !selectedPlan ? t('register.error.planRequired') : t('register.submit')}
        </button>
      </div>
    </div>
  );
}

const inputCls =
  'min-h-[44px] w-full rounded px-3 py-2 text-base outline-none transition-colors focus:ring-2';

function inputStyle(disabled?: boolean): React.CSSProperties {
  return {
    border: '1px solid var(--color-border)',
    backgroundColor: disabled ? 'var(--color-muted)' : 'var(--color-muted)',
    color: 'var(--color-foreground)',
    opacity: disabled ? 0.6 : 1,
  };
}

function inputFocusHandlers() {
  return {
    onFocus: (e: React.FocusEvent<HTMLInputElement>) => {
      e.currentTarget.style.borderColor = 'var(--color-ring)';
      e.currentTarget.style.boxShadow = '0 0 0 2px var(--color-ring)';
    },
    onBlur: (e: React.FocusEvent<HTMLInputElement>) => {
      e.currentTarget.style.borderColor = 'var(--color-border)';
      e.currentTarget.style.boxShadow = 'none';
    },
  };
}

export default RegisterForm;
